import { extname } from 'node:path'
import { toIrProjectFromCsvFile } from './ir/csv.js'
import { TranslationIrProject } from './ir/types.js'
import { validateIrProject } from './ir/validation.js'
import { toIrProjectFromYamlFile } from './ir/yaml.js'
import { TranslationInputFormat } from './types.js'

const toFormatFromPath = (filePath: string): TranslationInputFormat => {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml'
  }
  return 'csv'
}

/**
 * Options for validating one translation resource file.
 */
export interface ValidateTranslationFileOptions<TLanguage extends string = string> {
  /**
   * Path to the resource file that should be validated.
   */
  inputPath: string
  /**
   * Optional explicit file format.
   * When omitted, format is inferred from file extension.
   */
  format?: TranslationInputFormat
  /**
   * Required for CSV validation.
   */
  languages?: ReadonlyArray<TLanguage>
  /**
   * Required for CSV validation.
   */
  sourceLanguage?: TLanguage
}

/**
 * Validates one translation resource file and returns normalized IR.
 *
 * @param options Validation options.
 * @returns Parsed and validated IR project together with resolved format.
 * @throws When file content is invalid or required CSV context is missing.
 */
export const validateTranslationFile = async <TLanguage extends string = string>(
  options: ValidateTranslationFileOptions<TLanguage>
): Promise<{ format: TranslationInputFormat; project: TranslationIrProject<string> }> => {
  const format = options.format ?? toFormatFromPath(options.inputPath)

  if (format === 'csv') {
    if (!options.languages || options.languages.length === 0) {
      throw new Error('CSV validation requires "languages". Provide at least one language code.')
    }
    if (!options.sourceLanguage) {
      throw new Error('CSV validation requires "sourceLanguage".')
    }

    const project = await toIrProjectFromCsvFile(options.inputPath, {
      languages: options.languages,
      sourceLanguage: options.sourceLanguage,
    })
    validateIrProject(project)
    return {
      format,
      project,
    }
  }

  const project = await toIrProjectFromYamlFile(options.inputPath)
  validateIrProject(project)
  return {
    format,
    project,
  }
}

/**
 * Validates one YAML translation file and returns normalized IR.
 *
 * @param filePath Path to YAML resource file.
 * @returns Parsed and validated IR project.
 * @throws When file content is invalid YAML or violates IR constraints.
 */
export const validateYamlTranslationFile = async (
  filePath: string
): Promise<TranslationIrProject<string>> => {
  const result = await validateTranslationFile({
    inputPath: filePath,
    format: 'yaml',
  })
  return result.project
}
