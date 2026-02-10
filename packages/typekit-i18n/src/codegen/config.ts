import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TypekitI18nConfig } from './types.js'

const DEFAULT_CONFIG_FILE = 'typekit-i18n.config.ts'

const resolveConfigPath = (inputPath?: string): string => resolve(inputPath ?? DEFAULT_CONFIG_FILE)

const hasReadableConfig = async (configPath: string): Promise<boolean> => {
  try {
    await access(configPath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Loads Typekit i18n configuration from a file.
 *
 * @param inputPath Explicit config path. Defaults to `typekit-i18n.config.ts` in current working directory.
 * @returns Loaded config and resolved config path, or `null` when config file does not exist.
 */
export const loadTypekitI18nConfig = async <TLanguage extends string = string>(
  inputPath?: string
): Promise<{ config: TypekitI18nConfig<TLanguage>; configPath: string } | null> => {
  const configPath = resolveConfigPath(inputPath)
  const exists = await hasReadableConfig(configPath)
  if (!exists) {
    return null
  }

  const moduleUrl = pathToFileURL(configPath).toString()
  const imported = (await import(moduleUrl)) as { default?: TypekitI18nConfig<TLanguage> }
  if (!imported.default) {
    throw new Error(`Configuration "${configPath}" must export default TypekitI18nConfig object.`)
  }

  return {
    config: imported.default,
    configPath,
  }
}
