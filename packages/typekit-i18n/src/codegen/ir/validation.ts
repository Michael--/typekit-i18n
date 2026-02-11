import { TranslationIrEntry, TranslationIrProject } from './types.js'

const placeholderTokenPattern = /\{([A-Za-z0-9_]+)\}/g

const toEntryLocation = (
  entryIndex: number,
  locationResolver?: (entryIndex: number) => string
): string => {
  if (locationResolver) {
    return locationResolver(entryIndex)
  }
  return `root.entries[${entryIndex}]`
}

const toCombinedErrorMessage = (errors: ReadonlyArray<string>): string => {
  if (errors.length === 1) {
    return errors[0]
  }
  const lines = errors.map((error, index) => `${index + 1}. ${error}`)
  return `Validation failed with ${errors.length} error(s):\n${lines.join('\n')}`
}

const collectPlaceholderTokens = (value: string): ReadonlySet<string> => {
  const result = new Set<string>()
  const pattern = new RegExp(placeholderTokenPattern)
  let match = pattern.exec(value)

  while (match) {
    const token = match[1]
    result.add(token)
    match = pattern.exec(value)
  }

  return result
}

const getMissingTokens = (
  baselineTokens: ReadonlySet<string>,
  candidateTokens: ReadonlySet<string>
): ReadonlyArray<string> =>
  Array.from(baselineTokens.values()).filter((token) => !candidateTokens.has(token))

const validateLanguageShape = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>
): void => {
  if (project.languages.length === 0) {
    throw new Error('Invalid IR project: "languages" must include at least one language.')
  }
  if (!project.languages.includes(project.sourceLanguage)) {
    throw new Error(
      `Invalid IR project: source language "${project.sourceLanguage}" is not part of "languages".`
    )
  }
  if (new Set(project.languages).size !== project.languages.length) {
    throw new Error('Invalid IR project: "languages" must not contain duplicate entries.')
  }
}

const validateEntryValues = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  entry: TranslationIrEntry<TLanguage>,
  entryIndex: number,
  locationResolver?: (entryIndex: number) => string
): void => {
  const location = toEntryLocation(entryIndex, locationResolver)
  const errors: string[] = []
  project.languages.forEach((language) => {
    const translated = entry.values[language]
    if (typeof translated !== 'string') {
      errors.push(`Missing language "${language}" at ${location}.`)
      return
    }
    if (language === project.sourceLanguage && translated.length === 0) {
      errors.push(`Missing source language value for "${language}" at ${location}.`)
    }
  })

  if (errors.length > 0) {
    throw new Error(toCombinedErrorMessage(errors))
  }
}

const validatePlaceholderDeclarations = <TLanguage extends string>(
  entry: TranslationIrEntry<TLanguage>,
  entryIndex: number,
  locationResolver?: (entryIndex: number) => string
): void => {
  const location = toEntryLocation(entryIndex, locationResolver)
  if (!entry.placeholders || entry.placeholders.length === 0) {
    return
  }

  const names = new Set<string>()
  entry.placeholders.forEach((placeholder, placeholderIndex) => {
    if (placeholder.name.length === 0) {
      throw new Error(`Placeholder name must be non-empty at ${location}.`)
    }
    if (names.has(placeholder.name)) {
      throw new Error(
        `Duplicate placeholder "${placeholder.name}" at ${location}.placeholders[${placeholderIndex}].`
      )
    }
    names.add(placeholder.name)
  })
}

const validatePlaceholderTokenConsistency = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  entry: TranslationIrEntry<TLanguage>,
  entryIndex: number,
  locationResolver?: (entryIndex: number) => string
): void => {
  const location = toEntryLocation(entryIndex, locationResolver)
  const declaredPlaceholderNames = new Set(
    entry.placeholders?.map((placeholder) => placeholder.name)
  )
  const sourceTokens = collectPlaceholderTokens(entry.values[project.sourceLanguage])

  if (declaredPlaceholderNames.size > 0) {
    sourceTokens.forEach((token) => {
      if (!declaredPlaceholderNames.has(token)) {
        throw new Error(
          `Placeholder "{${token}}" in source language is not declared at ${location}.`
        )
      }
    })
  }

  project.languages.forEach((language) => {
    const value = entry.values[language]
    const languageTokens = collectPlaceholderTokens(value)

    if (declaredPlaceholderNames.size > 0) {
      languageTokens.forEach((token) => {
        if (!declaredPlaceholderNames.has(token)) {
          throw new Error(
            `Placeholder "{${token}}" in language "${language}" is not declared at ${location}.`
          )
        }
      })
    }

    const missingInLanguage = getMissingTokens(sourceTokens, languageTokens)
    if (missingInLanguage.length > 0) {
      throw new Error(
        `Missing placeholder(s) ${missingInLanguage
          .map((token) => `"{${token}}"`)
          .join(', ')} in language "${language}" at ${location}.`
      )
    }

    const extraInLanguage = getMissingTokens(languageTokens, sourceTokens)
    if (extraInLanguage.length > 0) {
      throw new Error(
        `Unexpected placeholder(s) ${extraInLanguage
          .map((token) => `"{${token}}"`)
          .join(', ')} in language "${language}" at ${location}.`
      )
    }
  })
}

/**
 * Options for validating IR projects.
 */
export interface ValidateIrProjectOptions {
  /**
   * Optional entry location resolver used in validation errors.
   * Defaults to `root.entries[index]`.
   */
  entryLocation?: (entryIndex: number) => string
}

/**
 * Validates a translation IR project with shared semantic checks.
 *
 * @param project Normalized IR project object.
 * @param options Validation options.
 * @throws When required fields, language coverage, or placeholder consistency are invalid.
 */
export const validateIrProject = <TLanguage extends string>(
  project: TranslationIrProject<TLanguage>,
  options: ValidateIrProjectOptions = {}
): void => {
  validateLanguageShape(project)

  const keys = new Set<string>()
  const errors: string[] = []
  project.entries.forEach((entry, entryIndex) => {
    const location = toEntryLocation(entryIndex, options.entryLocation)
    if (entry.key.length === 0) {
      errors.push(`Missing key at ${location}.`)
      return
    }
    if (entry.description.length === 0) {
      errors.push(`Missing description at ${location}.`)
      return
    }
    if (keys.has(entry.key)) {
      errors.push(`Duplicate key "${entry.key}" at ${location}.`)
      return
    }
    keys.add(entry.key)

    try {
      validateEntryValues(project, entry, entryIndex, options.entryLocation)
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
    try {
      validatePlaceholderDeclarations(entry, entryIndex, options.entryLocation)
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
    try {
      validatePlaceholderTokenConsistency(project, entry, entryIndex, options.entryLocation)
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  })

  if (errors.length > 0) {
    throw new Error(toCombinedErrorMessage(errors))
  }
}
