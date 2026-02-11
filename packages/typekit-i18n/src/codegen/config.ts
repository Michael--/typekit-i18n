import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tsImport } from 'tsx/esm/api'
import { parse as parseYaml } from 'yaml'
import { TypekitI18nConfig } from './types.js'

const DEFAULT_CONFIG_FILE_CANDIDATES = [
  'typekit.config.ts',
  'typekit.config.json',
  'typekit.config.yaml',
  'typekit.config.yml',
  'typekit-i18n.config.ts',
  'typekit-i18n.config.json',
  'typekit-i18n.config.yaml',
  'typekit-i18n.config.yml',
] as const

const TS_MODULE_CONFIG_EXTENSIONS = new Set<string>(['.ts', '.mts', '.cts'])
const JS_MODULE_CONFIG_EXTENSIONS = new Set<string>(['.js', '.mjs', '.cjs'])
const YAML_CONFIG_EXTENSIONS = new Set<string>(['.yaml', '.yml'])

const resolveConfigPath = async (inputPath?: string): Promise<string | null> => {
  if (inputPath) {
    return resolve(inputPath)
  }

  for (const candidate of DEFAULT_CONFIG_FILE_CANDIDATES) {
    const candidatePath = resolve(candidate)
    if (await hasReadableConfig(candidatePath)) {
      return candidatePath
    }
  }

  return null
}

const hasReadableConfig = async (configPath: string): Promise<boolean> => {
  try {
    await access(configPath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

const toConfigObject = <TLanguage extends string>(
  value: unknown,
  configPath: string
): TypekitI18nConfig<TLanguage> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Configuration "${configPath}" must export a config object.`)
  }
  return value as TypekitI18nConfig<TLanguage>
}

const loadConfigFromJavaScriptModule = async <TLanguage extends string>(
  configPath: string
): Promise<TypekitI18nConfig<TLanguage>> => {
  const moduleUrl = pathToFileURL(configPath).toString()
  const imported = (await import(moduleUrl)) as { default?: unknown }
  if (imported.default === undefined) {
    throw new Error(`Configuration "${configPath}" must export default TypekitI18nConfig object.`)
  }
  return toConfigObject(imported.default, configPath)
}

const loadConfigFromTypeScriptModule = async <TLanguage extends string>(
  configPath: string
): Promise<TypekitI18nConfig<TLanguage>> => {
  const moduleUrl = pathToFileURL(configPath).toString()
  const imported = (await tsImport(moduleUrl, import.meta.url)) as { default?: unknown }
  if (imported.default === undefined) {
    throw new Error(`Configuration "${configPath}" must export default TypekitI18nConfig object.`)
  }
  return toConfigObject(imported.default, configPath)
}

const loadConfigFromJson = async <TLanguage extends string>(
  configPath: string
): Promise<TypekitI18nConfig<TLanguage>> => {
  const content = await readFile(configPath, 'utf-8')
  try {
    return toConfigObject(JSON.parse(content) as unknown, configPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON configuration "${configPath}": ${message}`)
  }
}

const loadConfigFromYaml = async <TLanguage extends string>(
  configPath: string
): Promise<TypekitI18nConfig<TLanguage>> => {
  const content = await readFile(configPath, 'utf-8')
  try {
    return toConfigObject(parseYaml(content) as unknown, configPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid YAML configuration "${configPath}": ${message}`)
  }
}

const loadConfigFromPath = async <TLanguage extends string>(
  configPath: string
): Promise<TypekitI18nConfig<TLanguage>> => {
  const extension = extname(configPath).toLowerCase()

  if (TS_MODULE_CONFIG_EXTENSIONS.has(extension)) {
    return loadConfigFromTypeScriptModule(configPath)
  }
  if (JS_MODULE_CONFIG_EXTENSIONS.has(extension)) {
    return loadConfigFromJavaScriptModule(configPath)
  }
  if (extension === '.json') {
    return loadConfigFromJson(configPath)
  }
  if (YAML_CONFIG_EXTENSIONS.has(extension)) {
    return loadConfigFromYaml(configPath)
  }

  throw new Error(
    `Unsupported configuration extension "${extension}" for "${configPath}". Supported: .ts, .mts, .cts, .js, .mjs, .cjs, .json, .yaml, .yml.`
  )
}

/**
 * Loads Typekit i18n configuration from a file.
 *
 * @param inputPath Explicit config path. When omitted, loader auto-discovers
 * `typekit.config.{ts,json,yaml,yml}` and then legacy `typekit-i18n.config.{ts,json,yaml,yml}`.
 * @returns Loaded config and resolved config path, or `null` when config file does not exist.
 */
export const loadTypekitI18nConfig = async <TLanguage extends string = string>(
  inputPath?: string
): Promise<{ config: TypekitI18nConfig<TLanguage>; configPath: string } | null> => {
  const configPath = await resolveConfigPath(inputPath)
  if (!configPath) {
    return null
  }

  const exists = await hasReadableConfig(configPath)
  if (!exists) {
    return null
  }

  return {
    config: await loadConfigFromPath(configPath),
    configPath,
  }
}
