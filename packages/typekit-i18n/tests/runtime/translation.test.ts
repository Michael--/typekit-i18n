import { describe, expect, test, vi } from 'vitest'
import {
  createTranslationRuntime,
  createConsoleMissingTranslationReporter,
} from '../../src/runtime/translation.js'
import type { TranslationTable } from '../../src/runtime/types.js'

describe('createTranslationRuntime', () => {
  test('defaults to "en" when defaultLanguage is omitted', () => {
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

  test('throws when "en" is unavailable and defaultLanguage is omitted', () => {
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

  test('collects missing events when collection is enabled', () => {
    type LocalLanguage = 'en' | 'de'
    type LocalKey = 'greeting' | 'missing'

    const localTable: TranslationTable<LocalKey, LocalLanguage> = {
      greeting: {
        description: 'Greeting text',
        en: 'Hello',
        de: 'Hallo',
      },
      missing: {
        description: 'Missing key',
        en: '',
        de: '',
      },
    }

    const runtime = createTranslationRuntime(localTable, {
      defaultLanguage: 'en',
      collectMissingTranslations: true,
    })

    expect(runtime.translate('missing', 'de')).toBe('missing')
    expect(runtime.getCollectedMissingTranslations()).toHaveLength(1)
  })

  test('throws in strict mode when translation is missing', () => {
    type LocalLanguage = 'en' | 'de'
    type LocalKey = 'greeting' | 'missing'

    const localTable: TranslationTable<LocalKey, LocalLanguage> = {
      greeting: {
        description: 'Greeting text',
        en: 'Hello',
        de: 'Hallo',
      },
      missing: {
        description: 'Missing key',
        en: '',
        de: '',
      },
    }

    const runtime = createTranslationRuntime(localTable, {
      defaultLanguage: 'en',
      missingStrategy: 'strict',
    })

    expect(() => runtime.translate('missing', 'de')).toThrow(/Missing translation/)
  })

  test('uses optional console reporter', () => {
    type LocalLanguage = 'en' | 'de'
    type LocalKey = 'greeting' | 'missing'

    const localTable: TranslationTable<LocalKey, LocalLanguage> = {
      greeting: {
        description: 'Greeting text',
        en: 'Hello',
        de: 'Hallo',
      },
      missing: {
        description: 'Missing key',
        en: '',
        de: '',
      },
    }

    const warn = vi.fn()
    const runtime = createTranslationRuntime(localTable, {
      defaultLanguage: 'en',
      onMissingTranslation: createConsoleMissingTranslationReporter({ warn }),
    })

    runtime.translate('missing', 'de')

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing translation for key "missing"')
    )
  })

  test('creates isolated runtime with custom formatters', () => {
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
