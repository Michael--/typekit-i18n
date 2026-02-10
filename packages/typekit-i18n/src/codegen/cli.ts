#!/usr/bin/env node

import pc from 'picocolors'
import { loadTypekitI18nConfig } from './config.js'
import { generateTranslationTable } from './generate.js'

const resolveArgValue = (name: string): string | undefined => {
  const prefixed = `${name}=`
  const inlineArg = process.argv.find((arg) => arg.startsWith(prefixed))
  if (inlineArg) {
    return inlineArg.slice(prefixed.length)
  }

  const argIndex = process.argv.indexOf(name)
  if (argIndex >= 0 && process.argv[argIndex + 1]) {
    return process.argv[argIndex + 1]
  }
  return undefined
}

/**
 * Runs the Typekit i18n CLI for CSV code generation.
 *
 * @returns Process exit code.
 */
export const runCli = async (): Promise<number> => {
  const configArg = resolveArgValue('--config')
  const loaded = await loadTypekitI18nConfig(configArg)

  if (!loaded) {
    const resolvedPath = configArg ?? 'typekit-i18n.config.ts'
    console.warn(pc.yellow(`No config file found at "${resolvedPath}". Skipping generation.`))
    return 0
  }

  await generateTranslationTable(loaded.config)
  return 0
}

runCli()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Generation failed: ${message}`))
    process.exitCode = 1
  })
