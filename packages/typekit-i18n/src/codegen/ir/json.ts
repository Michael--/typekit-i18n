import { readFile, writeFile } from 'node:fs/promises'
import {
  TranslationIrEntry,
  TranslationIrEntryStatus,
  TranslationIrPlaceholder,
  TranslationIrPlaceholderType,
  TranslationIrProject,
} from './types.js'
import { validateIrProject } from './validation.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toPath = (path: ReadonlyArray<string | number>): string =>
  path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment))
    .join('.')
    .replace('.[', '[')

const toCombinedErrorMessage = (scope: string, errors: ReadonlyArray<string>): string => {
  if (errors.length === 1) {
    return errors[0]
  }
  const lines = errors.map((error, index) => `${index + 1}. ${error}`)
  return `${scope} failed with ${errors.length} error(s):\n${lines.join('\n')}`
}

const requireString = (value: unknown, path: ReadonlyArray<string | number>): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Expected non-empty string at "${toPath(path)}".`)
  }
  return value
}

const requireObject = (
  value: unknown,
  path: ReadonlyArray<string | number>
): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`Expected object at "${toPath(path)}".`)
  }
  return value
}

const requireArray = (
  value: unknown,
  path: ReadonlyArray<string | number>
): ReadonlyArray<unknown> => {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at "${toPath(path)}".`)
  }
  return value
}

const toStatus = (
  value: unknown,
  path: ReadonlyArray<string | number>
): TranslationIrEntryStatus | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (value !== 'draft' && value !== 'review' && value !== 'approved') {
    throw new Error(`Invalid status "${String(value)}" at "${toPath(path)}".`)
  }
  return value
}

const toCategory = (value: unknown, path: ReadonlyArray<string | number>): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected string at "${toPath(path)}".`)
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const toPlaceholderType = (
  value: unknown,
  path: ReadonlyArray<string | number>
): TranslationIrPlaceholderType | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected string at "${toPath(path)}".`)
  }

  const normalized = value.trim().toLowerCase()
  if (
    normalized !== 'string' &&
    normalized !== 'number' &&
    normalized !== 'boolean' &&
    normalized !== 'date' &&
    normalized !== 'currency'
  ) {
    throw new Error(`Invalid placeholder type "${value}" at "${toPath(path)}".`)
  }

  return normalized
}

const toTags = (
  value: unknown,
  path: ReadonlyArray<string | number>
): ReadonlyArray<string> | undefined => {
  if (value === undefined) {
    return undefined
  }
  const tags = requireArray(value, path)
  return tags.map((tag, index) => requireString(tag, [...path, index]))
}

const toPlaceholders = (
  value: unknown,
  path: ReadonlyArray<string | number>
): ReadonlyArray<TranslationIrPlaceholder> | undefined => {
  if (value === undefined) {
    return undefined
  }
  const placeholders = requireArray(value, path)
  const names = new Set<string>()

  return placeholders.map((placeholder, index) => {
    const basePath = [...path, index]
    const parsed = requireObject(placeholder, basePath)
    const name = requireString(parsed.name, [...basePath, 'name'])
    if (names.has(name)) {
      throw new Error(`Duplicate placeholder "${name}" at "${toPath(basePath)}".`)
    }
    names.add(name)

    const formatHint = parsed.formatHint
    if (formatHint !== undefined && typeof formatHint !== 'string') {
      throw new Error(`Expected string at "${toPath([...basePath, 'formatHint'])}".`)
    }

    return {
      name,
      type: toPlaceholderType(parsed.type, [...basePath, 'type']),
      formatHint,
    }
  })
}

const toLanguages = (
  value: unknown,
  sourceLanguage: string,
  path: ReadonlyArray<string | number>
): ReadonlyArray<string> => {
  const languages = requireArray(value, path).map((language, index) =>
    requireString(language, [...path, index])
  )

  if (languages.length === 0) {
    throw new Error(`Expected at least one language at "${toPath(path)}".`)
  }

  if (new Set(languages).size !== languages.length) {
    throw new Error(`Duplicate language entries in "${toPath(path)}".`)
  }

  if (!languages.includes(sourceLanguage)) {
    throw new Error(`Source language "${sourceLanguage}" is not part of "${toPath(path)}".`)
  }

  return languages
}

const toValues = (
  value: unknown,
  languages: ReadonlyArray<string>,
  sourceLanguage: string,
  path: ReadonlyArray<string | number>,
  entryKey: string
): Record<string, string> => {
  const parsed = requireObject(value, path)
  const values: Record<string, string> = {}
  const errors: string[] = []

  languages.forEach((language) => {
    if (!(language in parsed)) {
      errors.push(`Missing language "${language}" at "${toPath(path)}" for entry "${entryKey}".`)
      return
    }
    const translated = parsed[language]
    if (typeof translated !== 'string') {
      const valuePath = [...path, language]
      errors.push(`Expected string at "${toPath(valuePath)}" for entry "${entryKey}".`)
      return
    }
    if (language === sourceLanguage && translated.length === 0) {
      errors.push(
        `Missing source language value at "${toPath([...path, language])}" for entry "${entryKey}".`
      )
      return
    }
    values[language] = translated
  })

  if (errors.length > 0) {
    throw new Error(toCombinedErrorMessage('JSON value validation', errors))
  }

  return values
}

const toEntries = (
  value: unknown,
  languages: ReadonlyArray<string>,
  sourceLanguage: string,
  path: ReadonlyArray<string | number>
): ReadonlyArray<TranslationIrEntry<string>> => {
  const entries = requireArray(value, path)
  const parsedEntries: TranslationIrEntry<string>[] = []
  const keys = new Set<string>()
  const errors: string[] = []

  entries.forEach((entry, index) => {
    const basePath = [...path, index]
    try {
      const parsed = requireObject(entry, basePath)
      const key = requireString(parsed.key, [...basePath, 'key'])
      if (keys.has(key)) {
        throw new Error(`Duplicate key "${key}" at "${toPath(basePath)}".`)
      }
      keys.add(key)

      parsedEntries.push({
        category: toCategory(parsed.category, [...basePath, 'category']),
        key,
        description: requireString(parsed.description, [...basePath, 'description']),
        status: toStatus(parsed.status, [...basePath, 'status']),
        tags: toTags(parsed.tags, [...basePath, 'tags']),
        placeholders: toPlaceholders(parsed.placeholders, [...basePath, 'placeholders']),
        values: toValues(parsed.values, languages, sourceLanguage, [...basePath, 'values'], key),
      })
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  })

  if (errors.length > 0) {
    throw new Error(toCombinedErrorMessage('JSON entry validation', errors))
  }

  return parsedEntries
}

/**
 * Converts JSON content into translation IR.
 *
 * @param content JSON source content.
 * @returns Normalized IR project object.
 * @throws When the JSON content is invalid or does not match IR schema.
 */
export const toIrProjectFromJsonContent = <TLanguage extends string = string>(
  content: string
): TranslationIrProject<TLanguage> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON: ${message}`)
  }

  const root = requireObject(parsed, ['root'])
  const version = String(root.version)
  if (version !== '1') {
    throw new Error(`Unsupported IR version "${String(root.version)}".`)
  }

  const sourceLanguage = requireString(root.sourceLanguage, ['root', 'sourceLanguage'])
  const languages = toLanguages(root.languages, sourceLanguage, ['root', 'languages'])
  const entries = toEntries(root.entries, languages, sourceLanguage, ['root', 'entries'])

  const project: TranslationIrProject<TLanguage> = {
    version: '1',
    sourceLanguage: sourceLanguage as TLanguage,
    languages: languages as ReadonlyArray<TLanguage>,
    entries: entries as ReadonlyArray<TranslationIrEntry<TLanguage>>,
  }

  validateIrProject(project)
  return project
}

/**
 * Reads one JSON file and converts it into translation IR.
 *
 * @param filePath JSON source file path.
 * @returns Normalized IR project object.
 * @throws When file content is invalid JSON or does not match IR schema.
 */
export const toIrProjectFromJsonFile = async <TLanguage extends string = string>(
  filePath: string
): Promise<TranslationIrProject<TLanguage>> => {
  const content = await readFile(filePath, 'utf-8')
  try {
    return toIrProjectFromJsonContent(content)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`JSON validation failed in "${filePath}":\n${message}`)
  }
}

/**
 * Converts translation IR into JSON content.
 *
 * @param project Normalized IR project object.
 * @returns JSON document content.
 * @throws When project shape is invalid.
 */
export const toJsonContentFromIrProject = <TLanguage extends string = string>(
  project: TranslationIrProject<TLanguage>
): string => {
  if (project.languages.length === 0) {
    throw new Error('Invalid IR project: "languages" must include at least one language.')
  }
  if (!project.languages.includes(project.sourceLanguage)) {
    throw new Error(
      `Invalid IR project: source language "${project.sourceLanguage}" is not part of "languages".`
    )
  }

  const serialized = {
    version: project.version,
    sourceLanguage: project.sourceLanguage,
    languages: project.languages,
    entries: project.entries.map((entry) => ({
      ...(entry.category && entry.category.length > 0 ? { category: entry.category } : {}),
      key: entry.key,
      description: entry.description,
      ...(entry.status ? { status: entry.status } : {}),
      ...(entry.tags && entry.tags.length > 0 ? { tags: entry.tags } : {}),
      ...(entry.placeholders && entry.placeholders.length > 0
        ? { placeholders: entry.placeholders }
        : {}),
      values: entry.values,
    })),
  }

  return `${JSON.stringify(serialized, null, 2)}\n`
}

/**
 * Writes translation IR as JSON file content.
 *
 * @param filePath Output JSON path.
 * @param project Normalized IR project object.
 * @returns Resolves after writing file content.
 * @throws When project shape is invalid.
 */
export const writeJsonFileFromIrProject = async <TLanguage extends string = string>(
  filePath: string,
  project: TranslationIrProject<TLanguage>
): Promise<void> => {
  const content = toJsonContentFromIrProject(project)
  await writeFile(filePath, content, 'utf-8')
}
