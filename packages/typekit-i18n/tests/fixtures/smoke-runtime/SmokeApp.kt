private const val RUNTIME_BUNDLE_PATH = "./generated/translation.runtime.bundle.js"

fun main() {
  println("")
  println("Starting Kotlin SmokeApp...")

  val bridge = NodeTranslationRuntimeBridge(runtimeBundlePath = RUNTIME_BUNDLE_PATH)
  val translator = TypekitTranslator(bridge = bridge)

  println("\nTranslating welcome message for all supported languages:")
  for (language in TranslationLanguage.values()) {
    val text = translator.translate(TranslationKey.WELCOME, language)
    println("${language.code}: $text")
  }

  // use default language in a loop 0..2 items to show pluralization
  println("\nTranslating ICU plural examples:")
  for (count in 0..2) {
    val icuSample = translator.translate(
      TranslationKey.ITEM_COUNT_ICU,
      listOf(TranslationPlaceholder("count", TranslationPlaceholderValue.Number(count.toDouble())))
    )
    println("$icuSample")
  }
}
