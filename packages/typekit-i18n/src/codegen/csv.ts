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

const toCombinedErrorMessage = (scope: string, errors: ReadonlyArray<string>): string => {
  if (errors.length === 1) {
    return errors[0]
  }
  const lines = errors.map((error, index) => `${index + 1}. ${error}`)
  return `${scope} failed with ${errors.length} error(s):\n${lines.join('\n')}`
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
    const structureErrors: string[] = []
    const delimiter = detectDelimiter(content)
    let expectedColumnCount: number | undefined
    let settled = false

    const rejectOnce = (error: Error): void => {
      if (!settled) {
        settled = true
        reject(error)
      }
    }

    const resolveOnce = (parsedRows: ReadonlyArray<TranslationCsvRow>): void => {
      if (!settled) {
        settled = true
        resolve(parsedRows)
      }
    }

    parseString<TranslationCsvRow, TranslationCsvRow>(content, {
      headers: true,
      delimiter,
      trim: true,
      discardUnmappedColumns: false,
      strictColumnHandling: true,
    })
      .on('headers', (headers: ReadonlyArray<string>) => {
        expectedColumnCount = headers.length
      })
      .on('error', (error: Error) => rejectOnce(error))
      .on('data-invalid', (row: unknown, rowNumber: number, reason?: string): void => {
        const fileRow = rowNumber + 1
        const actualColumnCount = Array.isArray(row) ? row.length : undefined
        const reasonSuffix = typeof reason === 'string' && reason.length > 0 ? ` (${reason})` : ''

        if (typeof expectedColumnCount === 'number' && typeof actualColumnCount === 'number') {
          structureErrors.push(
            `Invalid column count at row ${fileRow}: expected ${expectedColumnCount}, got ${actualColumnCount}${reasonSuffix}.`
          )
          return
        }

        structureErrors.push(`Invalid column count at row ${fileRow}${reasonSuffix}.`)
      })
      .on('data', (row: TranslationCsvRow) => {
        rows.push(row)
      })
      .on('end', () => {
        if (structureErrors.length > 0) {
          rejectOnce(new Error(toCombinedErrorMessage('CSV structure validation', structureErrors)))
          return
        }
        resolveOnce(rows)
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
