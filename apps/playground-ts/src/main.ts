import { createTranslator } from 'typekit-i18n'
import {
  translationTable,
  type TranslateKey,
  type TranslateLanguage,
} from './generated/translationTable'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('Missing #app container')
}

const translate = createTranslator<TranslateLanguage, TranslateKey, typeof translationTable>(
  translationTable,
  {
    defaultLanguage: 'en',
  }
)

const currentLanguage: TranslateLanguage = 'de'

const heading = document.createElement('h1')
heading.textContent = translate('greeting_title', currentLanguage)

const body = document.createElement('p')
body.textContent = translate('greeting_body', currentLanguage, {
  data: [{ key: 'name', value: 'Mara' }],
})

const count = document.createElement('p')
count.textContent = translate('item_count', currentLanguage, {
  data: [{ key: 'count', value: '3' }],
})

root.append(heading, body, count)
