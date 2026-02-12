import * as vscode from 'vscode'

export interface ParsedCsvCell {
  readonly value: string
  readonly range: vscode.Range
}

export interface ParsedCsvRow {
  readonly line: number
  readonly cells: readonly ParsedCsvCell[]
}

export interface CsvParseError {
  readonly line: number
  readonly message: string
}

export interface ParsedCsvDocument {
  readonly rows: readonly ParsedCsvRow[]
  readonly errors: readonly CsvParseError[]
  readonly delimiter: ',' | ';'
}

interface MutableCsvCell {
  value: string
  start: number
  end: number
}

/**
 * Parses CSV content into rows with cell ranges for code actions and diagnostics.
 *
 * @param content CSV file content.
 * @returns Parsed rows and parse errors.
 */
export const parseCsvDocument = (content: string): ParsedCsvDocument => {
  const lines = content.split(/\r?\n/)
  const rows: ParsedCsvRow[] = []
  const errors: CsvParseError[] = []
  const delimiter = detectDelimiter(lines)

  lines.forEach((lineContent, index) => {
    const lineNumber = index + 1
    if (lineContent.trim().length === 0) {
      return
    }

    const parsed = parseCsvLine(lineContent, delimiter)
    if (typeof parsed === 'string') {
      errors.push({
        line: lineNumber,
        message: parsed,
      })
      return
    }

    rows.push({
      line: lineNumber,
      cells: parsed.map((cell) => ({
        value: cell.value,
        range: new vscode.Range(index, cell.start, index, cell.end),
      })),
    })
  })

  return {
    rows,
    errors,
    delimiter,
  }
}

const parseCsvLine = (line: string, delimiter: ',' | ';'): readonly MutableCsvCell[] | string => {
  const cells: MutableCsvCell[] = []
  let index = 0

  while (index <= line.length) {
    const tokenStart = index
    let value = ''
    let isQuoted = false

    if (index < line.length && line[index] === '"') {
      isQuoted = true
      index += 1
    }

    while (index < line.length) {
      const character = line[index]
      if (isQuoted) {
        if (character === '"') {
          const nextCharacter = line[index + 1]
          if (nextCharacter === '"') {
            value += '"'
            index += 2
            continue
          }
          isQuoted = false
          index += 1
          continue
        }
        value += character
        index += 1
        continue
      }

      if (character === delimiter) {
        break
      }

      value += character
      index += 1
    }

    if (isQuoted) {
      return 'Unterminated quoted field.'
    }

    const tokenEnd = index
    cells.push({
      value: value.trim(),
      start: tokenStart,
      end: tokenEnd,
    })

    if (index >= line.length) {
      break
    }

    if (line[index] !== delimiter) {
      return 'Invalid delimiter sequence.'
    }
    index += 1
  }

  return cells
}

const detectDelimiter = (lines: readonly string[]): ',' | ';' => {
  const firstNonEmptyLine = lines.find((line) => line.trim().length > 0)
  if (!firstNonEmptyLine) {
    return ','
  }

  const commaScore = countDelimiterCandidates(firstNonEmptyLine, ',')
  const semicolonScore = countDelimiterCandidates(firstNonEmptyLine, ';')

  if (semicolonScore > commaScore) {
    return ';'
  }
  return ','
}

const countDelimiterCandidates = (line: string, delimiter: ',' | ';'): number => {
  let count = 0
  let index = 0
  let quoted = false

  while (index < line.length) {
    const character = line[index]
    if (character === '"') {
      const nextCharacter = line[index + 1]
      if (quoted && nextCharacter === '"') {
        index += 2
        continue
      }
      quoted = !quoted
      index += 1
      continue
    }

    if (!quoted && character === delimiter) {
      count += 1
    }
    index += 1
  }

  return count
}
