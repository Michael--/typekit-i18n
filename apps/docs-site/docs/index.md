# typekit-i18n

Type-safe internationalization toolkit for TypeScript with runtime APIs, ICU rendering, and CSV/YAML code generation.

## What It Provides

- Typed translation keys and language unions via generated files
- Runtime translators with fallback or strict missing behavior
- Optional category-scoped lookup APIs (`translateIn`, `withCategory`)
- Active language state APIs (`setLanguage`, `getLanguage`)
- Placeholder replacement and named formatter hooks
- ICU-capable translator for plural/select/selectordinal/number/date/time
- Validation and conversion tooling for translation resources

## Workspace Targets

- `packages/typekit-i18n`: npm package (runtime + codegen + CLI)
- `apps/playground-ts`: React feature playground
- `apps/docs-site`: this VitePress documentation site

## Documentation Map

- [Getting Started](./getting-started)
- [VSCode Extension](./vscode-extension)
- [Runtime API](./runtime-api)
- [Codegen + CLI](./codegen-cli)
- [Native Targets](./native-targets)
- [Resource Formats](./resource-formats)
- [Translation Strategy](./translation-strategy)
- [GitHub Pages](./github-pages)

## Project Links

- GitHub: https://github.com/Michael--/typekit-i18n
- npm: https://www.npmjs.com/package/@number10/typekit-i18n
