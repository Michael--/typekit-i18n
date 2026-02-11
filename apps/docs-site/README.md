# docs-site

VitePress documentation app for `typekit-i18n`.

## Commands

```bash
pnpm --filter @typekit-i18n/docs-site run docs:dev
pnpm --filter @typekit-i18n/docs-site run docs:build
pnpm --filter @typekit-i18n/docs-site run docs:preview
```

## GitHub Pages Build

The VitePress config reads `DOCS_BASE_PATH`.

Example for repository project pages (`/<repo>/`):

```bash
DOCS_BASE_PATH=/typekit-i18n/ pnpm --filter @typekit-i18n/docs-site run docs:build
```

Without `DOCS_BASE_PATH`, base defaults to `/`.

## Content Location

- Docs pages: `apps/docs-site/docs/*.md`
- VitePress config: `apps/docs-site/docs/.vitepress/config.ts`
