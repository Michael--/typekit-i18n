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

  lines.forEach((lineContent, index) => {
    const lineNumber = index + 1
    if (lineContent.trim().length === 0) {
      return
    }

    const parsed = parseCsvLine(lineContent)
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
  }
}

const parseCsvLine = (line: string): readonly MutableCsvCell[] | string => {
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

      if (character === ',') {
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

    if (line[index] !== ',') {
      return 'Invalid delimiter sequence.'
    }
    index += 1
  }

  return cells
}
