# typekit-i18n

Type-safe internationalization workflow for TypeScript applications.

`typekit-i18n` combines a runtime translation API with code generation from CSV/YAML resources.

## Core Capabilities

- Typed translation keys and language unions
- Runtime fallback and strict missing-translation modes
- Placeholder replacement and named formatter hooks
- Multi-file resource generation (`.csv` and `.yaml`)
- Validation and conversion via CLI

## Workspace Targets

- `packages/typekit-i18n`: npm package (runtime + codegen + CLI)
- `apps/playground-ts`: React demo for runtime/codegen behavior
- `apps/docs-site`: this VitePress documentation site

## Quick Links

- [Getting Started](./getting-started)
- [Translation Strategy](./translation-strategy)
- [Runtime API](./runtime-api)
- [Codegen + CLI](./codegen-cli)
- [Resource Formats](./resource-formats)
