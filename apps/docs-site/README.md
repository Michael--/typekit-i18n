# docs-site

VitePress documentation app for `typekit-i18n`.

## Commands

```bash
pnpm --filter @typekit-i18n/docs-site run docs:dev
pnpm --filter @typekit-i18n/docs-site run docs:build
pnpm --filter @typekit-i18n/docs-site run docs:preview
```

## Content and Config

- docs content: `apps/docs-site/docs/*.md`
- VitePress config: `apps/docs-site/docs/.vitepress/config.ts`

## GitHub Pages

Build with repository base path:

```bash
DOCS_BASE_PATH=/typekit-i18n/ pnpm --filter @typekit-i18n/docs-site run docs:build
```

Without `DOCS_BASE_PATH`, base defaults to `/`.

Deployment workflow:

- file: `.github/workflows/pages.yml`
- build output: `apps/docs-site/docs/.vitepress/dist`
