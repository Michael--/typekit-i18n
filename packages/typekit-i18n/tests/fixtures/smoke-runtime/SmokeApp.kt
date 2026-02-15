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
  translator.translate(TranslationKey.WELCOME)
}
