import { TypekitI18nConfig } from 'typekit-i18n/codegen'

const config: TypekitI18nConfig<'en' | 'de'> = {
  input: ['./translations/*.csv'],
  output: './dist/generated/translationTable.ts',
  outputKeys: './dist/generated/translationKeys.ts',
  languages: ['en', 'de'],
  defaultLanguage: 'en',
}

export default config
