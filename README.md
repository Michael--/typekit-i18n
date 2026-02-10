# typekit-i18n

Type-safe i18n toolkit based on code generation from translation resource files.

## Goal

Provide a small, reliable workflow for multilingual UI text where translation keys are type-safe in application code.

Current implementation in this repository:

- Translation resources in CSV (`packages/typekit-i18n/resources/translations/*.csv`)
- Generator pipeline (`packages/typekit-i18n/src/codegen/*`)
- Typed runtime access (`packages/typekit-i18n/src/runtime/*`)
- Generated source of truth (`packages/typekit-i18n/dist/generated/translationTable.ts`)

## Current Project Status

This repository is in active migration from blueprint to package-first monorepo.

- Core runtime/codegen is now hosted in `packages/typekit-i18n`
- Remaining legacy helper paths are being retired step by step
- Root `typecheck`/`test` are now workspace-scoped quality gates for `packages/*` and `apps/*`
- Legacy reference paths remain outside those gates until migration is complete

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

1. Maintain package resources in `packages/typekit-i18n/resources/translations/*.csv`
2. Run package generation via `pnpm --filter typekit-i18n run gen`
3. Use runtime API from `typekit-i18n` (`translate`, `createTranslator`, typed placeholders)
4. Verify via package tests in `packages/typekit-i18n/tests`

Current workspace-first workflow:

1. Maintain consumer CSV files, for example `apps/playground-ts/translations/*.csv`
2. Define per-consumer config in `typekit-i18n.config.ts`
3. Run consumer generation via `pnpm --filter @typekit-i18n/playground-ts run gen`
4. Consume generated table in app code with runtime imports from `typekit-i18n`

## Architecture Direction (next)

Monorepo target structure:

- `packages/typekit-i18n`
- single publishable npm package for v1
- contains runtime API, CSV resource handling, codegen, Swift target tooling, and provider contract interfaces
- split into smaller packages later only if complexity requires it
- `apps/playground-ts`
- integration playground for API/DX checks
- `apps/docs-site`
- documentation site based on VitePress

Current migration state:

- skeleton folders and starter configs are present for all three targets
- legacy-to-target mapping is documented in `/Volumes/MR-SX5/projects/typekit-i18n/MIGRATION_MAP.md`

Root direction:

- keep root package minimal over time
- focus on shared dev tooling and workspace orchestration
