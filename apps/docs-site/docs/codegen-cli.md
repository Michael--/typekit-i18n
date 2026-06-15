---
description: >-
  Code generation and CLI reference for typekit-i18n — generate typed
  translation keys, validate resources, and convert formats.
---

# Codegen + CLI

Codegen imports come from `@number10/typekit-i18n/codegen`.

## Config Helper

Use `defineTypekitI18nConfig` for language inference:

```ts
import { defineTypekitI18nConfig } from '@number10/typekit-i18n/codegen'

export default defineTypekitI18nConfig({
  input: ['./translations/*.csv', './translations/*.yaml', './translations/*.json'],
  output: './src/generated/translationTable.ts',
  outputKeys: './src/generated/translationKeys.ts',
  languages: ['en', 'de', 'fr'] as const,
  defaultLanguage: 'en',
})
```

Config fields:

- `input`: file path or glob pattern(s)
- `format?`: optional force format for all inputs (`csv`, `yaml`, or `json`)
- `output`: generated table file path
- `outputKeys?`: generated key/language type file path
- `outputSwift?`: generated Swift output path (used by `--target swift`)
- `outputKotlin?`: generated Kotlin output path (used by `--target kotlin`)
- `outputRuntimeBridge?`: generated runtime bridge module path (`translation.runtime.mjs` by default when native targets are generated)
- `outputRuntimeBridgeBundle?`: generated bundled runtime bridge script path (`translation.runtime.bundle.js` by default when native targets are generated)
- `runtimeBridgeMode?`: runtime bridge mode (`icu` default, `basic` and `icu-formatjs` optional)
- `runtimeBridgeFunctionName?`: runtime bridge function name on `globalThis` (`__typekitTranslate` default)
- `outputContract?`: generated canonical contract JSON path
- `languages`: supported languages
- `defaultLanguage`: fallback language
- `localeByLanguage?`: optional locale mapping (used by ICU-aware targets)

Rules:

- `languages` must be non-empty and unique
- `defaultLanguage` must be part of `languages`
- `output` and `outputKeys` must not be identical
- duplicate keys across merged files fail generation
- `runtimeBridgeMode: 'icu-formatjs'` requires optional peer dependency `intl-messageformat`
- use `runtimeBridgeMode: 'basic'` for the smallest runtime footprint when ICU features are not needed

## Config Discovery

When no `--config` is passed, CLI checks:

- `typekit.config.ts|json|yaml|yml`
- `typekit-i18n.config.ts|json|yaml|yml`

## Generation Output

`generate` writes:

- `translationTable.ts`
- `translationKeys.ts`

Generated types include:

- `TranslateKey`
- `TranslateKeys`
- `TranslationCategories`
- `TranslateCategory`
- `TranslateKeysByCategory`
- `TranslateKeyOf`
- `LanguageCodes`
- `TranslateLanguage`

## CLI Commands

Binary name: `typekit-i18n`

### `init`

```bash
typekit-i18n init
```

Scaffolds a new project with `typekit.config.ts` and `translations/example.csv`.
Skips existing files without overwriting.

### `generate` (default)

```bash
typekit-i18n generate --config ./typekit.config.ts
# or simply
typekit-i18n

# watch mode (regenerates on file changes):
typekit-i18n generate --watch
typekit-i18n generate -w

# explicit target selection
typekit-i18n generate --target ts
typekit-i18n generate --target swift
typekit-i18n generate --target kotlin
typekit-i18n generate --target ts,swift,kotlin
```

If no config is found, command exits successfully and skips generation.

`generate` always emits canonical `translation.contract.json` plus selected target outputs.
When `swift` or `kotlin` targets are generated, `translation.runtime.mjs` and `translation.runtime.bundle.js` are generated automatically.

Native target integration details are documented in [Native Targets](./native-targets).

### `validate`

```bash
# YAML (format inferred)
typekit-i18n validate --input ./translations/features.yaml

# CSV
typekit-i18n validate \
  --input ./translations/ui.csv \
  --format csv \
  --languages en,de,fr \
  --source-language en
```

CSV validation requires `--languages` and `--source-language` (or `--sourceLanguage`).

### `convert`

```bash
# YAML -> CSV
typekit-i18n convert \
  --from yaml \
  --to csv \
  --input ./translations/features.yaml \
  --output ./translations/features.csv

# CSV -> YAML
typekit-i18n convert \
  --from csv \
  --to yaml \
  --input ./translations/ui.csv \
  --output ./translations/ui.yaml \
  --languages en,de,fr \
  --source-language en
```

For CSV input conversion, CSV context arguments are required.

### `lint`

```bash
# Find dead keys (defined but unused in source):
typekit-i18n lint --source 'src/**/*.tsx'

# CI mode: exit code 1 when dead keys are found:
typekit-i18n lint --source 'src/**/*.tsx' --strict
```

Scans source files for string literals matching defined translation keys.
Reports dead keys and unmatched source keys.
Default output is warnings (exit code 0); use `--strict` for CI failure.

## Programmatic API

Also exported:

- `generateTranslationTable(config)`
- `validateTranslationFile(options)`
- `validateYamlTranslationFile(path)`
- `loadTypekitI18nConfig(path?)`

## Flow

```mermaid
flowchart LR
  A["Load config"] --> B["Resolve input files"]
  B --> C["Validate CSV/YAML/JSON structure"]
  C --> D["Validate language contract"]
  D --> E["Merge entries + reject duplicate keys"]
  E --> F["Write translationTable.ts"]
  E --> G["Write translationKeys.ts"]
  E --> H["Write translation.contract.json"]
  E --> I["Write translation.runtime.mjs (native targets)"]
  I --> J["Bundle to translation.runtime.bundle.js"]
```
