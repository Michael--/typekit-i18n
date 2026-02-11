import { PlaceholderValue } from './types.js'

/**
 * Resolves locale string from language with optional overrides.
 *
 * @param language Requested language code.
 * @param defaultLanguage Fallback language code.
 * @param localeByLanguage Optional locale overrides per language.
 * @returns Locale string for Intl APIs.
 */
export const toLocale = <TLanguage extends string>(
  language: TLanguage,
  defaultLanguage: TLanguage,
  localeByLanguage?: Partial<Record<TLanguage, string>>
): string => localeByLanguage?.[language] ?? localeByLanguage?.[defaultLanguage] ?? language

/**
 * Gets or creates a cached PluralRules instance.
 *
 * @param locale Locale string for plural rules.
 * @param cache Shared cache map.
 * @param type Cardinal or ordinal plural rules.
 * @returns Intl.PluralRules instance.
 */
export const toPluralRules = (
  locale: string,
  cache: Map<string, Intl.PluralRules>,
  type: Intl.PluralRulesOptions['type'] = 'cardinal'
): Intl.PluralRules => {
  const cacheKey = `${locale}|${type}`
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const created = new Intl.PluralRules(locale, { type })
    cache.set(cacheKey, created)
    return created
  } catch {
    const fallbackLocale = 'en'
    const fallbackKey = `${fallbackLocale}|${type}`
    const fallbackCached = cache.get(fallbackKey)
    if (fallbackCached) {
      return fallbackCached
    }
    const fallback = new Intl.PluralRules(fallbackLocale, { type })
    cache.set(fallbackKey, fallback)
    return fallback
  }
}

/**
 * Gets or creates a cached NumberFormat instance.
 *
 * @param locale Locale string for number formatting.
 * @param cache Shared cache map.
 * @returns Intl.NumberFormat instance.
 */
export const toNumberFormatter = (
  locale: string,
  cache: Map<string, Intl.NumberFormat>
): Intl.NumberFormat => {
  const cached = cache.get(locale)
  if (cached) {
    return cached
  }

  try {
    const created = new Intl.NumberFormat(locale)
    cache.set(locale, created)
    return created
  } catch {
    const fallbackLocale = 'en'
    const fallbackCached = cache.get(fallbackLocale)
    if (fallbackCached) {
      return fallbackCached
    }
    const fallback = new Intl.NumberFormat(fallbackLocale)
    cache.set(fallbackLocale, fallback)
    return fallback
  }
}

/**
 * Converts a placeholder value to a numeric value for plural selection.
 *
 * @param value Placeholder value.
 * @returns Finite number or 0.
 */
export const toNumericValue = (value: PlaceholderValue | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'bigint') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : 0
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}
