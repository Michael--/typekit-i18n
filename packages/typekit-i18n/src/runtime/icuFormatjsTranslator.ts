import IntlMessageFormat from 'intl-messageformat'
import { toLocale } from './icuFormatters.js'
import { isQuotedPosition } from './icuEscape.js'
import {
  IcuTranslatorOptions,
  MissingTranslationEvent,
  Placeholder,
  PlaceholderValue,
  TranslationTable,
} from './types.js'
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

const FORMATTER_PLACEHOLDER_PATTERN = /\{([A-Za-z0-9_]+)\|([A-Za-z0-9_-]+)\}/g
const SIMPLE_PLACEHOLDER_PATTERN = /\{([A-Za-z0-9_]+)\}/g
const ICU_VARIABLE_PATTERN = /\{([A-Za-z0-9_]+)\s*,/g

interface FormatterPlaceholderBinding {
  replacementVariable: string
  placeholderKey: string
  formatterName: string
  rawToken: string
}

interface PreparedFormatjsTemplate {
  transformedTemplate: string
  formatterBindings: ReadonlyArray<FormatterPlaceholderBinding>
  simplePlaceholders: ReadonlyArray<string>
  icuVariables: ReadonlyArray<string>
}

interface CompiledFormatjsTemplate {
  preparedTemplate: PreparedFormatjsTemplate
  message: IntlMessageFormat
}

interface LineAndColumn {
  line: number
  column: number
}

const toMissingTranslationMessage = <TKey extends string, TLanguage extends string>(
  event: MissingTranslationEvent<TKey, TLanguage>
): string =>
  `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`

const toScopedMissingKey = (category: string, key: string): string => `${category}.${key}`

const toPlaceholderValueMap = (placeholder?: Placeholder): Record<string, PlaceholderValue> => {
  const values: Record<string, PlaceholderValue> = {}
  placeholder?.data.forEach((entry) => {
    values[entry.key] = entry.value
  })
  return values
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toLineAndColumnFromUnknown = (error: unknown): LineAndColumn => {
  if (!isRecord(error)) {
    return { line: 1, column: 1 }
  }

  const location = error.location
  if (!isRecord(location)) {
    return { line: 1, column: 1 }
  }

  const start = location.start
  if (!isRecord(start)) {
    return { line: 1, column: 1 }
  }

  const line = typeof start.line === 'number' ? start.line : 1
  const column = typeof start.column === 'number' ? start.column : 1
  return { line, column }
}

const toErrorReason = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const toIcuSyntaxError = <TKey extends string, TLanguage extends string>(
  key: TKey,
  language: TLanguage,
  error: unknown
): Error => {
  const { line, column } = toLineAndColumnFromUnknown(error)
  return new Error(
    `ICU syntax error for key "${key}" in "${language}" at line ${line}, column ${column}: ${toErrorReason(error)}`
  )
}

const collectMatches = (
  source: string,
  pattern: RegExp,
  excludedKeys: ReadonlySet<string>
): string[] => {
  const matches = new Set<string>()
  pattern.lastIndex = 0
  let matched = pattern.exec(source)
  while (matched) {
    const fullMatch = matched[0]
    const key = matched[1]
    if (!isQuotedPosition(source, matched.index) && !excludedKeys.has(key)) {
      matches.add(key)
    }
    matched = pattern.exec(source)
    if (matched && matched[0] === fullMatch && matched.index === pattern.lastIndex) {
      pattern.lastIndex += 1
    }
  }
  return [...matches]
}

const toPreparedTemplate = (template: string): PreparedFormatjsTemplate => {
  const formatterBindings: FormatterPlaceholderBinding[] = []
  let transformedTemplate = ''
  let cursor = 0
  let formatterIndex = 0

  FORMATTER_PLACEHOLDER_PATTERN.lastIndex = 0
  let formatterMatch = FORMATTER_PLACEHOLDER_PATTERN.exec(template)
  while (formatterMatch) {
    const fullMatch = formatterMatch[0]
    const placeholderKey = formatterMatch[1]
    const formatterName = formatterMatch[2]
    const matchIndex = formatterMatch.index

    if (!isQuotedPosition(template, matchIndex)) {
      transformedTemplate += template.slice(cursor, matchIndex)
      const replacementVariable = `__typekit_formatter_${formatterIndex}__`
      transformedTemplate += `{${replacementVariable}}`
      cursor = matchIndex + fullMatch.length
      formatterBindings.push({
        replacementVariable,
        placeholderKey,
        formatterName,
        rawToken: fullMatch,
      })
      formatterIndex += 1
    }

    formatterMatch = FORMATTER_PLACEHOLDER_PATTERN.exec(template)
  }

  transformedTemplate += template.slice(cursor)
  const formatterVariableNames = new Set<string>(
    formatterBindings.map((binding) => binding.replacementVariable)
  )

  const simplePlaceholders = collectMatches(
    transformedTemplate,
    SIMPLE_PLACEHOLDER_PATTERN,
    formatterVariableNames
  )
  const icuVariables = collectMatches(transformedTemplate, ICU_VARIABLE_PATTERN, new Set())

  return {
    transformedTemplate,
    formatterBindings,
    simplePlaceholders,
    icuVariables,
  }
}

const toFormatMessageResult = (result: unknown): string => {
  if (Array.isArray(result)) {
    return result.map((item) => String(item)).join('')
  }
  return String(result)
}

/**
 * Creates a typed translator powered by `intl-messageformat`.
 *
 * The API mirrors `createIcuTranslator` while delegating ICU rendering to FormatJS.
 * Existing `{name|formatter}` placeholders remain supported for backward compatibility.
 *
 * Import path:
 * - `@number10/typekit-i18n/runtime/icu-formatjs`
 *
 * @param table Translation table keyed by typed translation keys.
 * @param options Translator behavior options with optional ICU locale overrides.
 * @returns Runtime translate function with typed key/language parameters.
 */
export const createFormatjsIcuTranslator = <TTable extends TranslationTable<string, string>>(
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
  const preparedTemplateCache = new Map<string, PreparedFormatjsTemplate>()
  const compiledTemplateCache = new Map<string, CompiledFormatjsTemplate>()

  const handleMissing = (event: MissingTranslationEvent<TKey, TLanguage>): void => {
    resolvedOptions.onMissingTranslation?.(event)
    if (missingStrategy === 'strict') {
      throw new Error(toMissingTranslationMessage(event))
    }
  }

  const renderTemplate = (
    template: string,
    key: TKey,
    language: TLanguage,
    placeholder?: Placeholder
  ): string => {
    const locale = toLocale(language, defaultLanguage, resolvedOptions.localeByLanguage)
    const preparedTemplate =
      preparedTemplateCache.get(template) ??
      (() => {
        const prepared = toPreparedTemplate(template)
        preparedTemplateCache.set(template, prepared)
        return prepared
      })()

    const compiledCacheKey = `${locale}::${preparedTemplate.transformedTemplate}`
    const compiledTemplate =
      compiledTemplateCache.get(compiledCacheKey) ??
      (() => {
        try {
          const compiled: CompiledFormatjsTemplate = {
            preparedTemplate,
            message: new IntlMessageFormat(preparedTemplate.transformedTemplate, locale),
          }
          compiledTemplateCache.set(compiledCacheKey, compiled)
          return compiled
        } catch (error: unknown) {
          throw toIcuSyntaxError(key, language, error)
        }
      })()

    const valueMap = toPlaceholderValueMap(placeholder)
    const formatValues: Record<string, PlaceholderValue | string> = {}

    Object.keys(valueMap).forEach((valueKey) => {
      formatValues[valueKey] = valueMap[valueKey]
    })

    compiledTemplate.preparedTemplate.icuVariables.forEach((variable) => {
      if (typeof formatValues[variable] === 'undefined') {
        formatValues[variable] = 0
      }
    })

    compiledTemplate.preparedTemplate.simplePlaceholders.forEach((placeholderKey) => {
      if (typeof formatValues[placeholderKey] === 'undefined') {
        formatValues[placeholderKey] = `{${placeholderKey}}`
      }
    })

    compiledTemplate.preparedTemplate.formatterBindings.forEach((binding) => {
      const rawValue = valueMap[binding.placeholderKey]
      if (typeof rawValue === 'undefined') {
        formatValues[binding.replacementVariable] = binding.rawToken
        return
      }

      const fallbackValue = String(rawValue)
      const formatter = resolvedOptions.formatters?.[binding.formatterName]
      if (!formatter) {
        formatValues[binding.replacementVariable] = fallbackValue
        return
      }

      formatValues[binding.replacementVariable] = formatter(rawValue, {
        key,
        language,
        defaultLanguage,
        placeholderKey: binding.placeholderKey,
        formatter: binding.formatterName,
      })
    })

    try {
      const formatted = compiledTemplate.message.format(formatValues)
      return toFormatMessageResult(formatted)
    } catch (error: unknown) {
      throw toIcuSyntaxError(key, language, error)
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
      return renderTemplate(requestedText, key, language, placeholder)
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
      return renderTemplate(fallbackText, key, language, placeholder)
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
  translate.in = translate.translateIn

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
