import { constants } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'
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
  readonly config: Record<string, unknown>
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

const loadConfigFromModule = async (
  configPath: string,
  isTypeScriptModule: boolean
): Promise<Record<string, unknown>> => {
  const moduleUrl = pathToFileURL(configPath)
  try {
    const fileStats = await stat(configPath)
    moduleUrl.searchParams.set('mtime', String(fileStats.mtimeMs))
  } catch {
    // Ignore mtime resolution errors and keep URL without cache-busting params.
  }

  const imported = isTypeScriptModule
    ? ((await tsImport(moduleUrl.toString(), import.meta.url)) as { default?: unknown })
    : ((await import(moduleUrl.toString())) as { default?: unknown })
  if (imported.default === undefined) {
    throw new Error(`Configuration "${configPath}" must export a default object.`)
  }
  return toConfigObject(imported.default, configPath)
}

const loadConfigFromJson = async (configPath: string): Promise<Record<string, unknown>> => {
  const content = await readFile(configPath, 'utf8')
  try {
    return toConfigObject(JSON.parse(content) as unknown, configPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON configuration "${configPath}": ${message}`)
  }
}

const loadConfigFromYaml = async (configPath: string): Promise<Record<string, unknown>> => {
  const content = await readFile(configPath, 'utf8')
  try {
    return toConfigObject(parseYaml(content) as unknown, configPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid YAML configuration "${configPath}": ${message}`)
  }
}

const loadConfigFromPath = async (configPath: string): Promise<Record<string, unknown>> => {
  const extension = extname(configPath).toLowerCase()

  if (TS_MODULE_CONFIG_EXTENSIONS.has(extension)) {
    return loadConfigFromModule(configPath, true)
  }
  if (JS_MODULE_CONFIG_EXTENSIONS.has(extension)) {
    return loadConfigFromModule(configPath, false)
  }
  if (extension === '.json') {
    return loadConfigFromJson(configPath)
  }
  if (YAML_CONFIG_EXTENSIONS.has(extension)) {
    return loadConfigFromYaml(configPath)
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
        return {
          configPath,
          config: await loadConfigFromPath(configPath),
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
      const inputPatterns = toInputPatterns(loadedConfig.config)
      if (inputPatterns.length === 0) {
        warnings.push(`Config "${loadedConfig.configPath}" has no valid "input" entries.`)
        return
      }

      inputPatterns.forEach((inputPattern) => {
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
