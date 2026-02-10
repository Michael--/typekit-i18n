# Migration Map

This document defines how legacy blueprint files map into the monorepo target structure.

## Scope

- Legacy directories `ts/translations` and `scripts` are now reference-only.
- New feature work should target `packages/typekit-i18n` first.
- Existing legacy files are kept temporarily to preserve context during migration.
- A consumer prototype already exists in `apps/playground-ts` and uses `typekit-i18n` via workspace mapping.
- CSV resources, runtime translation API, and generator core are now migrated into `packages/typekit-i18n`.

## Path Mapping

| Legacy path                                 | Target path                                                        | Notes                                           |
| ------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `ts/translations/translation.ts`            | `packages/typekit-i18n/src/runtime/translation.ts`                 | Public runtime API (migrated)                   |
| `ts/translations/translationTypes.ts`       | `packages/typekit-i18n/src/runtime/types.ts`                       | Placeholder contracts                           |
| `ts/translations/translationTable.ts`       | `packages/typekit-i18n/dist/generated/translationTable.ts`         | Generated file output location                  |
| `ts/translations/translationTable*.csv`     | `packages/typekit-i18n/resources/translations/*.csv`               | Source translation resources (migrated)         |
| `ts/translations/tests/translation.test.ts` | `packages/typekit-i18n/tests/runtime/translation.test.ts`          | Runtime tests (migrated)                        |
| `scripts/translation-generator.ts`          | `packages/typekit-i18n/src/codegen/generate.ts`                    | Internal generator logic (migrated)             |
| `scripts/translation-tools.ts`              | `packages/typekit-i18n/src/codegen/csv.ts`                         | CSV parsing and helpers (migrated)              |
| `scripts/codegen/generate-swift-api.mjs`    | `packages/typekit-i18n/src/targets/swift/generate-swift-api.ts`    | Swift emitter (target path planned)             |
| `scripts/codegen/generate-api-manifest.mjs` | `packages/typekit-i18n/src/targets/swift/generate-api-manifest.ts` | Swift/API metadata (target path planned)        |
| `scripts/codegen/build-all.sh`              | `packages/typekit-i18n/src/targets/swift/build-all.sh`             | Transitional build helper (target path planned) |
| Root docs (`README.md`, `ROADMAP.md`)       | Keep in root                                                       | Workspace-level documentation                   |
| Playground app                              | `apps/playground-ts`                                               | Integration verification                        |
| Docs app                                    | `apps/docs-site`                                                   | VitePress site                                  |

## Migration Order

1. Move optional Swift target tooling.
2. Remove remaining legacy path usage from root scripts and docs.
3. Remove legacy directories after parity verification.

## Exit Criteria

- `packages/typekit-i18n` owns runtime, resources, codegen, and tests.
- Root scripts no longer depend on legacy `scripts/` or `ts/translations`.
- Legacy directories are removed or archived after parity verification.
