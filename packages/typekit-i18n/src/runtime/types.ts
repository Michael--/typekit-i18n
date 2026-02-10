/**
 * A single key/value placeholder entry used for text interpolation.
 */
export interface FormatPlaceholder {
  /**
   * Placeholder key without curly braces.
   */
  key: string
  /**
   * Placeholder replacement value.
   */
  value: string
}

/**
 * Placeholder payload for translation interpolation.
 */
export interface Placeholder {
  /**
   * Placeholder entries that can be injected into a translated text.
   */
  data: ReadonlyArray<FormatPlaceholder>
}

/**
 * Translation entry for one key.
 */
export type TranslationEntry<TLanguage extends string> = {
  /**
   * Human-readable context of the translation key.
   */
  description: string
} & Record<TLanguage, string>

/**
 * Full translation table keyed by translation key.
 */
export type TranslationTable<TKey extends string, TLanguage extends string> = Record<
  TKey,
  TranslationEntry<TLanguage>
>

/**
 * Metadata about a missing translation event.
 */
export interface MissingTranslationEvent<TKey extends string, TLanguage extends string> {
  /**
   * Requested key.
   */
  key: TKey
  /**
   * Requested language.
   */
  language: TLanguage
  /**
   * Fallback language.
   */
  defaultLanguage: TLanguage
  /**
   * Missing translation reason.
   */
  reason: MissingTranslationReason
}

/**
 * Missing translation reason categories.
 */
export type MissingTranslationReason = 'missing_key' | 'missing_language' | 'missing_fallback'

/**
 * Behavior strategy for missing translations.
 */
export type MissingTranslationStrategy = 'fallback' | 'strict'

/**
 * Runtime configuration for translator creation.
 */
export interface TranslatorOptions<TKey extends string, TLanguage extends string> {
  /**
   * Default fallback language.
   */
  defaultLanguage: TLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional callback for missing translation reporting.
   */
  onMissingTranslation?: (event: MissingTranslationEvent<TKey, TLanguage>) => void
}
