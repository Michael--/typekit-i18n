import { TypekitI18nConfig } from './src/codegen/index.js'

const config: TypekitI18nConfig<'en' | 'de'> = {
  input: ['./resources/translations/*.csv'],
  output: './src/generated/translationTable.ts',
  languages: ['en', 'de'],
  defaultLanguage: 'en',
}

export default config
