# Changelog

All notable changes to this project are documented in this file.

## 0.1.0 - 2026-02-12

- Initial public release of the `typekit-i18n` VSCode extension.
- Added key intelligence features:
  - Go to definition (`F12`)
  - Find references (`Shift+F12`)
  - Rename symbol (`F2`) across code and translation sources
  - Safe delete warning for still-referenced translation keys
- Added diagnostics and quick fixes for:
  - Missing key usage in code
  - Missing locale values
  - Placeholder mismatch across locales
  - Duplicate keys
  - CSV/YAML schema issues and value type constraints
  - ICU plural/selectordinal `other` branch validation
- Added translation-aware completion and hover previews.
- Added placeholder snippet insertion in `data` array format.
- Added refresh performance baseline command:
  - `typekitI18n.measureIndexPerformance`
- Added extension icon and publish metadata.
- Added diagnostics integration tests and diagnostics matrix documentation.
