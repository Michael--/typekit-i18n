import { describe, expect, test } from 'vitest'
import { toIrProjectFromCsvRows } from '../../src/codegen/ir/csv.js'
import { TranslationCsvRow } from '../../src/codegen/types.js'

describe('toIrProjectFromCsvRows', () => {
  test('converts rows into IR with optional metadata columns', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      {
        key: 'item_count',
        description: 'Summary line with count placeholder',
        status: 'approved',
        tags: 'ui, summary',
        placeholders: 'count:number',
        en: 'You currently have {count} items.',
        de: 'Du hast aktuell {count} Eintraege.',
      },
    ]

    const project = toIrProjectFromCsvRows(rows, {
      languages: ['en', 'de'],
      sourceLanguage: 'en',
      filePath: 'translations.csv',
    })

    expect(project).toEqual({
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'item_count',
          description: 'Summary line with count placeholder',
          status: 'approved',
          tags: ['ui', 'summary'],
          placeholders: [{ name: 'count', type: 'number' }],
          values: {
            en: 'You currently have {count} items.',
            de: 'Du hast aktuell {count} Eintraege.',
          },
        },
      ],
    })
  })

  test('throws on duplicate keys', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      { key: 'same', description: 'First', en: 'A', de: 'B' },
      { key: 'same', description: 'Second', en: 'C', de: 'D' },
    ]

    expect(() =>
      toIrProjectFromCsvRows(rows, {
        languages: ['en', 'de'],
        sourceLanguage: 'en',
        filePath: 'translations.csv',
      })
    ).toThrow(/Duplicate key "same" in translations\.csv at row 3\./)
  })

  test('throws on invalid placeholder type', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      {
        key: 'x',
        description: 'Test entry',
        placeholders: 'count:invalid_type',
        en: 'A',
        de: 'B',
      },
    ]

    expect(() =>
      toIrProjectFromCsvRows(rows, {
        languages: ['en', 'de'],
        sourceLanguage: 'en',
        filePath: 'translations.csv',
      })
    ).toThrow(/Invalid placeholder type "invalid_type" in translations\.csv at row 2\./)
  })

  test('throws when source language value is empty', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      {
        key: 'x',
        description: 'Test entry',
        en: '',
        de: 'B',
      },
    ]

    expect(() =>
      toIrProjectFromCsvRows(rows, {
        languages: ['en', 'de'],
        sourceLanguage: 'en',
        filePath: 'translations.csv',
      })
    ).toThrow(/Missing value for source language "en" in translations\.csv at row 2\./)
  })
})
