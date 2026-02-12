import { Placeholder, TranslationTable } from './types.js'

/**
 * Default category used when no explicit category is defined on an entry.
 */
export const DEFAULT_TRANSLATION_CATEGORY = 'default' as const

type EntryCategory<TEntry> = Extract<
  TEntry extends { category?: infer TCategory } ? TCategory : never,
  string
>

type NormalizedEntryCategory<TEntry> = [EntryCategory<TEntry>] extends [never]
  ? typeof DEFAULT_TRANSLATION_CATEGORY
  : EntryCategory<TEntry>

/**
 * Category union derived from a translation table.
 */
export type TranslationCategoryFromTable<TTable extends TranslationTable<string, string>> = Extract<
  {
    [TKey in keyof TTable]: NormalizedEntryCategory<TTable[TKey]>
  }[keyof TTable],
  string
>

/**
 * Key union narrowed to one category from a translation table.
 */
export type TranslationKeyOfCategoryFromTable<
  TTable extends TranslationTable<string, string>,
  TCategory extends TranslationCategoryFromTable<TTable>,
> = Extract<
  {
    [TKey in keyof TTable]: NormalizedEntryCategory<TTable[TKey]> extends TCategory ? TKey : never
  }[keyof TTable],
  string
>

/**
 * Result object for optional language/placeholder argument parsing.
 */
export interface TranslateCallArguments<TLanguage extends string> {
  /**
   * Resolved language for this translate call.
   */
  language: TLanguage
  /**
   * Resolved placeholder payload for this translate call.
   */
  placeholder?: Placeholder
}

type LookupMap<TKey extends string> = Map<string, Map<string, TKey>>

const isPlaceholder = (value: unknown): value is Placeholder => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as { data?: unknown }
  return Array.isArray(candidate.data)
}

/**
 * Resolves runtime arguments for APIs where language is optional.
 *
 * @param currentLanguage Runtime current language fallback.
 * @param languageOrPlaceholder Optional language or placeholder argument.
 * @param placeholder Optional placeholder argument.
 * @returns Resolved language and placeholder values.
 */
export const resolveTranslateCallArguments = <TLanguage extends string>(
  currentLanguage: TLanguage,
  languageOrPlaceholder?: TLanguage | Placeholder,
  placeholder?: Placeholder
): TranslateCallArguments<TLanguage> => {
  if (isPlaceholder(languageOrPlaceholder)) {
    return {
      language: currentLanguage,
      placeholder: languageOrPlaceholder,
    }
  }

  if (typeof languageOrPlaceholder === 'string') {
    return {
      language: languageOrPlaceholder,
      placeholder,
    }
  }

  return {
    language: currentLanguage,
    placeholder,
  }
}

const normalizeCategory = (category: string | undefined): string => {
  if (typeof category !== 'string') {
    return DEFAULT_TRANSLATION_CATEGORY
  }

  const trimmed = category.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_TRANSLATION_CATEGORY
}

/**
 * Builds one category/key lookup map from the translation table.
 *
 * @param table Translation table.
 * @returns Category scoped key lookup map.
 */
export const createScopedKeyLookup = <
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
>(
  table: TTable
): LookupMap<TKey> => {
  const lookup: LookupMap<TKey> = new Map()

  ;(Object.keys(table) as TKey[]).forEach((key) => {
    const entry = table[key]
    const category = normalizeCategory(entry.category)
    const categoryEntries = lookup.get(category) ?? new Map<string, TKey>()
    categoryEntries.set(key, key)
    lookup.set(category, categoryEntries)
  })

  return lookup
}

/**
 * Resolves one scoped key from category and key tokens.
 *
 * @param lookup Category lookup map.
 * @param category Category token.
 * @param key Key token inside category.
 * @returns Full table key if found, otherwise null.
 */
export const resolveScopedKey = <TKey extends string>(
  lookup: LookupMap<TKey>,
  category: string,
  key: string
): TKey | null => {
  const categoryEntries = lookup.get(normalizeCategory(category))
  if (!categoryEntries) {
    return null
  }

  return categoryEntries.get(key) ?? null
}
