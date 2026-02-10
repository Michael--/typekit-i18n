import { TypekitI18nConfig } from './src/codegen/index.js'

const config: TypekitI18nConfig<'en' | 'de'> = {
  input: ['./resources/translations/*.csv'],
  output: './dist/generated/translationTable.ts',
  outputKeys: './dist/generated/translationKeys.ts',
  languages: ['en', 'de'],
  defaultLanguage: 'en',
}

export default config
