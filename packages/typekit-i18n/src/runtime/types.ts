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
  value: PlaceholderValue
}

/**
 * Placeholder replacement value types.
 */
export type PlaceholderValue = string | number | boolean | bigint | Date

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
   * Optional category for scoped key access.
   * Empty/undefined values are treated as `default` at runtime.
   */
  category?: string
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
export type MissingTranslationReason = 'missingKey' | 'missingLanguage' | 'missingFallback'

/**
 * Behavior strategy for missing translations.
 */
export type MissingTranslationStrategy = 'fallback' | 'strict'

/**
 * Context passed to placeholder formatters.
 */
export interface PlaceholderFormatterContext<TKey extends string, TLanguage extends string> {
  /**
   * Translation key.
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
   * Placeholder key from the template.
   */
  placeholderKey: string
  /**
   * Formatter identifier from the template (e.g. `{value|currency}`).
   */
  formatter: string
}

/**
 * Placeholder formatter callback.
 */
export type PlaceholderFormatter<TKey extends string, TLanguage extends string> = (
  value: PlaceholderValue,
  context: PlaceholderFormatterContext<TKey, TLanguage>
) => string

/**
 * Map of available placeholder formatters by formatter identifier.
 */
export type PlaceholderFormatterMap<TKey extends string, TLanguage extends string> = Record<
  string,
  PlaceholderFormatter<TKey, TLanguage>
>

/**
 * Runtime configuration for translator creation.
 */
export interface TranslatorOptions<TKey extends string, TLanguage extends string> {
  /**
   * Default fallback language.
   */
  defaultLanguage: TLanguage
  /**
   * Initial active language used when translate calls omit `language`.
   * Defaults to `defaultLanguage`.
   */
  language?: TLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional placeholder formatter hooks.
   */
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  /**
   * Optional callback for missing translation reporting.
   */
  onMissingTranslation?: (event: MissingTranslationEvent<TKey, TLanguage>) => void
}

/**
 * Runtime configuration for ICU-capable translator creation.
 */
export interface IcuTranslatorOptions<
  TKey extends string,
  TLanguage extends string,
> extends TranslatorOptions<TKey, TLanguage> {
  /**
   * Optional locale overrides per language code used for ICU plural selection.
   */
  localeByLanguage?: Partial<Record<TLanguage, string>>
}
