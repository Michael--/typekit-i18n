import { readFile } from 'node:fs/promises'
import { TranslationIrProject } from './types.js'

const YAML_ADAPTER_NOT_IMPLEMENTED =
  'YAML-to-IR adapter is not implemented yet. See FORMAT_IR_PLAN.md for the staged rollout.'

/**
 * Converts YAML content into translation IR.
 *
 * @param content YAML source content.
 * @returns Normalized IR project object.
 * @throws Always, until YAML parsing is implemented.
 */
export const toIrProjectFromYamlContent = <TLanguage extends string = string>(
  content: string
): TranslationIrProject<TLanguage> => {
  void content
  throw new Error(YAML_ADAPTER_NOT_IMPLEMENTED)
}

/**
 * Reads one YAML file and converts it into translation IR.
 *
 * @param filePath YAML source file path.
 * @returns Normalized IR project object.
 * @throws Always, until YAML parsing is implemented.
 */
export const toIrProjectFromYamlFile = async <TLanguage extends string = string>(
  filePath: string
): Promise<TranslationIrProject<TLanguage>> => {
  await readFile(filePath, 'utf-8')
  throw new Error(`${YAML_ADAPTER_NOT_IMPLEMENTED} File: "${filePath}".`)
}
