import { defineTypekitI18nConfig } from 'typekit-i18n/codegen'

const config = defineTypekitI18nConfig({
  input: [
    './translations/ui.csv',
    './translations/features.yaml',
    './translations/diagnostics.csv',
  ],
  output: './generated/translationTable.ts',
  outputKeys: './generated/translationKeys.ts',
  languages: ['en', 'de', 'es', 'fr'] as const,
  defaultLanguage: 'en',
})

export default config
