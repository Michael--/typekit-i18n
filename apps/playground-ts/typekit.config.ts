import type { TypekitI18nConfig } from 'typekit-i18n/codegen'

const config: TypekitI18nConfig<'en' | 'de' | 'es' | 'fr'> = {
  input: ['./translations/*.csv'],
  output: './generated/translationTable.ts',
  outputKeys: './generated/translationKeys.ts',
  languages: ['en', 'de', 'es', 'fr'],
  defaultLanguage: 'en',
}

export default config
