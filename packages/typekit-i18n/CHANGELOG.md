# Changelog

All notable changes to `@number10/typekit-i18n` are documented in this file.

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
