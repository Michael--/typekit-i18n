# GitHub Pages

`docs-site` is configured for GitHub Pages deployment.

## Base Path

The VitePress config reads `DOCS_BASE_PATH` and normalizes trailing slash.

- unset: base is `/`
- set (project pages): base should be `/<repo>/`

Build example for this repository:

```bash
DOCS_BASE_PATH=/typekit-i18n/ pnpm --filter @typekit-i18n/docs-site run docs:build
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
- builds docs with `DOCS_BASE_PATH=/typekit-i18n/`
- uploads `apps/docs-site/docs/.vitepress/dist`
- deploys via `actions/deploy-pages`

## Common Failure Points

- wrong base path for project pages
- missing build artifacts in `docs/.vitepress/dist`
- links that assume root `/` while using project base path
