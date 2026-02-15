const config = {
  input: ['./translations/ui.yaml'],
  output: './generated/translationTable.ts',
  outputSwift: './generated/translation.swift',
  outputKotlin: './generated/translation.kt',
  outputContract: './generated/translation.contract.json',
  outputRuntimeBridge: './generated/translation.runtime.mjs',
  outputRuntimeBridgeBundle: './generated/translation.runtime.bundle.js',
  languages: ['en', 'de', 'es'] as const,
  defaultLanguage: 'en',
  localeByLanguage: {
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
  },
}

export default config
