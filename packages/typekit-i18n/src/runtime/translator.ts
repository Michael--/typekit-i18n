import { Placeholder, TranslationTable, TranslatorOptions } from './types.js'

const applyPlaceholders = (template: string, placeholder?: Placeholder): string => {
  let output = template
  placeholder?.data.forEach((entry) => {
    output = output.replace(new RegExp(`{${entry.key}}`, 'g'), entry.value)
  })
  return output
}

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
  return (key: TKey, language: TLanguage, placeholder?: Placeholder): string => {
    const translation = table[key]
    if (!translation) {
      options.onMissingTranslation?.({
        key,
        language,
        defaultLanguage: options.defaultLanguage,
      })
      return key
    }

    const requestedText = translation[language]
    if (requestedText.length > 0) {
      return applyPlaceholders(requestedText, placeholder)
    }

    const fallbackText = translation[options.defaultLanguage]
    if (fallbackText.length > 0) {
      options.onMissingTranslation?.({
        key,
        language,
        defaultLanguage: options.defaultLanguage,
      })
      return applyPlaceholders(fallbackText, placeholder)
    }

    options.onMissingTranslation?.({
      key,
      language,
      defaultLanguage: options.defaultLanguage,
    })
    return key
  }
}
