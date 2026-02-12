# typekit-i18n Diagnostics Matrix

This matrix tracks stable diagnostic codes and current quick-fix support in the extension.

## Diagnostic Codes

| Code     | Severity | Meaning                                                           | Quick Fix                                            |
| -------- | -------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| `TKI001` | Error    | Parser error in translation source file.                          | No                                                   |
| `TKI002` | Error    | Invalid schema (for example missing required CSV/YAML structure). | No                                                   |
| `TKI003` | Error    | CSV header missing `key` column.                                  | No                                                   |
| `TKI004` | Error    | Translation value is not a string.                                | Yes (`Replace value with empty string`)              |
| `TKI100` | Error    | Duplicate key definition.                                         | Yes (`Rename duplicate key`, `Delete duplicate key`) |
| `TKI101` | Warning  | Missing locale value for a key.                                   | Yes (`Add missing locale`)                           |
| `TKI102` | Warning  | Placeholder mismatch across locales.                              | Yes (`Align placeholders with base locale`)          |
| `TKI103` | Warning  | ICU plural/selectordinal without `other` branch.                  | Yes (`Copy ICU template from base locale`)           |
| `TKI200` | Error    | Missing key usage in code (`t(...)` / `icu(...)`).                | Yes (`Create translation key`)                       |
