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

## Exports

Runtime APIs:

```ts
import { createTranslator, createIcuTranslator } from 'typekit-i18n'
```

Codegen APIs:

```ts
import { defineTypekitI18nConfig } from 'typekit-i18n/codegen'
```

CLI binary:

```bash
typekit-i18n
```

## Feature Overview

- Typed translator creation from generated key and language unions
- Fallback or strict error behavior for missing translations
- Placeholder replacement (`{name}`) and formatter tokens (`{amount|currency}`)
- ICU-capable translator for `plural`, `select`, `selectordinal`, `number`, `date`, `time`
- Translation generation from mixed CSV and YAML files
- Validation and format conversion via CLI

## Quick Start

### 1. Create config (`typekit.config.ts`)

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

### 2. Generate translation outputs

```bash
npx typekit-i18n
# same as: npx typekit-i18n generate
```

### 3. Create a runtime translator

```ts
import { createTranslator } from 'typekit-i18n'
import type { PlaceholderFormatterMap } from 'typekit-i18n'
import type { TranslateKey, TranslateLanguage } from './generated/translationKeys'
import { translationTable } from './generated/translationTable'

const formatters: PlaceholderFormatterMap<TranslateKey, TranslateLanguage> = {
  currency: (value) => `EUR ${value}`,
}

const t = createTranslator(translationTable, {
  defaultLanguage: 'en',
  missingStrategy: 'fallback',
  formatters,
})

const title = t('greeting_title', 'de')
const price = t('price_formatted', 'de', {
  data: [{ key: 'amount', value: 12.5 }],
})
```

## Runtime API

### `createTranslator(table, options?)`

Creates a typed translator:

```ts
;(key, language?, placeholder?) => string
```

Options:

- `defaultLanguage?: TLanguage` (default: `'en'` when available in table)
- `missingStrategy?: 'fallback' | 'strict'` (default: `'fallback'`)
- `formatters?: PlaceholderFormatterMap<TKey, TLanguage>`
- `onMissingTranslation?: (event) => void`

Missing reasons:

- `missingKey`
- `missingLanguage`
- `missingFallback`

Behavior summary:

- Requested language value is used when non-empty.
- Empty requested language falls back to `defaultLanguage` (or `'en'` when omitted).
- If fallback is missing, translator returns the key (or throws in strict mode).

### `createIcuTranslator(table, options?)`

Creates a typed translator with ICU support.

Additional option:

- `localeByLanguage?: Partial<Record<TLanguage, string>>`

Supported ICU subset:

- Branch expressions:
  - `{count, plural, =0 {...} one {...} other {...}}`
  - `{count, plural, offset:1 one {...} other {...}}`
  - `{gender, select, male {...} female {...} other {...}}`
  - `{place, selectordinal, one {...} two {...} few {...} other {...}}`
- Argument formatting:
  - `{value, number}`
  - `{value, number, percent}`
  - `{value, number, currency/EUR}`
  - `{dateValue, date, short}`
  - `{dateValue, time, ::HH:mm}`
- `#` substitution inside plural/selectordinal branches
- Apostrophe escaping (`''`, quoted literals)

If ICU syntax is invalid, detailed runtime errors include key, language, and line/column location.

### Placeholder Types

```ts
type PlaceholderValue = string | number | boolean | bigint | Date

interface Placeholder {
  data: ReadonlyArray<{ key: string; value: PlaceholderValue }>
}
```

### Runtime Helper APIs

Also exported:

- `createTranslationRuntime(table, options?)`
- `createConsoleMissingTranslationReporter(writer?)`
- `translate(...)`
- `configureTranslationRuntime(...)`
- `getCollectedMissingTranslations()`
- `clearCollectedMissingTranslations()`

For application integrations, `createTranslator` or `createIcuTranslator` should be preferred.

## Codegen Config API (`typekit-i18n/codegen`)

Main exports:

- `defineTypekitI18nConfig(...)`
- `generateTranslationTable(...)`
- `validateTranslationFile(...)`
- `validateYamlTranslationFile(...)`
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

Notes:

- `input` accepts multiple files/globs and merges them deterministically.
- Without `format`, each file format is inferred by extension.
- Duplicate keys across all inputs are rejected.
- `output` and `outputKeys` must not be the same file path.

Auto-discovered config file order when `--config` is omitted:

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

- Loads config and generates `translationTable.ts` and `translationKeys.ts`
- If no config is found, exits successfully and skips generation

### `validate`

```bash
# YAML (format can be inferred from extension)
typekit-i18n validate --input ./translations/features.yaml

# CSV (requires CSV context)
typekit-i18n validate \
  --input ./translations/ui.csv \
  --format csv \
  --languages en,de,fr \
  --source-language en
```

CSV validation requires:

- `--languages`
- `--source-language` (or `--sourceLanguage`)

### `convert`

```bash
# YAML -> CSV
typekit-i18n convert \
  --from yaml \
  --to csv \
  --input ./translations/features.yaml \
  --output ./translations/features.csv

# CSV -> YAML (requires CSV context)
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

- Delimiter auto-detection: `;` or `,`
- Required columns:
  - `key`
  - `description`
  - one column per configured language
- Optional columns:
  - `status` (`draft | review | approved`)
  - `tags` (comma-separated)
  - `placeholders` (comma-separated definitions: `name:type:formatHint`)

Example:

```csv
key;description;status;tags;placeholders;en;de
greeting_title;Main title;approved;ui,home;name:string;Welcome {name};Willkommen {name}
price_formatted;Price line;review;billing;amount:number:currency;Price {amount|currency};Preis {amount|currency}
```

### YAML

```yaml
version: '1'
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: greeting_title
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

## Validation Guarantees

Validation covers:

- schema correctness
- non-empty key and description
- language declaration consistency
- source/default language completeness
- placeholder declaration consistency
- placeholder token parity across all languages
- duplicate key detection

## Notes

- Generated key unions preserve exact key strings.
- Use identifier-friendly keys (for example `snake_case`) for best developer experience.
- For workspace-level docs and deployment details, see the repository root README.
