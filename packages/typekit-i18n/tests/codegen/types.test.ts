import { describe, expect, test } from 'vitest'
import { defineTypekitI18nConfig } from '../../src/codegen/types.js'

describe('defineTypekitI18nConfig', () => {
  test('infers language union from languages tuple', () => {
    const config = defineTypekitI18nConfig({
      input: ['./translations/*.csv'],
      output: './generated/translationTable.ts',
      outputKeys: './generated/translationKeys.ts',
      languages: ['en', 'de'] as const,
      defaultLanguage: 'en',
    })

    const language: 'en' | 'de' = config.defaultLanguage
    expect(language).toBe('en')
    expect(config.languages).toEqual(['en', 'de'])
  })
})
