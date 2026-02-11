# typekit-i18n

Type-safe internationalization toolkit for TypeScript with:

- runtime translation APIs
- ICU message rendering support
- code generation from CSV/YAML resources
- CLI for generate, validate, and convert workflows

This repository is a `pnpm` workspace with three targets:

- `packages/typekit-i18n`: publishable npm package (runtime + codegen + CLI)
- `apps/playground-ts`: React playground for feature demos
- `apps/docs-site`: VitePress documentation site (GitHub Pages target)

## Requirements

- Node.js `>= 20.11.0`
- pnpm `>= 10`

## Workspace Setup

```bash
pnpm install
```

Core workspace commands:

```bash
pnpm run gen
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run check
```

Useful targeted commands:

```bash
pnpm --filter typekit-i18n run build
pnpm --filter @typekit-i18n/playground-ts run gen
pnpm --filter @typekit-i18n/docs-site run docs:build
```

## Quick Local Workflow

Generate the package CLI and playground artifacts:

```bash
pnpm run gen:typekit-i18n
```

Run playground:

```bash
pnpm run dev:playground
```

Playground URL: `http://localhost:4173`

Run docs site:

```bash
pnpm run dev:docs
```

Docs URL: `http://localhost:4174`

## Package Capabilities (`typekit-i18n`)

### Runtime

- `createTranslator(...)` for placeholder-based translation
- `createIcuTranslator(...)` for ICU subset support
- fallback and strict missing-translation behavior
- optional missing-translation callback
- optional custom placeholder formatter hooks (`{amount|currency}`)

### ICU Support

The ICU runtime supports a pragmatic subset including:

- `select`, `plural`, `selectordinal`
- `number`, `date`, `time` arguments
- plural `offset:n`
- `#` replacement in plural/selectordinal branches
- apostrophe escaping (`''`, quoted literals)

### Codegen and Validation

- config helper: `defineTypekitI18nConfig(...)`
- translation table generation from mixed CSV and YAML inputs
- type output generation (`TranslateKey`, `TranslateLanguage`, `LanguageCodes`)
- schema and placeholder consistency validation
- duplicate key detection across all input files

### CLI

Binary name: `typekit-i18n`

Commands:

- `typekit-i18n` or `typekit-i18n generate`
- `typekit-i18n validate`
- `typekit-i18n convert`

## Minimal Consumer Example

Install package:

```bash
pnpm add typekit-i18n
```

Define config (`typekit.config.ts`):

```ts
import { defineTypekitI18nConfig } from 'typekit-i18n/codegen'

export default defineTypekitI18nConfig({
  input: ['./translations/*.csv', './translations/*.yaml'],
  output: './src/generated/translationTable.ts',
  outputKeys: './src/generated/translationKeys.ts',
  languages: ['en', 'de'] as const,
  defaultLanguage: 'en',
})
```

Generate outputs:

```bash
npx typekit-i18n
```

Use runtime:

```ts
import { createTranslator } from 'typekit-i18n'
import { translationTable } from './generated/translationTable'
import type { TranslateKey, TranslateLanguage } from './generated/translationKeys'

const t = createTranslator<TranslateLanguage, TranslateKey, typeof translationTable>(
  translationTable,
  { defaultLanguage: 'en' }
)

const title = t('welcome_title', 'de')
```

## Docs and Publishing

- GitHub root documentation: this file (`README.md`)
- npm package documentation: `packages/typekit-i18n/README.md`
- full docs site source: `apps/docs-site/docs`

Build docs for local preview:

```bash
pnpm --filter @typekit-i18n/docs-site run docs:build
pnpm --filter @typekit-i18n/docs-site run docs:preview
```

Build docs for GitHub Pages project path:

```bash
DOCS_BASE_PATH=/typekit-i18n/ pnpm --filter @typekit-i18n/docs-site run docs:build
```

The repository includes a Pages workflow at `.github/workflows/pages.yml` that publishes `apps/docs-site/docs/.vitepress/dist`.

## Documentation References

- Root overview: `README.md`
- Package/npm reference: `packages/typekit-i18n/README.md`
- Docs site overview: `apps/docs-site/docs/index.md`
- Runtime API docs: `apps/docs-site/docs/runtime-api.md`
- CLI and codegen docs: `apps/docs-site/docs/codegen-cli.md`
- Resource format docs: `apps/docs-site/docs/resource-formats.md`
