import { describe, expect, test, vi } from 'vitest'
import { createFormatjsIcuTranslator } from '../../src/runtime/icuFormatjsTranslator.js'
import { TranslationTable } from '../../src/runtime/types.js'

type TestLanguage = 'en' | 'de'
type TestKey =
  | 'inboxSummary'
  | 'invoiceTotal'
  | 'fallbackOnly'
  | 'unknownFormatter'
  | 'quotedFormatter'
  | 'invalidIcu'

const table: TranslationTable<TestKey, TestLanguage> = {
  inboxSummary: {
    category: 'messages',
    description: 'ICU plural and select demo',
    en: '{gender, select, male {He} female {She} other {They}} has {count, plural, =0 {no messages} one {# message} other {# messages}}.',
    de: '{gender, select, male {Er} female {Sie} other {Sie}} hat {count, plural, =0 {keine Nachrichten} one {# Nachricht} other {# Nachrichten}}.',
  },
  invoiceTotal: {
    category: 'billing',
    description: 'Simple placeholder formatter in FormatJS ICU translator',
    en: 'Invoice total: {amount|currency}',
    de: 'Rechnungsbetrag: {amount|currency}',
  },
  fallbackOnly: {
    description: 'Only default language available',
    en: 'Only English fallback',
    de: '',
  },
  unknownFormatter: {
    description: 'Formatter fallback behavior',
    en: 'Value: {amount|does_not_exist}',
    de: 'Wert: {amount|does_not_exist}',
  },
  quotedFormatter: {
    description: 'Quoted formatter placeholder should stay literal',
    en: "Use '{amount|currency}' to show a literal token.",
    de: "Nutze '{amount|currency}' fuer ein literales Token.",
  },
  invalidIcu: {
    description: 'Invalid ICU syntax',
    en: '{count, plural, one # item other {# items}}',
    de: '',
  },
}

describe('createFormatjsIcuTranslator', () => {
  test('defaults to "en" when defaultLanguage is omitted', () => {
    const translate = createFormatjsIcuTranslator(table)

    expect(translate('fallbackOnly', 'de')).toBe('Only English fallback')
  })

  test('renders select and plural branches', () => {
    const translate = createFormatjsIcuTranslator(table, {
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

  test('applies formatter hooks for legacy {name|formatter} placeholders', () => {
    const translate = createFormatjsIcuTranslator(table, {
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

  test('falls back to raw value when formatter is unknown', () => {
    const translate = createFormatjsIcuTranslator(table, {
      defaultLanguage: 'en',
      formatters: {
        currency: (value) => `EUR ${value}`,
      },
    })

    expect(
      translate('unknownFormatter', 'en', {
        data: [{ key: 'amount', value: 12.5 }],
      })
    ).toBe('Value: 12.5')
  })

  test('keeps quoted formatter placeholders as literals', () => {
    const translate = createFormatjsIcuTranslator(table, {
      defaultLanguage: 'en',
      formatters: {
        currency: (value) => `EUR ${value}`,
      },
    })

    expect(translate('quotedFormatter', 'en')).toBe(
      'Use {amount|currency} to show a literal token.'
    )
  })

  test('supports scoped category translation and alias', () => {
    const translate = createFormatjsIcuTranslator(table, {
      defaultLanguage: 'en',
      formatters: {
        currency: (value) => `EUR ${value}`,
      },
    })

    expect(
      translate.translateIn('billing', 'invoiceTotal', 'de', {
        data: [{ key: 'amount', value: 12.5 }],
      })
    ).toBe('Rechnungsbetrag: EUR 12.5')
    expect(translate.in('messages', 'invoiceTotal', 'de')).toBe('messages.invoiceTotal')
  })

  test('throws detailed syntax errors for invalid ICU expressions', () => {
    const translate = createFormatjsIcuTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(() =>
      translate('invalidIcu', 'en', {
        data: [{ key: 'count', value: 2 }],
      })
    ).toThrow(/ICU syntax error for key "invalidIcu" in "en"/)
  })

  test('falls back to default language and reports missing language', () => {
    const onMissingTranslation = vi.fn()
    const translate = createFormatjsIcuTranslator(table, {
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
})
