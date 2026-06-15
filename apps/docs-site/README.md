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

Build for the configured custom domain:

```bash
pnpm --filter @typekit-i18n/docs-site run docs:build
```

The production custom domain uses the default `/` base path.

Deployment workflow:

- file: `.github/workflows/pages.yml`
- build output: `apps/docs-site/docs/.vitepress/dist`
