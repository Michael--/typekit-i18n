import { readCsvFile } from '../csv.js'
import { TranslationCsvRow } from '../types.js'
import {
  TranslationIrEntry,
  TranslationIrEntryStatus,
  TranslationIrPlaceholder,
  TranslationIrPlaceholderType,
  TranslationIrProject,
} from './types.js'

const STATUS_COLUMN = 'status'
const TAGS_COLUMN = 'tags'
const PLACEHOLDERS_COLUMN = 'placeholders'

const allowedPlaceholderTypes: ReadonlySet<TranslationIrPlaceholderType> = new Set([
  'string',
  'number',
  'boolean',
  'date',
  'currency',
])

const allowedStatuses: ReadonlySet<TranslationIrEntryStatus> = new Set([
  'draft',
  'review',
  'approved',
])

/**
 * Options for converting CSV resources into IR.
 */
export interface CsvToIrOptions<TLanguage extends string = string> {
  /**
   * Supported language columns expected in rows.
   */
  languages: ReadonlyArray<TLanguage>
  /**
   * Source/default language key.
   */
  sourceLanguage: TLanguage
  /**
   * Optional source file path used in validation messages.
   */
  filePath?: string
  /**
   * Optional status column name.
   * Defaults to `status`.
   */
  statusColumn?: string
  /**
   * Optional tags column name.
   * Defaults to `tags`.
   */
  tagsColumn?: string
  /**
   * Optional placeholders column name.
   * Defaults to `placeholders`.
   */
  placeholdersColumn?: string
}

const toLocation = (rowIndex: number, filePath?: string): string =>
  filePath ? `${filePath} at row ${rowIndex + 2}` : `row ${rowIndex + 2}`

const parseStatus = (
  row: TranslationCsvRow,
  rowIndex: number,
  locationPath: string | undefined,
  statusColumn: string
): TranslationIrEntryStatus | undefined => {
  const statusValue = row[statusColumn]
  if (typeof statusValue !== 'string' || statusValue.trim().length === 0) {
    return undefined
  }

  const normalized = statusValue.trim().toLowerCase() as TranslationIrEntryStatus
  if (!allowedStatuses.has(normalized)) {
    throw new Error(
      `Invalid status "${statusValue}" in ${toLocation(rowIndex, locationPath)}. Allowed: draft, review, approved.`
    )
  }

  return normalized
}

const parseTags = (
  row: TranslationCsvRow,
  tagsColumn: string
): ReadonlyArray<string> | undefined => {
  const tagsValue = row[tagsColumn]
  if (typeof tagsValue !== 'string' || tagsValue.trim().length === 0) {
    return undefined
  }

  const parsed = tagsValue
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

  return parsed.length > 0 ? parsed : undefined
}

const parsePlaceholderType = (
  candidate: string,
  rowIndex: number,
  locationPath: string | undefined
): TranslationIrPlaceholderType => {
  const normalized = candidate.trim().toLowerCase() as TranslationIrPlaceholderType
  if (!allowedPlaceholderTypes.has(normalized)) {
    throw new Error(
      `Invalid placeholder type "${candidate}" in ${toLocation(rowIndex, locationPath)}.`
    )
  }
  return normalized
}

const parsePlaceholders = (
  row: TranslationCsvRow,
  rowIndex: number,
  locationPath: string | undefined,
  placeholdersColumn: string
): ReadonlyArray<TranslationIrPlaceholder> | undefined => {
  const placeholdersValue = row[placeholdersColumn]
  if (typeof placeholdersValue !== 'string' || placeholdersValue.trim().length === 0) {
    return undefined
  }

  const placeholders: TranslationIrPlaceholder[] = []
  const seenNames = new Set<string>()
  const definitions = placeholdersValue
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  definitions.forEach((definition) => {
    const parts = definition.split(':').map((part) => part.trim())
    if (parts.length === 0 || parts.length > 3) {
      throw new Error(
        `Invalid placeholder definition "${definition}" in ${toLocation(rowIndex, locationPath)}.`
      )
    }

    const [name, typeCandidate, formatHintCandidate] = parts
    if (!name || name.length === 0) {
      throw new Error(
        `Invalid placeholder definition "${definition}" in ${toLocation(rowIndex, locationPath)}.`
      )
    }

    if (seenNames.has(name)) {
      throw new Error(`Duplicate placeholder "${name}" in ${toLocation(rowIndex, locationPath)}.`)
    }
    seenNames.add(name)

    const placeholder: TranslationIrPlaceholder = { name }
    if (typeCandidate && typeCandidate.length > 0) {
      placeholder.type = parsePlaceholderType(typeCandidate, rowIndex, locationPath)
    }
    if (formatHintCandidate && formatHintCandidate.length > 0) {
      placeholder.formatHint = formatHintCandidate
    }

    placeholders.push(placeholder)
  })

  return placeholders.length > 0 ? placeholders : undefined
}

const validateOptions = <TLanguage extends string>(options: CsvToIrOptions<TLanguage>): void => {
  if (options.languages.length === 0) {
    throw new Error('Invalid options: "languages" must include at least one language.')
  }
  if (!options.languages.includes(options.sourceLanguage)) {
    throw new Error(
      `Invalid options: source language "${options.sourceLanguage}" is not part of "languages".`
    )
  }
}

const toEntryFromRow = <TLanguage extends string>(
  row: TranslationCsvRow,
  rowIndex: number,
  options: CsvToIrOptions<TLanguage>
): TranslationIrEntry<TLanguage> => {
  const locationPath = options.filePath
  const key = row.key
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`Missing "key" in ${toLocation(rowIndex, locationPath)}.`)
  }

  const description = row.description
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error(`Missing "description" in ${toLocation(rowIndex, locationPath)}.`)
  }

  const values = {} as Record<TLanguage, string>
  options.languages.forEach((language) => {
    const value = row[language]
    if (typeof value !== 'string') {
      throw new Error(
        `Missing language column "${language}" in ${toLocation(rowIndex, locationPath)}.`
      )
    }
    if (language === options.sourceLanguage && value.length === 0) {
      throw new Error(
        `Missing value for source language "${options.sourceLanguage}" in ${toLocation(rowIndex, locationPath)}.`
      )
    }
    values[language] = value
  })

  const statusColumn = options.statusColumn ?? STATUS_COLUMN
  const tagsColumn = options.tagsColumn ?? TAGS_COLUMN
  const placeholdersColumn = options.placeholdersColumn ?? PLACEHOLDERS_COLUMN

  return {
    key,
    description,
    status: parseStatus(row, rowIndex, locationPath, statusColumn),
    tags: parseTags(row, tagsColumn),
    placeholders: parsePlaceholders(row, rowIndex, locationPath, placeholdersColumn),
    values,
  }
}

/**
 * Converts parsed CSV rows into translation IR.
 *
 * @param rows Parsed CSV rows.
 * @param options Conversion options.
 * @returns Normalized IR project object.
 */
export const toIrProjectFromCsvRows = <TLanguage extends string>(
  rows: ReadonlyArray<TranslationCsvRow>,
  options: CsvToIrOptions<TLanguage>
): TranslationIrProject<TLanguage> => {
  validateOptions(options)

  const entries = rows.map((row, rowIndex) => toEntryFromRow(row, rowIndex, options))
  const keys = new Set<string>()
  entries.forEach((entry, entryIndex) => {
    if (keys.has(entry.key)) {
      throw new Error(
        `Duplicate key "${entry.key}" in ${toLocation(entryIndex, options.filePath)}.`
      )
    }
    keys.add(entry.key)
  })

  return {
    version: '1',
    sourceLanguage: options.sourceLanguage,
    languages: options.languages,
    entries,
  }
}

/**
 * Reads one CSV file and converts it into translation IR.
 *
 * @param filePath CSV source file path.
 * @param options Conversion options without file path.
 * @returns Normalized IR project object.
 */
export const toIrProjectFromCsvFile = async <TLanguage extends string>(
  filePath: string,
  options: Omit<CsvToIrOptions<TLanguage>, 'filePath'>
): Promise<TranslationIrProject<TLanguage>> => {
  const rows = await readCsvFile(filePath)
  return toIrProjectFromCsvRows(rows, {
    ...options,
    filePath,
  })
}
