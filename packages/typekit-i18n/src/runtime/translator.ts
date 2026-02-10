import {
  MissingTranslationEvent,
  Placeholder,
  PlaceholderFormatterMap,
  TranslationTable,
  TranslatorOptions,
} from './types.js'

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
    const matcher = new RegExp(`\\{${escapeRegExp(entry.key)}(?:\\|([a-zA-Z0-9_-]+))?\\}`, 'g')
    output = output.replace(matcher, (_match: string, formatterName?: string) => {
      if (!formatterName) {
        return entry.value
      }

      const formatter = formatters?.[formatterName]
      if (!formatter) {
        return entry.value
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

/**
 * Creates a typed translator bound to a translation table.
 *
 * @param table Translation table keyed by typed translation keys.
 * @param options Translator behavior options.
 * @returns Runtime translate function with typed key/language parameters.
 */
export const createTranslator = <
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
>(
  table: TTable,
  options: TranslatorOptions<TKey, TLanguage>
): ((key: TKey, language: TLanguage, placeholder?: Placeholder) => string) => {
  const missingStrategy = options.missingStrategy ?? 'fallback'

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
        reason: 'missing_key',
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
        options.defaultLanguage,
        options.formatters
      )
    }

    const fallbackText = translation[options.defaultLanguage]
    handleMissing({
      key,
      language,
      defaultLanguage: options.defaultLanguage,
      reason: fallbackText.length > 0 ? 'missing_language' : 'missing_fallback',
    })

    if (fallbackText.length > 0) {
      return applyPlaceholders(
        fallbackText,
        placeholder,
        key,
        language,
        options.defaultLanguage,
        options.formatters
      )
    }

    return key
  }
}
