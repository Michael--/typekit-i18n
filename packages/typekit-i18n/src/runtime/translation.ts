import { createTranslator } from './translator.js'
import { MissingTranslationEvent, MissingTranslationStrategy, Placeholder } from './types.js'
import {
  TranslateLanguage,
  TranslateKeys,
  translationTable,
} from '../generated/translationTable.js'

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
 * Configures runtime behavior for `translate`.
 */
export interface TranslationRuntimeOptions {
  /**
   * Default fallback language.
   */
  defaultLanguage?: TranslateLanguage
  /**
   * Missing translation behavior strategy.
   */
  missingStrategy?: MissingTranslationStrategy
  /**
   * Optional runtime callback for missing translation reporting.
   * Pass `null` to clear the current callback.
   */
  onMissingTranslation?: RuntimeMissingTranslationHandler | null
  /**
   * Enables in-memory collection of missing translation events.
   */
  collectMissingTranslations?: boolean
}

interface TranslationRuntimeState {
  defaultLanguage: TranslateLanguage
  missingStrategy: MissingTranslationStrategy
  onMissingTranslation?: RuntimeMissingTranslationHandler
  collectMissingTranslations: boolean
}

const runtimeState: TranslationRuntimeState = {
  defaultLanguage: 'en',
  missingStrategy: 'fallback',
  onMissingTranslation: undefined,
  collectMissingTranslations: false,
}

const missingTranslationEvents: RuntimeMissingTranslationEvent[] = []

const runtimeMissingTranslationHandler = (event: RuntimeMissingTranslationEvent): void => {
  if (runtimeState.collectMissingTranslations) {
    missingTranslationEvents.push(event)
  }
  runtimeState.onMissingTranslation?.(event)
}

let baseTranslator = createTranslator<TranslateLanguage, TranslateKeys, typeof translationTable>(
  translationTable,
  {
    defaultLanguage: runtimeState.defaultLanguage,
    missingStrategy: runtimeState.missingStrategy,
    onMissingTranslation: runtimeMissingTranslationHandler,
  }
)

const rebuildBaseTranslator = (): void => {
  baseTranslator = createTranslator<TranslateLanguage, TranslateKeys, typeof translationTable>(
    translationTable,
    {
      defaultLanguage: runtimeState.defaultLanguage,
      missingStrategy: runtimeState.missingStrategy,
      onMissingTranslation: runtimeMissingTranslationHandler,
    }
  )
}

/**
 * Creates a console warning reporter for missing translation events.
 *
 * @param writer Console-like logger target. Defaults to global console.
 * @returns Missing translation reporter callback.
 */
export const createConsoleMissingTranslationReporter = (
  writer: Pick<Console, 'warn'> = console
): RuntimeMissingTranslationHandler => {
  return (event: RuntimeMissingTranslationEvent): void => {
    writer.warn(
      `Missing translation for key "${event.key}" in "${event.language}" (default "${event.defaultLanguage}", reason "${event.reason}").`
    )
  }
}

/**
 * Updates runtime behavior for `translate`.
 *
 * @param options Runtime behavior overrides.
 * @returns Nothing.
 */
export const configureTranslationRuntime = (options: TranslationRuntimeOptions): void => {
  if (options.defaultLanguage) {
    runtimeState.defaultLanguage = options.defaultLanguage
  }
  if (options.missingStrategy) {
    runtimeState.missingStrategy = options.missingStrategy
  }
  if (options.collectMissingTranslations !== undefined) {
    runtimeState.collectMissingTranslations = options.collectMissingTranslations
  }
  if ('onMissingTranslation' in options) {
    runtimeState.onMissingTranslation = options.onMissingTranslation ?? undefined
  }

  rebuildBaseTranslator()
}

/**
 * Returns collected missing translation events.
 *
 * @returns Missing translation events snapshot.
 */
export const getCollectedMissingTranslations =
  (): ReadonlyArray<RuntimeMissingTranslationEvent> => [...missingTranslationEvents]

/**
 * Clears collected missing translation events.
 *
 * @returns Nothing.
 */
export const clearCollectedMissingTranslations = (): void => {
  missingTranslationEvents.length = 0
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
  return baseTranslator(key, language, placeholder)
}
