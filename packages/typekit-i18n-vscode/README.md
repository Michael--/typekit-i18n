# typekit-i18n VSCode Extension

VSCode extension workspace for `typekit-i18n` authoring workflows.

## Scripts

- `pnpm --filter typekit-i18n-vscode build`
- `pnpm --filter typekit-i18n-vscode dev`
- `pnpm --filter typekit-i18n-vscode lint`
- `pnpm --filter typekit-i18n-vscode package:vsix`
- `pnpm --filter typekit-i18n-vscode typecheck`
- `pnpm --filter typekit-i18n-vscode test`

## Current Scope

- Key intelligence scaffolding (definition/reference/rename).
- Diagnostics command and refresh hooks.
- YAML/CSV schema validation hooks.
- Completion and hover provider scaffolding.

Implementation details and rollout plan are tracked in `PLAN.md`.

## Useful Settings

- `typekitI18n.translationGlobs`: translation file discovery globs.
- `typekitI18n.completionMode`: `fallback`, `always`, or `alwaysPreferExtension` (default, keeps extension suggestions first).
- `typekitI18n.previewLocales`: locales shown in completion/hover previews.
- `typekitI18n.previewMaxLocales`: max locale count shown in completion/hover previews.

## Local Installation

1. Build and package the extension:
   - `pnpm --filter typekit-i18n-vscode package:vsix`
2. Install the generated `.vsix` from VSCode:
   - Extensions view -> `...` menu -> `Install from VSIX...`
