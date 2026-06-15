import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { TranslatorApi } from '../runtime/translator.js'
import { TranslationKeyFromTable, TranslationLanguageFromTable } from '../runtime/scoped.js'
import {
  IcuTranslatorOptions,
  MissingTranslationEvent,
  Placeholder,
  PlaceholderValue,
  TranslationTable,
  TranslatorOptions,
} from '../runtime/types.js'
import { createTranslator } from '../runtime/translator.js'
import { createIcuTranslator } from '../runtime/icuTranslator.js'

// ---------------------------------------------------------------------------
// Placeholder helpers
// ---------------------------------------------------------------------------

/**
 * Converts a simple `Record<string, PlaceholderValue>` to the internal
 * `Placeholder` shape used by translator APIs.
 */
const toPlaceholder = (values?: Record<string, PlaceholderValue>): Placeholder | undefined => {
  if (!values) {
    return undefined
  }
  const keys = Object.keys(values)
  if (keys.length === 0) {
    return undefined
  }
  return {
    data: keys.map((key) => ({ key, value: values[key] })),
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TranslationContextValue<
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
> {
  translator: TranslatorApi<TLanguage, TKey, TTable>
  language: TLanguage
  setLanguage: (language: TLanguage) => void
}

const TranslationContext = createContext<TranslationContextValue<
  string,
  string,
  TranslationTable<string, string>
> | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Props for the TranslationProvider component.
 */
export interface TranslationProviderProps<TTable extends TranslationTable<string, string>> {
  /**
   * Translation table (typically the generated `translationTable`).
   */
  table: TTable
  /**
   * Default fallback language.
   */
  defaultLanguage?: TranslationLanguageFromTable<TTable>
  /**
   * Initial active language.
   */
  language?: TranslationLanguageFromTable<TTable>
  /**
   * Missing translation strategy.
   */
  missingStrategy?: 'fallback' | 'strict'
  /**
   * Optional callback for missing translation events.
   */
  onMissingTranslation?: (
    event: MissingTranslationEvent<
      TranslationKeyFromTable<TTable>,
      TranslationLanguageFromTable<TTable>
    >
  ) => void
  /**
   * React children.
   */
  children: React.ReactNode
}

/**
 * Provides a translation context to all descendant `useTranslate` hooks.
 *
 * Wrap your app root with this component once.
 */
export const TranslationProvider = <TTable extends TranslationTable<string, string>>({
  table,
  defaultLanguage,
  language: initialLanguage,
  missingStrategy,
  onMissingTranslation,
  children,
}: TranslationProviderProps<TTable>): React.ReactElement => {
  type TLanguage = TranslationLanguageFromTable<TTable>

  const [language, setLanguageState] = useState<TLanguage>(
    () =>
      initialLanguage ??
      defaultLanguage ??
      (Object.keys(Object.values(table)[0] ?? {}).find(
        (k) => k !== 'category' && k !== 'description'
      ) as TLanguage) ??
      ('en' as TLanguage)
  )

  const setLanguage = useCallback((nextLanguage: TLanguage) => {
    setLanguageState(nextLanguage)
  }, [])

  const options: TranslatorOptions<TranslationKeyFromTable<TTable>, TLanguage> = useMemo(
    () => ({
      defaultLanguage,
      language,
      missingStrategy,
      onMissingTranslation,
    }),
    [defaultLanguage, language, missingStrategy, onMissingTranslation]
  )

  const translator = useMemo(
    () =>
      createTranslator(
        table as unknown as TranslationTable<string, string>,
        options as unknown as TranslatorOptions<string, string>
      ),
    [table, options]
  ) as unknown as TranslatorApi<TLanguage, TranslationKeyFromTable<TTable>, TTable>

  // Keep translator language in sync
  translator.setLanguage(language)

  const value = useMemo<
    TranslationContextValue<TLanguage, TranslationKeyFromTable<TTable>, TTable>
  >(() => ({ translator, language, setLanguage }), [translator, language, setLanguage])

  return React.createElement(
    TranslationContext.Provider,
    {
      value: value as unknown as TranslationContextValue<
        string,
        string,
        TranslationTable<string, string>
      >,
    },
    children
  )
}

// ---------------------------------------------------------------------------
// useTranslationContext (internal)
// ---------------------------------------------------------------------------

const useTranslationContext = <
  TTable extends TranslationTable<string, string>,
>(): TranslationContextValue<
  TranslationLanguageFromTable<TTable>,
  TranslationKeyFromTable<TTable>,
  TTable
> => {
  const ctx = useContext(TranslationContext)
  if (!ctx) {
    throw new Error(
      'useTranslate() must be used inside a <TranslationProvider>. ' +
        'Wrap your app root with <TranslationProvider table={translationTable}>.'
    )
  }
  return ctx as unknown as TranslationContextValue<
    TranslationLanguageFromTable<TTable>,
    TranslationKeyFromTable<TTable>,
    TTable
  >
}

// ---------------------------------------------------------------------------
// useTranslate
// ---------------------------------------------------------------------------

/**
 * Return type of the `useTranslate` hook.
 */
export interface UseTranslateReturn<TTable extends TranslationTable<string, string>> {
  /**
   * Translate a key using the current language.
   * Accepts optional placeholders as a simple key-value record.
   */
  t: {
    (key: TranslationKeyFromTable<TTable>): string
    (key: TranslationKeyFromTable<TTable>, placeholders: Record<string, PlaceholderValue>): string
    (
      key: TranslationKeyFromTable<TTable>,
      language: TranslationLanguageFromTable<TTable>,
      placeholders?: Record<string, PlaceholderValue>
    ): string
  }
  /**
   * Current active language.
   */
  language: TranslationLanguageFromTable<TTable>
  /**
   * Set the active language.
   */
  setLanguage: (language: TranslationLanguageFromTable<TTable>) => void
}

/**
 * React hook for basic (non-ICU) translations.
 *
 * Requires a parent {@link TranslationProvider}.
 *
 * @returns Translate function, current language, and setter.
 */
export const useTranslate = <
  TTable extends TranslationTable<string, string>,
>(): UseTranslateReturn<TTable> => {
  const { translator, language, setLanguage } = useTranslationContext<TTable>()

  const t = useCallback(
    (
      key: TranslationKeyFromTable<TTable>,
      languageOrPlaceholders?:
        | TranslationLanguageFromTable<TTable>
        | Record<string, PlaceholderValue>,
      placeholders?: Record<string, PlaceholderValue>
    ): string => {
      if (typeof languageOrPlaceholders === 'string') {
        return translator(key, languageOrPlaceholders, toPlaceholder(placeholders))
      }
      return translator(key, language, toPlaceholder(languageOrPlaceholders))
    },
    [translator, language]
  )

  return { t, language, setLanguage }
}

// ---------------------------------------------------------------------------
// ICU Provider + Hook
// ---------------------------------------------------------------------------

interface IcuTranslationContextValue<
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
> {
  translator: TranslatorApi<TLanguage, TKey, TTable>
  language: TLanguage
  setLanguage: (language: TLanguage) => void
}

const IcuTranslationContext = createContext<IcuTranslationContextValue<
  string,
  string,
  TranslationTable<string, string>
> | null>(null)

/**
 * Props for the IcuTranslationProvider component.
 */
export interface IcuTranslationProviderProps<
  TTable extends TranslationTable<string, string>,
> extends TranslationProviderProps<TTable> {
  /**
   * Optional locale overrides per language code for ICU plural selection.
   */
  localeByLanguage?: Partial<Record<TranslationLanguageFromTable<TTable>, string>>
}

/**
 * ICU-aware variant of {@link TranslationProvider}.
 *
 * Use this when your translations contain ICU message syntax
 * (plural, select, selectordinal, number, date, time).
 */
export const IcuTranslationProvider = <TTable extends TranslationTable<string, string>>({
  table,
  defaultLanguage,
  language: initialLanguage,
  missingStrategy,
  onMissingTranslation,
  localeByLanguage,
  children,
}: IcuTranslationProviderProps<TTable>): React.ReactElement => {
  type TLanguage = TranslationLanguageFromTable<TTable>

  const [language, setLanguageState] = useState<TLanguage>(
    () =>
      initialLanguage ??
      defaultLanguage ??
      (Object.keys(Object.values(table)[0] ?? {}).find(
        (k) => k !== 'category' && k !== 'description'
      ) as TLanguage) ??
      ('en' as TLanguage)
  )

  const setLanguage = useCallback((nextLanguage: TLanguage) => {
    setLanguageState(nextLanguage)
  }, [])

  const options: IcuTranslatorOptions<TranslationKeyFromTable<TTable>, TLanguage> = useMemo(
    () => ({
      defaultLanguage,
      language,
      missingStrategy,
      onMissingTranslation,
      localeByLanguage,
    }),
    [defaultLanguage, language, missingStrategy, onMissingTranslation, localeByLanguage]
  )

  const translator = useMemo(
    () =>
      createIcuTranslator(
        table as unknown as TranslationTable<string, string>,
        options as unknown as IcuTranslatorOptions<string, string>
      ),
    [table, options]
  ) as unknown as TranslatorApi<TLanguage, TranslationKeyFromTable<TTable>, TTable>

  translator.setLanguage(language)

  const value = useMemo<
    IcuTranslationContextValue<TLanguage, TranslationKeyFromTable<TTable>, TTable>
  >(() => ({ translator, language, setLanguage }), [translator, language, setLanguage])

  return React.createElement(
    IcuTranslationContext.Provider,
    {
      value: value as unknown as IcuTranslationContextValue<
        string,
        string,
        TranslationTable<string, string>
      >,
    },
    children
  )
}

const useIcuTranslationContext = <
  TTable extends TranslationTable<string, string>,
>(): IcuTranslationContextValue<
  TranslationLanguageFromTable<TTable>,
  TranslationKeyFromTable<TTable>,
  TTable
> => {
  const ctx = useContext(IcuTranslationContext)
  if (!ctx) {
    throw new Error(
      'useIcuTranslate() must be used inside an <IcuTranslationProvider>. ' +
        'Wrap your app root with <IcuTranslationProvider table={translationTable}>.'
    )
  }
  return ctx as unknown as IcuTranslationContextValue<
    TranslationLanguageFromTable<TTable>,
    TranslationKeyFromTable<TTable>,
    TTable
  >
}

/**
 * React hook for ICU-capable translations.
 *
 * Requires a parent {@link IcuTranslationProvider}.
 *
 * @returns Translate function, current language, and setter.
 */
export const useIcuTranslate = <
  TTable extends TranslationTable<string, string>,
>(): UseTranslateReturn<TTable> => {
  const { translator, language, setLanguage } = useIcuTranslationContext<TTable>()

  const t = useCallback(
    (
      key: TranslationKeyFromTable<TTable>,
      languageOrPlaceholders?:
        | TranslationLanguageFromTable<TTable>
        | Record<string, PlaceholderValue>,
      placeholders?: Record<string, PlaceholderValue>
    ): string => {
      if (typeof languageOrPlaceholders === 'string') {
        return translator(key, languageOrPlaceholders, toPlaceholder(placeholders))
      }
      return translator(key, language, toPlaceholder(languageOrPlaceholders))
    },
    [translator, language]
  )

  return { t, language, setLanguage }
}
