import { PlaceholderFormatterMap, PlaceholderValue } from './types.js'
import { isQuotedPosition, unescapeIcuText } from './icuEscape.js'
import {
  findMatchingBrace,
  findTopLevelComma,
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
  compiledTemplateCache: Map<string, CompiledIcuTemplate>
}

interface IcuTextToken {
  kind: 'text'
  value: string
}

interface IcuExpressionToken {
  kind: 'expression'
  parsed: ParsedIcuExpression
  parsedOptions: ParsedIcuOptions
  sourceIndex: number
  rawExpression: string
}

type IcuTemplateToken = IcuTextToken | IcuExpressionToken

export type CompiledIcuTemplate = ReadonlyArray<IcuTemplateToken>

const toLineAndColumn = (template: string, index: number): { line: number; column: number } => {
  let line = 1
  let column = 1
  let cursor = 0
  const boundedIndex = Math.max(0, Math.min(index, template.length))

  while (cursor < boundedIndex) {
    const char = template[cursor]
    if (char === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
    cursor += 1
  }

  return { line, column }
}

const toIcuSyntaxError = <TKey extends string, TLanguage extends string>(
  template: string,
  sourceIndex: number,
  reason: string,
  context: IcuRenderContext<TKey, TLanguage>
): Error => {
  const { line, column } = toLineAndColumn(template, sourceIndex)
  return new Error(
    `ICU syntax error for key "${context.key}" in "${context.language}" at line ${line}, column ${column}: ${reason}`
  )
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
): CompiledIcuTemplate => {
  const cached = context.compiledTemplateCache.get(template)
  if (cached) {
    return cached
  }

  const tokens: IcuTemplateToken[] = []
  let textStart = 0
  let index = 0

  while (index < template.length) {
    const char = template[index]
    if (char !== '{' || isQuotedPosition(template, index)) {
      index += 1
      continue
    }

    const blockEnd = findMatchingBrace(template, index)
    if (blockEnd < 0) {
      throw toIcuSyntaxError(
        template,
        index,
        'Unterminated "{" expression. Missing matching "}".',
        context
      )
    }

    const rawExpression = template.slice(index + 1, blockEnd)
    const parsed = parseIcuExpression(rawExpression)
    if (!parsed) {
      if (findTopLevelComma(rawExpression, 0) >= 0) {
        throw toIcuSyntaxError(
          template,
          index,
          `Invalid ICU expression "${rawExpression}". Supported types are "select", "plural", and "selectordinal".`,
          context
        )
      }
      index = blockEnd + 1
      continue
    }

    const parsedOptions = parseIcuOptions(parsed.optionsSource, parsed.expressionType !== 'select')
    if (!parsedOptions) {
      throw toIcuSyntaxError(
        template,
        index,
        `Invalid ICU options for expression "${rawExpression}".`,
        context
      )
    }

    if (index > textStart) {
      tokens.push({
        kind: 'text',
        value: template.slice(textStart, index),
      })
    }

    tokens.push({
      kind: 'expression',
      parsed,
      parsedOptions,
      sourceIndex: index,
      rawExpression,
    })

    index = blockEnd + 1
    textStart = index
  }

  if (textStart < template.length) {
    tokens.push({
      kind: 'text',
      value: template.slice(textStart),
    })
  }

  const compiled = tokens as CompiledIcuTemplate
  context.compiledTemplateCache.set(template, compiled)
  return compiled
}

const renderCompiledTemplate = <TKey extends string, TLanguage extends string>(
  compiled: CompiledIcuTemplate,
  template: string,
  context: IcuRenderContext<TKey, TLanguage>
): string => {
  let output = ''

  compiled.forEach((token) => {
    if (token.kind === 'text') {
      output += token.value
      return
    }

    const selectedBranch = resolveIcuBranch(token.parsed, token.parsedOptions, context)
    if (selectedBranch === null) {
      throw toIcuSyntaxError(
        template,
        token.sourceIndex,
        `No matching branch for expression "${token.rawExpression}". Add an "other" branch.`,
        context
      )
    }

    const compiledBranch = formatIcuTemplate(selectedBranch, context)
    output += renderCompiledTemplate(compiledBranch, selectedBranch, context)
  })

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
  const compiled = formatIcuTemplate(template, context)
  const withResolvedIcu = renderCompiledTemplate(compiled, template, context)
  const withPlaceholders = applySimplePlaceholders(withResolvedIcu, context)
  return unescapeIcuText(withPlaceholders)
}
