import { describe, expect, test, vi } from 'vitest'
import { createTranslator } from '../../src/runtime/translator.js'
import { TranslationTable } from '../../src/runtime/types.js'

type TestLanguage = 'en' | 'de'

const table: TranslationTable<string, TestLanguage> = {
  greeting: {
    description: 'Greeting text',
    en: 'Hello',
    de: 'Hallo',
  },
  fallbackOnly: {
    description: 'Only default language is available',
    en: 'Only English',
    de: '',
  },
  repeatedPlaceholder: {
    description: 'Placeholder appears multiple times',
    en: '{name} says hi to {name}.',
    de: '{name} sagt Hallo zu {name}.',
  },
  formattedPlaceholder: {
    description: 'Placeholder with optional formatter',
    en: 'Total: {amount|currency}',
    de: 'Summe: {amount|currency}',
  },
  unknownFormatter: {
    description: 'Placeholder formatter fallback behavior',
    en: 'Value: {amount|does_not_exist}',
    de: 'Wert: {amount|does_not_exist}',
  },
  numericPlaceholder: {
    description: 'Numeric placeholder value',
    en: 'Items: {count}',
    de: 'Eintraege: {count}',
  },
  emptyEverywhere: {
    description: 'No language has content',
    en: '',
    de: '',
  },
}

describe('createTranslator', () => {
  test('returns the key and reports when a key is missing', () => {
    const onMissingTranslation = vi.fn()
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      onMissingTranslation,
    })

    expect(translate('does-not-exist', 'de')).toBe('does-not-exist')
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
    expect(onMissingTranslation).toHaveBeenLastCalledWith({
      key: 'does-not-exist',
      language: 'de',
      defaultLanguage: 'en',
      reason: 'missingKey',
    })
  })

  test('falls back to default language when target language text is empty', () => {
    const onMissingTranslation = vi.fn()
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      onMissingTranslation,
    })

    expect(translate('fallbackOnly', 'de')).toBe('Only English')
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
    expect(onMissingTranslation).toHaveBeenLastCalledWith({
      key: 'fallbackOnly',
      language: 'de',
      defaultLanguage: 'en',
      reason: 'missingLanguage',
    })
  })

  test('replaces placeholders globally', () => {
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('repeatedPlaceholder', 'en', {
        data: [{ key: 'name', value: 'Mara' }],
      })
    ).toBe('Mara says hi to Mara.')
  })

  test('applies named formatter hooks when present', () => {
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      formatters: {
        currency: (value) => `EUR ${value}`,
      },
    })

    expect(
      translate('formattedPlaceholder', 'en', {
        data: [{ key: 'amount', value: '12.50' }],
      })
    ).toBe('Total: EUR 12.50')
  })

  test('falls back to raw placeholder value when formatter is unknown', () => {
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      formatters: {
        currency: (value) => `EUR ${value}`,
      },
    })

    expect(
      translate('unknownFormatter', 'en', {
        data: [{ key: 'amount', value: '12.50' }],
      })
    ).toBe('Value: 12.50')
  })

  test('renders non-string placeholder values', () => {
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
    })

    expect(
      translate('numericPlaceholder', 'en', {
        data: [{ key: 'count', value: 3 }],
      })
    ).toBe('Items: 3')
  })

  test('returns key when neither target nor fallback text is available', () => {
    const onMissingTranslation = vi.fn()
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      onMissingTranslation,
    })

    expect(translate('emptyEverywhere', 'de')).toBe('emptyEverywhere')
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
    expect(onMissingTranslation).toHaveBeenLastCalledWith({
      key: 'emptyEverywhere',
      language: 'de',
      defaultLanguage: 'en',
      reason: 'missingFallback',
    })
  })

  test('throws in strict mode for missing language text', () => {
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      missingStrategy: 'strict',
    })

    expect(() => translate('fallbackOnly', 'de')).toThrow(
      /Missing translation for key "fallbackOnly".*reason "missingLanguage"/
    )
  })

  test('throws in strict mode for missing key', () => {
    const onMissingTranslation = vi.fn()
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      missingStrategy: 'strict',
      onMissingTranslation,
    })

    expect(() => translate('does-not-exist', 'de')).toThrow(
      /Missing translation for key "does-not-exist".*reason "missingKey"/
    )
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
  })
})
