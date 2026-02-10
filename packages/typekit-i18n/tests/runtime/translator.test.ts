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
  })

  test('falls back to default language when target language text is empty', () => {
    const onMissingTranslation = vi.fn()
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      onMissingTranslation,
    })

    expect(translate('fallbackOnly', 'de')).toBe('Only English')
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
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

  test('returns key when neither target nor fallback text is available', () => {
    const onMissingTranslation = vi.fn()
    const translate = createTranslator(table, {
      defaultLanguage: 'en',
      onMissingTranslation,
    })

    expect(translate('emptyEverywhere', 'de')).toBe('emptyEverywhere')
    expect(onMissingTranslation).toHaveBeenCalledTimes(1)
  })
})
