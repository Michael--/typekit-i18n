# Typekit i18n - Roadmap

Last sync: 2026-02-11

## Status Summary

- Completed baseline: Monorepo setup, TS runtime, CSV/YAML codegen, IR validation, CLI (`generate|validate|convert`), test baseline, docs-site + GitHub Pages workflow.
- New complexity driver: ICU runtime is now a core subsystem (parser + renderer + formatters + locale behavior).
- Primary gap: no consolidated single source of truth for language + locale + target metadata across TS runtime, CLI/codegen, and future non-TS targets.

## Completed (verified against current repository)

### Foundation and Package Layout

- [x] Workspace split into `packages/typekit-i18n`, `apps/playground-ts`, `apps/docs-site`.
- [x] Root scripts for `gen/build/lint/typecheck/test/check` are in place.
- [x] `packages/typekit-i18n` is the consolidated publishable package target.

### Runtime and API

- [x] Stable translator API via `createTranslator(...)`.
- [x] Missing translation strategy (`fallback` / `strict`) with reporting hooks.
- [x] Runtime configuration and missing-event collection API.
- [x] ICU translator implemented (`createIcuTranslator(...)`) with:
  - `select`, `plural`, `selectordinal`
  - `number`, `date`, `time` argument formatting
  - plural `offset`
  - apostrophe escaping and detailed syntax errors

### Codegen, IR, Validation, CLI

- [x] Typed config helper + config auto-discovery.
- [x] Deterministic multi-file generation.
- [x] CSV and YAML IR parsing + validation.
- [x] Placeholder consistency validation across locales.
- [x] CLI commands implemented: `generate`, `validate`, `convert`.

### Quality and Documentation

- [x] Runtime and codegen test suites present and expanded.
- [x] Docs site structure and content updated to current API.
- [x] Root README and package README updated as baseline docs.
- [x] GitHub Pages workflow for docs deployment is present (`.github/workflows/pages.yml`).

## Corrected / Obsolete Items from Previous Plan

- [obsolete] Former references to `FORMAT_IR_PLAN.md` and `MIGRATION_MAP.md` were intentionally removed.
- [obsolete] Assumption that IR and multi-format are only in planning stage; these are already implemented.
- [corrected] "SemVer + release process set up" was marked done earlier but is not yet complete as an operational release pipeline.

## Open Priorities (re-ranked)

### P0 - Single Source of Truth for Language and Target Contracts

Problem:

- Language + locale definitions are currently distributed across runtime defaults, config files, generated artifacts, and app-level setup.
- This becomes high-risk with ICU behavior and future Swift/multi-target output.

Planned actions:

- [ ] Define one canonical contract artifact from IR/codegen (languages, sourceLanguage, locale mapping, keys, placeholder metadata).
- [ ] Generate TS runtime-facing metadata from that artifact (no hardcoded language arrays in runtime defaults).
- [ ] Define target-neutral manifest schema versioning for non-TS generators.
- [ ] Decide where locale mapping lives (config vs generated artifact) and keep it deterministic.

### P0 - ICU Runtime Hardening and Scope Guardrails

Problem:

- ICU support adds substantial parser/runtime complexity and cross-locale behavior variance.

Planned actions:

- [ ] Formalize "supported ICU subset" as a versioned compatibility contract.
- [ ] Add negative/edge-case regression matrix per locale category behavior.
- [ ] Add performance guardrails for parser/renderer cache behavior.
- [ ] Document explicit non-goals (unsupported ICU constructs) to prevent uncontrolled scope growth.

### P1 - Release and Distribution Maturity

- [ ] Add release workflow (versioning + changelog + publish gates).
- [ ] Ensure npm publish artifact contract is explicit (`dist`, exports, CLI entry checks).
- [ ] Add pre-publish validation target that includes codegen drift and docs build.

### P1 - Migration and Adoption Assets

- [ ] Add `CONTRIBUTING.md` with contributor workflow and quality gates.
- [ ] Add architecture page for runtime/codegen/IR boundaries.

### P2 - Translation Workflow Integrations

- [ ] Define provider interface for external translation services (kept out of core runtime).
- [ ] Define review workflow metadata policy (`status`, `tags`, ownership).
- [ ] Evaluate optional automation around missing key extraction and review reports.

### Multi-Target (Swift and others)

Current reality:

- `scripts/codegen/generate-swift-api.mjs` exists but is legacy-coupled to old paths (`ts/translations/...`) and not aligned with current IR/codegen contracts.

Decision checkpoint:

- [ ] Keep Swift support as post-v1 track (v1.1/v2) and base it on the canonical IR manifest.
- [ ] Do not evolve legacy Swift script further before contract alignment.

## Next Concrete Steps

1. Implement the canonical contract artifact (P0) and wire TS runtime defaults to it.
2. Freeze and document ICU subset contract (P0) with explicit supported/unsupported syntax table.
3. Add release workflow and publish gates (P1).
4. Add contributing guide and architecture documentation (P1).
