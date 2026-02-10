import { createTranslator } from './translator.js'
import {
  MissingTranslationEvent,
  MissingTranslationStrategy,
  Placeholder,
  PlaceholderFormatterMap,
  TranslationTable,
} from './types.js'
import { TranslateLanguage, TranslateKeys } from '@gen/translationKeys.js'
import { translationTable } from '@gen/translationTable.js'

/**
 * Supported language codes.
 */
export const Iso639Codes = ['en', 'de'] as const

/**
 * Supported language code type.
 */
export type Iso639CodeType = (typeof Iso639Codes)[number]

/**
 * Language metadata entry.
 */
export interface ILanguage {
  /**
   * Human-readable language name.
   */
  name: string
  /**
   * Language code.
   */
  iso: Iso639CodeType
}

/**
 * Supported languages list.
 */
export const supportedLanguages: ReadonlyArray<ILanguage> = [
  { name: 'English', iso: 'en' },
  { name: 'Deutsch', iso: 'de' },
]

/**
 * Runtime configuration options.
 */
export interface TranslationRuntimeConfiguration<TLanguage extends string, TKey extends string> {
  /**
   * Default fallback language.
   */
  defaultLanguage?: TLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional runtime callback for missing translation reporting.
   * Pass `null` to clear the current callback.
   */
  onMissingTranslation?: ((event: MissingTranslationEvent<TKey, TLanguage>) => void) | null
  /**
   * Optional placeholder formatter hooks.
   * Pass `null` to clear configured formatters.
   */
  formatters?: PlaceholderFormatterMap<TKey, TLanguage> | null
  /**
   * Enables in-memory collection of missing translation events.
   */
  collectMissingTranslations?: boolean
}

/**
 * Runtime API object.
 */
export interface TranslationRuntime<TKey extends string, TLanguage extends string> {
  /**
   * Translates one key for one language.
   *
   * @param key Translation key.
   * @param language Target language.
   * @param placeholder Optional placeholder replacements.
   * @returns Translated string or key fallback.
   * @throws When `missingStrategy` is `strict` and a translation cannot be resolved.
   */
  translate: (key: TKey, language: TLanguage, placeholder?: Placeholder) => string
  /**
   * Updates runtime behavior.
   *
   * @param options Runtime behavior overrides.
   * @returns Nothing.
   */
  configure: (options: TranslationRuntimeConfiguration<TLanguage, TKey>) => void
  /**
   * Returns collected missing translation events.
   *
   * @returns Missing translation events snapshot.
   */
  getCollectedMissingTranslations: () => ReadonlyArray<MissingTranslationEvent<TKey, TLanguage>>
  /**
   * Clears collected missing translation events.
   *
   * @returns Nothing.
   */
  clearCollectedMissingTranslations: () => void
}

/**
 * Initial options to create a translation runtime.
 */
export interface CreateTranslationRuntimeOptions<TLanguage extends string, TKey extends string> {
  /**
   * Default fallback language.
   */
  defaultLanguage: TLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional runtime callback for missing translation reporting.
   */
  onMissingTranslation?: (event: MissingTranslationEvent<TKey, TLanguage>) => void
  /**
   * Optional placeholder formatter hooks.
   */
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  /**
   * Enables in-memory collection of missing translation events.
   */
  collectMissingTranslations?: boolean
}

interface TranslationRuntimeState<TLanguage extends string, TKey extends string> {
  defaultLanguage: TLanguage
  missingStrategy: MissingTranslationStrategy
  onMissingTranslation?: (event: MissingTranslationEvent<TKey, TLanguage>) => void
  formatters?: PlaceholderFormatterMap<TKey, TLanguage>
  collectMissingTranslations: boolean
}

/**
 * Creates a console warning reporter for missing translation events.
 *
 * @param writer Console-like logger target. Defaults to global console.
 * @returns Missing translation reporter callback.
 */
export const createConsoleMissingTranslationReporter = <
  TKey extends string = string,
  TLanguage extends string = string,
>(
  writer: Pick<Console, 'warn'> = console
): ((event: MissingTranslationEvent<TKey, TLanguage>) => void) => {
  return (event: MissingTranslationEvent<TKey, TLanguage>): void => {
    writer.warn(
      `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`
    )
  }
}

/**
 * Creates an isolated translation runtime bound to one translation table.
 *
 * @param table Translation table used by this runtime.
 * @param options Initial runtime options.
 * @returns Runtime API object.
 */
export const createTranslationRuntime = <
  TLanguage extends string,
  TKey extends string,
  TTable extends TranslationTable<TKey, TLanguage>,
>(
  table: TTable,
  options: CreateTranslationRuntimeOptions<TLanguage, TKey>
): TranslationRuntime<TKey, TLanguage> => {
  const runtimeState: TranslationRuntimeState<TLanguage, TKey> = {
    defaultLanguage: options.defaultLanguage,
    missingStrategy: options.missingStrategy ?? 'fallback',
    onMissingTranslation: options.onMissingTranslation,
    formatters: options.formatters,
    collectMissingTranslations: options.collectMissingTranslations ?? false,
  }

  const missingTranslationEvents: MissingTranslationEvent<TKey, TLanguage>[] = []

  const runtimeMissingTranslationHandler = (
    event: MissingTranslationEvent<TKey, TLanguage>
  ): void => {
    if (runtimeState.collectMissingTranslations) {
      missingTranslationEvents.push(event)
    }
    runtimeState.onMissingTranslation?.(event)
  }

  let runtimeTranslator = createTranslator<TLanguage, TKey, TTable>(table, {
    defaultLanguage: runtimeState.defaultLanguage,
    missingStrategy: runtimeState.missingStrategy,
    formatters: runtimeState.formatters,
    onMissingTranslation: runtimeMissingTranslationHandler,
  })

  const rebuildRuntimeTranslator = (): void => {
    runtimeTranslator = createTranslator<TLanguage, TKey, TTable>(table, {
      defaultLanguage: runtimeState.defaultLanguage,
      missingStrategy: runtimeState.missingStrategy,
      formatters: runtimeState.formatters,
      onMissingTranslation: runtimeMissingTranslationHandler,
    })
  }

  const configure = (nextOptions: TranslationRuntimeConfiguration<TLanguage, TKey>): void => {
    if (nextOptions.defaultLanguage) {
      runtimeState.defaultLanguage = nextOptions.defaultLanguage
    }
    if (nextOptions.missingStrategy) {
      runtimeState.missingStrategy = nextOptions.missingStrategy
    }
    if (nextOptions.collectMissingTranslations !== undefined) {
      runtimeState.collectMissingTranslations = nextOptions.collectMissingTranslations
    }
    if ('onMissingTranslation' in nextOptions) {
      runtimeState.onMissingTranslation = nextOptions.onMissingTranslation ?? undefined
    }
    if ('formatters' in nextOptions) {
      runtimeState.formatters = nextOptions.formatters ?? undefined
    }

    rebuildRuntimeTranslator()
  }

  const getCollectedMissingTranslations = (): ReadonlyArray<
    MissingTranslationEvent<TKey, TLanguage>
  > => [...missingTranslationEvents]

  const clearCollectedMissingTranslations = (): void => {
    missingTranslationEvents.length = 0
  }

  const translateWithRuntime = (
    key: TKey,
    language: TLanguage,
    placeholder?: Placeholder
  ): string => runtimeTranslator(key, language, placeholder)

  return {
    translate: translateWithRuntime,
    configure,
    getCollectedMissingTranslations,
    clearCollectedMissingTranslations,
  }
}

/**
 * Runtime missing translation event type for the generated default table.
 */
export type RuntimeMissingTranslationEvent = MissingTranslationEvent<
  TranslateKeys,
  TranslateLanguage
>

/**
 * Runtime missing translation callback type for the generated default table.
 */
export type RuntimeMissingTranslationHandler = (event: RuntimeMissingTranslationEvent) => void

/**
 * Configures runtime behavior for the default `translate` API.
 */
export type TranslationRuntimeOptions = TranslationRuntimeConfiguration<
  TranslateLanguage,
  TranslateKeys
>

const defaultRuntime = createTranslationRuntime<
  TranslateLanguage,
  TranslateKeys,
  typeof translationTable
>(translationTable, {
  defaultLanguage: 'en',
})

/**
 * Updates runtime behavior for the default `translate` API.
 *
 * @param options Runtime behavior overrides.
 * @returns Nothing.
 */
export const configureTranslationRuntime = (options: TranslationRuntimeOptions): void => {
  defaultRuntime.configure(options)
}

/**
 * Returns collected missing translation events for the default `translate` API.
 *
 * @returns Missing translation events snapshot.
 */
export const getCollectedMissingTranslations = (): ReadonlyArray<RuntimeMissingTranslationEvent> =>
  defaultRuntime.getCollectedMissingTranslations()

/**
 * Clears collected missing translation events for the default `translate` API.
 *
 * @returns Nothing.
 */
export const clearCollectedMissingTranslations = (): void => {
  defaultRuntime.clearCollectedMissingTranslations()
}

/**
 * Translates a key using the generated default translation table.
 *
 * @param key Translation key.
 * @param language Target language.
 * @param placeholder Optional placeholder replacements.
 * @returns Translated string or key fallback.
 * @throws When `missingStrategy` is `strict` and a translation cannot be resolved.
 */
export const translate = (
  key: TranslateKeys,
  language: Iso639CodeType,
  placeholder?: Placeholder
): string => {
  return defaultRuntime.translate(key, language, placeholder)
}
