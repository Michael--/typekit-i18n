# Playground Translations

This directory demonstrates the multi-file translation capability of `typekit-i18n`.

## Structure

Translations are split into **three thematic CSV files**:

### 1. `ui.csv` - UI Elements

Contains all UI-related strings:

- Settings and labels
- Mode options (fallback/strict)
- Feature section title
- Error messages

### 2. `features.csv` - Feature Demonstrations

Contains strings demonstrating key features:

- Greeting messages (with placeholders)
- Placeholder examples (text, numbers)
- Custom formatter examples (currency, dates)
- Fallback behavior demo

### 3. `diagnostics.csv` - Diagnostics Panel

Contains diagnostics-related strings:

- Diagnostics panel title
- Status messages
- Missing translation count

## Multi-File Benefits

Splitting translations into multiple files provides:

1. **Better organization** - Related keys grouped together
2. **Easier maintenance** - Changes isolated to relevant files
3. **Team collaboration** - Reduced merge conflicts
4. **Demonstrates capability** - Shows typekit-i18n handles multiple sources

## Configuration

The `typekit.config.ts` specifies all input files:

```typescript
input: ['./translations/ui.csv', './translations/features.csv', './translations/diagnostics.csv']
```

All files are merged during generation, ensuring no duplicate keys exist across files.

## Future Extensions

This structure also prepares for:

- **YAML format support** - Different file formats per domain
- **Domain-specific translations** - Easy to add/remove translation sets
- **Modular translation management** - Independent versioning per file
