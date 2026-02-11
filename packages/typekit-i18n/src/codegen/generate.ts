import { glob } from 'glob'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import pc from 'picocolors'
import { readCsvHeaders } from './csv.js'
import { toIrProjectFromCsvFile } from './ir/csv.js'
import { TranslationIrProject } from './ir/types.js'
import { toIrProjectFromYamlFile } from './ir/yaml.js'
import { TranslationInputFormat, TranslationRecord, TypekitI18nConfig } from './types.js'
import { parse as parseYaml } from 'yaml'

const quote = (value: string): string => JSON.stringify(value)
const CSV_BASE_COLUMNS: ReadonlySet<string> = new Set(['key', 'description'])
const CSV_METADATA_COLUMNS: ReadonlySet<string> = new Set(['status', 'tags', 'placeholders'])

const toTypeUnion = (values: ReadonlyArray<string>): string =>
  values.length === 0 ? 'never' : values.map((value) => quote(value)).join(' | ')

const toCombinedErrorMessage = (errors: ReadonlyArray<string>): string => {
  if (errors.length === 1) {
    return errors[0]
  }
  const lines = errors.map((error) => `- ${error.split('\n').join('\n  ')}`)
  return `Generation failed with ${errors.length} error(s):\n${lines.join('\n')}`
}

const normalizeLanguageList = (languages: ReadonlyArray<string>): ReadonlyArray<string> =>
  Array.from(
    new Set(languages.map((language) => language.trim()).filter((language) => language.length > 0))
  )

const isLikelyLanguageCode = (value: string): boolean =>
  /^[A-Za-z]{2}(?:-[A-Za-z0-9_]+)?$/.test(value)

const toLanguageDeclarationMismatchMessage = (
  scope: string,
  declaredLanguages: ReadonlyArray<string>,
  configuredLanguages: ReadonlyArray<string>
): string | null => {
  const missingConfigured = configuredLanguages.filter(
    (language) => !declaredLanguages.includes(language)
  )
  const unconfigured = declaredLanguages.filter(
    (language) => !configuredLanguages.includes(language)
  )

  if (missingConfigured.length === 0 && unconfigured.length === 0) {
    return null
  }

  const details: string[] = []
  if (missingConfigured.length > 0) {
    details.push(`missing configured language(s): ${missingConfigured.join(', ')}`)
  }
  if (unconfigured.length > 0) {
    details.push(`unconfigured language(s): ${unconfigured.join(', ')}`)
  }

  return `Language declaration mismatch in ${scope}: ${details.join('; ')}. Configured languages: ${configuredLanguages.join(', ')}. Declared languages: ${declaredLanguages.join(', ')}.`
}

const validateLanguageConfig = <TLanguage extends string>(
  config: TypekitI18nConfig<TLanguage>
): void => {
  if (config.languages.length === 0) {
    throw new Error('Invalid configuration: "languages" must include at least one language.')
  }

  if (new Set(config.languages).size !== config.languages.length) {
    throw new Error('Invalid configuration: "languages" must not contain duplicate entries.')
  }

  if (!config.languages.includes(config.defaultLanguage)) {
    throw new Error(
      `Invalid configuration: default language "${config.defaultLanguage}" is not part of "languages".`
    )
  }
}

const normalizeCsvIrErrorMessage = (message: string): string =>
  message.replace(/source language/g, 'default language')

const validateCsvLanguageDeclaration = async <TLanguage extends string>(
  filePath: string,
  config: TypekitI18nConfig<TLanguage>
): Promise<void> => {
  const headers = await readCsvHeaders(filePath)
  const declaredLanguages = normalizeLanguageList(
    headers.filter((header) => {
      if (CSV_BASE_COLUMNS.has(header) || CSV_METADATA_COLUMNS.has(header)) {
        return false
      }
      return config.languages.includes(header as TLanguage) || isLikelyLanguageCode(header)
    })
  )

  const mismatchMessage = toLanguageDeclarationMismatchMessage(
    `${filePath} header`,
    declaredLanguages,
    config.languages
  )
  if (mismatchMessage) {
    throw new Error(mismatchMessage)
  }
}

const readYamlDeclaredLanguages = async (
  filePath: string
): Promise<ReadonlyArray<string> | null> => {
  try {
    const content = await readFile(filePath, 'utf-8')
    const parsed = parseYaml(content) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const root = parsed as Record<string, unknown>
    const rawLanguages = root.languages
    if (!Array.isArray(rawLanguages)) {
      return null
    }

    const languages = rawLanguages.filter(
      (language): language is string => typeof language === 'string'
    )
    if (languages.length === 0) {
      return null
    }

    return normalizeLanguageList(languages)
  } catch {
    return null
  }
}

const validateYamlLanguageDeclaration = async <TLanguage extends string>(
  filePath: string,
  config: TypekitI18nConfig<TLanguage>
): Promise<void> => {
  const declaredLanguages = await readYamlDeclaredLanguages(filePath)
  if (!declaredLanguages) {
    return
  }

  const mismatchMessage = toLanguageDeclarationMismatchMessage(
    `${filePath} at "root.languages"`,
    declaredLanguages,
    config.languages
  )
  if (mismatchMessage) {
    throw new Error(mismatchMessage)
  }
}

const validateYamlProjectLanguageConfig = <TLanguage extends string>(
  project: TranslationIrProject<string>,
  config: TypekitI18nConfig<TLanguage>,
  filePath: string
): void => {
  if (project.sourceLanguage !== config.defaultLanguage) {
    throw new Error(
      `Source language mismatch in ${filePath}: config default language "${config.defaultLanguage}" does not match YAML source language "${project.sourceLanguage}".`
    )
  }

  const missingLanguages = config.languages.filter(
    (language) => !project.languages.includes(language)
  )
  if (missingLanguages.length > 0) {
    throw new Error(
      `YAML file ${filePath} is missing configured language(s): ${missingLanguages.join(', ')}.`
    )
  }

  const extraLanguages = project.languages.filter(
    (language) => !config.languages.includes(language as TLanguage)
  )
  if (extraLanguages.length > 0) {
    throw new Error(
      `YAML file ${filePath} contains unconfigured language(s): ${extraLanguages.join(', ')}.`
    )
  }
}

const inferInputFormatFromPath = (filePath: string): TranslationInputFormat => {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml'
  }
  return 'csv'
}

const loadProjectFromFile = async <TLanguage extends string>(
  filePath: string,
  format: TranslationInputFormat,
  config: TypekitI18nConfig<TLanguage>
): Promise<TranslationIrProject<string>> => {
  if (format === 'csv') {
    await validateCsvLanguageDeclaration(filePath, config)
    return toIrProjectFromCsvFile(filePath, {
      languages: config.languages,
      sourceLanguage: config.defaultLanguage,
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(normalizeCsvIrErrorMessage(message))
    })
  }

  await validateYamlLanguageDeclaration(filePath, config)
  const project = await toIrProjectFromYamlFile(filePath)
  validateYamlProjectLanguageConfig(project, config, filePath)
  return project
}

const toEntryLocation = (
  format: TranslationInputFormat,
  filePath: string,
  entryIndex: number
): string =>
  format === 'csv'
    ? `${filePath} at row ${entryIndex + 2}`
    : `${filePath} at entry ${entryIndex + 1}`

const toHeaderComment = (files: ReadonlyArray<string>): string => {
  const lines = files.map((file, index) => `[${index + 1}/${files.length}] "${file}"`)
  return `/*
   This file is generated.
   Source files:
   ${lines.join('\n   ')}
*/
// cspell:disable
`
}

const toKeysModuleSource = <TLanguage extends string>(
  files: ReadonlyArray<string>,
  records: ReadonlyArray<TranslationRecord<TLanguage>>,
  languages: ReadonlyArray<TLanguage>
): string => {
  const keyUnion = toTypeUnion(records.map((record) => record.key))
  const languageUnion = toTypeUnion(languages)

  return `${toHeaderComment(files)}
export type TranslateKey = ${keyUnion}
export type TranslateKeys = TranslateKey
export type TranslateLanguage = ${languageUnion}
`
}

const resolveTypeImportPath = (outputPath: string, outputKeysPath: string): string => {
  const relativePath = relative(dirname(outputPath), outputKeysPath)
  const normalizedPath = relativePath.split('\\').join('/')
  const withPrefix = normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`
  const extension = extname(withPrefix)
  const withoutExtension =
    extension.length > 0 ? withPrefix.slice(0, -extension.length) : withPrefix
  return `${withoutExtension}.js`
}

const toTableModuleSource = <TLanguage extends string>(
  files: ReadonlyArray<string>,
  records: ReadonlyArray<TranslationRecord<TLanguage>>,
  languages: ReadonlyArray<TLanguage>,
  typeImportPath: string
): string => {
  const recordSource = records
    .map((record) => {
      const languageLines = languages
        .map((language) => `    ${language}: ${quote(record.values[language])},`)
        .join('\n')

      return `  ${quote(record.key)}: {
    description: ${quote(record.description)},
${languageLines}
  },`
    })
    .join('\n')

  return `${toHeaderComment(files)}
export const translationTable = {
${recordSource}
} as const

export type { TranslateKey, TranslateKeys, TranslateLanguage } from ${quote(typeImportPath)}
`
}

const resolveInputFiles = async (
  inputPatterns: ReadonlyArray<string>
): Promise<ReadonlyArray<string>> => {
  const fileSet = new Set<string>()
  for (const pattern of inputPatterns) {
    const matches = await glob(pattern, { nodir: true })
    matches.sort().forEach((file) => fileSet.add(file))
  }
  return Array.from(fileSet.values()).sort()
}

/**
 * Generates typed translation table output from configured resources.
 *
 * @param config Generation configuration.
 * @returns Absolute output path and number of generated keys.
 */
export const generateTranslationTable = async <TLanguage extends string>(
  config: TypekitI18nConfig<TLanguage>
): Promise<{ outputPath: string; outputKeysPath: string; keyCount: number }> => {
  validateLanguageConfig(config)

  const configuredFormat = config.format
  const inputPatterns = Array.isArray(config.input) ? config.input : [config.input]
  const files = await resolveInputFiles(inputPatterns)

  if (files.length === 0) {
    throw new Error(`No translation files matched input pattern(s): ${inputPatterns.join(', ')}`)
  }

  const keySet = new Set<string>()
  const records: TranslationRecord<TLanguage>[] = []
  const errors: string[] = []

  for (const filePath of files) {
    const format = configuredFormat ?? inferInputFormatFromPath(filePath)
    let project: TranslationIrProject<string>
    try {
      project = await loadProjectFromFile(filePath, format, config)
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error))
      continue
    }

    project.entries.forEach((entry, entryIndex) => {
      if (keySet.has(entry.key)) {
        errors.push(
          `Duplicate key "${entry.key}" found in ${toEntryLocation(format, filePath, entryIndex)}.`
        )
        return
      }
      keySet.add(entry.key)
      const values = {} as Record<TLanguage, string>
      let hasLanguageError = false
      config.languages.forEach((language) => {
        const translated = entry.values[language]
        if (typeof translated !== 'string') {
          errors.push(
            `Missing language "${language}" in ${toEntryLocation(format, filePath, entryIndex)}.`
          )
          hasLanguageError = true
          return
        }
        values[language] = translated
      })
      if (hasLanguageError) {
        return
      }
      records.push({
        key: entry.key,
        description: entry.description,
        values,
      })
    })
  }

  if (errors.length > 0) {
    throw new Error(toCombinedErrorMessage(errors))
  }

  const outputPath = resolve(config.output)
  const outputKeysPath = resolve(
    config.outputKeys ?? join(dirname(outputPath), 'translationKeys.ts')
  )

  if (outputPath === outputKeysPath) {
    throw new Error(
      'Invalid configuration: "output" and "outputKeys" must not point to the same file.'
    )
  }

  await Promise.all([
    mkdir(dirname(outputPath), { recursive: true }),
    mkdir(dirname(outputKeysPath), { recursive: true }),
  ])

  const tableSource = toTableModuleSource(
    files,
    records,
    config.languages,
    resolveTypeImportPath(outputPath, outputKeysPath)
  )
  const keysSource = toKeysModuleSource(files, records, config.languages)

  await Promise.all([
    writeFile(outputPath, tableSource, 'utf-8'),
    writeFile(outputKeysPath, keysSource, 'utf-8'),
  ])

  process.stdout.write(
    `${pc.green(
      `Generated "${outputPath}" and "${outputKeysPath}" with ${records.length} keys.`
    )}\n`
  )

  return {
    outputPath,
    outputKeysPath,
    keyCount: records.length,
  }
}
