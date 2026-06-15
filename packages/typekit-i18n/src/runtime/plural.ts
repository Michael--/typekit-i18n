/**
 * Lightweight plural helpers for use with the basic translator.
 *
 * These wrap `Intl.PluralRules` and generate suffixed keys
 * compatible with a convention-based translation table layout:
 *
 *   item_count_one:   "{count} item"
 *   item_count_other: "{count} items"
 *
 * No ICU syntax required on the runtime side.
 */

/**
 * Returns the plural category for a numeric value in a given locale.
 *
 * Uses `Intl.PluralRules` with cardinal plural selection.
 *
 * @param count Numeric value to categorize.
 * @param locale Locale string (defaults to `"en"`).
 * @returns Plural category: `"zero" | "one" | "two" | "few" | "many" | "other"`.
 */
export const pluralCategory = (count: number, locale = 'en'): Intl.LDMLPluralRule =>
  new Intl.PluralRules(locale).select(count)

/**
 * Builds a plural-aware translation key by appending the plural category.
 *
 * @param baseKey Base translation key without suffix.
 * @param count Numeric value to determine the plural form.
 * @param locale Locale string (defaults to `"en"`).
 * @returns Suffixed key: `"${baseKey}_${category}"`.
 *
 * @example
 *   pluralKey('item_count', 1)          // → "item_count_one"
 *   pluralKey('item_count', 5)          // → "item_count_other"
 *   pluralKey('item_count', 0, 'ar')    // → "item_count_zero"
 */
export const pluralKey = (baseKey: string, count: number, locale?: string): string =>
  `${baseKey}_${pluralCategory(count, locale)}`
