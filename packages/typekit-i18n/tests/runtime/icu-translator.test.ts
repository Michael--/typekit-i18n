import { describe, expect, test, vi } from 'vitest'
import { createIcuTranslator } from '../../src/runtime/icuTranslator.js'
import { TranslationTable } from '../../src/runtime/types.js'

type TestLanguage = 'en' | 'de'
type TestKey = 'inboxSummary' | 'invoiceTotal' | 'fallbackOnly'

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
