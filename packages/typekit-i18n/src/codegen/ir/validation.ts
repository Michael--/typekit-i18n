import { TranslationIrEntry, TranslationIrProject } from './types.js'

const simplePlaceholderPattern = /^([A-Za-z0-9_]+)(?:\|[A-Za-z0-9_-]+)?$/u

const isQuotedPosition = (text: string, position: number): boolean => {
  let inQuoted = false

  for (let index = 0; index <= position && index < text.length; index += 1) {
    const char = text[index]
    if (char === "'") {
      const nextChar = text[index + 1]
      if (nextChar === "'") {
        index += 1
        continue
      }
      if (index === position) {
        return false
      }
      inQuoted = !inQuoted
    }
  }

  return inQuoted
}

const findMatchingBrace = (value: string, startIndex: number): number => {
  let depth = 0
  for (let index = startIndex; index < value.length; index += 1) {
    if (isQuotedPosition(value, index)) {
      continue
    }
    const char = value[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

const findTopLevelComma = (value: string, startIndex: number): number => {
  let depth = 0
  for (let index = startIndex; index < value.length; index += 1) {
    if (isQuotedPosition(value, index)) {
      continue
    }
    const char = value[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth = Math.max(0, depth - 1)
    } else if (char === ',' && depth === 0) {
      return index
    }
  }
  return -1
}

const parseSimplePlaceholderName = (rawExpression: string): string | null => {
  const match = simplePlaceholderPattern.exec(rawExpression.trim())
  if (!match) {
    return null
  }
  return match[1]
}

const parseIcuOffset = (optionsSource: string): { offset: number; startIndex: number } | null => {
  const offsetMatch = /^\s*offset\s*:\s*(-?\d+(?:\.\d+)?)\s*/u.exec(optionsSource)
  if (!offsetMatch) {
    return { offset: 0, startIndex: 0 }
  }
  const offsetValue = Number.parseFloat(offsetMatch[1])
  if (!Number.isFinite(offsetValue)) {
    return null
  }
  return { offset: offsetValue, startIndex: offsetMatch[0].length }
}

const collectIcuOptionMessages = (
  optionsSource: string,
  allowOffset: boolean
): ReadonlyArray<string> | null => {
  const offsetResult = allowOffset ? parseIcuOffset(optionsSource) : { offset: 0, startIndex: 0 }
  if (!offsetResult) {
    return null
  }

  const messages: string[] = []
  let index = offsetResult.startIndex

  while (index < optionsSource.length) {
    while (index < optionsSource.length && /\s/u.test(optionsSource[index])) {
      index += 1
    }
    if (index >= optionsSource.length) {
      break
    }

    const selectorStart = index
    while (index < optionsSource.length && !/\s|\{/u.test(optionsSource[index])) {
      index += 1
    }
    const selector = optionsSource.slice(selectorStart, index).trim()
    if (selector.length === 0) {
      return null
    }

    while (index < optionsSource.length && /\s/u.test(optionsSource[index])) {
      index += 1
    }
    if (optionsSource[index] !== '{') {
      return null
    }

    const blockStart = index
    const blockEnd = findMatchingBrace(optionsSource, blockStart)
    if (blockEnd < 0) {
      return null
    }

    messages.push(optionsSource.slice(blockStart + 1, blockEnd))
    index = blockEnd + 1
  }

  return messages.length > 0 ? messages : null
}

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

const collectPlaceholderTokensFromTemplate = (value: string, result: Set<string>): void => {
  let index = 0

  while (index < value.length) {
    const char = value[index]
    if (char !== '{' || isQuotedPosition(value, index)) {
      index += 1
      continue
    }

    const blockEnd = findMatchingBrace(value, index)
    if (blockEnd < 0) {
      index += 1
      continue
    }

    const rawExpression = value.slice(index + 1, blockEnd)
    const firstCommaIndex = findTopLevelComma(rawExpression, 0)

    if (firstCommaIndex < 0) {
      const placeholderName = parseSimplePlaceholderName(rawExpression)
      if (placeholderName) {
        result.add(placeholderName)
      }
      index = blockEnd + 1
      continue
    }

    const secondCommaIndex = findTopLevelComma(rawExpression, firstCommaIndex + 1)
    const variableName = rawExpression.slice(0, firstCommaIndex).trim()
    if (variableName.length === 0) {
      index = blockEnd + 1
      continue
    }

    const expressionType =
      secondCommaIndex < 0
        ? rawExpression.slice(firstCommaIndex + 1).trim()
        : rawExpression.slice(firstCommaIndex + 1, secondCommaIndex).trim()

    if (expressionType === 'number' || expressionType === 'date' || expressionType === 'time') {
      result.add(variableName)
      index = blockEnd + 1
      continue
    }

    if (secondCommaIndex < 0) {
      index = blockEnd + 1
      continue
    }

    const optionsSource = rawExpression.slice(secondCommaIndex + 1).trim()

    if (
      optionsSource.length === 0 ||
      (expressionType !== 'plural' &&
        expressionType !== 'select' &&
        expressionType !== 'selectordinal')
    ) {
      index = blockEnd + 1
      continue
    }

    result.add(variableName)
    const messages = collectIcuOptionMessages(optionsSource, expressionType !== 'select')
    if (messages) {
      messages.forEach((message) => {
        collectPlaceholderTokensFromTemplate(message, result)
      })
    }

    index = blockEnd + 1
  }
}

const collectPlaceholderTokens = (value: string): ReadonlySet<string> => {
  const result = new Set<string>()
  collectPlaceholderTokensFromTemplate(value, result)
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

const validateCategory = <TLanguage extends string>(
  entry: TranslationIrEntry<TLanguage>,
  entryIndex: number,
  locationResolver?: (entryIndex: number) => string
): void => {
  const location = toEntryLocation(entryIndex, locationResolver)
  if (entry.category === undefined) {
    return
  }

  const normalized = entry.category.trim()
  if (normalized.length === 0) {
    throw new Error(`Category must be non-empty at ${location}.`)
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
      validateCategory(entry, entryIndex, options.entryLocation)
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
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
