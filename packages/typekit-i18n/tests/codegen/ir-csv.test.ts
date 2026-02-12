import { describe, expect, test } from 'vitest'
import { parseCsvContent } from '../../src/codegen/csv.js'
import { toCsvContentFromIrProject, toIrProjectFromCsvRows } from '../../src/codegen/ir/csv.js'
import { TranslationIrProject } from '../../src/codegen/ir/types.js'
import { TranslationCsvRow } from '../../src/codegen/types.js'

describe('toIrProjectFromCsvRows', () => {
  test('converts rows into IR with optional metadata columns', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      {
        key: 'item_count',
        category: 'dashboard',
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
          category: 'dashboard',
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
    ).toThrow(/Duplicate key "same" at translations\.csv at row 3\./)
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

  test('reports multiple row validation errors in one run', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      {
        key: 'missing_description',
        description: '',
        en: 'A',
        de: 'B',
      },
      {
        key: 'missing_source',
        description: 'Missing source value',
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
    ).toThrow(/CSV row validation failed with 2 error\(s\):/)
    expect(() =>
      toIrProjectFromCsvRows(rows, {
        languages: ['en', 'de'],
        sourceLanguage: 'en',
        filePath: 'translations.csv',
      })
    ).toThrow(/Missing "description" in translations\.csv at row 2\./)
    expect(() =>
      toIrProjectFromCsvRows(rows, {
        languages: ['en', 'de'],
        sourceLanguage: 'en',
        filePath: 'translations.csv',
      })
    ).toThrow(/Missing value for source language "en" in translations\.csv at row 3\./)
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

  test('throws when placeholder tokens are inconsistent across languages', () => {
    const rows: ReadonlyArray<TranslationCsvRow> = [
      {
        key: 'item_count',
        description: 'Summary line with count placeholder',
        placeholders: 'count:number',
        en: 'You currently have {count} items.',
        de: 'Du hast aktuell Elemente.',
      },
    ]

    expect(() =>
      toIrProjectFromCsvRows(rows, {
        languages: ['en', 'de'],
        sourceLanguage: 'en',
        filePath: 'translations.csv',
      })
    ).toThrow(
      /Missing placeholder\(s\) "\{count\}" in language "de" at translations\.csv at row 2\./
    )
  })

  test('roundtrips IR through CSV content including metadata columns', async () => {
    const project: TranslationIrProject<'en' | 'de'> = {
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'item_count',
          category: 'dashboard',
          description: 'Summary line with count placeholder',
          status: 'review',
          tags: ['ui', 'summary'],
          placeholders: [{ name: 'count', type: 'number', formatHint: 'integer' }],
          values: {
            en: 'You currently have {count} items.',
            de: 'Du hast aktuell {count} Eintraege.',
          },
        },
      ],
    }

    const content = toCsvContentFromIrProject(project)
    const rows = await parseCsvContent(content)
    const parsed = toIrProjectFromCsvRows(rows, {
      languages: ['en', 'de'],
      sourceLanguage: 'en',
    })

    expect(parsed).toEqual(project)
  })

  test('omits optional metadata columns when no entry uses them', () => {
    const project: TranslationIrProject<'en' | 'de'> = {
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'title',
          description: 'Simple title',
          values: {
            en: 'Title',
            de: 'Titel',
          },
        },
      ],
    }

    const content = toCsvContentFromIrProject(project)
    const header = content.trim().split('\n')[0]
    expect(header).toBe('key;description;en;de')
  })

  test('writes category column when at least one entry has category', () => {
    const project: TranslationIrProject<'en' | 'de'> = {
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'title',
          category: 'common',
          description: 'Simple title',
          values: {
            en: 'Title',
            de: 'Titel',
          },
        },
      ],
    }

    const content = toCsvContentFromIrProject(project)
    const header = content.trim().split('\n')[0]
    expect(header).toBe('key;description;category;en;de')
  })
})
