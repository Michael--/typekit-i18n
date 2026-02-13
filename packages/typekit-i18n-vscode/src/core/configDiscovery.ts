import { constants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import * as vscode from 'vscode'
import { parse as parseYaml } from 'yaml'

const DEFAULT_TRANSLATION_GLOBS = ['**/translations/**/*.{yaml,yml,csv}'] as const
const EXCLUDE_GLOB = '**/{node_modules,dist,build,.git}/**'
const CONFIG_FILE_CANDIDATES = [
  'typekit.config.ts',
  'typekit.config.json',
  'typekit.config.yaml',
  'typekit.config.yml',
  'typekit-i18n.config.ts',
  'typekit-i18n.config.json',
  'typekit-i18n.config.yaml',
  'typekit-i18n.config.yml',
] as const

const TS_MODULE_CONFIG_EXTENSIONS = new Set<string>(['.ts', '.mts', '.cts'])
const JS_MODULE_CONFIG_EXTENSIONS = new Set<string>(['.js', '.mjs', '.cjs'])
const YAML_CONFIG_EXTENSIONS = new Set<string>(['.yaml', '.yml'])

interface LoadedTypekitConfig {
  readonly configPath: string
  readonly inputPatterns: readonly string[]
}

/**
 * Translation discovery resolution details for extension status output.
 */
export interface TranslationDiscoveryStatus {
  /**
   * Final glob list used for file indexing.
   */
  readonly effectiveGlobs: readonly string[]
  /**
   * User-configured glob list from VSCode settings.
   */
  readonly configuredGlobs: readonly string[]
  /**
   * Glob list inferred from discovered typekit config `input` entries.
   */
  readonly configGlobs: readonly string[]
  /**
   * Successfully loaded config file paths.
   */
  readonly loadedConfigPaths: readonly string[]
  /**
   * Non-fatal discovery warnings.
   */
  readonly discoveryWarnings: readonly string[]
}

/**
 * Glob patterns used to watch for typekit config changes.
 */
export const TYPEKIT_CONFIG_DISCOVERY_GLOBS: readonly string[] = CONFIG_FILE_CANDIDATES.map(
  (candidate) => `**/${candidate}`
)

const toUniqueGlobs = (globs: ReadonlyArray<string>): readonly string[] =>
  [...new Set(globs)].sort((left, right) => left.localeCompare(right))

const normalizeGlob = (value: string): string => {
  const normalized = value.replace(/\\/g, '/').trim()
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

const isInsideWorkspaceRoot = (relativePath: string): boolean =>
  relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)

const hasReadableFile = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

const toConfigObject = (value: unknown, configPath: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Configuration "${configPath}" must export an object.`)
  }
  return value as Record<string, unknown>
}

const toInputPatterns = (config: Record<string, unknown>): readonly string[] => {
  const inputValue = config.input
  if (typeof inputValue === 'string') {
    const trimmedInput = inputValue.trim()
    return trimmedInput.length > 0 ? [trimmedInput] : []
  }
  if (!Array.isArray(inputValue)) {
    return []
  }

  const patterns: string[] = []
  inputValue.forEach((item) => {
    if (typeof item !== 'string') {
      return
    }
    const trimmedInput = item.trim()
    if (trimmedInput.length === 0) {
      return
    }
    patterns.push(trimmedInput)
  })
  return patterns
}

const decodeSimpleEscape = (escapedCharacter: string): string => {
  if (escapedCharacter === 'n') {
    return '\n'
  }
  if (escapedCharacter === 'r') {
    return '\r'
  }
  if (escapedCharacter === 't') {
    return '\t'
  }
  if (escapedCharacter === 'b') {
    return '\b'
  }
  if (escapedCharacter === 'f') {
    return '\f'
  }
  if (escapedCharacter === 'v') {
    return '\v'
  }
  if (escapedCharacter === '\\') {
    return '\\'
  }
  if (escapedCharacter === "'") {
    return "'"
  }
  if (escapedCharacter === '"') {
    return '"'
  }
  if (escapedCharacter === '`') {
    return '`'
  }
  return escapedCharacter
}

const decodeSingleOrTemplateLiteral = (literal: string, quote: "'" | '`'): string | null => {
  const body = literal.slice(1, -1)
  if (quote === '`' && body.includes('${')) {
    return null
  }

  let decoded = ''
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character !== '\\') {
      decoded += character
      continue
    }
    if (index + 1 >= body.length) {
      return null
    }
    const escapedCharacter = body[index + 1]
    decoded += decodeSimpleEscape(escapedCharacter)
    index += 1
  }
  return decoded
}

const decodeStringLiteral = (literal: string): string | null => {
  if (literal.length < 2) {
    return null
  }

  const quote = literal[0]
  if (quote === '"') {
    try {
      const parsed = JSON.parse(literal) as unknown
      return typeof parsed === 'string' ? parsed : null
    } catch {
      return null
    }
  }
  if (quote === "'") {
    return decodeSingleOrTemplateLiteral(literal, "'")
  }
  if (quote === '`') {
    return decodeSingleOrTemplateLiteral(literal, '`')
  }
  return null
}

const readQuotedLiteral = (source: string, startIndex: number): string | null => {
  const quote = source[startIndex]
  if (quote !== "'" && quote !== '"' && quote !== '`') {
    return null
  }

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\\') {
      index += 1
      continue
    }
    if (character === quote) {
      return source.slice(startIndex, index + 1)
    }
  }
  return null
}

const skipLineComment = (source: string, startIndex: number): number => {
  for (let index = startIndex; index < source.length; index += 1) {
    if (source[index] === '\n') {
      return index
    }
  }
  return source.length
}

const skipBlockComment = (source: string, startIndex: number): number | null => {
  const endIndex = source.indexOf('*/', startIndex + 2)
  if (endIndex < 0) {
    return null
  }
  return endIndex + 1
}

const readArrayLiteral = (source: string, startIndex: number): string | null => {
  if (source[startIndex] !== '[') {
    return null
  }

  let depth = 0
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index]
    if (character === "'" || character === '"' || character === '`') {
      const quoted = readQuotedLiteral(source, index)
      if (!quoted) {
        return null
      }
      index += quoted.length - 1
      continue
    }
    if (character === '/' && source[index + 1] === '/') {
      index = skipLineComment(source, index + 2)
      continue
    }
    if (character === '/' && source[index + 1] === '*') {
      const commentEndIndex = skipBlockComment(source, index)
      if (commentEndIndex === null) {
        return null
      }
      index = commentEndIndex
      continue
    }

    if (character === '[') {
      depth += 1
      continue
    }
    if (character === ']') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }
  return null
}

const skipWhitespace = (source: string, startIndex: number): number => {
  let index = startIndex
  while (index < source.length && /\s/u.test(source[index])) {
    index += 1
  }
  return index
}

const readInputExpression = (source: string, startIndex: number): string | null => {
  const valueStartIndex = skipWhitespace(source, startIndex)
  if (valueStartIndex >= source.length) {
    return null
  }

  const firstCharacter = source[valueStartIndex]
  if (firstCharacter === '[') {
    return readArrayLiteral(source, valueStartIndex)
  }
  if (firstCharacter === "'" || firstCharacter === '"' || firstCharacter === '`') {
    return readQuotedLiteral(source, valueStartIndex)
  }
  return null
}

const extractInputExpression = (source: string): string | null => {
  const inputPropertyPattern = /\binput\s*:/gu
  let match: RegExpExecArray | null = inputPropertyPattern.exec(source)
  while (match) {
    const expression = readInputExpression(source, match.index + match[0].length)
    if (expression) {
      return expression
    }
    match = inputPropertyPattern.exec(source)
  }
  return null
}

const parseInputPatternsFromArrayLiteral = (arrayLiteral: string): readonly string[] => {
  const patterns: string[] = []
  const bodyStartIndex = arrayLiteral.indexOf('[') + 1
  const bodyEndIndex = arrayLiteral.lastIndexOf(']')
  if (bodyStartIndex <= 0 || bodyEndIndex < bodyStartIndex) {
    return []
  }

  let index = bodyStartIndex
  while (index < bodyEndIndex) {
    const nextIndex = skipWhitespace(arrayLiteral, index)
    if (nextIndex >= bodyEndIndex) {
      break
    }
    const character = arrayLiteral[nextIndex]
    if (character === ',') {
      index = nextIndex + 1
      continue
    }
    if (character !== "'" && character !== '"' && character !== '`') {
      return []
    }

    const literal = readQuotedLiteral(arrayLiteral, nextIndex)
    if (!literal) {
      return []
    }
    const decoded = decodeStringLiteral(literal)
    if (typeof decoded !== 'string') {
      return []
    }
    const normalized = decoded.trim()
    if (normalized.length > 0) {
      patterns.push(normalized)
    }
    index = nextIndex + literal.length
  }

  return patterns
}

const parseInputPatternsFromExpression = (expression: string): readonly string[] => {
  const trimmedExpression = expression.trim()
  if (trimmedExpression.length < 2) {
    return []
  }
  if (trimmedExpression.startsWith('[')) {
    return parseInputPatternsFromArrayLiteral(trimmedExpression)
  }

  const decoded = decodeStringLiteral(trimmedExpression)
  if (typeof decoded !== 'string') {
    return []
  }
  const normalized = decoded.trim()
  return normalized.length > 0 ? [normalized] : []
}

const loadInputPatternsFromModuleConfig = async (
  configPath: string
): Promise<readonly string[]> => {
  const content = await readFile(configPath, 'utf8')
  const inputExpression = extractInputExpression(content)
  if (!inputExpression) {
    throw new Error('Could not statically resolve "input" from module config.')
  }
  const parsedPatterns = parseInputPatternsFromExpression(inputExpression)
  if (parsedPatterns.length === 0) {
    throw new Error('Could not parse "input" as a static string or string array.')
  }
  return parsedPatterns
}

const loadInputPatternsFromJsonConfig = async (configPath: string): Promise<readonly string[]> => {
  const content = await readFile(configPath, 'utf8')
  try {
    const parsed = toConfigObject(JSON.parse(content) as unknown, configPath)
    return toInputPatterns(parsed)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON configuration "${configPath}": ${message}`)
  }
}

const loadInputPatternsFromYamlConfig = async (configPath: string): Promise<readonly string[]> => {
  const content = await readFile(configPath, 'utf8')
  try {
    const parsed = toConfigObject(parseYaml(content) as unknown, configPath)
    return toInputPatterns(parsed)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid YAML configuration "${configPath}": ${message}`)
  }
}

const loadInputPatternsFromPath = async (configPath: string): Promise<readonly string[]> => {
  const extension = extname(configPath).toLowerCase()

  if (TS_MODULE_CONFIG_EXTENSIONS.has(extension) || JS_MODULE_CONFIG_EXTENSIONS.has(extension)) {
    return loadInputPatternsFromModuleConfig(configPath)
  }
  if (extension === '.json') {
    return loadInputPatternsFromJsonConfig(configPath)
  }
  if (YAML_CONFIG_EXTENSIONS.has(extension)) {
    return loadInputPatternsFromYamlConfig(configPath)
  }

  throw new Error(`Unsupported configuration extension "${extension}" for "${configPath}".`)
}

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const discoverConfigUris = async (): Promise<readonly vscode.Uri[]> => {
  const configUrisByPath = new Map<string, vscode.Uri>()

  await Promise.all(
    CONFIG_FILE_CANDIDATES.map(async (candidate) => {
      const uris = await vscode.workspace.findFiles(`**/${candidate}`, EXCLUDE_GLOB)
      uris.forEach((uri) => {
        if (basename(uri.fsPath) !== candidate) {
          return
        }
        configUrisByPath.set(uri.fsPath, uri)
      })
    })
  )

  return [...configUrisByPath.values()].sort((left, right) =>
    left.fsPath.localeCompare(right.fsPath)
  )
}

interface ConfigLoadOutcome {
  readonly loadedConfigs: readonly LoadedTypekitConfig[]
  readonly warnings: readonly string[]
}

const loadDiscoveredConfigs = async (): Promise<ConfigLoadOutcome> => {
  const configUris = await discoverConfigUris()
  const warnings: string[] = []
  const loadedConfigs = await Promise.all(
    configUris.map(async (uri) => {
      const configPath = uri.fsPath
      if (!(await hasReadableFile(configPath))) {
        warnings.push(`Ignored unreadable config file "${configPath}".`)
        return null
      }

      try {
        const inputPatterns = await loadInputPatternsFromPath(configPath)
        return {
          configPath,
          inputPatterns,
        }
      } catch (error: unknown) {
        warnings.push(`Ignored invalid config "${configPath}": ${formatErrorMessage(error)}`)
        return null
      }
    })
  )

  return {
    loadedConfigs: loadedConfigs.filter((item): item is LoadedTypekitConfig => item !== null),
    warnings,
  }
}

const toWorkspaceGlob = (configPath: string, inputPattern: string): string | null => {
  const normalizedInput = normalizeGlob(inputPattern)
  if (normalizedInput.length === 0) {
    return null
  }

  const configUri = vscode.Uri.file(configPath)
  const workspaceFolder =
    typeof vscode.workspace.getWorkspaceFolder === 'function'
      ? vscode.workspace.getWorkspaceFolder(configUri)
      : undefined
  if (!workspaceFolder) {
    return normalizedInput
  }

  const configDirectory = dirname(configPath)
  const absoluteInputPath = isAbsolute(normalizedInput)
    ? normalizedInput
    : resolve(configDirectory, normalizedInput)
  const relativeInputPath = normalizeGlob(relative(workspaceFolder.uri.fsPath, absoluteInputPath))
  if (!isInsideWorkspaceRoot(relativeInputPath)) {
    return null
  }

  return relativeInputPath
}

const readConfiguredTranslationGlobs = (): readonly string[] => {
  const configuredGlobs = vscode.workspace
    .getConfiguration('typekitI18n')
    .get<readonly string[]>('translationGlobs', DEFAULT_TRANSLATION_GLOBS)

  return toUniqueGlobs(
    configuredGlobs
      .map((globPattern) => normalizeGlob(globPattern))
      .filter((globPattern) => globPattern.length > 0)
  )
}

/**
 * Resolves translation discovery globs together with status metadata.
 *
 * @returns Effective globs and discovery metadata for diagnostics/status output.
 */
export const resolveEffectiveTranslationGlobsStatus =
  async (): Promise<TranslationDiscoveryStatus> => {
    const configuredGlobs = readConfiguredTranslationGlobs()
    const loadedConfigOutcome = await loadDiscoveredConfigs()
    const configGlobs: string[] = []
    const warnings = [...loadedConfigOutcome.warnings]

    loadedConfigOutcome.loadedConfigs.forEach((loadedConfig) => {
      if (loadedConfig.inputPatterns.length === 0) {
        warnings.push(`Config "${loadedConfig.configPath}" has no valid "input" entries.`)
        return
      }

      loadedConfig.inputPatterns.forEach((inputPattern) => {
        const resolvedGlob = toWorkspaceGlob(loadedConfig.configPath, inputPattern)
        if (!resolvedGlob) {
          warnings.push(
            `Ignored input "${inputPattern}" from "${loadedConfig.configPath}" because it resolves outside the workspace root.`
          )
          return
        }
        configGlobs.push(resolvedGlob)
      })
    })

    const uniqueConfigGlobs = toUniqueGlobs(configGlobs)
    const effectiveGlobs =
      uniqueConfigGlobs.length > 0
        ? toUniqueGlobs([...uniqueConfigGlobs, ...configuredGlobs])
        : configuredGlobs

    return {
      effectiveGlobs,
      configuredGlobs,
      configGlobs: uniqueConfigGlobs,
      loadedConfigPaths: loadedConfigOutcome.loadedConfigs
        .map((loadedConfig) => loadedConfig.configPath)
        .sort((left, right) => left.localeCompare(right)),
      discoveryWarnings: warnings.sort((left, right) => left.localeCompare(right)),
    }
  }

/**
 * Resolves translation discovery globs for the extension.
 *
 * Resolution order:
 * 1. `input` paths from discovered `typekit.config.*` / `typekit-i18n.config.*`
 * 2. `typekitI18n.translationGlobs` setting fallback
 *
 * @returns Unique workspace-relative glob list.
 */
export const resolveEffectiveTranslationGlobs = async (): Promise<readonly string[]> => {
  const discoveryStatus = await resolveEffectiveTranslationGlobsStatus()
  return discoveryStatus.effectiveGlobs
}
