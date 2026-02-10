/**
 * Supported IR version.
 */
export type TranslationIrVersion = '1'

/**
 * Optional translation workflow status.
 */
export type TranslationIrEntryStatus = 'draft' | 'review' | 'approved'

/**
 * Optional placeholder type hints in IR.
 */
export type TranslationIrPlaceholderType = 'string' | 'number' | 'boolean' | 'date' | 'currency'

/**
 * Placeholder metadata in IR.
 */
export interface TranslationIrPlaceholder {
  /**
   * Placeholder name used in template values.
   */
  name: string
  /**
   * Optional semantic type hint.
   */
  type?: TranslationIrPlaceholderType
  /**
   * Optional formatter hint used by tooling.
   */
  formatHint?: string
}

/**
 * One normalized translation entry in IR.
 */
export interface TranslationIrEntry<TLanguage extends string = string> {
  /**
   * Stable translation key.
   */
  key: string
  /**
   * Translator/developer context.
   */
  description: string
  /**
   * Optional tags for grouping/filtering.
   */
  tags?: ReadonlyArray<string>
  /**
   * Optional review workflow status.
   */
  status?: TranslationIrEntryStatus
  /**
   * Optional declared placeholders.
   */
  placeholders?: ReadonlyArray<TranslationIrPlaceholder>
  /**
   * Per-language translated values.
   */
  values: Record<TLanguage, string>
}

/**
 * Project-level translation IR object.
 */
export interface TranslationIrProject<TLanguage extends string = string> {
  /**
   * IR schema version.
   */
  version: TranslationIrVersion
  /**
   * Project fallback/source language.
   */
  sourceLanguage: TLanguage
  /**
   * Supported project languages.
   */
  languages: ReadonlyArray<TLanguage>
  /**
   * All normalized translation entries.
   */
  entries: ReadonlyArray<TranslationIrEntry<TLanguage>>
}
