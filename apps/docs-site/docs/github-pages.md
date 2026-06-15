---
description: >-
  Deploy the typekit-i18n documentation site to GitHub Pages with a custom
  domain and CI setup.
---

# GitHub Pages

`docs-site` is configured for GitHub Pages deployment.

## Base Path

The production site is deployed to the custom domain:

- `https://typekit-i18n.number10.de/`

The VitePress config reads `DOCS_BASE_PATH` and normalizes trailing slash. For the production custom domain, leave it unset so the base is `/`.

Build example for this repository:

```bash
pnpm --filter @typekit-i18n/docs-site run docs:build
```

## Local Preview

```bash
pnpm --filter @typekit-i18n/docs-site run docs:build
pnpm --filter @typekit-i18n/docs-site run docs:preview
```

## Repository Workflow

Deployment workflow file:

- `.github/workflows/pages.yml`

Workflow behavior:

- triggers on pushes to `main` for docs/package/workflow paths
- builds docs with the default `/` base path for the custom domain
- uploads `apps/docs-site/docs/.vitepress/dist`
- deploys via `actions/deploy-pages`

## Common Failure Points

- wrong base path for the configured Pages domain
- missing build artifacts in `docs/.vitepress/dist`
- links or sitemap entries that point to an old Pages URL
