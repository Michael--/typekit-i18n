import { glob } from 'glob'
import { dirname, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import pc from 'picocolors'
import { readCsvFile } from './csv.js'
import { TranslationRecord, TypekitI18nConfig } from './types.js'

const requiredHeaders = ['key', 'description'] as const

const quote = (value: string): string => JSON.stringify(value)

const validateLanguageConfig = <TLanguage extends string>(
  config: TypekitI18nConfig<TLanguage>
): void => {
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
  languages: ReadonlyArray<TLanguage>
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

const toTypeModuleSource = <TLanguage extends string>(
  files: ReadonlyArray<string>,
  records: ReadonlyArray<TranslationRecord<TLanguage>>,
  languages: ReadonlyArray<TLanguage>
): string => {
  const languageUnion = languages.map((language) => quote(language)).join(' | ')

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

export type TranslateKey = keyof typeof translationTable
export type TranslateLanguage = ${languageUnion}
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
): Promise<{ outputPath: string; keyCount: number }> => {
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
      const record = validateRow(row, rowIndex, filePath, config.languages)
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
  const outputDir = dirname(outputPath)
  await mkdir(outputDir, { recursive: true })
  const source = toTypeModuleSource(files, records, config.languages)
  await writeFile(outputPath, source, 'utf-8')
  process.stdout.write(`${pc.green(`Generated "${outputPath}" with ${records.length} keys.`)}\n`)

  return {
    outputPath,
    keyCount: records.length,
  }
}
