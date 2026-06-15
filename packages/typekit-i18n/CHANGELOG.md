# Changelog

All notable changes to `@number10/typekit-i18n` are documented in this file.

## 0.4.0 - 2026-06-15

Changes since `v0.3.1` (baseline commit `d2dd5f3e`).

### Added

- Added JSON translation input support for generation, validation, and format conversion.
- Added `typekit-i18n init` for project scaffolding.
- Added `typekit-i18n lint` for dead key and unmatched source key analysis, including `--strict` CI mode.
- Added `--watch` / `-w`, `--help` / `-h`, and `--version` / `-v` CLI support.
- Added React integration via `TranslationProvider`, `useTranslate`, `IcuTranslationProvider`, and `useIcuTranslate`.
- Added `pluralKey` and `pluralCategory` helpers for basic translator workflows.
- Added `onError` callbacks for ICU parse and render failures.

### Changed

- Updated root, package, and docs-site documentation for JSON resources, React hooks, plural helpers, CLI init/lint/watch, and runtime error callbacks.
- Removed dead singleton exports from the legacy runtime translation module.

### Fixed

- Fixed CLI lint default exit behavior so warnings do not fail unless `--strict` is set.
- Removed redundant IR project validation from single-file validation.
- Cached placeholder regex patterns in the basic translator for faster repeated formatting.

## 0.3.1 - 2026-06-15

Changes since `v0.3.0`

### Changed

- Added npm package description and keywords for improved package discoverability.
- Updated package dependencies and build tooling versions.

### Fixed

- Removed deprecated TypeScript `baseUrl` usage from package build configuration.

## 0.3.0 - 2026-02-16

Changes since `v0.2.0` (last publish baseline commit `d985522c`).

### Added

- Optional full-ICU runtime entry point `@number10/typekit-i18n/runtime/icu-formatjs`, powered by `intl-messageformat`.
- Runtime bridge mode `runtimeBridgeMode: 'icu-formatjs'` for generated `translation.runtime.mjs` and `translation.runtime.bundle.js`.
- Runtime bridge smoke execution across all bridge modes (`basic`, `icu`, `icu-formatjs`) with optional single-mode override via `TYPEKIT_RUNTIME_BRIDGE_MODE`.

### Changed

- Runtime bridge mode validation now accepts `basic`, `icu`, and `icu-formatjs`, including updated validation diagnostics.
- Runtime bridge and native target documentation now includes explicit runtime-footprint guidance and mode-selection tradeoffs.

## 0.2.0 - 2026-02-15

Changes since `v0.1.0` (last publish baseline commit `a7466fa5`).

### Added

- Swift and Kotlin code generation targets via `generate --target swift|kotlin`.
- Canonical contract output `translation.contract.json` for native target workflows.
- Shared runtime bridge outputs for native targets:
  - `translation.runtime.mjs`
  - `translation.runtime.bundle.js`
- Bundled runtime bridge mode selection via `runtimeBridgeMode` (`icu` default, `basic` optional).
- Kotlin generated `NodeTranslationRuntimeBridge` for direct runtime bundle execution on JVM.
- Java interoperability support improvements via `TypekitJavaInterop` default overload generation.
- Native smoke runtime fixtures for Swift, Kotlin, and Java under `tests/fixtures/smoke-runtime`.

### Changed

- Native target generation now emits runtime bridge artifacts automatically when `swift` or `kotlin` targets are selected.
- Native smoke fixtures now include ICU usage examples to validate runtime parity across languages.

### Fixed

- Runtime bridge bundling and runtime import resolution for built CLI distributions.
- Kotlin translator convenience overloads for default-language placeholder calls.
