import {
  IcuTranslatorOptions,
  MissingTranslationEvent,
  Placeholder,
  TranslationTable,
} from './types.js'
import { CompiledIcuTemplate, IcuRenderContext, renderIcuMessage } from './icuRenderer.js'
import type { TranslatorApi } from './translator.js'
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

/**
 * Supported ICU subset:
 * - `{var, select, key {...} other {...}}`
 * - `{var, plural, =0 {...} one {...} other {...}}`
 * - `{var, plural, offset:1 one {...} other {...}}`
 * - `{var, selectordinal, one {...} two {...} few {...} other {...}}`
 * - `{var, number[, style-or-skeleton]}`
 * - `{var, date[, style-or-skeleton]}`
 * - `{var, time[, style-or-skeleton]}`
 * - `#` replacement inside plural branches
 * - Apostrophe escaping: `''` for literal `'`, `'{...}'` for literal text
 */

const toMissingTranslationMessage = <TKey extends string, TLanguage extends string>(
  event: MissingTranslationEvent<TKey, TLanguage>
): string =>
  `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`

const toScopedMissingKey = (category: string, key: string): string => `${category}.${key}`

const toPlaceholderValueMap = (
  placeholder?: Placeholder
): Record<string, import('./types.js').PlaceholderValue> => {
  const values: Record<string, import('./types.js').PlaceholderValue> = {}
  placeholder?.data.forEach((entry) => {
    values[entry.key] = entry.value
  })
  return values
}

/**
 * Creates a typed translator that supports a pragmatic subset of ICU message syntax.
 *
 * Supported syntax:
 * - `{name}` and `{name|formatter}` placeholders
 * - `{count, plural, one {...} other {...}}` with exact matches like `=0`
 * - `{count, plural, offset:1 one {...} other {...}}` for offset handling
 * - `{value, select, key {...} other {...}}`
 * - `{place, selectordinal, one {...} two {...} few {...} other {...}}`
 * - `{amount, number, ::currency/EUR}` and `{ratio, number, percent}`
 * - `{date, date, short}` and `{date, time, ::HH:mm}`
 *
 * @param table Translation table keyed by typed translation keys.
 * @param options Translator behavior options with optional ICU locale overrides.
 * @returns Runtime translate function with typed key/language parameters.
 */
export const createIcuTranslator = <TTable extends TranslationTable<string, string>>(
  table: TTable,
  options?: IcuTranslatorOptions<
    TranslationKeyFromTable<TTable>,
    TranslationLanguageFromTable<TTable>
  >
): TranslatorApi<TranslationLanguageFromTable<TTable>, TranslationKeyFromTable<TTable>, TTable> => {
  const resolvedOptions: IcuTranslatorOptions<
    TranslationKeyFromTable<TTable>,
    TranslationLanguageFromTable<TTable>
  > = options ?? {}
  type TKey = TranslationKeyFromTable<TTable>
  type TLanguage = TranslationLanguageFromTable<TTable>
  const missingStrategy = resolvedOptions.missingStrategy ?? 'fallback'
  const defaultLanguage = resolveDefaultLanguage(table, resolvedOptions.defaultLanguage)
  const scopedKeyLookup = createScopedKeyLookup(table)
  let currentLanguage = resolvedOptions.language ?? defaultLanguage
  const pluralRulesCache = new Map<string, Intl.PluralRules>()
  const numberFormatCache = new Map<string, Intl.NumberFormat>()
  const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>()
  const compiledTemplateCache = new Map<string, CompiledIcuTemplate>()

  const handleMissing = (event: MissingTranslationEvent<TKey, TLanguage>): void => {
    resolvedOptions.onMissingTranslation?.(event)
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
      const context: IcuRenderContext<TKey, TLanguage> = {
        key,
        language,
        defaultLanguage,
        values: toPlaceholderValueMap(placeholder),
        formatters: resolvedOptions.formatters,
        localeByLanguage: resolvedOptions.localeByLanguage,
        pluralRulesCache,
        numberFormatCache,
        dateTimeFormatCache,
        compiledTemplateCache,
      }
      return renderIcuMessage(requestedText, context)
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
      const context: IcuRenderContext<TKey, TLanguage> = {
        key,
        language,
        defaultLanguage,
        values: toPlaceholderValueMap(placeholder),
        formatters: resolvedOptions.formatters,
        localeByLanguage: resolvedOptions.localeByLanguage,
        pluralRulesCache,
        numberFormatCache,
        dateTimeFormatCache,
        compiledTemplateCache,
      }
      return renderIcuMessage(fallbackText, context)
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
