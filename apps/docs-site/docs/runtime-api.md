---
description: >-
  Runtime API reference for @number10/typekit-i18n — translators, language
  state, placeholder formatting, and ICU message rendering.
---

# Runtime API

Runtime imports come from `@number10/typekit-i18n`.

## Core Types

- `TranslationTable<TKey, TLanguage>`
- `Placeholder` and `PlaceholderValue`
- `MissingTranslationEvent`
- `PlaceholderFormatterMap`

## `createTranslator(table, options?)`

Creates a typed translator function:

```ts
;(key, language?, placeholder?) => string
```

Options:

- `defaultLanguage?: TLanguage` (`'en'` by default when available in table)
- `language?: TLanguage` (initial active language, defaults to `defaultLanguage`)
- `missingStrategy?: 'fallback' | 'strict'`
- `formatters?: PlaceholderFormatterMap<TKey, TLanguage>`
- `onMissingTranslation?: (event) => void`

Missing reasons:

- `missingKey`
- `missingLanguage`
- `missingFallback`

Behavior summary:

- uses target language value when non-empty
- falls back to `defaultLanguage` when target language value is empty
- `defaultLanguage` falls back to `'en'` when omitted and available in table
- creating a translator throws when `defaultLanguage` is omitted and table does not contain `'en'`
- returns key when no value can be resolved
- throws in strict mode

Category-aware APIs:

- `translateIn(category, key, language?, placeholder?)`
- `in(category, key, language?, placeholder?)` (alias of `translateIn`)
- `withCategory(category)` (returns a category-bound translate function)

Language state APIs:

- `setLanguage(language)`
- `getLanguage()`

Example:

```ts
import { createTranslator } from '@number10/typekit-i18n'
import { translationTable } from './generated/translationTable'

const t = createTranslator(translationTable)

t('welcome_title') // active language ("en" by default)
t.setLanguage('de')
t('welcome_title') // now "de"

t.in('home', 'welcome_title')

const tHome = t.withCategory('home')
tHome('welcome_title')
```

## `createIcuTranslator(table, options?)`

Same base behavior as `createTranslator`, plus ICU rendering.

Additional option:

- `localeByLanguage?: Partial<Record<TLanguage, string>>`

Supported ICU subset:

- `select`: `{gender, select, male {...} female {...} other {...}}`
- `plural`: `{count, plural, =0 {...} one {...} other {...}}`
- `plural` with offset: `{count, plural, offset:1 one {...} other {...}}`
- `selectordinal`: `{place, selectordinal, one {...} two {...} few {...} other {...}}`
- number arguments:
  - `{amount, number}`
  - `{ratio, number, percent}`
  - `{amount, number, currency/EUR}`
  - skeleton form: `{amount, number, ::compact-short}`
- date/time arguments:
  - `{when, date, short|medium|long|full}`
  - `{when, time, short|medium|long|full}`
  - skeleton form: `{when, time, ::HH:mm}` or `{when, date, ::yyyy-MM-dd}`
- `#` replacement in plural/selectordinal branches
- apostrophe escaping (`''`, quoted literals)

Explicitly unsupported ICU features:

- expression types outside the supported subset, for example `choice`
- `select` numeric selectors like `=1` (numeric selectors are only supported in `plural`/`selectordinal`)
- full ICU number skeleton support (only documented tokens are supported)
- full ICU date/time skeleton support (only documented pattern letters are supported)
- MessageFormat-2 syntax

Invalid ICU expressions throw detailed syntax errors with key, language, line, and column.

## `createFormatjsIcuTranslator(table, options?)`

Runtime import:

```ts
import { createFormatjsIcuTranslator } from '@number10/typekit-i18n/runtime/icu-formatjs'
```

Behavior:

- same translator API shape as `createIcuTranslator`
- ICU rendering delegated to `intl-messageformat` (FormatJS)
- supports legacy `{name|formatter}` placeholders for backward compatibility
- `intl-messageformat` is an optional peer dependency and only needed for this import path

## Placeholder Replacement

Payload shape:

```ts
{
  data: [{ key: 'name', value: 'Mara' }]
}
```

Tokens:

- `{name}`: raw replacement
- `{amount|currency}`: named formatter callback

If formatter is missing, fallback is `String(value)`.

## Translation Runtime Object

`createTranslationRuntime(table, options?)` returns:

- `translate(key, language?, placeholder?)`
- `translateIn(category, key, language?, placeholder?)`
- `withCategory(category)`
- `setLanguage(language)`
- `getLanguage()`
- `configure(options)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`

`configure` can update:

- `defaultLanguage`
- `language`
- `missingStrategy`
- `onMissingTranslation` (`null` clears)
- `formatters` (`null` clears)
- `collectMissingTranslations`

Also exported:

- `createConsoleMissingTranslationReporter(writer?)` — console warn reporter for missing events

## `onError` Callback (ICU Translators)

Both `createIcuTranslator` and `createFormatjsIcuTranslator` accept an optional `onError` callback:

```ts
import { createIcuTranslator } from '@number10/typekit-i18n'
import type { TranslationErrorEvent } from '@number10/typekit-i18n'

const t = createIcuTranslator(table, {
  onError: (event: TranslationErrorEvent) => {
    console.warn(`ICU error for key "${event.key}": ${event.error.message}`)
  },
})
```

When `onError` is provided, ICU parse and render errors are reported via the callback
instead of throwing. The translation returns the raw key as fallback value.
Without `onError`, errors throw as before.

Error event shape:

- `key` — translation key
- `language` — requested language
- `defaultLanguage` — fallback language
- `reason` — `'icuParseError'` or `'icuRenderError'`
- `error` — original `Error` object

## Plural Helpers (Basic Translator)

For pluralization without ICU syntax, use the convention-based `pluralKey` helper:

```ts
import { createTranslator, pluralKey } from '@number10/typekit-i18n'

// Translation table with suffixed keys:
//   item_count_one:   "{count} item"
//   item_count_other: "{count} items"

const t = createTranslator(table)

const key = pluralKey('item_count', 5) // → "item_count_other"
const key = pluralKey('item_count', 1) // → "item_count_one"
const key = pluralKey('item_count', 0, 'ar') // → "item_count_zero"

t(key, { data: [{ key: 'count', value: 5 }] })
```

`pluralCategory(count, locale?)` returns the raw `Intl.LDMLPluralRule` if more control is needed.

## React Integration

React hooks are available via `@number10/typekit-i18n/react`:

```tsx
import { TranslationProvider, useTranslate } from '@number10/typekit-i18n/react'

function App() {
  return (
    <TranslationProvider table={translationTable} defaultLanguage="en">
      <Welcome />
    </TranslationProvider>
  )
}

function Welcome() {
  const { t, language, setLanguage } = useTranslate()
  return <h1>{t('greeting_title')}</h1>
}
```

ICU variant: <code v-pre>&lt;IcuTranslationProvider localeByLanguage={{ de: 'de-DE' }}&gt;</code> + `useIcuTranslate()`.
