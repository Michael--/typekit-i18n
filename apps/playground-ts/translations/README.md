# Playground Translations

This directory demonstrates the **multi-file and multi-format** translation capability of `typekit-i18n`.

## Structure

Translations are split into **three thematic files** using **mixed formats (CSV + YAML)**:

### 1. `ui.csv` - UI Elements (CSV)

Contains all UI-related strings:

- Settings and labels
- Mode options (fallback/strict)
- Feature section title
- Error messages

### 2. `features.yaml` - Feature Demonstrations (YAML)

Contains strings demonstrating key features:

- Greeting messages (with placeholders)
- Placeholder examples (text, numbers)
- Custom formatter examples (currency, dates)
- Fallback behavior demo
- Includes metadata: status, tags, placeholder types

### 3. `diagnostics.csv` - Diagnostics Panel (CSV)

Contains diagnostics-related strings:

- Diagnostics panel title
- Status messages
- Missing translation count

## Multi-File & Multi-Format Benefits

Splitting translations into multiple files and formats provides:

1. **Better organization** - Related keys grouped together
2. **Easier maintenance** - Changes isolated to relevant files
3. **Team collaboration** - Reduced merge conflicts
4. **Format flexibility** - Use CSV for simple tables, YAML for rich metadata
5. **Demonstrates capability** - Shows typekit-i18n handles multiple sources and formats

## Configuration

The `typekit.config.ts` specifies all input files with mixed formats:

```typescript
input: ['./translations/ui.csv', './translations/features.yaml', './translations/diagnostics.csv']
```

All files are merged during generation, ensuring no duplicate keys exist across files. Format detection is automatic based on file extension.

## Format Comparison

### CSV

- Simple, tabular structure
- Easy to edit in spreadsheets
- Compact for simple translations
- Example: `ui.csv`, `diagnostics.csv`

### YAML

- Rich metadata support (status, tags, placeholder types)
- Better for complex translations
- Structured placeholder definitions
- Example: `features.yaml`
