import {
  IcuTranslatorOptions,
  MissingTranslationEvent,
  Placeholder,
  PlaceholderFormatterMap,
  PlaceholderValue,
  TranslationTable,
} from './types.js'

const placeholderPattern = /\{([A-Za-z0-9_]+)(?:\|([A-Za-z0-9_-]+))?\}/g

type PlaceholderValueMap = Record<string, PlaceholderValue>

interface IcuRenderContext<TKey extends string, TLanguage extends string> {
  key: TKey
  language: TLanguage
  defaultLanguage: TLanguage
  values: PlaceholderValueMap
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  localeByLanguage?: Partial<Record<TLanguage, string>>
  pluralRulesCache: Map<string, Intl.PluralRules>
  numberFormatCache: Map<string, Intl.NumberFormat>
}

interface ParsedIcuExpression {
  variableName: string
  expressionType: 'plural' | 'select'
  optionsSource: string
}

/**
 * Supported ICU subset in this proof-of-concept:
 * - `{var, select, key {...} other {...}}`
 * - `{var, plural, =0 {...} one {...} other {...}}`
 * - `#` replacement inside plural branches
 *
 * TODO(icu):
 * - Add `zero`, `two`, `few`, `many` category tests per locale.
 * - Add `selectordinal` support.
 * - Add `offset:n` support for plural expressions.
 * - Add escaping and apostrophe handling compatible with ICU message syntax.
 * - Add strict syntax errors (line/column) instead of graceful fallback on parse failures.
 * - Add compile/cache layer for parsed templates to avoid reparsing on every translate call.
 */

const toMissingTranslationMessage = <TKey extends string, TLanguage extends string>(
  event: MissingTranslationEvent<TKey, TLanguage>
): string =>
  `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`

const toPlaceholderValueMap = (placeholder?: Placeholder): PlaceholderValueMap => {
  const values: PlaceholderValueMap = {}
  placeholder?.data.forEach((entry) => {
    values[entry.key] = entry.value
  })
  return values
}

const findMatchingBrace = (value: string, startIndex: number): number => {
  let depth = 0
  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

const findTopLevelComma = (value: string, startIndex: number): number => {
  let depth = 0
  for (let index = startIndex; index < value.length; index += 1) {
    const char = value[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      return index
    }
  }
  return -1
}

const parseIcuExpression = (rawExpression: string): ParsedIcuExpression | null => {
  const firstCommaIndex = findTopLevelComma(rawExpression, 0)
  if (firstCommaIndex < 0) {
    return null
  }
  const secondCommaIndex = findTopLevelComma(rawExpression, firstCommaIndex + 1)
  if (secondCommaIndex < 0) {
    return null
  }

  const variableName = rawExpression.slice(0, firstCommaIndex).trim()
  const expressionTypeRaw = rawExpression.slice(firstCommaIndex + 1, secondCommaIndex).trim()
  const optionsSource = rawExpression.slice(secondCommaIndex + 1).trim()

  if (variableName.length === 0 || optionsSource.length === 0) {
    return null
  }
  // TODO(icu): Extend parser to recognize `selectordinal` and plural `offset:n`.
  if (expressionTypeRaw !== 'plural' && expressionTypeRaw !== 'select') {
    return null
  }

  return {
    variableName,
    expressionType: expressionTypeRaw,
    optionsSource,
  }
}

const parseIcuOptions = (optionsSource: string): ReadonlyMap<string, string> | null => {
  const options = new Map<string, string>()
  let index = 0

  while (index < optionsSource.length) {
    while (index < optionsSource.length && /\s/u.test(optionsSource[index])) {
      index += 1
    }
    if (index >= optionsSource.length) {
      break
    }

    const selectorStart = index
    while (index < optionsSource.length && !/\s|\{/u.test(optionsSource[index])) {
      index += 1
    }
    const selector = optionsSource.slice(selectorStart, index).trim()
    if (selector.length === 0) {
      return null
    }

    while (index < optionsSource.length && /\s/u.test(optionsSource[index])) {
      index += 1
    }
    if (optionsSource[index] !== '{') {
      return null
    }

    const blockStart = index
    const blockEnd = findMatchingBrace(optionsSource, blockStart)
    if (blockEnd < 0) {
      return null
    }

    // TODO(icu): Add proper ICU escaping handling for apostrophes and literal braces.
    const message = optionsSource.slice(blockStart + 1, blockEnd)
    options.set(selector, message)
    index = blockEnd + 1
  }

  return options.size > 0 ? options : null
}

const toLocale = <TLanguage extends string>(
  language: TLanguage,
  defaultLanguage: TLanguage,
  localeByLanguage?: Partial<Record<TLanguage, string>>
): string => localeByLanguage?.[language] ?? localeByLanguage?.[defaultLanguage] ?? language

const toPluralRules = (locale: string, cache: Map<string, Intl.PluralRules>): Intl.PluralRules => {
  const cached = cache.get(locale)
  if (cached) {
    return cached
  }

  try {
    const created = new Intl.PluralRules(locale)
    cache.set(locale, created)
    return created
  } catch {
    const fallbackLocale = 'en'
    const fallbackCached = cache.get(fallbackLocale)
    if (fallbackCached) {
      return fallbackCached
    }
    const fallback = new Intl.PluralRules(fallbackLocale)
    cache.set(fallbackLocale, fallback)
    return fallback
  }
}

const toNumberFormatter = (
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

const toNumericValue = (value: PlaceholderValue | undefined): number => {
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

const applySimplePlaceholders = <TKey extends string, TLanguage extends string>(
  template: string,
  context: IcuRenderContext<TKey, TLanguage>
): string =>
  template.replace(
    placeholderPattern,
    (match: string, placeholderKey: string, formatterName?: string): string => {
      if (!(placeholderKey in context.values)) {
        return match
      }

      const rawValue = context.values[placeholderKey]
      const fallbackValue = String(rawValue)
      if (!formatterName) {
        return fallbackValue
      }

      const formatter = context.formatters?.[formatterName]
      if (!formatter) {
        return fallbackValue
      }

      return formatter(rawValue, {
        key: context.key,
        language: context.language,
        defaultLanguage: context.defaultLanguage,
        placeholderKey,
        formatter: formatterName,
      })
    }
  )

const resolveIcuBranch = <TKey extends string, TLanguage extends string>(
  parsed: ParsedIcuExpression,
  options: ReadonlyMap<string, string>,
  context: IcuRenderContext<TKey, TLanguage>
): string | null => {
  if (parsed.expressionType === 'select') {
    const selectedKey = String(context.values[parsed.variableName] ?? 'other')
    return options.get(selectedKey) ?? options.get('other') ?? null
  }

  const numericValue = toNumericValue(context.values[parsed.variableName])
  const exactMatchKey = `=${numericValue}`
  const locale = toLocale(context.language, context.defaultLanguage, context.localeByLanguage)
  const pluralRules = toPluralRules(locale, context.pluralRulesCache)
  const category = pluralRules.select(numericValue)
  const rawBranch =
    options.get(exactMatchKey) ?? options.get(category) ?? options.get('other') ?? null
  if (rawBranch === null) {
    return null
  }

  const numberFormatter = toNumberFormatter(locale, context.numberFormatCache)
  return rawBranch.replace(/#/g, numberFormatter.format(numericValue))
}

const formatIcuTemplate = <TKey extends string, TLanguage extends string>(
  template: string,
  context: IcuRenderContext<TKey, TLanguage>
): string => {
  // TODO(icu): Move parsing to a compiled AST cache to avoid repeated scanning on hot paths.
  let output = ''
  let index = 0

  while (index < template.length) {
    const char = template[index]
    if (char !== '{') {
      output += char
      index += 1
      continue
    }

    const blockEnd = findMatchingBrace(template, index)
    if (blockEnd < 0) {
      output += char
      index += 1
      continue
    }

    const rawExpression = template.slice(index + 1, blockEnd)
    const parsed = parseIcuExpression(rawExpression)
    if (!parsed) {
      output += template.slice(index, blockEnd + 1)
      index = blockEnd + 1
      continue
    }

    const options = parseIcuOptions(parsed.optionsSource)
    if (!options) {
      output += template.slice(index, blockEnd + 1)
      index = blockEnd + 1
      continue
    }

    const selectedBranch = resolveIcuBranch(parsed, options, context)
    if (selectedBranch === null) {
      output += template.slice(index, blockEnd + 1)
      index = blockEnd + 1
      continue
    }

    output += formatIcuTemplate(selectedBranch, context)
    index = blockEnd + 1
  }

  return output
}

const renderMessage = <TKey extends string, TLanguage extends string>(
  template: string,
  key: TKey,
  language: TLanguage,
  defaultLanguage: TLanguage,
  placeholder: Placeholder | undefined,
  options: IcuTranslatorOptions<TKey, TLanguage>,
  pluralRulesCache: Map<string, Intl.PluralRules>,
  numberFormatCache: Map<string, Intl.NumberFormat>
): string => {
  const context: IcuRenderContext<TKey, TLanguage> = {
    key,
    language,
    defaultLanguage,
    values: toPlaceholderValueMap(placeholder),
    formatters: options.formatters,
    localeByLanguage: options.localeByLanguage,
    pluralRulesCache,
    numberFormatCache,
  }

  const withResolvedIcu = formatIcuTemplate(template, context)
  return applySimplePlaceholders(withResolvedIcu, context)
}

/**
 * Creates a typed translator that supports a pragmatic subset of ICU message syntax.
 *
 * Supported syntax:
 * - `{name}` and `{name|formatter}` placeholders
 * - `{count, plural, one {...} other {...}}` with exact matches like `=0`
 * - `{value, select, key {...} other {...}}`
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
      return renderMessage(
        requestedText,
        key,
        language,
        options.defaultLanguage,
        placeholder,
        options,
        pluralRulesCache,
        numberFormatCache
      )
    }

    const fallbackText = translation[options.defaultLanguage]
    handleMissing({
      key,
      language,
      defaultLanguage: options.defaultLanguage,
      reason: fallbackText.length > 0 ? 'missingLanguage' : 'missingFallback',
    })

    if (fallbackText.length > 0) {
      return renderMessage(
        fallbackText,
        key,
        language,
        options.defaultLanguage,
        placeholder,
        options,
        pluralRulesCache,
        numberFormatCache
      )
    }

    return key
  }
}
