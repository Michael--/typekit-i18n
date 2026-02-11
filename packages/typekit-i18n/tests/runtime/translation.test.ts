import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TranslateKeys } from '@gen/translationKeys'
import {
  clearCollectedMissingTranslations,
  configureTranslationRuntime,
  createTranslationRuntime,
  createConsoleMissingTranslationReporter,
  getCollectedMissingTranslations,
  translate,
} from '../../src/runtime/translation.js'
import type { TranslationTable } from '../../src/runtime/types.js'

const missingKey = '__missing_translation_key__' as unknown as TranslateKeys

beforeEach(() => {
  clearCollectedMissingTranslations()
  configureTranslationRuntime({
    defaultLanguage: 'en',
    missingStrategy: 'fallback',
    collectMissingTranslations: false,
    onMissingTranslation: null,
  })
})

describe('translate', () => {
  test('returns existing translations for supported languages', () => {
    expect(translate('Sun Position', 'en')).toBe('Sun Position')
    expect(translate('Sun Position', 'de')).toBe('Sonnenposition')
  })

  test('collects missing events when collection is enabled', () => {
    configureTranslationRuntime({
      collectMissingTranslations: true,
    })

    expect(translate(missingKey, 'de')).toBe(missingKey)
    expect(getCollectedMissingTranslations()).toEqual([
      {
        key: missingKey,
        language: 'de',
        defaultLanguage: 'en',
        reason: 'missingKey',
      },
    ])
  })

  test('throws in strict mode when translation is missing', () => {
    configureTranslationRuntime({
      missingStrategy: 'strict',
    })

    expect(() => translate(missingKey, 'de')).toThrow(
      /Missing translation for key "__missing_translation_key__".*reason "missingKey"/
    )
  })

  test('uses optional console reporter', () => {
    const warn = vi.fn()
    configureTranslationRuntime({
      onMissingTranslation: createConsoleMissingTranslationReporter({ warn }),
    })

    translate(missingKey, 'de')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing translation for key "__missing_translation_key__"')
    )
  })

  test('creates isolated runtime independent from generated default table', () => {
    type CustomLanguage = 'en' | 'fr'
    type CustomKey = 'hello' | 'price'

    const customTable: TranslationTable<CustomKey, CustomLanguage> = {
      hello: {
        description: 'Custom greeting',
        en: 'Hello',
        fr: 'Bonjour',
      },
      price: {
        description: 'Price label with formatter',
        en: 'Price: {amount|currency}',
        fr: 'Prix: {amount|currency}',
      },
    }

    const customRuntime = createTranslationRuntime(customTable, {
      defaultLanguage: 'en',
      missingStrategy: 'strict',
    })

    expect(customRuntime.translate('hello', 'fr')).toBe('Bonjour')

    customRuntime.configure({
      formatters: {
        currency: (value) => `${value} EUR`,
      },
    })

    expect(
      customRuntime.translate('price', 'fr', {
        data: [{ key: 'amount', value: '10' }],
      })
    ).toBe('Prix: 10 EUR')
  })
})
