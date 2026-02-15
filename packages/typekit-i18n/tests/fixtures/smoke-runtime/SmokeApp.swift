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
    #if canImport(JavaScriptCore)
    let runtimeBundlePath = "./generated/translation.runtime.bundle.js"
    let runtimeBundleSource = try String(contentsOfFile: runtimeBundlePath, encoding: .utf8)

    guard let context = JSContext() else {
      throw SmokeRuntimeError.missingJavaScriptContext
    }

    context.evaluateScript(runtimeBundleSource)

    let bridge = JavaScriptCoreTranslationRuntimeBridge(context: context)
    let translator = TypekitTranslator(bridge: bridge)

    for language in TranslationLanguage.allCases {
      let text = try translator.translate(.welcome, language: language)
      print("\(language.rawValue): \(text)")
    }
    #else
    print("JavaScriptCore is not available on this platform.")
    #endif
  }
}
