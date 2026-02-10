import { glob } from 'glob'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import pc from 'picocolors'
import { readCsvFile } from './csv.js'
import { TranslationRecord, TypekitI18nConfig } from './types.js'

const requiredHeaders = ['key', 'description'] as const

const quote = (value: string): string => JSON.stringify(value)

const toTypeUnion = (values: ReadonlyArray<string>): string =>
  values.length === 0 ? 'never' : values.map((value) => quote(value)).join(' | ')

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

const validateRow = <TLanguage extends string>(
  row: Record<string, string>,
  rowIndex: number,
  filePath: string,
  languages: ReadonlyArray<TLanguage>,
  defaultLanguage: TLanguage
): TranslationRecord<TLanguage> => {
  requiredHeaders.forEach((header) => {
    if (!row[header] || row[header].length === 0) {
      throw new Error(`Missing "${header}" in ${filePath} at row ${rowIndex + 2}.`)
    }
  })

  const key = row.key
  const description = row.description
  const values: Record<TLanguage, string> = {} as Record<TLanguage, string>

  languages.forEach((language) => {
    const languageValue = row[language]
    if (typeof languageValue !== 'string') {
      throw new Error(
        `Missing language column "${language}" in ${filePath} at row ${rowIndex + 2}.`
      )
    }
    if (language === defaultLanguage && languageValue.length === 0) {
      throw new Error(
        `Missing value for default language "${defaultLanguage}" in ${filePath} at row ${rowIndex + 2}.`
      )
    }
    values[language] = languageValue
  })

  return {
    key,
    description,
    values,
  }
}

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
 * Generates typed translation table output from CSV resources.
 *
 * @param config Generation configuration.
 * @returns Absolute output path and number of generated keys.
 */
export const generateTranslationTable = async <TLanguage extends string>(
  config: TypekitI18nConfig<TLanguage>
): Promise<{ outputPath: string; outputKeysPath: string; keyCount: number }> => {
  validateLanguageConfig(config)

  const inputPatterns = Array.isArray(config.input) ? config.input : [config.input]
  const files = await resolveInputFiles(inputPatterns)

  if (files.length === 0) {
    throw new Error(`No translation files matched input pattern(s): ${inputPatterns.join(', ')}`)
  }

  const keySet = new Set<string>()
  const records: TranslationRecord<TLanguage>[] = []

  for (const filePath of files) {
    const rows = await readCsvFile(filePath)
    rows.forEach((row, rowIndex) => {
      const record = validateRow(row, rowIndex, filePath, config.languages, config.defaultLanguage)
      if (keySet.has(record.key)) {
        throw new Error(
          `Duplicate key "${record.key}" found in ${filePath} at row ${rowIndex + 2}.`
        )
      }
      keySet.add(record.key)
      records.push(record)
    })
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
