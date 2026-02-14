fun main() {
  val bridge = LambdaTranslationRuntimeBridge { key, language, placeholders ->
    "$key:$language:${placeholders.size}"
  }

  val translator = TypekitTranslator(bridge = bridge)
  val value = translator.translate(
    key = TranslationKey.TITLE,
    language = TranslationLanguage.DE,
    placeholders = listOf(TranslationPlaceholder("name", TranslationPlaceholderValue.Text("Ada")))
  )

  print(value)
}
