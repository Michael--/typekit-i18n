# typekit-i18n VSCode Extension Plan

## MVP First (Top Priority)

- [x] Key intelligence: definition, references, rename across TS/TSX + YAML/CSV.
- [ ] Live diagnostics + quick fixes for missing keys, missing locales, duplicates, placeholder mismatches.
- [x] YAML/CSV schema validation for raw translation data quality.
- [x] Completion + hover preview with translation-aware context.

## Goal

Ship one extension for users, with modular internals, focused on translation authoring speed and data integrity for `typekit-i18n`.

## Use Cases

### 1) Key Intelligence

- [x] `F12` on `t("greeting_title")` opens the source key in translation raw data.
- [x] `Shift+F12` shows all key usages in code and raw data.
- [x] `F2` rename updates code + YAML/CSV references consistently.
- [ ] Safe delete warning when a key still has references.

### 2) Diagnostics + Quick Fixes

- [x] Missing key usage in code gets a diagnostic and quick fix to create key.
- [x] Missing locale value gets a warning and quick fix to add entry.
- [ ] Placeholder mismatch (for example `{name}` vs `{username}`) gets a diagnostic and fix suggestion.
- [ ] Duplicate key definitions get diagnostics and merge/rename quick fixes.

### 3) YAML/CSV Schema Validation

- [x] Validate required columns/fields (`key`, `locale`, `value`).
- [ ] Validate value type constraints (`string` values).
- [ ] Validate ICU/plural shape (`one`, `other`, and required forms).
- [x] Validate parser-level errors with precise file locations.

### 4) Completion + Hover

- [x] Context-aware key completion in `t("...")` calls.
- [x] Completion item preview for primary locales (`de`, `en`).
- [ ] Placeholder-aware snippet insertion for parameterized messages.
- [x] Hover status signals (`missing locale`, `deprecated`, `fuzzy`) when metadata is available.

## Execution Plan

### Phase 0 - Foundation

- [x] Create extension package and base scripts.
- [x] Add Vite build setup and strict TypeScript configuration.
- [x] Add modular feature entry points for MVP areas.
- [x] Add initial translation workspace indexing abstraction.

### Phase 1 - Read Model and Index

- [x] Define canonical translation key model shared by YAML and CSV.
- [x] Implement YAML/CSV parsers and normalization pipeline.
- [x] Add incremental refresh with file watchers and debounce.
- [ ] Add baseline performance measurements for medium workspaces.

### Phase 2 - Language Features

- [x] Implement key extraction from TS/TSX call sites.
- [x] Implement definition/reference provider backed by index.
- [x] Implement rename provider with workspace edits.
- [x] Implement completion + hover using indexed translations.

### Phase 3 - Validation and Fixes

- [x] Implement diagnostics rules and stable diagnostic codes.
- [ ] Implement code actions and quick fixes for each diagnostic code.
- [x] Implement YAML/CSV schema validators with precise spans.
- [ ] Add diagnostics integration tests with fixture workspaces.

### Phase 4 - UX and Hardening

- [ ] Add progress/status reporting and long-running task cancellation.
- [ ] Add telemetry/event hooks (opt-in) for performance and failures.
- [x] Add packaging and release flow for VSIX.
- [x] Add docs for setup, limits, and troubleshooting.

## Options and Tradeoffs

### Parser Strategy

- Option A: reuse `yaml` and `fast-csv` ecosystem parsers for speed.
- Option B: custom parser pipeline for tighter control.
- Preferred for MVP: Option A.

### Index Update Strategy

- Option A: full refresh on command/save events.
- Option B: incremental per-file updates with cache invalidation.
- Preferred for MVP: Option A first, then Option B.

### Key Usage Detection

- Option A: regex heuristics in string literals.
- Option B: AST-backed extraction via TypeScript parser.
- Preferred for MVP: Option B for accuracy.

### Runtime Architecture

- Option A: in-extension providers only.
- Option B: dedicated language server process.
- Preferred for MVP: Option A first, keep interfaces ready for Option B.

## Deliverables

- [x] Working VSCode extension package with initial feature behavior.
- [x] Automated lint, typecheck, and tests in workspace scripts.
- [ ] Versioned diagnostics and quick-fix matrix.
- [x] Developer documentation for extension architecture and contribution flow.
