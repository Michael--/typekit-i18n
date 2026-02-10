/*
   This file is generated.
   Source files:
   [1/1] "translations/translationTablePlayground.csv"
*/
// cspell:disable

export const translationTable = {
  greeting_title: {
    description: 'Headline text for the playground',
    en: 'Welcome to typekit-i18n',
    de: 'Willkommen bei typekit-i18n',
  },
  greeting_body: {
    description: 'Greeting message with user placeholder',
    en: 'Hello {name}, nice to see you.',
    de: 'Hallo {name}, schoen dich zu sehen.',
  },
  item_count: {
    description: 'Summary line with count placeholder',
    en: 'You currently have {count} items.',
    de: 'Du hast aktuell {count} Eintraege.',
  },
} as const

export type TranslateKey = keyof typeof translationTable
export type TranslateKeys = TranslateKey
export type TranslateLanguage = 'en' | 'de'
