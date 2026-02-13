# VSCode Extension

The `typekit-i18n` VSCode extension improves authoring workflows for translation keys and raw translation files (`.yaml`, `.yml`, `.csv`).

## Availability

- Marketplace listing: https://marketplace.visualstudio.com/items?itemName=number10.typekit-i18n-vscode
- Local package path in this repository:
  - `packages/typekit-i18n-vscode`

## Core Features

- Key intelligence:
  - Go to definition (`F12`) from `t("...")` / `icu("...")`
  - Find references (`Shift+F12`) across code and translation files
  - Rename symbol (`F2`) across code and translation files
- Diagnostics + quick fixes:
  - Unknown key usage in code
  - Missing locale values
  - Duplicate key definitions
  - Placeholder mismatch across locales
  - CSV/YAML schema issues and value type validation
  - ICU plural/selectordinal `other` branch checks
- Completion + hover:
  - Key completion with translation preview details
  - Hover preview for configured locales
  - Placeholder snippet insertion for parameterized keys
- Utility:
  - Manual diagnostics refresh command
  - Index refresh performance baseline command

## Install from VSIX (Local)

Build extension package:

```bash
pnpm --filter typekit-i18n-vscode package:vsix
```

Install in VSCode:

1. Open Extensions view
2. Open menu `...`
3. Select `Install from VSIX...`
4. Choose `packages/typekit-i18n-vscode/typekit-i18n-vscode-0.1.0.vsix`

## Extension Settings

- `typekitI18n.translationGlobs`: translation file discovery globs.
- `typekitI18n.completionMode`: completion behavior (`fallback`, `always`, `alwaysPreferExtension`).
- `typekitI18n.enablePlaceholderSnippets`: enables snippet insertion for placeholder data arguments.
- `typekitI18n.previewLocales`: locales shown in completion and hover previews.
- `typekitI18n.previewMaxLocales`: max locale count in completion and hover previews.

## Commands

- `typekit-i18n: Refresh Translation Index`
- `typekit-i18n: Run Diagnostics`
- `typekit-i18n: Measure Index Performance`
