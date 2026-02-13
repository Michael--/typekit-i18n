import { defineTypekitI18nConfig } from '@number10/typekit-i18n/codegen'

const config = defineTypekitI18nConfig({
  input: [
    './translations/ui.csv',
    './translations/features.yaml',
    './translations/diagnostics.csv',
    './translations/icu.yaml',
  ],
  output: './generated/translationTable.ts',
  outputKeys: './generated/translationKeys.ts',
  languages: ['en', 'de', 'es', 'fr', 'ar', 'pl'] as const,
  defaultLanguage: 'en',
})

export default config
