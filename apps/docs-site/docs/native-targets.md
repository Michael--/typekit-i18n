# Native Targets (Swift + Kotlin)

This page documents how to use generated native target artifacts and how to connect them to a runtime bridge.

## Goal

Native targets do not re-implement i18n logic by default.
They provide strongly typed APIs and call your runtime bridge.

## Generate Artifacts

`typekit.config.ts` example:

```ts
import { defineTypekitI18nConfig } from '@number10/typekit-i18n/codegen'

export default defineTypekitI18nConfig({
  input: ['./translations/*.csv', './translations/*.yaml'],
  output: './generated/translationTable.ts',
  outputKeys: './generated/translationKeys.ts',
  outputSwift: './generated/translation.swift',
  outputKotlin: './generated/translation.kt',
  outputContract: './generated/translation.contract.json',
  languages: ['en', 'de'] as const,
  defaultLanguage: 'en',
  localeByLanguage: {
    en: 'en-US',
    de: 'de-DE',
  },
})
```

Generate targets:

```bash
typekit-i18n generate --target swift
typekit-i18n generate --target kotlin
typekit-i18n generate --target ts,swift,kotlin
```

## Bridge Contract

Generated native APIs call a bridge with:

- `key`: translation key string
- `language`: language code string
- `placeholders`: key-value map payload (after native conversion)

Expected result:

- preferred: `string`
- accepted: object with `value: string`
- error path (Swift bridge): object with `missingReason: string`

The default Swift JavaScriptCore bridge expects a JS function named `__typekitTranslate` (configurable via `functionName`).

## Copy/Paste Rules

- `COPY/PASTE READY (Smoke)`: the snippet is executable as a minimal smoke setup.
- `PRODUCTION ADAPT REQUIRED`: replace stub parts for your real runtime integration.
- Enum values (`TranslationKey.*`, `TranslationLanguage.*`) must match your generated files.

Always verify generated enums first:

- Swift: `translation.swift` (`TranslationKey`, `TranslationLanguage`)
- Kotlin: `translation.kt` (`TranslationKey`, `TranslationLanguage`)

## Swift Integration

### 1. Add generated file

Add `translation.swift` to your Xcode target.

### 2. Provide a runtime bridge

Use `JavaScriptCoreTranslationRuntimeBridge` or your own `TranslationRuntimeBridge`.

`COPY/PASTE READY (Smoke)` + `PRODUCTION ADAPT REQUIRED` on marked lines:

```swift
import Foundation
import JavaScriptCore

let context = JSContext()!

// PRODUCTION ADAPT REQUIRED:
// Your app must provide the real translation function expected by the bridge.
context.evaluateScript(
  """
  globalThis.__typekitTranslate = ({ key, language, placeholders }) => {
    // PRODUCTION ADAPT REQUIRED:
    // replace with your real JS runtime adapter call
    return `${key}:${language}:${Object.keys(placeholders ?? {}).length}`;
  };
  """
)

let bridge = JavaScriptCoreTranslationRuntimeBridge(context: context)
let translator = TypekitTranslator(bridge: bridge)

// COPY/PASTE READY (Smoke):
// adjust enum members only if your generated keys/languages differ.
let text = try translator.translate(
  .greetingTitle,
  language: .de,
  placeholders: [
    TranslationPlaceholder(key: "name", value: .string("Ada"))
  ]
)
```

Swift adaptation checklist:

- Replace `__typekitTranslate` stub with your actual JS runtime call path.
- Use a `TranslationKey` case that exists in your generated `translation.swift`.
- Use a `TranslationLanguage` case that exists in your generated `translation.swift`.

### 3. Resource checklist

- If your JS runtime script is external, include it in `Copy Bundle Resources`.
- Ensure generated `translation.swift` matches the same translation contract version as your runtime payload.
- Keep `localeByLanguage` aligned with your runtime ICU locale handling.

## Kotlin Integration

### 1. Add generated file

Include `translation.kt` in your Kotlin module.

### 2. Provide a runtime bridge

Use `LambdaTranslationRuntimeBridge` or implement `TranslationRuntimeBridge`.

`COPY/PASTE READY (Smoke)` + `PRODUCTION ADAPT REQUIRED` on marked lines:

```kotlin
val bridge = LambdaTranslationRuntimeBridge { key, language, placeholders ->
  // PRODUCTION ADAPT REQUIRED:
  // replace with your real runtime adapter call
  "$key:$language:${placeholders.size}"
}

val translator = TypekitTranslator(bridge = bridge)

// COPY/PASTE READY (Smoke):
// adjust enum members only if your generated keys/languages differ.
val text = translator.translate(
  key = TranslationKey.GREETING_TITLE,
  language = TranslationLanguage.DE,
  placeholders = listOf(
    TranslationPlaceholder("name", TranslationPlaceholderValue.Text("Ada"))
  )
)
```

Kotlin adaptation checklist:

- Replace bridge lambda stub with your actual runtime adapter.
- Use `TranslationKey` values that exist in generated `translation.kt`.
- Use `TranslationLanguage` values that exist in generated `translation.kt`.

### 3. Java interop

Use `TypekitJavaInterop` from Java code:

`COPY/PASTE READY (Smoke)` + `PRODUCTION ADAPT REQUIRED` for bridge source:

```java
TypekitTranslator translator = TypekitJavaInterop.createTranslator(bridge);
String text = TypekitJavaInterop.translate(translator, TranslationKey.GREETING_TITLE, TranslationLanguage.DE);
```

### 4. Resource checklist

- Package runtime JS resources in app assets if your bridge delegates to JS.
- Keep generated `translation.kt` and runtime contract in the same app build.
- Validate language/key lookup behavior with smoke tests after generation changes.

## Operational Guidance

- Regenerate targets whenever translations or language config change.
- Do not manually edit generated target files.
- Keep consumer smoke tests in CI so integration errors are detected early.
