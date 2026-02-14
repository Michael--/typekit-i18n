import { TranslationRecord } from './types.js'

/**
 * Supported translation contract schema version.
 */
export const TRANSLATION_CONTRACT_SCHEMA_VERSION = '1' as const

/**
 * Translation contract schema version type.
 */
export type TranslationContractSchemaVersion = typeof TRANSLATION_CONTRACT_SCHEMA_VERSION

/**
 * Placeholder metadata in canonical translation contract entries.
 */
export interface TranslationContractPlaceholder {
  /**
   * Placeholder name used in message templates.
   */
  name: string
  /**
   * Optional semantic type hint.
   */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'currency'
  /**
   * Optional formatter hint for tooling and adapters.
   */
  formatHint?: string
}

/**
 * One translation entry in the canonical contract.
 */
export interface TranslationContractEntry<TLanguage extends string = string> {
  /**
   * Scoped key category.
   */
  category: string
  /**
   * Stable translation key.
   */
  key: string
  /**
   * Human-readable translator/developer context.
   */
  description: string
  /**
   * Optional review workflow status.
   */
  status?: 'draft' | 'review' | 'approved'
  /**
   * Optional grouping tags.
   */
  tags?: ReadonlyArray<string>
  /**
   * Optional placeholder metadata.
   */
  placeholders?: ReadonlyArray<TranslationContractPlaceholder>
  /**
   * Per-language translation values.
   */
  values: Record<TLanguage, string>
}

/**
 * Canonical translation contract shared by all target generators.
 */
export interface TranslationContract<TLanguage extends string = string> {
  /**
   * Contract schema version.
   */
  schemaVersion: TranslationContractSchemaVersion
  /**
   * Source/default language.
   */
  sourceLanguage: TLanguage
  /**
   * Supported project languages.
   */
  languages: ReadonlyArray<TLanguage>
  /**
   * Optional locale mapping used by ICU-aware target adapters.
   */
  localeByLanguage: Partial<Record<TLanguage, string>>
  /**
   * Canonical translation entries.
   */
  entries: ReadonlyArray<TranslationContractEntry<TLanguage>>
}

/**
 * Options for creating canonical contract objects from normalized records.
 */
export interface CreateTranslationContractOptions<TLanguage extends string = string> {
  /**
   * Source/default language.
   */
  sourceLanguage: TLanguage
  /**
   * Supported project languages.
   */
  languages: ReadonlyArray<TLanguage>
  /**
   * Optional locale mapping used by ICU-aware target adapters.
   */
  localeByLanguage?: Partial<Record<TLanguage, string>>
  /**
   * Normalized translation records.
   */
  records: ReadonlyArray<TranslationRecord<TLanguage>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid translation contract at "${path}": expected non-empty string.`)
  }
  return value
}

const parseOptionalStringArray = (
  value: unknown,
  path: string
): ReadonlyArray<string> | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new Error(`Invalid translation contract at "${path}": expected string array.`)
  }
  return value
}

const validateLocaleByLanguage = <TLanguage extends string>(
  value: unknown,
  languages: ReadonlyArray<TLanguage>
): Partial<Record<TLanguage, string>> => {
  if (value === undefined) {
    return {}
  }
  if (!isRecord(value)) {
    throw new Error('Invalid translation contract at "localeByLanguage": expected object.')
  }

  const normalized: Partial<Record<TLanguage, string>> = {}
  for (const [language, locale] of Object.entries(value)) {
    if (!languages.includes(language as TLanguage)) {
      throw new Error(
        `Invalid translation contract at "localeByLanguage.${language}": language is not declared in "languages".`
      )
    }
    if (typeof locale !== 'string' || locale.trim().length === 0) {
      throw new Error(
        `Invalid translation contract at "localeByLanguage.${language}": expected non-empty locale string.`
      )
    }
    normalized[language as TLanguage] = locale
  }
  return normalized
}

const validateEntry = <TLanguage extends string>(
  value: unknown,
  index: number,
  languages: ReadonlyArray<TLanguage>
): TranslationContractEntry<TLanguage> => {
  const basePath = `entries[${index}]`
  if (!isRecord(value)) {
    throw new Error(`Invalid translation contract at "${basePath}": expected object.`)
  }

  const status = value.status
  if (status !== undefined && status !== 'draft' && status !== 'review' && status !== 'approved') {
    throw new Error(
      `Invalid translation contract at "${basePath}.status": expected "draft", "review", or "approved".`
    )
  }

  const placeholders = value.placeholders
  if (
    placeholders !== undefined &&
    (!Array.isArray(placeholders) ||
      !placeholders.every(
        (placeholder) =>
          isRecord(placeholder) &&
          typeof placeholder.name === 'string' &&
          placeholder.name.length > 0 &&
          (placeholder.type === undefined ||
            placeholder.type === 'string' ||
            placeholder.type === 'number' ||
            placeholder.type === 'boolean' ||
            placeholder.type === 'date' ||
            placeholder.type === 'currency') &&
          (placeholder.formatHint === undefined || typeof placeholder.formatHint === 'string')
      ))
  ) {
    throw new Error(
      `Invalid translation contract at "${basePath}.placeholders": expected placeholder descriptor array.`
    )
  }

  const rawValues = value.values
  if (!isRecord(rawValues)) {
    throw new Error(`Invalid translation contract at "${basePath}.values": expected object.`)
  }

  const typedValues = {} as Record<TLanguage, string>
  for (const language of languages) {
    const translated = rawValues[language]
    if (typeof translated !== 'string') {
      throw new Error(
        `Invalid translation contract at "${basePath}.values.${language}": expected string translation value.`
      )
    }
    typedValues[language] = translated
  }

  return {
    category: assertString(value.category, `${basePath}.category`),
    key: assertString(value.key, `${basePath}.key`),
    description: assertString(value.description, `${basePath}.description`),
    status,
    tags: parseOptionalStringArray(value.tags, `${basePath}.tags`),
    placeholders: placeholders as ReadonlyArray<TranslationContractPlaceholder> | undefined,
    values: typedValues,
  }
}

/**
 * Creates canonical translation contract object from normalized records.
 *
 * @param options Contract creation options.
 * @returns Canonical translation contract.
 */
export const createTranslationContract = <TLanguage extends string>(
  options: CreateTranslationContractOptions<TLanguage>
): TranslationContract<TLanguage> => ({
  schemaVersion: TRANSLATION_CONTRACT_SCHEMA_VERSION,
  sourceLanguage: options.sourceLanguage,
  languages: [...options.languages],
  localeByLanguage: options.localeByLanguage ? { ...options.localeByLanguage } : {},
  entries: options.records.map((record) => ({
    category: record.category,
    key: record.key,
    description: record.description,
    status: record.status,
    tags: record.tags ? [...record.tags] : undefined,
    placeholders: record.placeholders
      ? record.placeholders.map((placeholder) => ({
          name: placeholder.name,
          type: placeholder.type,
          formatHint: placeholder.formatHint,
        }))
      : undefined,
    values: { ...record.values },
  })),
})

/**
 * Serializes canonical translation contract as deterministic JSON source.
 *
 * @param contract Canonical translation contract.
 * @returns JSON string with trailing newline.
 */
export const toTranslationContractSource = <TLanguage extends string>(
  contract: TranslationContract<TLanguage>
): string => `${JSON.stringify(contract, null, 2)}\n`

/**
 * Parses and validates translation contract JSON content.
 *
 * @param content Contract JSON content.
 * @returns Parsed and validated translation contract.
 * @throws When JSON parsing fails or schema validation fails.
 */
export const parseTranslationContractContent = (content: string): TranslationContract<string> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid translation contract JSON: ${message}`)
  }

  return validateTranslationContract(parsed)
}

/**
 * Validates unknown input as translation contract.
 *
 * @param value Unknown input value.
 * @returns Validated translation contract.
 * @throws When the value does not match translation contract schema.
 */
export const validateTranslationContract = (value: unknown): TranslationContract<string> => {
  if (!isRecord(value)) {
    throw new Error('Invalid translation contract: expected root object.')
  }

  if (value.schemaVersion !== TRANSLATION_CONTRACT_SCHEMA_VERSION) {
    throw new Error(
      `Invalid translation contract at "schemaVersion": expected "${TRANSLATION_CONTRACT_SCHEMA_VERSION}".`
    )
  }

  const languages = value.languages
  if (!Array.isArray(languages) || !languages.every((language) => typeof language === 'string')) {
    throw new Error('Invalid translation contract at "languages": expected non-empty string array.')
  }
  if (languages.length === 0) {
    throw new Error('Invalid translation contract at "languages": expected non-empty string array.')
  }

  const sourceLanguage = assertString(value.sourceLanguage, 'sourceLanguage')
  if (!languages.includes(sourceLanguage)) {
    throw new Error(
      `Invalid translation contract at "sourceLanguage": "${sourceLanguage}" is not declared in "languages".`
    )
  }

  const normalizedLanguages = languages as ReadonlyArray<string>
  const localeByLanguage = validateLocaleByLanguage(value.localeByLanguage, normalizedLanguages)
  const entries = value.entries
  if (!Array.isArray(entries)) {
    throw new Error('Invalid translation contract at "entries": expected array.')
  }

  return {
    schemaVersion: TRANSLATION_CONTRACT_SCHEMA_VERSION,
    sourceLanguage,
    languages: normalizedLanguages,
    localeByLanguage,
    entries: entries.map((entry, index) => validateEntry(entry, index, normalizedLanguages)),
  }
}
