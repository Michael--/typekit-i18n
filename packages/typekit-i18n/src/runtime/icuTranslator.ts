import {
  IcuTranslatorOptions,
  MissingTranslationEvent,
  Placeholder,
  TranslationTable,
} from './types.js'
import { CompiledIcuTemplate, IcuRenderContext, renderIcuMessage } from './icuRenderer.js'

/**
 * Supported ICU subset:
 * - `{var, select, key {...} other {...}}`
 * - `{var, plural, =0 {...} one {...} other {...}}`
 * - `{var, plural, offset:1 one {...} other {...}}`
 * - `{var, selectordinal, one {...} two {...} few {...} other {...}}`
 * - `#` replacement inside plural branches
 * - Apostrophe escaping: `''` for literal `'`, `'{...}'` for literal text
 *
 * TODO(icu-next):
 * - Add support for ICU argument formats like `number`, `date`, and `time` (with style/skeleton handling).
 * - Validate selector quality in parser/options (duplicate selectors and invalid selector forms).
 * - Throw strict syntax errors for unmatched closing braces (`}`) in message templates.
 */

const toMissingTranslationMessage = <TKey extends string, TLanguage extends string>(
  event: MissingTranslationEvent<TKey, TLanguage>
): string =>
  `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`

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
 *
 * @param table Translation table keyed by typed translation keys.
 * @param options Translator behavior options with optional ICU locale overrides.
 * @returns Runtime translate function with typed key/language parameters.
 */
export const createIcuTranslator = <
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
>(
  table: TTable,
  options: IcuTranslatorOptions<TKey, TLanguage>
): ((key: TKey, language: TLanguage, placeholder?: Placeholder) => string) => {
  const missingStrategy = options.missingStrategy ?? 'fallback'
  const pluralRulesCache = new Map<string, Intl.PluralRules>()
  const numberFormatCache = new Map<string, Intl.NumberFormat>()
  const compiledTemplateCache = new Map<string, CompiledIcuTemplate>()

  const handleMissing = (event: MissingTranslationEvent<TKey, TLanguage>): void => {
    options.onMissingTranslation?.(event)
    if (missingStrategy === 'strict') {
      throw new Error(toMissingTranslationMessage(event))
    }
  }

  return (key: TKey, language: TLanguage, placeholder?: Placeholder): string => {
    const translation = table[key]
    if (!translation) {
      handleMissing({
        key,
        language,
        defaultLanguage: options.defaultLanguage,
        reason: 'missingKey',
      })
      return key
    }

    const requestedText = translation[language]
    if (requestedText.length > 0) {
      const context: IcuRenderContext<TKey, TLanguage> = {
        key,
        language,
        defaultLanguage: options.defaultLanguage,
        values: toPlaceholderValueMap(placeholder),
        formatters: options.formatters,
        localeByLanguage: options.localeByLanguage,
        pluralRulesCache,
        numberFormatCache,
        compiledTemplateCache,
      }
      return renderIcuMessage(requestedText, context)
    }

    const fallbackText = translation[options.defaultLanguage]
    handleMissing({
      key,
      language,
      defaultLanguage: options.defaultLanguage,
      reason: fallbackText.length > 0 ? 'missingLanguage' : 'missingFallback',
    })

    if (fallbackText.length > 0) {
      const context: IcuRenderContext<TKey, TLanguage> = {
        key,
        language,
        defaultLanguage: options.defaultLanguage,
        values: toPlaceholderValueMap(placeholder),
        formatters: options.formatters,
        localeByLanguage: options.localeByLanguage,
        pluralRulesCache,
        numberFormatCache,
        compiledTemplateCache,
      }
      return renderIcuMessage(fallbackText, context)
    }

    return key
  }
}
