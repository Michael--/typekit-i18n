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

## Swift Integration

### 1. Add generated file

Add `translation.swift` to your Xcode target.

### 2. Provide a runtime bridge

Use `JavaScriptCoreTranslationRuntimeBridge` or your own `TranslationRuntimeBridge`.

```swift
import Foundation
import JavaScriptCore

let context = JSContext()!

// Your app must provide the translate function expected by the bridge.
context.evaluateScript(
  """
  globalThis.__typekitTranslate = ({ key, language, placeholders }) => {
    // Delegate to your JS runtime integration here.
    return `${key}:${language}:${Object.keys(placeholders ?? {}).length}`;
  };
  """
)

let bridge = JavaScriptCoreTranslationRuntimeBridge(context: context)
let translator = TypekitTranslator(bridge: bridge)

let text = try translator.translate(
  .greetingTitle,
  language: .de,
  placeholders: [
    TranslationPlaceholder(key: "name", value: .string("Ada"))
  ]
)
```

### 3. Resource checklist

- If your JS runtime script is external, include it in `Copy Bundle Resources`.
- Ensure generated `translation.swift` matches the same translation contract version as your runtime payload.
- Keep `localeByLanguage` aligned with your runtime ICU locale handling.

## Kotlin Integration

### 1. Add generated file

Include `translation.kt` in your Kotlin module.

### 2. Provide a runtime bridge

Use `LambdaTranslationRuntimeBridge` or implement `TranslationRuntimeBridge`.

```kotlin
val bridge = LambdaTranslationRuntimeBridge { key, language, placeholders ->
  // Delegate to your JS runtime integration here.
  "$key:$language:${placeholders.size}"
}

val translator = TypekitTranslator(bridge = bridge)
val text = translator.translate(
  key = TranslationKey.GREETING_TITLE,
  language = TranslationLanguage.DE,
  placeholders = listOf(
    TranslationPlaceholder("name", TranslationPlaceholderValue.Text("Ada"))
  )
)
```

### 3. Java interop

Use `TypekitJavaInterop` from Java code:

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
