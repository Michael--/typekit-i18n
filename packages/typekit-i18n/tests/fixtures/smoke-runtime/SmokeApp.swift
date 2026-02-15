import Foundation
#if canImport(JavaScriptCore)
import JavaScriptCore
#endif

enum SmokeRuntimeError: Error {
  case missingJavaScriptContext
}

@main
struct SmokeApp {
  static func main() throws {
    print("\nStarting Swift SmokeApp...")
    #if canImport(JavaScriptCore)
    let runtimeBundlePath = "./generated/translation.runtime.bundle.js"
    let runtimeBundleSource = try String(contentsOfFile: runtimeBundlePath, encoding: .utf8)

    guard let context = JSContext() else {
      throw SmokeRuntimeError.missingJavaScriptContext
    }

    context.evaluateScript(runtimeBundleSource)

    let bridge = JavaScriptCoreTranslationRuntimeBridge(context: context)
    let translator = TypekitTranslator(bridge: bridge)

    print("\nTranslating welcome message for all supported languages:")
    for language in TranslationLanguage.allCases {
      let text = try translator.translate(.welcome, language: language)
      print("\(language.rawValue): \(text)")
    }

    // use default language in a loop 0..2 items to show pluralization
    print("\nTranslating ICU plural examples:")
    for count in 0...2 {
      let icuSample = try translator.translate(
        .itemCountIcu,
        placeholders: [TranslationPlaceholder(key: "count", value: .number(Double(count)))]
      )
      print("\(icuSample)")
    }
    #else
    print("JavaScriptCore is not available on this platform.")
    #endif
  }
}
