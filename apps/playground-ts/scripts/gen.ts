import { generateTranslationTable, loadTypekitI18nConfig } from 'typekit-i18n/codegen'

/**
 * Generates the local playground translation table from CSV resources.
 *
 * @throws When the expected playground config file cannot be loaded.
 */
const run = async (): Promise<void> => {
  const loaded = await loadTypekitI18nConfig<'en' | 'de'>('./typekit-i18n.config.ts')
  if (!loaded) {
    throw new Error('Missing config file: ./typekit-i18n.config.ts')
  }

  await generateTranslationTable(loaded.config)
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
