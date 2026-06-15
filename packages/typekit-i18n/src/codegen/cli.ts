#!/usr/bin/env node

import { mkdir } from 'node:fs/promises'
import { readFileSync, watch } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import pc from 'picocolors'
import { loadTypekitI18nConfig } from './config.js'
import { generateTranslations, resolveCodegenTargets, type CodegenTarget } from './generate.js'
import { writeCsvFileFromIrProject } from './ir/csv.js'
import { writeJsonFileFromIrProject } from './ir/json.js'
import { writeYamlFileFromIrProject } from './ir/yaml.js'
import { validateTranslationFile } from './validate.js'
import type { TypekitI18nConfig } from './types.js'

type CliCommand = 'generate' | 'validate' | 'convert'
type TranslationFormat = 'csv' | 'yaml' | 'json'

const PACKAGE_NAME = '@number10/typekit-i18n'

const WATCH_DEBOUNCE_MS = 300
const SUPPORTED_WATCHED_EXTENSIONS = new Set(['.csv', '.yaml', '.yml', '.json'])

const resolvePackageVersion = (): string => {
  try {
    const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url))
    const content = readFileSync(packageJsonPath, 'utf-8')
    const parsed = JSON.parse(content) as { version?: string }
    return parsed.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

const HELP_TEXT = `${pc.bold('typekit-i18n')} — Type-safe i18n toolkit for TypeScript

${pc.underline('Usage:')}
  typekit-i18n <command> [options]

${pc.underline('Commands:')}
  ${pc.bold('generate')}              Generate typed translation modules from CSV/YAML resources.
                        Uses config from typekit.config.ts (auto-discovered).

  ${pc.bold('validate')}              Validate one translation resource file.
                        Requires --input and optional --format.

  ${pc.bold('convert')}               Convert translation resources between formats.
                        Requires --from, --to, --input, and --output.

${pc.underline('Options:')}
  --help, -h              Show this help text.
  --version, -v           Show package version.

${pc.underline('Generate Options:')}
  --config <path>         Path to config file (default: auto-discovery).
  --target <name>         Generation target: ts, swift, kotlin (repeatable).
  --watch, -w             Watch input files and regenerate on changes.

${pc.underline('Validate Options:')}
  --input <path>          Path to translation resource file.
  --format <csv|yaml|json> Resource format (inferred from extension when omitted).
  --languages <codes>     Comma-separated language codes (CSV only).
  --source-language <code> Source language code (CSV only).

${pc.underline('Convert Options:')}
  --from <csv|yaml|json>  Source format.
  --to <csv|yaml|json>    Target format.
  --input <path>          Path to source resource file.
  --output <path>         Path to output file.
  --languages <codes>     Comma-separated language codes (CSV only).
  --source-language <code> Source language code (CSV only).

${pc.underline('Examples:')}
  ${pc.dim('# Generate typed modules')}
  typekit-i18n generate
  typekit-i18n generate --target swift --target kotlin

  ${pc.dim('# Validate a resource file')}
  typekit-i18n validate --input translations/ui.csv --languages=en,de --source-language=en
  typekit-i18n validate --input translations/features.yaml

  ${pc.dim('# Convert between formats')}
  typekit-i18n convert --from csv --to yaml --input ui.csv --output ui.yaml

${pc.dim('Documentation: https://typekit-i18n.number10.de/')}
`

const printHelp = (): void => {
  process.stdout.write(`${HELP_TEXT}\n`)
}

const printVersion = (): void => {
  process.stdout.write(`${PACKAGE_NAME} v${resolvePackageVersion()}\n`)
}

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

type HelpAction = 'help'
type VersionAction = 'version'
type ResolvedCliAction =
  | { kind: 'command'; command: CliCommand; args: string[] }
  | { kind: 'help' }
  | { kind: 'version' }

const hasFlag = (args: ReadonlyArray<string>, flag: string, shorthand?: string): boolean =>
  args.includes(flag) || (shorthand ? args.includes(shorthand) : false)

const resolveCliAction = (argv: ReadonlyArray<string>): ResolvedCliAction => {
  if (hasFlag(argv, '--help', '-h')) {
    return { kind: 'help' }
  }
  if (hasFlag(argv, '--version', '-v')) {
    return { kind: 'version' }
  }

  const [firstArg, ...restArgs] = argv
  if (firstArg === 'generate' || firstArg === 'validate' || firstArg === 'convert') {
    return { kind: 'command', command: firstArg, args: restArgs }
  }

  return { kind: 'command', command: 'generate', args: [...argv] }
}

const toFormat = (value: string, argumentName: string): TranslationFormat => {
  if (value === 'csv' || value === 'yaml' || value === 'json') {
    return value
  }
  throw new Error(`Invalid value for "${argumentName}": "${value}". Use "csv", "yaml", or "json".`)
}

const inferFormatFromPath = (filePath: string): TranslationFormat => {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.yaml' || extension === '.yml') {
    return 'yaml'
  }
  if (extension === '.json') {
    return 'json'
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
    format,
  })
}

/**
 * Extracts the longest non-glob directory prefix from a glob pattern.
 *
 * @param pattern Glob pattern string.
 * @returns Resolved directory path for watching.
 */
const toWatchDirectory = (pattern: string): string => {
  const resolved = resolve(pattern)
  const segments = resolved.split(sep)
  const globChars = /[*?[\]{}!]/u

  let directorySegments: string[] = []
  for (const segment of segments) {
    if (globChars.test(segment)) {
      break
    }
    directorySegments.push(segment)
  }

  const directoryPath = directorySegments.length > 0 ? directorySegments.join(sep) : resolved
  return directoryPath || sep
}

/**
 * Collects unique watch directories from all input patterns.
 *
 * @param config Generator config with input patterns.
 * @returns Deduplicated directory paths to watch.
 */
const resolveWatchDirectories = (config: TypekitI18nConfig): ReadonlyArray<string> => {
  const patterns = Array.isArray(config.input) ? config.input : [config.input]
  const directories = new Set<string>()
  for (const pattern of patterns) {
    directories.add(toWatchDirectory(pattern))
  }
  return Array.from(directories)
}

/**
 * Starts a file watcher loop that regenerates translations on input changes.
 *
 * @param config Generator config.
 * @param targets Optional generation targets.
 * @param signal Abort signal to stop watching.
 */
const runGenerateWatch = (
  config: TypekitI18nConfig,
  targets: ReadonlyArray<CodegenTarget> | undefined,
  signal: AbortSignal
): void => {
  const directories = resolveWatchDirectories(config)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  const triggerGeneration = async (): Promise<void> => {
    try {
      // ANSI escape to clear terminal
      process.stdout.write('\x1B[2J\x1B[H')
      await generateTranslations(config, { targets })
      process.stdout.write(
        pc.dim(
          `\nWatching for changes in ${directories.length} director${directories.length === 1 ? 'y' : 'ies'}… (Ctrl+C to stop)\n`
        )
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(pc.red(`Generation failed: ${message}`))
    }
  }

  const scheduleGeneration = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void triggerGeneration()
    }, WATCH_DEBOUNCE_MS)
  }

  for (const directory of directories) {
    try {
      const watcher = watch(directory, { recursive: true }, (_event, filename) => {
        if (filename) {
          const extension = extname(filename).toLowerCase()
          if (SUPPORTED_WATCHED_EXTENSIONS.has(extension)) {
            scheduleGeneration()
          }
        }
      })

      signal.addEventListener('abort', () => {
        watcher.close()
      })
    } catch {
      console.warn(pc.yellow(`Unable to watch directory "${directory}".`))
    }
  }

  process.stdout.write(
    pc.dim(
      `Watching for changes in ${directories.length} director${directories.length === 1 ? 'y' : 'ies'}… (Ctrl+C to stop)\n`
    )
  )
}

const runGenerateCommand = async (args: ReadonlyArray<string>): Promise<number> => {
  const configArg = resolveArgValue(args, '--config')
  const targets = resolveGenerateTargets(args)
  const shouldWatch = hasFlag(args, '--watch', '-w')
  const loaded = await loadTypekitI18nConfig(configArg)

  if (!loaded) {
    const resolvedPath =
      configArg ?? 'typekit.config.ts|json|yaml|yml or typekit-i18n.config.ts|json|yaml|yml'
    console.warn(pc.yellow(`No config file found at "${resolvedPath}". Skipping generation.`))
    return 0
  }

  await generateTranslations(loaded.config, { targets })

  if (shouldWatch) {
    const abortController = new AbortController()
    process.on('SIGINT', () => abortController.abort())
    process.on('SIGTERM', () => abortController.abort())
    runGenerateWatch(loaded.config, targets, abortController.signal)

    // Keep the process alive for the watcher
    await new Promise<void>((resolvePromise) => {
      abortController.signal.addEventListener('abort', () => resolvePromise())
    })
  }

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
  } else if (to === 'json') {
    await writeJsonFileFromIrProject(outputPath, project)
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
  const action = resolveCliAction(argv)

  if (action.kind === 'help') {
    printHelp()
    return 0
  }
  if (action.kind === 'version') {
    printVersion()
    return 0
  }

  const { command, args } = action
  if (command === 'generate') {
    return runGenerateCommand(args)
  }
  if (command === 'validate') {
    return runValidateCommand(args)
  }
  return runConvertCommand(args)
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
