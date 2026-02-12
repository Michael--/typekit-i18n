/**
 * Supported input resource formats for generation.
 */
export type TranslationInputFormat = 'csv' | 'yaml'

/**
 * Generator configuration used to transform translation resources into a typed table module.
 */
export interface TypekitI18nConfig<TLanguage extends string = string> {
  /**
   * Input file pattern(s), resolved from current working directory.
   */
  input: string | ReadonlyArray<string>
  /**
   * Optional input file format override for all configured files.
   * When omitted, each file format is inferred from extension (`.yaml`/`.yml` => `yaml`, otherwise `csv`).
   */
  format?: TranslationInputFormat
  /**
   * Output file path for generated TypeScript module.
   */
  output: string
  /**
   * Optional output file path for generated key/language type exports.
   * Defaults to `translationKeys.ts` in the same directory as `output`.
   */
  outputKeys?: string
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
 * Helper input type for strongly typed config inference from language tuples.
 */
export type TypekitI18nConfigDefinition<TLanguages extends readonly [string, ...string[]]> = Omit<
  TypekitI18nConfig<TLanguages[number]>,
  'languages' | 'defaultLanguage'
> & {
  /**
   * Supported language columns in the input resources.
   */
  languages: TLanguages
  /**
   * Default fallback language.
   */
  defaultLanguage: TLanguages[number]
}

/**
 * Defines Typekit i18n config with language union inferred from `languages`.
 *
 * @param config Config object with non-empty language tuple.
 * @returns Unchanged config object with inferred language union typing.
 */
export const defineTypekitI18nConfig = <const TLanguages extends readonly [string, ...string[]]>(
  config: TypekitI18nConfigDefinition<TLanguages>
): TypekitI18nConfig<TLanguages[number]> => config

/**
 * Internal CSV row representation.
 */
export type TranslationCsvRow = Record<string, string>

/**
 * Normalized translation record after validation.
 */
export interface TranslationRecord<TLanguage extends string = string> {
  /**
   * Optional category used for scoped key access.
   * Empty source values are normalized to `default`.
   */
  category: string
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
