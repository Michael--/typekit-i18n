import { describe, expect, test, vi } from 'vitest'
import * as icuParser from '../../src/runtime/icuParser.js'
import { createIcuTranslator } from '../../src/runtime/icuTranslator.js'
import { TranslationTable } from '../../src/runtime/types.js'

type TestLanguage = 'en' | 'de'
type TestKey =
  | 'inboxSummary'
  | 'invoiceTotal'
  | 'fallbackOnly'
  | 'ordinalPlace'
  | 'offsetInvite'
  | 'escapeDemo'
  | 'invalidTypeDemo'
  | 'invalidOptionsDemo'
  | 'unterminatedDemo'
  | 'missingOtherDemo'
  | 'cacheProbe'

const table: TranslationTable<TestKey, TestLanguage> = {
  inboxSummary: {
    description: 'ICU plural and select demo',
    en: '{gender, select, male {He} female {She} other {They}} has {count, plural, =0 {no messages} one {# message} other {# messages}}.',
    de: '{gender, select, male {Er} female {Sie} other {Sie}} hat {count, plural, =0 {keine Nachrichten} one {# Nachricht} other {# Nachrichten}}.',
  },
  invoiceTotal: {
    description: 'Simple placeholder formatter in ICU translator',
    en: 'Invoice total: {amount|currency}',
    de: 'Rechnungsbetrag: {amount|currency}',
  },
  fallbackOnly: {
    description: 'Only default language available',
    en: 'Only English fallback',
    de: '',
  },
  ordinalPlace: {
    description: 'Selectordinal demo',
    en: 'You finished {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}.',
    de: 'Du wurdest {place, selectordinal, one {#.} two {#.} few {#.} other {#.}}.',
  },
  offsetInvite: {
    description: 'Plural offset demo',
    en: '{count, plural, offset:1 =0 {You joined.} one {You and # other joined.} other {You and # others joined.}}',
    de: '{count, plural, offset:1 =0 {Du bist beigetreten.} one {Du und # weitere Person sind beigetreten.} other {Du und # weitere Personen sind beigetreten.}}',
  },
  escapeDemo: {
    description: 'Apostrophe escaping demo',
    en: "Hello {name}, it''s easy: use '{braces}' to show literal braces.",
    de: "Hallo {name}, es ist einfach: nutze '{geschweifte Klammern}' fuer literale Klammern.",
  },
  invalidTypeDemo: {
    description: 'Unsupported ICU expression type',
    en: '{count, choice, one {# item} other {# items}}',
    de: '',
  },
  invalidOptionsDemo: {
    description: 'Invalid ICU options syntax',
    en: '{count, plural, one # item other {# items}}',
    de: '',
  },
  unterminatedDemo: {
    description: 'Unterminated ICU block',
    en: '{count, plural, one {# item} other {# items}',
    de: '',
  },
  missingOtherDemo: {
    description: 'Missing required fallback branch',
    en: '{gender, select, male {He}}',
    de: '',
  },
  cacheProbe: {
    description: 'Compile cache probe',
    en: '{count, plural, one {# item} other {# items}}',
    de: '',
  },
}

describe('createIcuTranslator', () => {
  test('renders select and plural branches', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('inboxSummary', 'en', {
        data: [
          { key: 'gender', value: 'female' },
          { key: 'count', value: 1 },
        ],
      })
    ).toBe('She has 1 message.')
  })

  test('supports exact plural matches', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('inboxSummary', 'en', {
        data: [
          { key: 'gender', value: 'male' },
          { key: 'count', value: 0 },
        ],
      })
    ).toBe('He has no messages.')
  })

  test('applies formatter hooks for simple placeholders', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
      formatters: {
        currency: (value) => `EUR ${value}`,
      },
    })

    expect(
      translate('invoiceTotal', 'de', {
        data: [{ key: 'amount', value: 12.5 }],
      })
    ).toBe('Rechnungsbetrag: EUR 12.5')
  })

  test('supports selectordinal branches', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('ordinalPlace', 'en', {
        data: [{ key: 'place', value: 1 }],
      })
    ).toBe('You finished 1st.')

    expect(
      translate('ordinalPlace', 'en', {
        data: [{ key: 'place', value: 3 }],
      })
    ).toBe('You finished 3rd.')
  })

  test('applies plural offsets for selection and # formatting', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('offsetInvite', 'en', {
        data: [{ key: 'count', value: 1 }],
      })
    ).toBe('You joined.')

    expect(
      translate('offsetInvite', 'en', {
        data: [{ key: 'count', value: 5 }],
      })
    ).toBe('You and 4 others joined.')
  })

  test('handles apostrophe escaping correctly', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('escapeDemo', 'en', {
        data: [{ key: 'name', value: 'Alice' }],
      })
    ).toBe("Hello Alice, it's easy: use {braces} to show literal braces.")
  })

  test('escapes special chars inside quoted sections', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('escapeDemo', 'de', {
        data: [{ key: 'name', value: 'Bob' }],
      })
    ).toBe('Hallo Bob, es ist einfach: nutze {geschweifte Klammern} fuer literale Klammern.')
  })

  test('falls back to default language and reports missing language', () => {
    const onMissingTranslation = vi.fn()
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
      onMissingTranslation,
    })

    expect(translate('fallbackOnly', 'de')).toBe('Only English fallback')
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
    expect(onMissingTranslation).toHaveBeenLastCalledWith({
      key: 'fallbackOnly',
      language: 'de',
      defaultLanguage: 'en',
      reason: 'missingLanguage',
    })
  })

  test('throws in strict mode for missing keys', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
      missingStrategy: 'strict',
    })

    expect(() => translate('unknown' as TestKey, 'de')).toThrow(
      /Missing translation for key "unknown".*reason "missingKey"/
    )
  })

  test('supports locale categories zero/two/few/many/other', () => {
    type CategoryLanguage = 'ar'
    type CategoryKey = 'pluralCategories'

    const categoryTable: TranslationTable<CategoryKey, CategoryLanguage> = {
      pluralCategories: {
        description: 'Arabic plural category coverage',
        ar: '{count, plural, zero {ZERO} one {ONE} two {TWO} few {FEW} many {MANY} other {OTHER}}',
      },
    }

    const translate = createIcuTranslator(categoryTable, {
      defaultLanguage: 'ar',
    })

    expect(translate('pluralCategories', 'ar', { data: [{ key: 'count', value: 0 }] })).toBe('ZERO')
    expect(translate('pluralCategories', 'ar', { data: [{ key: 'count', value: 1 }] })).toBe('ONE')
    expect(translate('pluralCategories', 'ar', { data: [{ key: 'count', value: 2 }] })).toBe('TWO')
    expect(translate('pluralCategories', 'ar', { data: [{ key: 'count', value: 3 }] })).toBe('FEW')
    expect(translate('pluralCategories', 'ar', { data: [{ key: 'count', value: 11 }] })).toBe(
      'MANY'
    )
    expect(translate('pluralCategories', 'ar', { data: [{ key: 'count', value: 100 }] })).toBe(
      'OTHER'
    )
  })

  test('throws detailed syntax errors for unsupported expression types', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(() =>
      translate('invalidTypeDemo', 'en', { data: [{ key: 'count', value: 2 }] })
    ).toThrow(
      /ICU syntax error for key "invalidTypeDemo" in "en" at line 1, column 1: Invalid ICU expression/
    )
  })

  test('throws detailed syntax errors for invalid options blocks', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(() =>
      translate('invalidOptionsDemo', 'en', {
        data: [{ key: 'count', value: 2 }],
      })
    ).toThrow(
      /ICU syntax error for key "invalidOptionsDemo" in "en" at line 1, column 1: Invalid ICU options/
    )
  })

  test('throws detailed syntax errors for unterminated ICU expressions', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(() =>
      translate('unterminatedDemo', 'en', { data: [{ key: 'count', value: 2 }] })
    ).toThrow(
      /ICU syntax error for key "unterminatedDemo" in "en" at line 1, column 1: Unterminated "\{" expression/
    )
  })

  test('throws when no ICU branch matches and no other branch exists', () => {
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(() =>
      translate('missingOtherDemo', 'en', {
        data: [{ key: 'gender', value: 'female' }],
      })
    ).toThrow(
      /ICU syntax error for key "missingOtherDemo" in "en" at line 1, column 1: No matching branch/
    )
  })

  test('reuses compiled ICU templates across translate calls', () => {
    const parseSpy = vi.spyOn(icuParser, 'parseIcuExpression')
    const translate = createIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    translate('cacheProbe', 'en', {
      data: [{ key: 'count', value: 2 }],
    })
    const afterFirstRender = parseSpy.mock.calls.length

    translate('cacheProbe', 'en', {
      data: [{ key: 'count', value: 5 }],
    })
    const afterSecondRender = parseSpy.mock.calls.length

    expect(afterFirstRender).toBeGreaterThan(0)
    expect(afterSecondRender).toBe(afterFirstRender)
    parseSpy.mockRestore()
  })
})
