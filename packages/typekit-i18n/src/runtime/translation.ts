import { createTranslator } from './translator.js'
import {
  resolveDefaultLanguage,
  TranslationCategoryFromTable,
  TranslationKeyFromTable,
  TranslationKeyOfCategoryFromTable,
  TranslationLanguageFromTable,
} from './scoped.js'
import {
  MissingTranslationEvent,
  MissingTranslationStrategy,
  Placeholder,
  PlaceholderFormatterMap,
  TranslationTable,
} from './types.js'

/**
 * Runtime configuration options.
 */
export interface TranslationRuntimeConfiguration<TLanguage extends string, TKey extends string> {
  /**
   * Default fallback language.
   */
  defaultLanguage?: TLanguage
  /**
   * Active language used when translate calls omit `language`.
   */
  language?: TLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional runtime callback for missing translation reporting.
   * Pass `null` to clear the current callback.
   */
  onMissingTranslation?: ((event: MissingTranslationEvent<TKey, TLanguage>) => void) | null
  /**
   * Optional placeholder formatter hooks.
   * Pass `null` to clear configured formatters.
   */
  formatters?: PlaceholderFormatterMap<TKey, TLanguage> | null
  /**
   * Enables in-memory collection of missing translation events.
   */
  collectMissingTranslations?: boolean
}

/**
 * Runtime API object.
 */
export interface TranslationRuntime<
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
> {
  /**
   * Translates one key in the active or explicitly provided language.
   *
   * @param key Translation key.
   * @param languageOrPlaceholder Optional language or placeholder replacements.
   * @param placeholder Optional placeholder replacements.
   * @returns Translated string or key fallback.
   * @throws When `missingStrategy` is `strict` and a translation cannot be resolved.
   */
  translate: (
    key: TKey,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ) => string
  /**
   * Translates one key inside one category.
   *
   * @param category Translation category.
   * @param key Category-scoped translation key.
   * @param languageOrPlaceholder Optional language or placeholder replacements.
   * @param placeholder Optional placeholder replacements.
   * @returns Translated string or key fallback.
   * @throws When `missingStrategy` is `strict` and a translation cannot be resolved.
   */
  translateIn: <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory,
    key: TranslationKeyOfCategoryFromTable<TTable, TCategory>,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ) => string
  /**
   * Creates one translator bound to a fixed category.
   *
   * @param category Translation category.
   * @returns Category scoped translate function.
   */
  withCategory: <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory
  ) => (
    key: TranslationKeyOfCategoryFromTable<TTable, TCategory>,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ) => string
  /**
   * Sets the active language used when translate calls omit `language`.
   *
   * @param language Active language.
   * @returns Nothing.
   */
  setLanguage: (language: TLanguage) => void
  /**
   * Returns the active language used by translate calls without language argument.
   *
   * @returns Active language.
   */
  getLanguage: () => TLanguage
  /**
   * Updates runtime behavior.
   *
   * @param options Runtime behavior overrides.
   * @returns Nothing.
   */
  configure: (options: TranslationRuntimeConfiguration<TLanguage, TKey>) => void
  /**
   * Returns collected missing translation events.
   *
   * @returns Missing translation events snapshot.
   */
  getCollectedMissingTranslations: () => ReadonlyArray<MissingTranslationEvent<TKey, TLanguage>>
  /**
   * Clears collected missing translation events.
   *
   * @returns Nothing.
   */
  clearCollectedMissingTranslations: () => void
}

/**
 * Initial options to create a translation runtime.
 */
export interface CreateTranslationRuntimeOptions<TLanguage extends string, TKey extends string> {
  /**
   * Default fallback language.
   * Defaults to `"en"` when omitted and available in the translation table.
   */
  defaultLanguage?: TLanguage
  /**
   * Active language used when translate calls omit `language`.
   * Defaults to `defaultLanguage`.
   */
  language?: TLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional runtime callback for missing translation reporting.
   */
  onMissingTranslation?: (event: MissingTranslationEvent<TKey, TLanguage>) => void
  /**
   * Optional placeholder formatter hooks.
   */
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  /**
   * Enables in-memory collection of missing translation events.
   */
  collectMissingTranslations?: boolean
}

interface TranslationRuntimeState<TLanguage extends string, TKey extends string> {
  defaultLanguage: TLanguage
  language: TLanguage
  missingStrategy: MissingTranslationStrategy
  onMissingTranslation?: (event: MissingTranslationEvent<TKey, TLanguage>) => void
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  collectMissingTranslations: boolean
}

/**
 * Creates a console warning reporter for missing translation events.
 *
 * @param writer Console-like logger target. Defaults to global console.
 * @returns Missing translation reporter callback.
 */
export const createConsoleMissingTranslationReporter = <
  TKey extends string = string,
  TLanguage extends string = string,
>(
  writer: Pick<Console, 'warn'> = console
): ((event: MissingTranslationEvent<TKey, TLanguage>) => void) => {
  return (event: MissingTranslationEvent<TKey, TLanguage>): void => {
    writer.warn(
      `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`
    )
  }
}

/**
 * Creates an isolated translation runtime bound to one translation table.
 *
 * @param table Translation table used by this runtime.
 * @param options Initial runtime options.
 * @returns Runtime API object.
 */
export const createTranslationRuntime = <TTable extends TranslationTable<string, string>>(
  table: TTable,
  options: CreateTranslationRuntimeOptions<
    TranslationLanguageFromTable<TTable>,
    TranslationKeyFromTable<TTable>
  > = {}
): TranslationRuntime<
  TranslationLanguageFromTable<TTable>,
  TranslationKeyFromTable<TTable>,
  TTable
> => {
  type TLanguage = TranslationLanguageFromTable<TTable>
  type TKey = TranslationKeyFromTable<TTable>
  const defaultLanguage = resolveDefaultLanguage(table, options.defaultLanguage)

  const runtimeState: TranslationRuntimeState<TLanguage, TKey> = {
    defaultLanguage,
    language: options.language ?? defaultLanguage,
    missingStrategy: options.missingStrategy ?? 'fallback',
    onMissingTranslation: options.onMissingTranslation,
    formatters: options.formatters,
    collectMissingTranslations: options.collectMissingTranslations ?? false,
  }

  const missingTranslationEvents: MissingTranslationEvent<TKey, TLanguage>[] = []

  const runtimeMissingTranslationHandler = (
    event: MissingTranslationEvent<TKey, TLanguage>
  ): void => {
    if (runtimeState.collectMissingTranslations) {
      missingTranslationEvents.push(event)
    }
    runtimeState.onMissingTranslation?.(event)
  }

  let runtimeTranslator = createTranslator(table, {
    defaultLanguage: runtimeState.defaultLanguage,
    language: runtimeState.language,
    missingStrategy: runtimeState.missingStrategy,
    formatters: runtimeState.formatters,
    onMissingTranslation: runtimeMissingTranslationHandler,
  })

  const rebuildRuntimeTranslator = (): void => {
    runtimeTranslator = createTranslator(table, {
      defaultLanguage: runtimeState.defaultLanguage,
      language: runtimeState.language,
      missingStrategy: runtimeState.missingStrategy,
      formatters: runtimeState.formatters,
      onMissingTranslation: runtimeMissingTranslationHandler,
    })
  }

  const configure = (nextOptions: TranslationRuntimeConfiguration<TLanguage, TKey>): void => {
    if (nextOptions.defaultLanguage) {
      runtimeState.defaultLanguage = nextOptions.defaultLanguage
    }
    if (nextOptions.language) {
      runtimeState.language = nextOptions.language
    }
    if (nextOptions.missingStrategy) {
      runtimeState.missingStrategy = nextOptions.missingStrategy
    }
    if (nextOptions.collectMissingTranslations !== undefined) {
      runtimeState.collectMissingTranslations = nextOptions.collectMissingTranslations
    }
    if ('onMissingTranslation' in nextOptions) {
      runtimeState.onMissingTranslation = nextOptions.onMissingTranslation ?? undefined
    }
    if ('formatters' in nextOptions) {
      runtimeState.formatters = nextOptions.formatters ?? undefined
    }

    rebuildRuntimeTranslator()
  }

  const getCollectedMissingTranslations = (): ReadonlyArray<
    MissingTranslationEvent<TKey, TLanguage>
  > => [...missingTranslationEvents]

  const clearCollectedMissingTranslations = (): void => {
    missingTranslationEvents.length = 0
  }

  const setLanguage = (language: TLanguage): void => {
    runtimeState.language = language
    runtimeTranslator.setLanguage(language)
  }

  const getLanguage = (): TLanguage => runtimeTranslator.getLanguage()

  const translateWithRuntime = (
    key: TKey,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ): string => runtimeTranslator(key, languageOrPlaceholder, placeholder)

  const translateInWithRuntime = <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory,
    key: TranslationKeyOfCategoryFromTable<TTable, TCategory>,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ): string => runtimeTranslator.translateIn(category, key, languageOrPlaceholder, placeholder)

  const withCategory = <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory
  ) => runtimeTranslator.withCategory(category)

  return {
    translate: translateWithRuntime,
    translateIn: translateInWithRuntime,
    withCategory,
    setLanguage,
    getLanguage,
    configure,
    getCollectedMissingTranslations,
    clearCollectedMissingTranslations,
  }
}
