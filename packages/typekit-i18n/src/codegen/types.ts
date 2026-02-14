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
   * Optional output file path for the canonical translation contract JSON artifact.
   * Defaults to `translation.contract.json` in the same directory as `output`.
   */
  outputContract?: string
  /**
   * Supported language columns in the input resources.
   */
  languages: ReadonlyArray<TLanguage>
  /**
   * Default fallback language.
   */
  defaultLanguage: TLanguage
  /**
   * Optional locale mapping used by ICU-aware consumers.
   * Keys must be part of `languages`.
   */
  localeByLanguage?: Partial<Record<TLanguage, string>>
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
   * Optional review workflow status.
   */
  status?: 'draft' | 'review' | 'approved'
  /**
   * Optional tags for grouping/filtering.
   */
  tags?: ReadonlyArray<string>
  /**
   * Optional declared placeholders.
   */
  placeholders?: ReadonlyArray<{
    /**
     * Placeholder name used in template values.
     */
    name: string
    /**
     * Optional semantic type hint.
     */
    type?: 'string' | 'number' | 'boolean' | 'date' | 'currency'
    /**
     * Optional formatter hint used by tooling.
     */
    formatHint?: string
  }>
  /**
   * Per-language translation values.
   */
  values: Record<TLanguage, string>
}
