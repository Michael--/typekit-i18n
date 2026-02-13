import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => {
  class Position {
    public readonly line: number
    public readonly character: number

    public constructor(line: number, character: number) {
      this.line = line
      this.character = character
    }
  }

  class Range {
    public readonly start: Position
    public readonly end: Position

    public constructor(start: Position, end: Position) {
      this.start = start
      this.end = end
    }

    public contains(position: Position): boolean {
      const startsBefore =
        this.start.line < position.line ||
        (this.start.line === position.line && this.start.character <= position.character)
      const endsAfter =
        this.end.line > position.line ||
        (this.end.line === position.line && this.end.character >= position.character)
      return startsBefore && endsAfter
    }
  }

  class Uri {
    public readonly fsPath: string

    private constructor(fsPath: string) {
      this.fsPath = fsPath
    }

    public static file(fsPath: string): Uri {
      return new Uri(fsPath)
    }
  }

  return {
    Position,
    Range,
    Uri,
  }
})

const { extractKeyUsages, findUsageAtPosition, isTranslatorIdentifierInDocument } =
  await import('../src/core/keyUsage')

interface MockTextDocument {
  readonly fileName: string
  readonly languageId: string
  readonly uri: { readonly fsPath: string }
  getText(): string
  positionAt(offset: number): { readonly line: number; readonly character: number }
}

const toLineOffsets = (content: string): readonly number[] => {
  const offsets = [0]
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') {
      offsets.push(index + 1)
    }
  }
  return offsets
}

const createMockDocument = (content: string): MockTextDocument => {
  const lineOffsets = toLineOffsets(content)
  const positionAt = (offset: number): { readonly line: number; readonly character: number } => {
    const safeOffset = Math.max(0, Math.min(offset, content.length))
    let line = 0
    for (let index = 0; index < lineOffsets.length; index += 1) {
      if (lineOffsets[index] <= safeOffset) {
        line = index
        continue
      }
      break
    }
    return {
      line,
      character: safeOffset - lineOffsets[line],
    }
  }

  return {
    fileName: '/workspace/src/app.ts',
    languageId: 'typescript',
    uri: { fsPath: '/workspace/src/app.ts' },
    getText: () => content,
    positionAt,
  }
}

describe('key usage integration', () => {
  it('extracts keys for translator variables created via createTranslator', () => {
    const document = createMockDocument(`
import { createTranslator } from '@number10/typekit-i18n'

const translate = createTranslator(translationTable)
const value = translate('Buy now')
`)

    const usages = extractKeyUsages(document as never)
    expect(usages).toHaveLength(1)
    expect(usages[0]?.key).toBe('Buy now')
  })

  it('supports aliased translator factory imports', () => {
    const document = createMockDocument(`
import { createTranslator as makeTranslator } from '@number10/typekit-i18n'

const translate = makeTranslator(translationTable)
const value = translate('Test')
`)

    expect(isTranslatorIdentifierInDocument(document as never, 'translate')).toBe(true)
    const usages = extractKeyUsages(document as never)
    expect(usages.map((usage) => usage.key)).toEqual(['Test'])
  })

  it('finds usage under cursor for hover or go-to-definition', () => {
    const source = `
import { createTranslator } from '@number10/typekit-i18n'

const translate = createTranslator(translationTable)
const value = translate('Checkout')
`
    const document = createMockDocument(source)
    const keyOffset = source.indexOf('Checkout')
    const usage = findUsageAtPosition(document as never, document.positionAt(keyOffset) as never)

    expect(usage?.key).toBe('Checkout')
  })
})
