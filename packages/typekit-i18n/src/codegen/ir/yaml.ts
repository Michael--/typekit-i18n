import { readFile } from 'node:fs/promises'
import { parseDocument } from 'yaml'
import {
  TranslationIrEntry,
  TranslationIrEntryStatus,
  TranslationIrPlaceholder,
  TranslationIrPlaceholderType,
  TranslationIrProject,
} from './types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toPath = (path: ReadonlyArray<string | number>): string =>
  path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : segment))
    .join('.')
    .replace('.[', '[')

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
  path: ReadonlyArray<string | number>
): Record<string, string> => {
  const parsed = requireObject(value, path)
  const values: Record<string, string> = {}

  languages.forEach((language) => {
    if (!(language in parsed)) {
      throw new Error(`Missing language "${language}" at "${toPath(path)}".`)
    }
    const translated = parsed[language]
    if (typeof translated !== 'string') {
      throw new Error(`Expected string at "${toPath([...path, language])}".`)
    }
    if (language === sourceLanguage && translated.length === 0) {
      throw new Error(`Missing source language value at "${toPath([...path, language])}".`)
    }
    values[language] = translated
  })

  return values
}

const toEntries = (
  value: unknown,
  languages: ReadonlyArray<string>,
  sourceLanguage: string,
  path: ReadonlyArray<string | number>
): ReadonlyArray<TranslationIrEntry<string>> => {
  const entries = requireArray(value, path)
  const keys = new Set<string>()

  return entries.map((entry, index) => {
    const basePath = [...path, index]
    const parsed = requireObject(entry, basePath)
    const key = requireString(parsed.key, [...basePath, 'key'])
    if (keys.has(key)) {
      throw new Error(`Duplicate key "${key}" at "${toPath(basePath)}".`)
    }
    keys.add(key)

    return {
      key,
      description: requireString(parsed.description, [...basePath, 'description']),
      status: toStatus(parsed.status, [...basePath, 'status']),
      tags: toTags(parsed.tags, [...basePath, 'tags']),
      placeholders: toPlaceholders(parsed.placeholders, [...basePath, 'placeholders']),
      values: toValues(parsed.values, languages, sourceLanguage, [...basePath, 'values']),
    }
  })
}

/**
 * Converts YAML content into translation IR.
 *
 * @param content YAML source content.
 * @returns Normalized IR project object.
 * @throws When the YAML content is invalid or does not match IR schema.
 */
export const toIrProjectFromYamlContent = <TLanguage extends string = string>(
  content: string
): TranslationIrProject<TLanguage> => {
  const document = parseDocument(content)
  if (document.errors.length > 0) {
    throw new Error(`Invalid YAML: ${document.errors[0].message}`)
  }

  const root = requireObject(document.toJS(), ['root'])
  const version = String(root.version)
  if (version !== '1') {
    throw new Error(`Unsupported IR version "${String(root.version)}".`)
  }

  const sourceLanguage = requireString(root.sourceLanguage, ['root', 'sourceLanguage'])
  const languages = toLanguages(root.languages, sourceLanguage, ['root', 'languages'])
  const entries = toEntries(root.entries, languages, sourceLanguage, ['root', 'entries'])

  return {
    version: '1',
    sourceLanguage: sourceLanguage as TLanguage,
    languages: languages as ReadonlyArray<TLanguage>,
    entries: entries as ReadonlyArray<TranslationIrEntry<TLanguage>>,
  }
}

/**
 * Reads one YAML file and converts it into translation IR.
 *
 * @param filePath YAML source file path.
 * @returns Normalized IR project object.
 * @throws When file content is invalid YAML or does not match IR schema.
 */
export const toIrProjectFromYamlFile = async <TLanguage extends string = string>(
  filePath: string
): Promise<TranslationIrProject<TLanguage>> => {
  const content = await readFile(filePath, 'utf-8')
  return toIrProjectFromYamlContent(content)
}
