# Native Targets (Swift + Kotlin)

Native targets now generate:

- `translation.swift` or `translation.kt` (typed native API)
- `translation.contract.json` (canonical contract)
- `translation.runtime.mjs` (shared JS runtime bridge installer)

The generated runtime bridge installs `globalThis.__typekitTranslate` by default and uses:

- `createIcuTranslator` (default)
- or `createTranslator` when `runtimeBridgeMode: 'basic'`

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

`outputRuntimeBridge`, `runtimeBridgeMode`, and `runtimeBridgeFunctionName` are optional.

## Generate

```bash
typekit-i18n generate --target swift
typekit-i18n generate --target kotlin
typekit-i18n generate --target ts,swift,kotlin
```

When `swift` or `kotlin` is generated, `translation.runtime.mjs` is generated automatically.

## What Is Copy/Paste Ready?

- `COPY/PASTE READY`: use exactly as shown.
- `PRODUCTION ADAPT REQUIRED`: replace engine-specific loading code only.
- Enum members like `TranslationKey.*` and `TranslationLanguage.*` come from your generated files and can differ.

## Swift (JavaScriptCore)

### 1. Add generated files

- Add `translation.swift` to your Xcode target.
- Bundle a built JS file produced from `translation.runtime.mjs` in `Copy Bundle Resources`.

### 2. Initialize in minimal steps

`COPY/PASTE READY` (only key/language enum values may differ):

```swift
import Foundation
import JavaScriptCore

let context = JSContext()!
context.evaluateScript(runtimeBridgeBundleText) // built from translation.runtime.mjs
let bridge = JavaScriptCoreTranslationRuntimeBridge(context: context)
let t = TypekitTranslator(bridge: bridge)

let value = try t.translate(
  .greetingTitle,
  language: .de,
  placeholders: [TranslationPlaceholder(key: "name", value: .string("Ada"))]
)
```

`PRODUCTION ADAPT REQUIRED`: how `runtimeBridgeBundleText` is loaded from app resources.

## Kotlin (Android/JVM)

### 1. Add generated files

- Include `translation.kt` in your module.
- Bundle/evaluate JS built from `translation.runtime.mjs` in your JS engine.

### 2. Initialize in minimal steps

`COPY/PASTE READY` once your JS engine can call `__typekitTranslate`:

```kotlin
val bridge = LambdaTranslationRuntimeBridge { key, language, placeholders ->
  jsEngine.callTypekitTranslate(
    key = key,
    language = language,
    placeholders = placeholders.associate { entry -> entry.key to entry.value.bridgeValue() }
  )
}
val t = TypekitTranslator(bridge = bridge)

val value = t.translate(
  key = TranslationKey.GREETING_TITLE,
  language = TranslationLanguage.DE,
  placeholders = listOf(TranslationPlaceholder("name", TranslationPlaceholderValue.Text("Ada")))
)
```

`PRODUCTION ADAPT REQUIRED`: `jsEngine.callTypekitTranslate(...)` is app-specific.

## Java Interop

`COPY/PASTE READY`:

```java
TypekitTranslator t = TypekitJavaInterop.createTranslator(bridge);
String value = TypekitJavaInterop.translate(t, TranslationKey.GREETING_TITLE, TranslationLanguage.DE);
```

## Runtime Bridge Contract

`translation.runtime.mjs` installs a function with payload:

- `key: string`
- `language: string`
- `placeholders: Record<string, unknown>`

and returns `string`.

## Notes

- Regenerate after translation/config changes.
- Do not edit generated files manually.
- Keep generated native files and runtime bridge bundle from the same generation run.
