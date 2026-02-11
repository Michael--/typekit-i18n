import { parseString } from 'fast-csv'
import { readFile } from 'node:fs/promises'
import { TranslationCsvRow } from './types.js'

/**
 * Auto-detects CSV delimiter from the first line.
 *
 * @param content CSV content.
 * @returns Detected delimiter (comma or semicolon).
 */
const detectDelimiter = (content: string): ',' | ';' => {
  const firstLine = content.split('\n')[0] || ''
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length
  return semicolonCount > commaCount ? ';' : ','
}

/**
 * Parses CSV content into row objects.
 *
 * @param content UTF-8 CSV content.
 * @returns Parsed rows with header-based keys.
 */
export const parseCsvContent = async (
  content: string
): Promise<ReadonlyArray<TranslationCsvRow>> => {
  return new Promise((resolve, reject) => {
    const rows: TranslationCsvRow[] = []
    const delimiter = detectDelimiter(content)

    parseString<TranslationCsvRow, TranslationCsvRow>(content, {
      headers: true,
      delimiter,
      trim: true,
      discardUnmappedColumns: false,
    })
      .on('error', (error) => reject(error))
      .on('data', (row: TranslationCsvRow) => {
        rows.push(row)
      })
      .on('end', () => {
        resolve(rows)
      })
  })
}

/**
 * Reads and parses a CSV file from disk.
 *
 * @param filePath Path to CSV file.
 * @returns Parsed rows with header-based keys.
 */
export const readCsvFile = async (filePath: string): Promise<ReadonlyArray<TranslationCsvRow>> => {
  const content = await readFile(filePath, 'utf-8')
  return parseCsvContent(content)
}
