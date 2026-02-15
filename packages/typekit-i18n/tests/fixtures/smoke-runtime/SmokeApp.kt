private const val RUNTIME_BUNDLE_PATH = "./generated/translation.runtime.bundle.js"

fun main() {
  println("")
  println("Starting Kotlin SmokeApp...")

  val bridge = NodeTranslationRuntimeBridge(runtimeBundlePath = RUNTIME_BUNDLE_PATH)
  val translator = TypekitTranslator(bridge = bridge)

  println("Translating welcome message for all supported languages:")
  for (language in TranslationLanguage.values()) {
    val text = translator.translate(TranslationKey.WELCOME, language)
    println("${language.code}: $text")
  }

  val icuSample = translator.translate(
    TranslationKey.ITEM_COUNT_ICU,
    TranslationLanguage.EN,
    listOf(TranslationPlaceholder("count", TranslationPlaceholderValue.Number(2.0)))
  )
  println("ICU sample: $icuSample")
}
