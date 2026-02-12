import {
  MissingTranslationEvent,
  Placeholder,
  PlaceholderFormatterMap,
  TranslationTable,
  TranslatorOptions,
} from './types.js'
import {
  createScopedKeyLookup,
  resolveDefaultLanguage,
  resolveScopedKey,
  resolveTranslateCallArguments,
  TranslationCategoryFromTable,
  TranslationKeyFromTable,
  TranslationLanguageFromTable,
  TranslationKeyOfCategoryFromTable,
} from './scoped.js'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const applyPlaceholders = <TKey extends string, TLanguage extends string>(
  template: string,
  placeholder: Placeholder | undefined,
  key: TKey,
  language: TLanguage,
  defaultLanguage: TLanguage,
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
): string => {
  if (!placeholder) {
    return template
  }

  let output = template
  placeholder.data.forEach((entry) => {
    const fallbackValue = String(entry.value)
    const matcher = new RegExp(`\\{${escapeRegExp(entry.key)}(?:\\|([a-zA-Z0-9_-]+))?\\}`, 'g')
    output = output.replace(matcher, (_match: string, formatterName?: string) => {
      if (!formatterName) {
        return fallbackValue
      }

      const formatter = formatters?.[formatterName]
      if (!formatter) {
        return fallbackValue
      }

      return formatter(entry.value, {
        key,
        language,
        defaultLanguage,
        placeholderKey: entry.key,
        formatter: formatterName,
      })
    })
  })
  return output
}

const toMissingTranslationMessage = <TKey extends string, TLanguage extends string>(
  event: MissingTranslationEvent<TKey, TLanguage>
): string =>
  `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`

const toScopedMissingKey = (category: string, key: string): string => `${category}.${key}`

/**
 * Translate API returned by `createTranslator`.
 */
export interface TranslatorApi<
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
> {
  /**
   * Translates one key in the active or explicitly provided language.
   *
   * @param key Global translation key.
   * @param languageOrPlaceholder Optional language or placeholder payload.
   * @param placeholder Optional placeholder payload.
   * @returns Translated string or key fallback.
   */
  (key: TKey, languageOrPlaceholder?: TLanguage | Placeholder, placeholder?: Placeholder): string
  /**
   * Translates one key scoped by category.
   *
   * @param category Translation category.
   * @param key Category-scoped translation key.
   * @param languageOrPlaceholder Optional language or placeholder payload.
   * @param placeholder Optional placeholder payload.
   * @returns Translated string or key fallback.
   */
  translateIn: <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory,
    key: TranslationKeyOfCategoryFromTable<TTable, TCategory>,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ) => string
  /**
   * Creates a translate function pre-bound to one category.
   *
   * @param category Translation category.
   * @returns Category-scoped translate function.
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
   * Returns the currently active language.
   *
   * @returns Active language.
   */
  getLanguage: () => TLanguage
}

/**
 * Creates a typed translator bound to a translation table.
 *
 * @param table Translation table keyed by typed translation keys.
 * @param options Translator behavior options.
 * @returns Runtime translate function with typed key/language parameters.
 */
export const createTranslator = <TTable extends TranslationTable<string, string>>(
  table: TTable,
  options: TranslatorOptions<
    TranslationKeyFromTable<TTable>,
    TranslationLanguageFromTable<TTable>
  > = {}
): TranslatorApi<TranslationLanguageFromTable<TTable>, TranslationKeyFromTable<TTable>, TTable> => {
  type TKey = TranslationKeyFromTable<TTable>
  type TLanguage = TranslationLanguageFromTable<TTable>
  const missingStrategy = options.missingStrategy ?? 'fallback'
  const defaultLanguage = resolveDefaultLanguage(table, options.defaultLanguage)
  const scopedKeyLookup = createScopedKeyLookup(table)
  let currentLanguage = options.language ?? defaultLanguage

  const handleMissing = (event: MissingTranslationEvent<TKey, TLanguage>): void => {
    options.onMissingTranslation?.(event)
    if (missingStrategy === 'strict') {
      throw new Error(toMissingTranslationMessage(event))
    }
  }

  const translateByKey = (key: TKey, language: TLanguage, placeholder?: Placeholder): string => {
    const translation = table[key]
    if (!translation) {
      handleMissing({
        key,
        language,
        defaultLanguage,
        reason: 'missingKey',
      })
      return key
    }

    const requestedText = translation[language]
    if (requestedText.length > 0) {
      return applyPlaceholders(
        requestedText,
        placeholder,
        key,
        language,
        defaultLanguage,
        options.formatters
      )
    }

    const fallbackText = translation[defaultLanguage]
    handleMissing({
      key,
      language,
      defaultLanguage,
      reason:
        typeof fallbackText === 'string' && fallbackText.length > 0
          ? 'missingLanguage'
          : 'missingFallback',
    })

    if (typeof fallbackText === 'string' && fallbackText.length > 0) {
      return applyPlaceholders(
        fallbackText,
        placeholder,
        key,
        language,
        defaultLanguage,
        options.formatters
      )
    }

    return key
  }

  const translate = ((
    key: TKey,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ): string => {
    const resolved = resolveTranslateCallArguments(
      currentLanguage,
      languageOrPlaceholder,
      placeholder
    )
    return translateByKey(key, resolved.language, resolved.placeholder)
  }) as TranslatorApi<TLanguage, TKey, TTable>

  translate.translateIn = <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory,
    key: TranslationKeyOfCategoryFromTable<TTable, TCategory>,
    languageOrPlaceholder?: TLanguage | Placeholder,
    placeholder?: Placeholder
  ): string => {
    const resolved = resolveTranslateCallArguments(
      currentLanguage,
      languageOrPlaceholder,
      placeholder
    )
    const fullKey = resolveScopedKey(scopedKeyLookup, category, key)
    if (fullKey) {
      return translateByKey(fullKey as TKey, resolved.language, resolved.placeholder)
    }

    const scopedMissingKey = toScopedMissingKey(category, key)
    handleMissing({
      key: scopedMissingKey as TKey,
      language: resolved.language,
      defaultLanguage,
      reason: 'missingKey',
    })
    return scopedMissingKey
  }

  translate.withCategory = <TCategory extends TranslationCategoryFromTable<TTable>>(
    category: TCategory
  ) => {
    return (
      key: TranslationKeyOfCategoryFromTable<TTable, TCategory>,
      languageOrPlaceholder?: TLanguage | Placeholder,
      placeholder?: Placeholder
    ): string => translate.translateIn(category, key, languageOrPlaceholder, placeholder)
  }

  translate.setLanguage = (language: TLanguage): void => {
    currentLanguage = language
  }

  translate.getLanguage = (): TLanguage => currentLanguage

  return translate
}
