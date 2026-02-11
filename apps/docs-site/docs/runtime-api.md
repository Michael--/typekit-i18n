# Runtime API

Runtime imports come from `typekit-i18n`.

## Core Types

- `TranslationTable<TKey, TLanguage>`
- `Placeholder` and `PlaceholderValue`
- `MissingTranslationEvent`
- `PlaceholderFormatterMap`

## `createTranslator(table, options)`

Creates a typed translator function:

```ts
;(key, language, placeholder?) => string
```

Options:

- `defaultLanguage: TLanguage`
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
- returns key when no value can be resolved
- throws in strict mode

## `createIcuTranslator(table, options)`

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

Invalid ICU expressions throw detailed syntax errors with key, language, line, and column.

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

`createTranslationRuntime(table, options)` returns:

- `translate(key, language, placeholder?)`
- `configure(options)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`

`configure` can update:

- `defaultLanguage`
- `missingStrategy`
- `onMissingTranslation` (`null` clears)
- `formatters` (`null` clears)
- `collectMissingTranslations`

## Default Runtime Helpers

Also exported:

- `translate(...)`
- `configureTranslationRuntime(...)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`
- `createConsoleMissingTranslationReporter(writer?)`
