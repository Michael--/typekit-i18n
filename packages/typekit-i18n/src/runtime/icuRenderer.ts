import { PlaceholderFormatterMap, PlaceholderValue } from './types.js'
import { isQuotedPosition, unescapeIcuText } from './icuEscape.js'
import {
  findMatchingBrace,
  parseIcuExpression,
  parseIcuOptions,
  ParsedIcuExpression,
  ParsedIcuOptions,
} from './icuParser.js'
import { toLocale, toNumberFormatter, toNumericValue, toPluralRules } from './icuFormatters.js'

const placeholderPattern = /\{([A-Za-z0-9_]+)(?:\|([A-Za-z0-9_-]+))?\}/g

type PlaceholderValueMap = Record<string, PlaceholderValue>

/**
 * ICU rendering context with caches and configuration.
 */
export interface IcuRenderContext<TKey extends string, TLanguage extends string> {
  key: TKey
  language: TLanguage
  defaultLanguage: TLanguage
  values: PlaceholderValueMap
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  localeByLanguage?: Partial<Record<TLanguage, string>>
  pluralRulesCache: Map<string, Intl.PluralRules>
  numberFormatCache: Map<string, Intl.NumberFormat>
}

/**
 * Applies simple placeholder replacement with optional formatters.
 *
 * @param template Template string with {key} and {key|formatter} placeholders.
 * @param context Rendering context.
 * @returns Template with placeholders replaced.
 */
export const applySimplePlaceholders = <TKey extends string, TLanguage extends string>(
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

/**
 * Resolves the appropriate ICU branch based on expression type and values.
 *
 * @param parsed Parsed ICU expression.
 * @param parsedOptions Parsed options with optional offset.
 * @param context Rendering context.
 * @returns Selected branch text or null if no match.
 */
export const resolveIcuBranch = <TKey extends string, TLanguage extends string>(
  parsed: ParsedIcuExpression,
  parsedOptions: ParsedIcuOptions,
  context: IcuRenderContext<TKey, TLanguage>
): string | null => {
  if (parsed.expressionType === 'select') {
    const selectedKey = String(context.values[parsed.variableName] ?? 'other')
    return parsedOptions.options.get(selectedKey) ?? parsedOptions.options.get('other') ?? null
  }

  const numericValue = toNumericValue(context.values[parsed.variableName])
  const adjustedValue = numericValue - parsedOptions.offset
  const exactMatchKey = `=${adjustedValue}`
  const locale = toLocale(context.language, context.defaultLanguage, context.localeByLanguage)
  const pluralRules = toPluralRules(
    locale,
    context.pluralRulesCache,
    parsed.expressionType === 'selectordinal' ? 'ordinal' : 'cardinal'
  )
  const category = pluralRules.select(adjustedValue)
  const rawBranch =
    parsedOptions.options.get(exactMatchKey) ??
    parsedOptions.options.get(category) ??
    parsedOptions.options.get('other') ??
    null
  if (rawBranch === null) {
    return null
  }

  const numberFormatter = toNumberFormatter(locale, context.numberFormatCache)
  const formattedNumber = numberFormatter.format(adjustedValue)
  let output = ''
  let index = 0

  while (index < rawBranch.length) {
    if (rawBranch[index] === '#' && !isQuotedPosition(rawBranch, index)) {
      output += formattedNumber
    } else {
      output += rawBranch[index]
    }
    index += 1
  }

  return output
}

/**
 * Formats an ICU template by recursively resolving expressions.
 *
 * @param template ICU message template.
 * @param context Rendering context.
 * @returns Formatted text with ICU expressions resolved.
 */
export const formatIcuTemplate = <TKey extends string, TLanguage extends string>(
  template: string,
  context: IcuRenderContext<TKey, TLanguage>
): string => {
  let output = ''
  let index = 0

  while (index < template.length) {
    const char = template[index]
    if (char !== '{' || isQuotedPosition(template, index)) {
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

    const options = parseIcuOptions(parsed.optionsSource, parsed.expressionType !== 'select')
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

/**
 * Renders a complete ICU message with placeholders and escaping.
 *
 * @param template ICU message template.
 * @param context Rendering context.
 * @returns Final rendered message text.
 */
export const renderIcuMessage = <TKey extends string, TLanguage extends string>(
  template: string,
  context: IcuRenderContext<TKey, TLanguage>
): string => {
  const withResolvedIcu = formatIcuTemplate(template, context)
  const withPlaceholders = applySimplePlaceholders(withResolvedIcu, context)
  return unescapeIcuText(withPlaceholders)
}
