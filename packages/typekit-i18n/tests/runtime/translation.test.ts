import { describe, expect, test } from 'vitest'
import { translate } from '../../src/runtime/translation.js'

describe('translate', () => {
  test('returns existing translations for supported languages', () => {
    expect(translate('Sun Position', 'en')).toBe('Sun Position')
    expect(translate('Sun Position', 'de')).toBe('Sonnenposition')
  })
})
