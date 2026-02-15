import java.io.File

private const val RUNTIME_BUNDLE_PATH = "./generated/translation.runtime.bundle.js"
private const val RUNTIME_BRIDGE_FUNCTION_NAME = "__typekitTranslate"

private val NODE_BRIDGE_SCRIPT = """
const fs = require('node:fs')
const vm = require('node:vm')

const runtimeBundlePath = process.argv[1]
const functionName = process.argv[2]
const payloadSource = fs.readFileSync(0, 'utf8')

try {
  const context = vm.createContext({ console })
  context.globalThis = context
  const runtimeBundleSource = fs.readFileSync(runtimeBundlePath, 'utf8')
  vm.runInContext(runtimeBundleSource, context, { filename: runtimeBundlePath })
  const bridgeFunction = context[functionName]
  if (typeof bridgeFunction !== 'function') {
    throw new Error('Bridge function "' + functionName + '" was not installed.')
  }

  const payload = JSON.parse(payloadSource)
  const result = bridgeFunction(payload)

  if (typeof result === 'string') {
    process.stdout.write(result)
    process.exit(0)
  }

  if (result && typeof result === 'object') {
    if (typeof result.value === 'string') {
      process.stdout.write(result.value)
      process.exit(0)
    }
    if (typeof result.missingReason === 'string') {
      throw new Error('Missing translation: ' + result.missingReason)
    }
  }

  throw new Error('Runtime bridge returned an unsupported result type.')
} catch (error) {
  const message = error && typeof error.message === 'string' ? error.message : String(error)
  process.stderr.write(message)
  process.exit(1)
}
""".trimIndent()

private class NodeTranslationRuntimeBridge(
  private val runtimeBundlePath: String,
  private val functionName: String = RUNTIME_BRIDGE_FUNCTION_NAME
) : TranslationRuntimeBridge {
  @Throws(Exception::class)
  override fun translate(
    key: String,
    language: String,
    placeholders: List<TranslationPlaceholder>
  ): String {
    val runtimeBundleFile = File(runtimeBundlePath)
    if (!runtimeBundleFile.isFile) {
      throw TypekitKotlinBridgeException("Runtime bundle not found: $runtimeBundlePath")
    }

    val payload = toPayloadJson(key, language, placeholders)
    val process = ProcessBuilder(
      "node",
      "-e",
      NODE_BRIDGE_SCRIPT,
      runtimeBundleFile.path,
      functionName
    ).start()

    process.outputStream.use { stream ->
      stream.write(payload.toByteArray(Charsets.UTF_8))
    }

    val stdout = process.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
      reader.readText()
    }
    val stderr = process.errorStream.bufferedReader(Charsets.UTF_8).use { reader ->
      reader.readText()
    }
    val exitCode = process.waitFor()

    if (exitCode != 0) {
      val message = stderr.ifBlank { stdout }.ifBlank { "Unknown JavaScript bridge failure." }
      throw TypekitKotlinBridgeException("JavaScript bridge execution failed: $message")
    }

    return stdout
  }
}

private fun toPayloadJson(
  key: String,
  language: String,
  placeholders: List<TranslationPlaceholder>
): String {
  val placeholderEntries = placeholders.joinToString(",") { placeholder ->
    "\"${escapeJson(placeholder.key)}\":${toPlaceholderJsonValue(placeholder.value)}"
  }

  return "{\"key\":\"${escapeJson(key)}\",\"language\":\"${escapeJson(language)}\",\"placeholders\":{$placeholderEntries}}"
}

private fun toPlaceholderJsonValue(value: TranslationPlaceholderValue): String =
  when (value) {
    is TranslationPlaceholderValue.Text -> "\"${escapeJson(value.value)}\""
    is TranslationPlaceholderValue.Number -> value.value.toString()
    is TranslationPlaceholderValue.Bool -> value.value.toString()
    is TranslationPlaceholderValue.Timestamp -> value.value.time.toString()
  }

private fun escapeJson(value: String): String = buildString {
  value.forEach { character ->
    when (character) {
      '\\' -> append("\\\\")
      '"' -> append("\\\"")
      '\b' -> append("\\b")
      '\u000C' -> append("\\f")
      '\n' -> append("\\n")
      '\r' -> append("\\r")
      '\t' -> append("\\t")
      else -> {
        if (character.code < 0x20) {
          append("\\u")
          append(character.code.toString(16).padStart(4, '0'))
        } else {
          append(character)
        }
      }
    }
  }
}

fun main() {
  println("")
  println("Starting Kotlin SmokeApp...")

  val bridge = NodeTranslationRuntimeBridge(runtimeBundlePath = RUNTIME_BUNDLE_PATH)
  val translator = TypekitTranslator(bridge = bridge)

  for (language in TranslationLanguage.values()) {
    val text = translator.translate(TranslationKey.WELCOME, language)
    println("${language.code}: $text")
  }
}
