import { createTranslator } from './translator.js'
import { Placeholder } from './types.js'
import {
  TranslateLanguage,
  TranslateKeys,
  translationTable,
} from '../generated/translationTable.js'

/**
 * Supported language codes.
 */
export const Iso639Codes = ['en', 'de'] as const

/**
 * Supported language code type.
 */
export type Iso639CodeType = (typeof Iso639Codes)[number]

/**
 * Language metadata entry.
 */
export interface ILanguage {
  /**
   * Human-readable language name.
   */
  name: string
  /**
   * Language code.
   */
  iso: Iso639CodeType
}

/**
 * Supported languages list.
 */
export const supportedLanguages: ReadonlyArray<ILanguage> = [
  { name: 'English', iso: 'en' },
  { name: 'Deutsch', iso: 'de' },
]

const baseTranslator = createTranslator<TranslateLanguage, TranslateKeys, typeof translationTable>(
  translationTable,
  {
    defaultLanguage: 'en',
    onMissingTranslation: (event) => {
      console.warn(
        `Missing translation for key "${event.key}" in "${event.language}", fallback "${event.defaultLanguage}"`
      )
    },
  }
)

/**
 * Translates a key using the generated default translation table.
 *
 * @param key Translation key.
 * @param language Target language.
 * @param placeholder Optional placeholder replacements.
 * @returns Translated string or key fallback.
 */
export const translate = (
  key: TranslateKeys,
  language: Iso639CodeType,
  placeholder?: Placeholder
): string => {
  return baseTranslator(key, language, placeholder)
}
