# Codegen + CLI

Codegen imports come from `@number10/typekit-i18n/codegen`.

## Config Helper

Use `defineTypekitI18nConfig` for language inference:

```ts
import { defineTypekitI18nConfig } from '@number10/typekit-i18n/codegen'

export default defineTypekitI18nConfig({
  input: ['./translations/*.csv', './translations/*.yaml'],
  output: './src/generated/translationTable.ts',
  outputKeys: './src/generated/translationKeys.ts',
  languages: ['en', 'de', 'fr'] as const,
  defaultLanguage: 'en',
})
```

Config fields:

- `input`: file path or glob pattern(s)
- `format?`: optional force format for all inputs (`csv` or `yaml`)
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

### `generate` (default)

```bash
typekit-i18n generate --config ./typekit.config.ts
# or simply
typekit-i18n

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
  B --> C["Validate CSV/YAML structure"]
  C --> D["Validate language contract"]
  D --> E["Merge entries + reject duplicate keys"]
  E --> F["Write translationTable.ts"]
  E --> G["Write translationKeys.ts"]
  E --> H["Write translation.contract.json"]
  E --> I["Write translation.runtime.mjs (native targets)"]
  I --> J["Bundle to translation.runtime.bundle.js"]
```
