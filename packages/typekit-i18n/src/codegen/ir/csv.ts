import { readCsvFile } from '../csv.js'
import { TranslationCsvRow } from '../types.js'
import { writeFile } from 'node:fs/promises'
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
const CSV_DELIMITER = ';'
const CSV_NEWLINE = '\n'

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

/**
 * Options for converting translation IR into CSV.
 */
export interface IrToCsvOptions {
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
  /**
   * Includes status column when undefined values exist.
   * Defaults to `true` when at least one entry has a status value.
   */
  includeStatusColumn?: boolean
  /**
   * Includes tags column when undefined values exist.
   * Defaults to `true` when at least one entry has tags.
   */
  includeTagsColumn?: boolean
  /**
   * Includes placeholders column when undefined values exist.
   * Defaults to `true` when at least one entry has placeholders.
   */
  includePlaceholdersColumn?: boolean
}

const stringifyCsvValue = (value: string): string => {
  if (
    value.includes(CSV_DELIMITER) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

const toTagsCell = (tags: ReadonlyArray<string> | undefined): string =>
  tags && tags.length > 0 ? tags.join(', ') : ''

const toPlaceholderCell = (
  placeholders: ReadonlyArray<TranslationIrPlaceholder> | undefined
): string =>
  placeholders && placeholders.length > 0
    ? placeholders
        .map((placeholder) => {
          const hasType = typeof placeholder.type === 'string' && placeholder.type.length > 0
          const hasFormatHint =
            typeof placeholder.formatHint === 'string' && placeholder.formatHint.length > 0

          if (!hasType && !hasFormatHint) {
            return placeholder.name
          }
          if (!hasType && hasFormatHint) {
            return `${placeholder.name}::${placeholder.formatHint}`
          }
          if (hasType && !hasFormatHint) {
            return `${placeholder.name}:${placeholder.type}`
          }
          return `${placeholder.name}:${placeholder.type}:${placeholder.formatHint}`
        })
        .join(',')
    : ''

const shouldIncludeStatusColumn = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  options: IrToCsvOptions
): boolean =>
  options.includeStatusColumn ??
  project.entries.some((entry) => typeof entry.status === 'string' && entry.status.length > 0)

const shouldIncludeTagsColumn = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  options: IrToCsvOptions
): boolean =>
  options.includeTagsColumn ??
  project.entries.some((entry) => Array.isArray(entry.tags) && entry.tags.length > 0)

const shouldIncludePlaceholdersColumn = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  options: IrToCsvOptions
): boolean =>
  options.includePlaceholdersColumn ??
  project.entries.some(
    (entry) => Array.isArray(entry.placeholders) && entry.placeholders.length > 0
  )

const assertProjectShape = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>
): void => {
  if (project.languages.length === 0) {
    throw new Error('Invalid IR project: "languages" must include at least one language.')
  }
  if (!project.languages.includes(project.sourceLanguage)) {
    throw new Error(
      `Invalid IR project: source language "${project.sourceLanguage}" is not part of "languages".`
    )
  }
}

/**
 * Converts translation IR into CSV row objects.
 *
 * @param project Normalized IR project object.
 * @param options Conversion options.
 * @returns CSV rows that match configured language and metadata columns.
 * @throws When project shape is invalid.
 */
export const toCsvRowsFromIrProject = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  options: IrToCsvOptions = {}
): ReadonlyArray<TranslationCsvRow> => {
  assertProjectShape(project)

  const statusColumn = options.statusColumn ?? STATUS_COLUMN
  const tagsColumn = options.tagsColumn ?? TAGS_COLUMN
  const placeholdersColumn = options.placeholdersColumn ?? PLACEHOLDERS_COLUMN

  const includeStatusColumn = shouldIncludeStatusColumn(project, options)
  const includeTagsColumn = shouldIncludeTagsColumn(project, options)
  const includePlaceholdersColumn = shouldIncludePlaceholdersColumn(project, options)

  return project.entries.map((entry) => {
    const row: TranslationCsvRow = {
      key: entry.key,
      description: entry.description,
    }

    if (includeStatusColumn) {
      row[statusColumn] = entry.status ?? ''
    }
    if (includeTagsColumn) {
      row[tagsColumn] = toTagsCell(entry.tags)
    }
    if (includePlaceholdersColumn) {
      row[placeholdersColumn] = toPlaceholderCell(entry.placeholders)
    }

    project.languages.forEach((language) => {
      row[language] = entry.values[language]
    })

    return row
  })
}

/**
 * Converts translation IR into CSV file content.
 *
 * @param project Normalized IR project object.
 * @param options Conversion options.
 * @returns Semicolon-delimited CSV content with header row.
 * @throws When project shape is invalid.
 */
export const toCsvContentFromIrProject = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  options: IrToCsvOptions = {}
): string => {
  assertProjectShape(project)

  const statusColumn = options.statusColumn ?? STATUS_COLUMN
  const tagsColumn = options.tagsColumn ?? TAGS_COLUMN
  const placeholdersColumn = options.placeholdersColumn ?? PLACEHOLDERS_COLUMN

  const includeStatusColumn = shouldIncludeStatusColumn(project, options)
  const includeTagsColumn = shouldIncludeTagsColumn(project, options)
  const includePlaceholdersColumn = shouldIncludePlaceholdersColumn(project, options)

  const headers: string[] = ['key', 'description']
  if (includeStatusColumn) {
    headers.push(statusColumn)
  }
  if (includeTagsColumn) {
    headers.push(tagsColumn)
  }
  if (includePlaceholdersColumn) {
    headers.push(placeholdersColumn)
  }
  headers.push(...project.languages)

  const rows = toCsvRowsFromIrProject(project, {
    ...options,
    includeStatusColumn,
    includeTagsColumn,
    includePlaceholdersColumn,
  })

  const contentRows = rows.map((row) =>
    headers.map((header) => stringifyCsvValue(row[header] ?? '')).join(CSV_DELIMITER)
  )

  return [headers.join(CSV_DELIMITER), ...contentRows].join(CSV_NEWLINE).concat(CSV_NEWLINE)
}

/**
 * Writes translation IR as CSV file content.
 *
 * @param filePath Output CSV path.
 * @param project Normalized IR project object.
 * @param options Conversion options.
 * @returns Resolves after writing file content.
 * @throws When project shape is invalid.
 */
export const writeCsvFileFromIrProject = async <TLanguage extends string>(
  filePath: string,
  project: TranslationIrProject<TLanguage>,
  options: IrToCsvOptions = {}
): Promise<void> => {
  const content = toCsvContentFromIrProject(project, options)
  await writeFile(filePath, content, 'utf-8')
}
