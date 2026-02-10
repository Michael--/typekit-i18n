# Migration Map

This document defines how legacy blueprint files map into the monorepo target structure.

## Scope

- Legacy directories `ts/translations` and `scripts` are now reference-only.
- New feature work should target `packages/typekit-i18n` first.
- Existing legacy files are kept temporarily to preserve context during migration.

## Path Mapping

| Legacy path                                 | Target path                                                        | Notes                          |
| ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| `ts/translations/translation.ts`            | `packages/typekit-i18n/src/runtime/translation.ts`                 | Public runtime API             |
| `ts/translations/translationTypes.ts`       | `packages/typekit-i18n/src/runtime/placeholder-types.ts`           | Placeholder contracts          |
| `ts/translations/translationTable.ts`       | `packages/typekit-i18n/src/generated/translation-table.ts`         | Generated file output location |
| `ts/translations/translationTable*.csv`     | `packages/typekit-i18n/resources/translations/*.csv`               | Source translation resources   |
| `ts/translations/tests/translation.test.ts` | `packages/typekit-i18n/tests/runtime/translation.test.ts`          | Runtime tests                  |
| `scripts/translation-generator.ts`          | `packages/typekit-i18n/src/codegen/translation-generator.ts`       | Internal generator logic       |
| `scripts/translation-tools.ts`              | `packages/typekit-i18n/src/codegen/csv-tools.ts`                   | CSV parsing and helpers        |
| `scripts/codegen/generate-swift-api.mjs`    | `packages/typekit-i18n/src/targets/swift/generate-swift-api.ts`    | Swift emitter                  |
| `scripts/codegen/generate-api-manifest.mjs` | `packages/typekit-i18n/src/targets/swift/generate-api-manifest.ts` | Swift/API metadata             |
| `scripts/codegen/build-all.sh`              | `packages/typekit-i18n/src/targets/swift/build-all.sh`             | Transitional build helper      |
| Root docs (`README.md`, `ROADMAP.md`)       | Keep in root                                                       | Workspace-level documentation  |
| Playground app                              | `apps/playground-ts`                                               | Integration verification       |
| Docs app                                    | `apps/docs-site`                                                   | VitePress site                 |

## Migration Order

1. Move CSV resource files and parser/generator internals.
2. Move runtime API and runtime tests.
3. Move generated table output path.
4. Move optional Swift target tooling.
5. Remove legacy path usage from root scripts.

## Exit Criteria

- `packages/typekit-i18n` owns runtime, resources, codegen, and tests.
- Root scripts no longer depend on legacy `scripts/` or `ts/translations`.
- Legacy directories are removed or archived after parity verification.
