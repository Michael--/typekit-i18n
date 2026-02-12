import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TranslateKeys } from '@gen/translationKeys'
import {
  clearCollectedMissingTranslations,
  configureTranslationRuntime,
  createTranslationRuntime,
  createConsoleMissingTranslationReporter,
  getLanguage,
  getCollectedMissingTranslations,
  setLanguage,
  translate,
  translateIn,
} from '../../src/runtime/translation.js'
import type { TranslationTable } from '../../src/runtime/types.js'

const missingKey = '__missing_translation_key__' as unknown as TranslateKeys

beforeEach(() => {
  clearCollectedMissingTranslations()
  configureTranslationRuntime({
    defaultLanguage: 'en',
    language: 'en',
    missingStrategy: 'fallback',
    collectMissingTranslations: false,
    onMissingTranslation: null,
  })
  setLanguage('en')
})

describe('translate', () => {
  test('createTranslationRuntime defaults to "en" when defaultLanguage is omitted', () => {
    type LocalLanguage = 'en' | 'de'
    type LocalKey = 'greeting'

    const localTable: TranslationTable<LocalKey, LocalLanguage> = {
      greeting: {
        description: 'Greeting text',
        en: 'Hello',
        de: 'Hallo',
      },
    }

    const runtime = createTranslationRuntime(localTable)
    expect(runtime.translate('greeting')).toBe('Hello')
    expect(runtime.translate('greeting', 'de')).toBe('Hallo')
  })

  test('createTranslationRuntime throws when "en" is unavailable and defaultLanguage is omitted', () => {
    type LocalLanguage = 'de' | 'fr'
    type LocalKey = 'greeting'

    const localTable: TranslationTable<LocalKey, LocalLanguage> = {
      greeting: {
        description: 'Greeting text',
        de: 'Hallo',
        fr: 'Bonjour',
      },
    }

    expect(() => createTranslationRuntime(localTable)).toThrow(
      /Missing "defaultLanguage" option.*does not contain "en"/
    )
  })

  test('returns existing translations for supported languages', () => {
    expect(translate('Settings', 'en')).toBe('Settings')
    expect(translate('Settings', 'de')).toBe('Einstellungen')
  })

  test('uses configured active language when language argument is omitted', () => {
    setLanguage('de')

    expect(getLanguage()).toBe('de')
    expect(translate('Settings')).toBe('Einstellungen')
  })

  test('supports category scoped lookups via translateIn', () => {
    expect(translateIn('default', 'Settings', 'de')).toBe('Einstellungen')
    expect(translateIn('common', 'Settings', 'de')).toBe('common.Settings')
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
      language: 'fr',
      missingStrategy: 'strict',
    })

    expect(customRuntime.getLanguage()).toBe('fr')
    expect(customRuntime.translate('hello')).toBe('Bonjour')
    customRuntime.setLanguage('en')
    expect(customRuntime.translate('hello')).toBe('Hello')

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
