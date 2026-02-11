import { describe, expect, test, vi } from 'vitest'
import { createIcuTranslator } from '../../src/runtime/icuTranslator.js'
import { TranslationTable } from '../../src/runtime/types.js'

type TestLanguage = 'en' | 'de'
type TestKey = 'inboxSummary' | 'invoiceTotal' | 'fallbackOnly' | 'ordinalPlace' | 'offsetInvite'

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
})
