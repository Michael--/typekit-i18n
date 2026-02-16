const RUNTIME_BRIDGE_MODES = ['basic', 'icu', 'icu-formatjs'] as const
type RuntimeBridgeMode = (typeof RUNTIME_BRIDGE_MODES)[number]

const runtimeBridgeModeFromEnv = process.env.TYPEKIT_RUNTIME_BRIDGE_MODE
const runtimeBridgeMode: RuntimeBridgeMode =
  runtimeBridgeModeFromEnv &&
  RUNTIME_BRIDGE_MODES.includes(runtimeBridgeModeFromEnv as RuntimeBridgeMode)
    ? (runtimeBridgeModeFromEnv as RuntimeBridgeMode)
    : 'icu'

if (
  runtimeBridgeModeFromEnv &&
  !RUNTIME_BRIDGE_MODES.includes(runtimeBridgeModeFromEnv as RuntimeBridgeMode)
) {
  throw new Error(
    `Invalid TYPEKIT_RUNTIME_BRIDGE_MODE "${runtimeBridgeModeFromEnv}". Expected one of: ${RUNTIME_BRIDGE_MODES.join(', ')}.`
  )
}

const config = {
  input: ['./translations/ui.yaml'],
  output: './generated/translationTable.ts',
  outputSwift: './generated/translation.swift',
  outputKotlin: './generated/translation.kt',
  outputContract: './generated/translation.contract.json',
  outputRuntimeBridge: './generated/translation.runtime.mjs',
  outputRuntimeBridgeBundle: './generated/translation.runtime.bundle.js',
  runtimeBridgeMode,
  languages: ['en', 'de', 'es'] as const,
  defaultLanguage: 'en',
  localeByLanguage: {
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
  },
}

export default config
