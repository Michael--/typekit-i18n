import java.util.List;

public final class SmokeApp {
  public static void main(String[] args) throws Exception {
    System.out.println();
    System.out.println("Starting Java SmokeApp...");

    TranslationRuntimeBridge bridge = new NodeTranslationRuntimeBridge("./generated/translation.runtime.bundle.js");
    TypekitTranslator translator = TypekitJavaInterop.createTranslator(bridge);

    System.out.println("\nTranslating welcome message for all supported languages:");
    for (TranslationLanguage language : TranslationLanguage.values()) {
      String text = TypekitJavaInterop.translate(translator, TranslationKey.WELCOME, language);
      System.out.println(language.getCode() + ": " + text);
    }

    System.out.println("\nTranslating ICU plural examples:");
    for (int count = 0; count <= 2; count += 1) {
      String icuSample = translator.translate(
          TranslationKey.ITEM_COUNT_ICU,
          List.of(new TranslationPlaceholder("count", new TranslationPlaceholderValue.Number((double) count)))
      );
      System.out.println(icuSample);
    }
  }
}
