# typekit-i18n

Type-safe i18n toolkit based on code generation from translation resource files.

## Goal

Provide a small, reliable workflow for multilingual UI text where translation keys are type-safe in application code.

Current blueprint in this repository:

- Translation resources in CSV (`ts/translations/translationTable*.csv`)
- Generator pipeline (`scripts/translation-generator.ts`)
- Typed runtime access (`ts/translations/translation.ts`)
- Generated source of truth (`ts/translations/translationTable.ts`)

## Current Project Status

This repository is currently a blueprint extraction stage.

- Existing code fragments are reference implementations
- Module locations and package boundaries are expected to change
- Current `typecheck`/`test` commands are defined but not yet hard quality gates until the structure migration is complete

## v1 Scope

What v1 includes:

- Type-safe translation keys for TypeScript projects
- CSV-to-TypeScript code generation
- Runtime translation lookup with default-language fallback
- Placeholder replacement in translation strings
- Basic test coverage for runtime translation behavior

What v1 does not include:

- Built-in translation editor UI
- Hard coupling to cloud translation providers
- First-class multi-language SDKs beyond TypeScript (e.g. Swift generator as next phase)

## Minimum Requirements

- Node.js `>= 20.11.0`
- `pnpm` (project uses `pnpm@10.28.1`)
- TypeScript toolchain configured via `tsconfig.json`
- Test runner configured via Vitest

Setup and verification:

```bash
pnpm install
pnpm run generate
pnpm run typecheck
pnpm run test
```

One-shot check:

```bash
pnpm run check
```

## Public API (v1)

Primary API surface:

- `translate(key, language, placeholder?) => string`
- `supportedLanguages: ILanguages[]`
- `Iso639Codes` and `Iso639CodeType`
- `TranslateKeys` (generated union from translation resources)

Current signature:

```ts
translate(key: TranslateKeys, language: Iso639CodeType, placeholder?: Placeholder): string
```

Behavior:

- Resolves translation for `key` in `language`
- Falls back to default language (`en`) if target language is missing
- Returns `key` when no translation can be resolved
- Replaces `{placeholder}` tokens if placeholder data is provided

## Resource Contract (CSV)

Each translation row is expected to contain:

- `key` (stable identifier used in code)
- `description` (context for translators/developers)
- one column per language (currently `en`, `de`)

Format notes:

- CSV delimiter: `;`
- UTF-8 supported
- multiple `translationTable*.csv` files are merged into one generated table

## Workflow

1. Maintain translations in `ts/translations/translationTable*.csv`
2. Run generator `scripts/translation-generator.ts`
3. Use generated keys/API from `ts/translations/translation.ts`
4. Verify behavior with tests in `ts/translations/tests/translation.test.ts`

## Architecture Direction (next)

- Extract this blueprint into reusable packages:
- `@typekit-i18n/core` (runtime + types)
- `@typekit-i18n/codegen` (resource validation + generation CLI)
- Define plugin-style provider interface for optional cloud translation adapters
- Keep Swift/other language targets behind a neutral intermediate model
