#!/usr/bin/env node

import { mkdir } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import pc from 'picocolors'
import { loadTypekitI18nConfig } from './config.js'
import { generateTranslations, resolveCodegenTargets, type CodegenTarget } from './generate.js'
import { writeCsvFileFromIrProject } from './ir/csv.js'
import { writeYamlFileFromIrProject } from './ir/yaml.js'
import { validateTranslationFile } from './validate.js'

type CliCommand = 'generate' | 'validate' | 'convert'
type TranslationFormat = 'csv' | 'yaml'

const resolveArgValue = (args: ReadonlyArray<string>, name: string): string | undefined => {
  const prefixed = `${name}=`
  const inlineArg = args.find((arg) => arg.startsWith(prefixed))
  if (inlineArg) {
    return inlineArg.slice(prefixed.length)
  }

  const argIndex = args.indexOf(name)
  if (argIndex >= 0 && args[argIndex + 1]) {
    return args[argIndex + 1]
  }
  return undefined
}

const resolveRequiredArg = (args: ReadonlyArray<string>, name: string): string => {
  const value = resolveArgValue(args, name)
  if (!value) {
    throw new Error(`Missing required argument "${name}".`)
  }
  return value
}

const resolveCommand = (argv: ReadonlyArray<string>): { command: CliCommand; args: string[] } => {
  const [firstArg, ...restArgs] = argv
  if (firstArg === 'generate' || firstArg === 'validate' || firstArg === 'convert') {
    return {
      command: firstArg,
      args: restArgs,
    }
  }

  return {
    command: 'generate',
    args: [...argv],
  }
}

const toFormat = (value: string, argumentName: string): TranslationFormat => {
  if (value === 'csv' || value === 'yaml') {
    return value
  }
  throw new Error(`Invalid value for "${argumentName}": "${value}". Use "csv" or "yaml".`)
}

const inferFormatFromPath = (filePath: string): TranslationFormat => {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml'
  }
  return 'csv'
}

const parseLanguages = (value: string): ReadonlyArray<string> =>
  value
    .split(',')
    .map((language) => language.trim())
    .filter((language) => language.length > 0)

const resolveArgValues = (args: ReadonlyArray<string>, name: string): ReadonlyArray<string> => {
  const prefixed = `${name}=`
  const inlineValues = args
    .filter((arg) => arg.startsWith(prefixed))
    .map((arg) => arg.slice(prefixed.length))
  const separatedValues = args.flatMap((arg, index) => {
    if (arg !== name) {
      return []
    }
    const value = args[index + 1]
    return value ? [value] : []
  })

  return [...inlineValues, ...separatedValues]
}

const resolveGenerateTargets = (
  args: ReadonlyArray<string>
): ReadonlyArray<CodegenTarget> | undefined => {
  const rawTargetValues = resolveArgValues(args, '--target')
  if (rawTargetValues.length === 0) {
    return undefined
  }

  const splitTargets = rawTargetValues
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (splitTargets.length === 0) {
    throw new Error('Invalid "--target": expected at least one target name.')
  }

  return resolveCodegenTargets(splitTargets)
}

const resolveCsvContextArgs = (
  args: ReadonlyArray<string>
): {
  languages?: ReadonlyArray<string>
  sourceLanguage?: string
} => {
  const languagesArg = resolveRequiredArg(args, '--languages')
  const languages = parseLanguages(languagesArg)
  if (languages.length === 0) {
    throw new Error('Invalid "--languages": expected at least one comma-separated language code.')
  }

  const sourceLanguage =
    resolveArgValue(args, '--source-language') ?? resolveArgValue(args, '--sourceLanguage')
  if (sourceLanguage && !languages.includes(sourceLanguage)) {
    throw new Error(
      `Invalid CSV context: source language "${sourceLanguage}" is not part of --languages.`
    )
  }

  return {
    languages,
    sourceLanguage,
  }
}

const loadProject = async (
  format: TranslationFormat,
  filePath: string,
  args: ReadonlyArray<string>
) => {
  if (format === 'csv') {
    const csvContext = resolveCsvContextArgs(args)
    if (!csvContext.languages || !csvContext.sourceLanguage) {
      throw new Error('CSV input requires "--languages" and "--source-language".')
    }
    return validateTranslationFile({
      inputPath: filePath,
      format: 'csv',
      languages: csvContext.languages,
      sourceLanguage: csvContext.sourceLanguage,
    })
  }
  return validateTranslationFile({
    inputPath: filePath,
    format: 'yaml',
  })
}

const runGenerateCommand = async (args: ReadonlyArray<string>): Promise<number> => {
  const configArg = resolveArgValue(args, '--config')
  const targets = resolveGenerateTargets(args)
  const loaded = await loadTypekitI18nConfig(configArg)

  if (!loaded) {
    const resolvedPath =
      configArg ?? 'typekit.config.ts|json|yaml|yml or typekit-i18n.config.ts|json|yaml|yml'
    console.warn(pc.yellow(`No config file found at "${resolvedPath}". Skipping generation.`))
    return 0
  }

  await generateTranslations(loaded.config, { targets })
  return 0
}

const runValidateCommand = async (args: ReadonlyArray<string>): Promise<number> => {
  const inputPath = resolveRequiredArg(args, '--input')
  const formatArg = resolveArgValue(args, '--format')
  const format = formatArg ? toFormat(formatArg, '--format') : inferFormatFromPath(inputPath)
  const csvContext = format === 'csv' ? resolveCsvContextArgs(args) : {}
  await validateTranslationFile({
    inputPath,
    format,
    languages: csvContext.languages,
    sourceLanguage: csvContext.sourceLanguage,
  })
  process.stdout.write(pc.green(`Validation passed for "${inputPath}" (${format}).\n`))
  return 0
}

const runConvertCommand = async (args: ReadonlyArray<string>): Promise<number> => {
  const from = toFormat(resolveRequiredArg(args, '--from'), '--from')
  const to = toFormat(resolveRequiredArg(args, '--to'), '--to')
  const inputPath = resolveRequiredArg(args, '--input')
  const outputPath = resolveRequiredArg(args, '--output')

  const loaded = await loadProject(from, inputPath, args)
  const project = loaded.project
  await mkdir(dirname(outputPath), { recursive: true })

  if (to === 'csv') {
    await writeCsvFileFromIrProject(outputPath, project)
  } else {
    await writeYamlFileFromIrProject(outputPath, project)
  }

  process.stdout.write(
    pc.green(`Converted "${inputPath}" from ${from} to ${to} at "${outputPath}".\n`)
  )
  return 0
}

/**
 * Runs Typekit i18n CLI commands.
 *
 * @returns Process exit code.
 */
export const runCli = async (): Promise<number> => {
  const argv = process.argv.slice(2)
  const resolved = resolveCommand(argv)

  if (resolved.command === 'generate') {
    return runGenerateCommand(resolved.args)
  }
  if (resolved.command === 'validate') {
    return runValidateCommand(resolved.args)
  }
  return runConvertCommand(resolved.args)
}

runCli()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Command failed: ${message}`))
    process.exitCode = 1
  })
