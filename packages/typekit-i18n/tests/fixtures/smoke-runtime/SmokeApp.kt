fun main() {
  val valuesByLanguage = mapOf(
    "en" to "Hello World",
    "de" to "Herzlich Willkommen",
    "es" to "Hola Mundo"
  )

  val bridge = LambdaTranslationRuntimeBridge { key, language, _ ->
    if (key != TranslationKey.WELCOME.rawValue) {
      throw IllegalArgumentException("Unsupported translation key: $key")
    }
    valuesByLanguage[language] ?: error("Missing translation for language: $language")
  }

  val translator = TypekitTranslator(bridge = bridge)
  for (language in TranslationLanguage.values()) {
    val text = translator.translate(TranslationKey.WELCOME, language)
    println("${language.code}: $text")
  }
}
