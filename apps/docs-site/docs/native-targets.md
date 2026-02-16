# Native Targets (Swift + Kotlin + Java Interop)

Native target generation produces:

- `translation.swift` (typed Swift API)
- `translation.kt` (typed Kotlin API with Java interop support)
- `translation.contract.json` (canonical contract)
- `translation.runtime.mjs` (shared JS runtime bridge installer)
- `translation.runtime.bundle.js` (direct-eval bundle for JavaScriptCore/embedded engines)

The generated runtime bridge installs `globalThis.__typekitTranslate` by default and uses:

- `createIcuTranslator` by default (`runtimeBridgeMode: 'icu'`)
- `createTranslator` when `runtimeBridgeMode: 'basic'`
- `createFormatjsIcuTranslator` when `runtimeBridgeMode: 'icu-formatjs'`

For `runtimeBridgeMode: 'icu-formatjs'`, install optional peer dependency `intl-messageformat`.
For the smallest runtime footprint, prefer `runtimeBridgeMode: 'basic'` when ICU expressions are not required.

## Config

```ts
import { defineTypekitI18nConfig } from '@number10/typekit-i18n/codegen'

export default defineTypekitI18nConfig({
  input: ['./translations/*.csv', './translations/*.yaml'],
  output: './generated/translationTable.ts',
  outputKeys: './generated/translationKeys.ts',
  outputSwift: './generated/translation.swift',
  outputKotlin: './generated/translation.kt',
  outputContract: './generated/translation.contract.json',
  outputRuntimeBridge: './generated/translation.runtime.mjs',
  outputRuntimeBridgeBundle: './generated/translation.runtime.bundle.js',
  runtimeBridgeMode: 'icu',
  runtimeBridgeFunctionName: '__typekitTranslate',
  languages: ['en', 'de'] as const,
  defaultLanguage: 'en',
  localeByLanguage: {
    en: 'en-US',
    de: 'de-DE',
  },
})
```

`outputRuntimeBridge`, `outputRuntimeBridgeBundle`, `runtimeBridgeMode`, and `runtimeBridgeFunctionName` are optional.

## Generate

```bash
typekit-i18n generate --target swift
typekit-i18n generate --target kotlin
typekit-i18n generate --target ts,swift,kotlin
```

When `swift` or `kotlin` is generated, both runtime outputs are generated automatically.

## Swift (JavaScriptCore)

### 1. Add generated files

- Add `translation.swift` to your Xcode target.
- Prefer `translation.runtime.bundle.js` in `Copy Bundle Resources`.
- `translation.runtime.mjs` remains available for module-aware JS runtimes.

### 2. Initialize in minimal steps

```swift
import Foundation
import JavaScriptCore

let context = JSContext()!
context.evaluateScript(runtimeBridgeBundleText) // generated translation.runtime.bundle.js
let bridge = JavaScriptCoreTranslationRuntimeBridge(context: context)
let t = TypekitTranslator(bridge: bridge)

let value = try t.translate(
  .greetingTitle,
  language: .de,
  placeholders: [TranslationPlaceholder(key: "name", value: .string("Ada"))]
)
```

`runtimeBridgeBundleText` loading is app-specific.

## Kotlin (JVM/Android)

### 1. Add generated files

- Include `translation.kt` in your module.
- Make `translation.runtime.bundle.js` available at runtime.

### 2. Initialize in minimal steps

```kotlin
val bridge = NodeTranslationRuntimeBridge(
  runtimeBundlePath = "./generated/translation.runtime.bundle.js"
)
val t = TypekitTranslator(bridge = bridge)

val value = t.translate(
  TranslationKey.GREETING_TITLE,
  placeholders = listOf(
    TranslationPlaceholder("name", TranslationPlaceholderValue.Text("Ada"))
  )
)
```

`NodeTranslationRuntimeBridge` executes the generated JS runtime bridge through `node` and calls `__typekitTranslate`.

## Java Interop

Java can consume the same generated Kotlin API:

```java
TranslationRuntimeBridge bridge =
    new NodeTranslationRuntimeBridge("./generated/translation.runtime.bundle.js");
TypekitTranslator t = TypekitJavaInterop.createTranslator(bridge);

String value = t.translate(
    TranslationKey.GREETING_TITLE,
    java.util.List.of(
        new TranslationPlaceholder("name", new TranslationPlaceholderValue.Text("Ada"))
    )
);
```

## Native Smoke Fixtures

Repository fixtures validating native runtime integration:

- `packages/typekit-i18n/tests/fixtures/smoke-runtime/SmokeApp.swift`
- `packages/typekit-i18n/tests/fixtures/smoke-runtime/SmokeApp.kt`
- `packages/typekit-i18n/tests/fixtures/smoke-runtime/SmokeApp.java`
- `packages/typekit-i18n/tests/fixtures/smoke-runtime/run-smoke.mjs`

Run from repository root:

```bash
node packages/typekit-i18n/tests/fixtures/smoke-runtime/run-smoke.mjs
```

## Runtime Bridge Contract

`translation.runtime.mjs` and `translation.runtime.bundle.js` install a function with payload:

- `key: string`
- `language: string`
- `placeholders: Record<string, unknown>`

and return `string`.

## Notes

- Regenerate after translation/config changes.
- Do not edit generated files manually.
- Keep generated native files and runtime bridge bundle from the same generation run.
