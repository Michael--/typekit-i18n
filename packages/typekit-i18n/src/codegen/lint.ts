import { glob } from 'glob'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { TypekitI18nConfig } from './types.js'
import { toIrProjectFromCsvFile } from './ir/csv.js'
import { toIrProjectFromJsonFile } from './ir/json.js'
import { toIrProjectFromYamlFile } from './ir/yaml.js'
import { TranslationInputFormat } from './types.js'

/**
 * Result entry for one dead key (defined but never used in source).
 */
export interface LintDeadKey {
  /**
   * Translation key.
   */
  key: string
  /**
   * Optional category.
   */
  category: string
}

/**
 * Result entry for one unmatched key (found in source but not defined).
 */
export interface LintUnmatchedKey {
  /**
   * String literal found in source.
   */
  value: string
  /**
   * Source file path relative to cwd.
   */
  file: string
}

/**
 * Full lint result.
 */
export interface LintResult {
  /**
   * Keys defined in translation resources but never found in source code.
   */
  deadKeys: ReadonlyArray<LintDeadKey>
  /**
   * String literals in source code that match no defined translation key.
   * Only reported when they look like potential translation keys.
   */
  unmatchedKeys: ReadonlyArray<LintUnmatchedKey>
  /**
   * Total defined keys.
   */
  definedKeyCount: number
  /**
   * Keys with at least one match in source code.
   */
  matchedKeyCount: number
}

/**
 * Options for linting.
 */
export interface LintOptions {
  /**
   * Source file glob patterns.
   */
  source: ReadonlyArray<string>
}

const inferFormatFromPath = (filePath: string): TranslationInputFormat => {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml'
  }
  if (extension === '.json') {
    return 'json'
  }
  return 'csv'
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts'])

/**
 * Simple key-like string heuristic: dot-separated or snake_case identifiers.
 * Excludes values with purely numeric segments (e.g. "cyan.2" from Tailwind).
 */
const isKeyLike = (value: string): boolean => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(value)) {
    return false
  }
  // Exclude values where any dot/underscore-separated segment is purely numeric
  const segments = value.split(/[._]/)
  return segments.every((segment) => !/^\d+$/.test(segment))
}

/**
 * Collects all defined translation keys from configured input files.
 *
 * @param config Generator config with input patterns.
 * @returns Array of key/category pairs.
 */
const collectDefinedKeys = async (
  config: TypekitI18nConfig
): Promise<ReadonlyArray<{ key: string; category: string }>> => {
  const inputPatterns = Array.isArray(config.input) ? config.input : [config.input]
  const files = await glob([...inputPatterns], { nodir: true })
  const results: { key: string; category: string }[] = []

  for (const filePath of files) {
    const format = config.format ?? inferFormatFromPath(filePath)
    let project
    if (format === 'csv') {
      project = await toIrProjectFromCsvFile(filePath, {
        languages: config.languages,
        sourceLanguage: config.defaultLanguage,
      })
    } else if (format === 'json') {
      project = await toIrProjectFromJsonFile(filePath)
    } else {
      project = await toIrProjectFromYamlFile(filePath)
    }

    for (const entry of project.entries) {
      results.push({
        key: entry.key,
        category: entry.category ?? 'default',
      })
    }
  }

  return results
}

/**
 * Scans source files for string literals and returns unique values.
 *
 * @param sourcePatterns Glob patterns for source files.
 * @returns Map of string literal to file where it was found.
 */
const scanSourceFiles = async (
  sourcePatterns: ReadonlyArray<string>
): Promise<Map<string, string>> => {
  const files = await glob([...sourcePatterns], { nodir: true })
  const sourceFiles = files.filter((file) => SOURCE_EXTENSIONS.has(extname(file).toLowerCase()))
  const found = new Map<string, string>()

  // Matches single-quoted and double-quoted string literals
  const stringLiteralPattern = /(["'])((?:(?!\1).|\\.)*?)\1/g

  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, 'utf-8')

    stringLiteralPattern.lastIndex = 0
    let match = stringLiteralPattern.exec(content)
    while (match) {
      const value = match[2]
      // Only track key-like strings to reduce noise
      if (isKeyLike(value) && value.length > 1 && value.length < 120) {
        const existing = found.get(value)
        if (!existing) {
          found.set(value, filePath)
        }
      }
      match = stringLiteralPattern.exec(content)
    }
  }

  return found
}

/**
 * Runs lint analysis: finds dead keys and unmatched keys.
 *
 * @param config Generator config with translation input patterns.
 * @param options Lint options with source patterns.
 * @returns Lint result with dead and unmatched keys.
 */
export const lintTranslations = async (
  config: TypekitI18nConfig,
  options: LintOptions
): Promise<LintResult> => {
  const definedKeys = await collectDefinedKeys(config)
  const sourceStrings = await scanSourceFiles(options.source)

  const definedKeySet = new Set(definedKeys.map((entry) => entry.key))
  const deadKeys: LintDeadKey[] = []
  const unmatchedKeys: LintUnmatchedKey[] = []
  let matchedKeyCount = 0

  for (const entry of definedKeys) {
    if (sourceStrings.has(entry.key)) {
      matchedKeyCount += 1
    } else {
      deadKeys.push({ key: entry.key, category: entry.category })
    }
  }

  for (const [value, file] of sourceStrings) {
    if (!definedKeySet.has(value)) {
      // Only report key-like strings that aren't common JS/TS identifiers
      if (value.includes('.') || value.includes('_')) {
        unmatchedKeys.push({ value, file })
      }
    }
  }

  return {
    deadKeys: deadKeys.sort((a, b) => a.key.localeCompare(b.key)),
    unmatchedKeys: unmatchedKeys.sort((a, b) => a.value.localeCompare(b.value)),
    definedKeyCount: definedKeys.length,
    matchedKeyCount,
  }
}
