# typekit-i18n VSCode Extension

VSCode extension for `typekit-i18n` authoring workflows.

## Status

- Initial release: `0.1.0`
- Marketplace link: pending first publish

## Features

- Key intelligence:
  - Go to definition (`F12`)
  - Find references (`Shift+F12`)
  - Rename symbol (`F2`)
  - Safe delete warning for still-referenced keys
- Diagnostics and quick fixes:
  - Unknown key usage in code
  - Missing locale values
  - Duplicate keys
  - Placeholder mismatch
  - CSV/YAML schema and value type checks
  - ICU plural/selectordinal `other` branch check
- Completion and hover:
  - Translation-aware key completion
  - Locale preview in completion and hover
  - Placeholder snippet insertion in `data` array format
- Utility:
  - Refresh translation index
  - Run diagnostics manually
  - Measure index refresh baseline (`typekitI18n.measureIndexPerformance`)

## Scripts

- `pnpm --filter typekit-i18n-vscode build`
- `pnpm --filter typekit-i18n-vscode dev`
- `pnpm --filter typekit-i18n-vscode lint`
- `pnpm --filter typekit-i18n-vscode package:vsix`
- `pnpm --filter typekit-i18n-vscode typecheck`
- `pnpm --filter typekit-i18n-vscode test`

## Current Scope

Implementation details and rollout plan are tracked in `PLAN.md`.
Diagnostic code coverage is tracked in `docs/DIAGNOSTICS.md`.

## Useful Settings

- `typekitI18n.translationGlobs`: translation file discovery globs.
- `typekitI18n.completionMode`: `fallback`, `always`, or `alwaysPreferExtension` (default, keeps extension suggestions first).
- `typekitI18n.enablePlaceholderSnippets`: inserts `t("key", { ... })` placeholder snippets on completion when applicable.
- `typekitI18n.previewLocales`: locales shown in completion/hover previews.
- `typekitI18n.previewMaxLocales`: max locale count shown in completion/hover previews.

## Local Installation

1. Build and package the extension:
   - `pnpm --filter typekit-i18n-vscode package:vsix`
2. Install the generated `.vsix` from VSCode:
   - Extensions view -> `...` menu -> `Install from VSIX...`
