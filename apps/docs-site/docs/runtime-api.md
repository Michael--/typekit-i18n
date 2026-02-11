# Runtime API

Runtime imports come from `typekit-i18n`.

## `createTranslator(table, options)`

Creates a typed translator function:

```ts
;(key, language, placeholder?) => string
```

`options`:

- `defaultLanguage: TLanguage`
- `missingStrategy?: 'fallback' | 'strict'`
- `formatters?: Record<string, PlaceholderFormatter>`
- `onMissingTranslation?: (event) => void`

Behavior:

- Returns requested translation when present
- Falls back to `defaultLanguage` when target translation is empty
- Returns `key` when no value can be resolved
- Throws in `strict` mode on missing key/language/fallback

```mermaid
flowchart TD
  A["translate(key, language, placeholder?)"] --> B{"Key exists?"}
  B -- "No" --> C["Emit reason: missingKey"]
  C --> D{"missingStrategy = strict?"}
  D -- "Yes" --> E["Throw error"]
  D -- "No" --> F["Return key"]
  B -- "Yes" --> G{"Requested language text non-empty?"}
  G -- "Yes" --> H["Apply placeholders + formatters"]
  H --> I["Return requested text"]
  G -- "No" --> J{"Fallback text non-empty?"}
  J -- "Yes" --> K["Emit reason: missingLanguage"]
  K --> H
  J -- "No" --> L["Emit reason: missingFallback"]
  L --> D
```

Missing event reasons:

- `missingKey`
- `missingLanguage`
- `missingFallback`

## Placeholder Replacement

Placeholder payload:

```ts
{
  data: [{ key: 'name', value: 'Mara' }]
}
```

Template usage:

- Raw replacement: `{name}`
- Named formatter: `{amount|currency}`

If a formatter is missing, raw string conversion is used as fallback.

```mermaid
flowchart LR
  A["Template token {amount|currency}"] --> B{"Formatter exists?"}
  B -- "Yes" --> C["Run formatter(value, context)"]
  B -- "No" --> D["Use String(value) fallback"]
```

## `createTranslationRuntime(table, options)`

Creates an isolated runtime instance with mutable behavior:

- `translate(key, language, placeholder?)`
- `configure(options)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`

`configure` can update:

- `defaultLanguage`
- `missingStrategy`
- `onMissingTranslation`
- `formatters`
- `collectMissingTranslations`

## Default Runtime Helpers

These helpers operate on the package default generated table:

- `translate(key, language, placeholder?)`
- `configureTranslationRuntime(options)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`
- `createConsoleMissingTranslationReporter(writer?)`
