import Foundation

@main
struct SmokeApp {
  static func main() throws {
    let bridge = ClosureTranslationRuntimeBridge { key, language, placeholders in
      return "\(key):\(language):\(placeholders.count)"
    }
    let translator = TypekitTranslator(bridge: bridge)
    let value = try translator.translate(
      .title,
      language: .de,
      placeholders: [TranslationPlaceholder(key: "name", value: .string("Ada"))]
    )
    print(value)
  }
}
