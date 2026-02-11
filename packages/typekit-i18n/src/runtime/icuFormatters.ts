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

const toFormatterCacheKey = (locale: string, options?: object): string =>
  options ? `${locale}|${JSON.stringify(options)}` : locale

/**
 * Gets or creates a cached NumberFormat instance.
 *
 * @param locale Locale string for number formatting.
 * @param cache Shared cache map.
 * @param options Optional Intl.NumberFormat options.
 * @returns Intl.NumberFormat instance.
 */
export const toNumberFormatter = (
  locale: string,
  cache: Map<string, Intl.NumberFormat>,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat => {
  const cacheKey = toFormatterCacheKey(locale, options)
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const created = new Intl.NumberFormat(locale, options)
    cache.set(cacheKey, created)
    return created
  } catch {
    const fallbackLocale = 'en'
    const fallbackKey = toFormatterCacheKey(fallbackLocale, options)
    const fallbackCached = cache.get(fallbackKey)
    if (fallbackCached) {
      return fallbackCached
    }
    const fallback = new Intl.NumberFormat(fallbackLocale, options)
    cache.set(fallbackKey, fallback)
    return fallback
  }
}

/**
 * Gets or creates a cached DateTimeFormat instance.
 *
 * @param locale Locale string for date/time formatting.
 * @param cache Shared cache map.
 * @param options Intl.DateTimeFormat options.
 * @returns Intl.DateTimeFormat instance.
 */
export const toDateTimeFormatter = (
  locale: string,
  cache: Map<string, Intl.DateTimeFormat>,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  const cacheKey = toFormatterCacheKey(locale, options)
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const created = new Intl.DateTimeFormat(locale, options)
    cache.set(cacheKey, created)
    return created
  } catch {
    const fallbackLocale = 'en'
    const fallbackKey = toFormatterCacheKey(fallbackLocale, options)
    const fallbackCached = cache.get(fallbackKey)
    if (fallbackCached) {
      return fallbackCached
    }
    const fallback = new Intl.DateTimeFormat(fallbackLocale, options)
    cache.set(fallbackKey, fallback)
    return fallback
  }
}

const parseCurrencyToken = (token: string): string | null => {
  if (!token.startsWith('currency')) {
    return null
  }
  if (token === 'currency') {
    return 'USD'
  }
  const separatorIndex = token.indexOf('/') >= 0 ? token.indexOf('/') : token.indexOf(':')
  if (separatorIndex < 0) {
    return null
  }
  const currency = token
    .slice(separatorIndex + 1)
    .trim()
    .toUpperCase()
  if (!/^[A-Z]{3}$/u.test(currency)) {
    return null
  }
  return currency
}

/**
 * Parses ICU number style or skeleton text into Intl.NumberFormat options.
 *
 * Supported styles:
 * - `integer`
 * - `percent`
 * - `currency`, `currency:EUR`, `currency/EUR`
 * - `compactShort`, `compactLong`
 *
 * Supported skeleton tokens (prefix `::`):
 * - `integer`
 * - `percent`
 * - `currency`, `currency/XXX`
 * - `compact-short`, `compact-long`
 *
 * @param styleSource Optional ICU style segment.
 * @returns Intl options or null for unsupported styles.
 */
export const toNumberFormatOptionsFromStyle = (
  styleSource?: string
): Intl.NumberFormatOptions | null => {
  const trimmedStyle = styleSource?.trim() ?? ''
  if (trimmedStyle.length === 0) {
    return {}
  }

  if (trimmedStyle.startsWith('::')) {
    const tokens = trimmedStyle
      .slice(2)
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
    if (tokens.length === 0) {
      return null
    }

    const options: Intl.NumberFormatOptions = {}
    for (const token of tokens) {
      const currency = parseCurrencyToken(token)
      if (currency !== null) {
        options.style = 'currency'
        options.currency = currency
        continue
      }
      if (token === 'integer') {
        options.maximumFractionDigits = 0
        options.minimumFractionDigits = 0
        continue
      }
      if (token === 'percent') {
        options.style = 'percent'
        continue
      }
      if (token === 'compact-short') {
        options.notation = 'compact'
        options.compactDisplay = 'short'
        continue
      }
      if (token === 'compact-long') {
        options.notation = 'compact'
        options.compactDisplay = 'long'
        continue
      }
      return null
    }
    return options
  }

  if (trimmedStyle === 'integer') {
    return {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  }
  if (trimmedStyle === 'percent') {
    return { style: 'percent' }
  }
  if (trimmedStyle === 'compactShort') {
    return { notation: 'compact', compactDisplay: 'short' }
  }
  if (trimmedStyle === 'compactLong') {
    return { notation: 'compact', compactDisplay: 'long' }
  }

  const currency = parseCurrencyToken(trimmedStyle)
  if (currency !== null) {
    return {
      style: 'currency',
      currency,
    }
  }

  return null
}

type DateTimeExpressionType = 'date' | 'time'

const setYearOption = (options: Intl.DateTimeFormatOptions, count: number): void => {
  options.year = count === 2 ? '2-digit' : 'numeric'
}

const setMonthOption = (options: Intl.DateTimeFormatOptions, count: number): void => {
  if (count <= 1) {
    options.month = 'numeric'
    return
  }
  if (count === 2) {
    options.month = '2-digit'
    return
  }
  if (count === 3) {
    options.month = 'short'
    return
  }
  if (count === 4) {
    options.month = 'long'
    return
  }
  options.month = 'narrow'
}

const setWeekdayOption = (options: Intl.DateTimeFormatOptions, count: number): void => {
  if (count <= 3) {
    options.weekday = 'short'
    return
  }
  if (count === 4) {
    options.weekday = 'long'
    return
  }
  options.weekday = 'narrow'
}

const setNumericOption = (
  options: Intl.DateTimeFormatOptions,
  key: 'day' | 'hour' | 'minute' | 'second',
  count: number
): void => {
  options[key] = count === 2 ? '2-digit' : 'numeric'
}

const toDateTimeStyleOptions = (
  expressionType: DateTimeExpressionType,
  style: string
): Intl.DateTimeFormatOptions | null => {
  if (style !== 'short' && style !== 'medium' && style !== 'long' && style !== 'full') {
    return null
  }
  return expressionType === 'date' ? { dateStyle: style } : { timeStyle: style }
}

const toDateTimeSkeletonOptions = (skeleton: string): Intl.DateTimeFormatOptions | null => {
  if (skeleton.length === 0) {
    return null
  }

  const options: Intl.DateTimeFormatOptions = {}
  let index = 0

  while (index < skeleton.length) {
    const char = skeleton[index]
    if (!/[A-Za-z]/u.test(char)) {
      index += 1
      continue
    }

    let end = index + 1
    while (end < skeleton.length && skeleton[end] === char) {
      end += 1
    }
    const count = end - index

    if (char === 'y' || char === 'Y') {
      setYearOption(options, count)
    } else if (char === 'M' || char === 'L') {
      setMonthOption(options, count)
    } else if (char === 'd') {
      setNumericOption(options, 'day', count)
    } else if (char === 'E' || char === 'e' || char === 'c') {
      setWeekdayOption(options, count)
    } else if (char === 'H') {
      setNumericOption(options, 'hour', count)
      options.hour12 = false
    } else if (char === 'h') {
      setNumericOption(options, 'hour', count)
      options.hour12 = true
    } else if (char === 'm') {
      setNumericOption(options, 'minute', count)
    } else if (char === 's') {
      setNumericOption(options, 'second', count)
    } else if (char === 'S') {
      const fractionalDigits = Math.min(3, Math.max(1, count)) as 1 | 2 | 3
      options.fractionalSecondDigits = fractionalDigits
    } else if (char === 'a') {
      options.hour12 = true
    } else if (char === 'G') {
      if (count <= 3) {
        options.era = 'short'
      } else if (count === 4) {
        options.era = 'long'
      } else {
        options.era = 'narrow'
      }
    } else if (char === 'z') {
      options.timeZoneName = count <= 3 ? 'short' : 'long'
    } else {
      return null
    }

    index = end
  }

  return Object.keys(options).length > 0 ? options : null
}

/**
 * Parses ICU date/time style or skeleton text into Intl.DateTimeFormat options.
 *
 * Supported styles:
 * - `short`, `medium`, `long`, `full`
 *
 * Supported skeleton prefix:
 * - `::` followed by ICU-style pattern letters (e.g. `::yyyy-MM-dd`, `::HH:mm`).
 *
 * @param expressionType ICU date or time expression type.
 * @param styleSource Optional ICU style segment.
 * @returns Intl options or null for unsupported styles.
 */
export const toDateTimeFormatOptionsFromStyle = (
  expressionType: DateTimeExpressionType,
  styleSource?: string
): Intl.DateTimeFormatOptions | null => {
  const trimmedStyle = styleSource?.trim() ?? ''
  if (trimmedStyle.length === 0) {
    return expressionType === 'date' ? { dateStyle: 'medium' } : { timeStyle: 'medium' }
  }

  if (trimmedStyle.startsWith('::')) {
    return toDateTimeSkeletonOptions(trimmedStyle.slice(2))
  }

  return toDateTimeStyleOptions(expressionType, trimmedStyle)
}

/**
 * Converts a placeholder value to a Date for ICU date/time formatting.
 *
 * @param value Placeholder value.
 * @returns Valid Date object or Unix epoch date when conversion fails.
 */
export const toDateValue = (value: PlaceholderValue | undefined): Date => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : new Date(0)
  }

  if (typeof value === 'bigint') {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? new Date(numericValue) : new Date(0)
  }

  const normalizedValue =
    typeof value === 'boolean' ? Number(value) : ((value ?? 0) as string | number | Date)
  const date = new Date(normalizedValue)
  return Number.isFinite(date.getTime()) ? date : new Date(0)
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
