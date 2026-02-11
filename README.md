# typekit-i18n

Type-safe internationalization toolkit for TypeScript apps.

This repository is a pnpm workspace with three targets:

- `packages/typekit-i18n`: publishable runtime + codegen package
- `apps/playground-ts`: React playground for runtime/codegen features
- `apps/docs-site`: VitePress documentation site (GitHub Pages target)

## Quick Start

```bash
pnpm install
pnpm run gen:typekit-i18n
pnpm run dev:playground
```

Playground URL: `http://localhost:4173`

Run docs locally:

```bash
pnpm run dev:docs
```

Docs URL: `http://localhost:4174`

## Workspace Commands

```bash
pnpm run gen
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run check
```

Targeted commands:

```bash
pnpm --filter typekit-i18n run build
pnpm --filter @typekit-i18n/playground-ts run gen
pnpm --filter @typekit-i18n/docs-site run docs:build
```

## Package Overview (`typekit-i18n`)

The package provides:

- Runtime translator API with type-safe keys and languages
- Placeholder replacement and named formatters (`{amount|currency}`)
- Fallback and strict missing-translation behavior
- Translation resource validation (`csv` and `yaml`)
- Code generation for `translationTable.ts` and `translationKeys.ts`
- CLI: `generate`, `validate`, `convert`

Runtime import:

```ts
import { createTranslator } from 'typekit-i18n'
```

Codegen import:

```ts
import { defineTypekitI18nConfig } from 'typekit-i18n/codegen'
```

Detailed package documentation: [`packages/typekit-i18n/README.md`](packages/typekit-i18n/README.md)

## Generator Workflow

1. Create `typekit.config.ts` in your app/package root.
2. Configure `input`, `output`, `languages`, and `defaultLanguage`.
3. Run `typekit-i18n` (or `typekit-i18n generate`).
4. Import generated `translationTable` and `TranslateKey`/`TranslateLanguage` types.
5. Build a translator with `createTranslator(...)`.

Auto-discovered config files:

- `typekit.config.ts|json|yaml|yml`
- `typekit-i18n.config.ts|json|yaml|yml` (legacy fallback)

## Docs Site and GitHub Pages

Source docs live in `apps/docs-site/docs`.

Local build:

```bash
pnpm --filter @typekit-i18n/docs-site run docs:build
```

For GitHub Pages project sites, set base path to repository name during build:

```bash
DOCS_BASE_PATH=/typekit-i18n/ pnpm --filter @typekit-i18n/docs-site run docs:build
```

The VitePress config reads `DOCS_BASE_PATH` and defaults to `/`.

## Repository References

- Root docs: [`README.md`](README.md)
- npm package docs: [`packages/typekit-i18n/README.md`](packages/typekit-i18n/README.md)
- Docs site source: [`apps/docs-site/docs`](apps/docs-site/docs)
