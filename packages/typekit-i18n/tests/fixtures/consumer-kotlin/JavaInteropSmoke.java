public final class JavaInteropSmoke {
  public static void main(String[] args) throws Exception {
    TranslationRuntimeBridge bridge = new LambdaTranslationRuntimeBridge(
        (key, language, placeholders) -> key + ":" + language + ":" + placeholders.size()
    );

    TypekitTranslator translator = TypekitJavaInterop.createTranslator(bridge);
    String text = TypekitJavaInterop.translate(translator, TranslationKey.TITLE, TranslationLanguage.DE);
    System.out.print(text);
  }
}
