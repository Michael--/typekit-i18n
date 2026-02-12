# Translation Strategy

## Recommended Workflow

1. Keep source/default language authoritative.
2. Split translation resources by domain or feature.
3. Generate typed artifacts (`translationTable.ts`, `translationKeys.ts`).
4. Enforce validation in CI.
5. Use runtime fallback for resilience and strict mode in high-signal tests.

## File Organization

Prefer multiple translation files over a monolith.

Examples:

- by feature: `auth`, `checkout`, `settings`
- by ownership: `billing`, `support`, `legal`
- by risk level: `ui`, `compliance`, `contracts`

Benefits:

- smaller review scope
- fewer merge conflicts
- clearer ownership boundaries

## Category Strategy

Use categories as an optional runtime scoping tool, not as a replacement for clear key naming.

Suggested rules:

- keep uncategorized keys in `default`
- add categories for large, discoverability-heavy areas (`home`, `billing`, `settings`)
- keep category names stable and domain-oriented
- avoid highly granular categories that only contain one or two keys

Runtime impact:

- global access remains available via `translate(key, language?, placeholder?)`
- scoped access is available via `translateIn(category, key, language?, placeholder?)`
- pre-bound scoped translators are available via `withCategory(category)`

## Quality Controls

Use validation as a release gate:

- language declaration consistency
- placeholder token consistency across locales
- required source language completeness
- duplicate key rejection

Suggested CI checks:

```bash
pnpm run gen
pnpm run typecheck
pnpm run test
```

## Missing Translation Policy

Runtime options:

- `missingStrategy: 'fallback'` for user-facing resilience
- `missingStrategy: 'strict'` for test pipelines and QA scenarios

Optional reporting:

- `onMissingTranslation` callback
- runtime event collection via `createTranslationRuntime(..., { collectMissingTranslations: true })`

## ICU Usage Policy

Use ICU when language rules require branching or locale formatting:

- plural/select/selectordinal logic
- number/date/time locale formatting

Use plain placeholders for simple static replacement.

This keeps templates readable while enabling rich locale behavior only where needed.
