# typekit-i18n

Type-safe i18n runtime and code generator for TypeScript.

## Installation

```bash
pnpm add typekit-i18n
```

Alternative package managers:

```bash
npm install typekit-i18n
# or
yarn add typekit-i18n
```

## What You Get

- Typed translator creation (`createTranslator`)
- Runtime fallback or strict error behavior for missing translations
- Placeholder replacement with optional named formatters
- Generator config helpers (`defineTypekitI18nConfig`)
- CLI for generation, validation, and format conversion
- CSV and YAML translation resource support

## Runtime Quick Start

### 1. Generate a translation table

Create `typekit.config.ts`:

```ts
import { defineTypekitI18nConfig } from 'typekit-i18n/codegen'

export default defineTypekitI18nConfig({
  input: ['./translations/*.csv', './translations/*.yaml'],
  output: './src/generated/translationTable.ts',
  outputKeys: './src/generated/translationKeys.ts',
  languages: ['en', 'de', 'fr'] as const,
  defaultLanguage: 'en',
})
```

Run generator:

```bash
npx typekit-i18n
# same as: npx typekit-i18n generate
```

### 2. Create a translator

```ts
import { createTranslator } from 'typekit-i18n'
import type { PlaceholderFormatterMap } from 'typekit-i18n'
import type { TranslateKey, TranslateLanguage } from './generated/translationKeys'
import { translationTable } from './generated/translationTable'

const formatters: PlaceholderFormatterMap<TranslateKey, TranslateLanguage> = {
  currency: (value) => `EUR ${value}`,
}

const t = createTranslator<TranslateLanguage, TranslateKey, typeof translationTable>(
  translationTable,
  {
    defaultLanguage: 'en',
    missingStrategy: 'fallback',
    formatters,
  }
)

const title = t('greeting_title', 'de')
const price = t('price_formatted', 'de', {
  data: [{ key: 'amount', value: 12.5 }],
})
```

## Runtime API

### `createTranslator(table, options)`

Creates a translator function:

```ts
;(key, language, placeholder?) => string
```

`options`:

- `defaultLanguage`: fallback language
- `missingStrategy`: `'fallback' | 'strict'` (default: `'fallback'`)
- `formatters`: formatter map for tokens like `{value|currency}`
- `onMissingTranslation`: callback for missing key/language/fallback events

Missing translation reasons:

- `missingKey`
- `missingLanguage`
- `missingFallback`

### `createTranslationRuntime(table, options)`

Creates an isolated runtime object with:

- `translate(...)`
- `configure(...)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`

### Default runtime helpers

- `translate(key, language, placeholder?)`
- `configureTranslationRuntime(options)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`
- `createConsoleMissingTranslationReporter(writer?)`

## Codegen Config API (`typekit-i18n/codegen`)

Main exports:

- `defineTypekitI18nConfig(...)`
- `generateTranslationTable(...)`
- `validateTranslationFile(...)`
- `loadTypekitI18nConfig(...)`

Config shape:

```ts
interface TypekitI18nConfig<TLanguage extends string = string> {
  input: string | ReadonlyArray<string>
  format?: 'csv' | 'yaml'
  output: string
  outputKeys?: string
  languages: ReadonlyArray<TLanguage>
  defaultLanguage: TLanguage
}
```

Config file auto-discovery order:

- `typekit.config.ts`
- `typekit.config.json`
- `typekit.config.yaml`
- `typekit.config.yml`
- `typekit-i18n.config.ts`
- `typekit-i18n.config.json`
- `typekit-i18n.config.yaml`
- `typekit-i18n.config.yml`

## CLI

Binary name: `typekit-i18n`

### `generate` (default)

```bash
typekit-i18n generate --config ./typekit.config.ts
# or simply:
typekit-i18n
```

- Loads config and generates `translationTable.ts` + `translationKeys.ts`
- If no config file is found, command exits without failure

### `validate`

```bash
# YAML validation
typekit-i18n validate --input ./translations/features.yaml --format yaml

# CSV validation (requires languages and source language)
typekit-i18n validate \
  --input ./translations/ui.csv \
  --format csv \
  --languages en,de,fr \
  --source-language en
```

### `convert`

```bash
# YAML -> CSV
typekit-i18n convert \
  --from yaml \
  --to csv \
  --input ./translations/features.yaml \
  --output ./translations/features.csv

# CSV -> YAML (CSV context required)
typekit-i18n convert \
  --from csv \
  --to yaml \
  --input ./translations/ui.csv \
  --output ./translations/ui.yaml \
  --languages en,de,fr \
  --source-language en
```

## Resource Formats

### CSV

- Delimiter is auto-detected (`;` or `,`)
- Required columns: `key`, `description`, one column per configured language
- Optional metadata columns:
  - `status` (`draft | review | approved`)
  - `tags` (comma-separated)
  - `placeholders` (comma-separated: `name:type:formatHint`)
- Default/source language value must not be empty

Example:

```csv
key;description;status;tags;placeholders;en;de
welcome_title;Main title;approved;ui,home;name:string;Welcome {name};Willkommen {name}
```

### YAML

Example:

```yaml
version: '1'
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: welcome_title
    description: Main title
    status: approved
    tags: [ui, home]
    placeholders:
      - name: name
        type: string
    values:
      en: 'Welcome {name}'
      de: 'Willkommen {name}'
```

## Notes

- Generated key unions preserve key strings exactly.
- Keep translation keys identifier-friendly (for example `snake_case`) for best DX.
- For complete workspace docs and examples, see the repository root README.
