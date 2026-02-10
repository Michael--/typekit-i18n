# playground-ts

Interactive React-based playground demonstrating `typekit-i18n` features and capabilities.

## Features

- **Multi-language support**: Switch between EN, DE, ES, and FR translations in real-time
- **Translation modes**: Toggle between fallback (graceful) and strict (throws errors) modes
- **Placeholder replacement**: Basic string interpolation with type-safe placeholders
- **Custom formatters**: Currency and date formatting with locale-aware output
- **Live diagnostics**: Real-time detection and reporting of missing translations
- **Fallback behavior**: Demonstrates graceful degradation when translations are incomplete

## Local workflow

```bash
# Install dependencies
pnpm install

# Generate translation types from CSV
pnpm run gen

# Start development server (http://localhost:4173)
pnpm run dev

# Type-check
pnpm typecheck

# Build for production
pnpm run build
```

## Translation Management

Edit `translations/translationTablePlayground.csv` to add or modify translations, then run `pnpm run gen` to regenerate the TypeScript types and translation table.
