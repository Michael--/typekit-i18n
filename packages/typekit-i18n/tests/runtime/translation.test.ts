import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TranslateKeys } from '../../src/generated/translationTable.js'
import {
  clearCollectedMissingTranslations,
  configureTranslationRuntime,
  createConsoleMissingTranslationReporter,
  getCollectedMissingTranslations,
  translate,
} from '../../src/runtime/translation.js'

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
        reason: 'missing_key',
      },
    ])
  })

  test('throws in strict mode when translation is missing', () => {
    configureTranslationRuntime({
      missingStrategy: 'strict',
    })

    expect(() => translate(missingKey, 'de')).toThrow(
      /Missing translation for key "__missing_translation_key__".*reason "missing_key"/
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
})
