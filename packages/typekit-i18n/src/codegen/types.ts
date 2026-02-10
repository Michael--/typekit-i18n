/**
 * Generator configuration used to transform CSV translation files into a typed table module.
 */
export interface TypekitI18nConfig<TLanguage extends string = string> {
  /**
   * Input file pattern(s), resolved from current working directory.
   */
  input: string | ReadonlyArray<string>
  /**
   * Output file path for generated TypeScript module.
   */
  output: string
  /**
   * Supported language columns in the input resources.
   */
  languages: ReadonlyArray<TLanguage>
  /**
   * Default fallback language.
   */
  defaultLanguage: TLanguage
}

/**
 * Internal CSV row representation.
 */
export type TranslationCsvRow = Record<string, string>

/**
 * Normalized translation record after validation.
 */
export interface TranslationRecord<TLanguage extends string = string> {
  /**
   * Translation key used in source code.
   */
  key: string
  /**
   * Human-readable translator context.
   */
  description: string
  /**
   * Per-language translation values.
   */
  values: Record<TLanguage, string>
}
