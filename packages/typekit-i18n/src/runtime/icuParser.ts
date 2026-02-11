import { isQuotedPosition } from './icuEscape.js'

/**
 * Parsed ICU expression structure.
 */
export interface ParsedIcuExpression {
  variableName: string
  expressionType: 'plural' | 'select' | 'selectordinal'
  optionsSource: string
}

/**
 * Parsed ICU options with optional offset.
 */
export interface ParsedIcuOptions {
  options: ReadonlyMap<string, string>
  offset: number
}

/**
 * Finds the matching closing brace for an opening brace, respecting quoted sections.
 *
 * @param value Text to search in.
 * @param startIndex Index of the opening brace.
 * @returns Index of matching closing brace or -1 if not found.
 */
export const findMatchingBrace = (value: string, startIndex: number): number => {
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

/**
 * Finds the next top-level comma (not inside braces or quotes).
 *
 * @param value Text to search in.
 * @param startIndex Starting position.
 * @returns Index of next top-level comma or -1 if not found.
 */
export const findTopLevelComma = (value: string, startIndex: number): number => {
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

/**
 * Parses an ICU expression into structured components.
 *
 * @param rawExpression Expression string without outer braces.
 * @returns Parsed expression or null if invalid.
 */
export const parseIcuExpression = (rawExpression: string): ParsedIcuExpression | null => {
  const firstCommaIndex = findTopLevelComma(rawExpression, 0)
  if (firstCommaIndex < 0) {
    return null
  }
  const secondCommaIndex = findTopLevelComma(rawExpression, firstCommaIndex + 1)
  if (secondCommaIndex < 0) {
    return null
  }

  const variableName = rawExpression.slice(0, firstCommaIndex).trim()
  const expressionTypeRaw = rawExpression.slice(firstCommaIndex + 1, secondCommaIndex).trim()
  const optionsSource = rawExpression.slice(secondCommaIndex + 1).trim()

  if (variableName.length === 0 || optionsSource.length === 0) {
    return null
  }
  if (
    expressionTypeRaw !== 'plural' &&
    expressionTypeRaw !== 'select' &&
    expressionTypeRaw !== 'selectordinal'
  ) {
    return null
  }

  return {
    variableName,
    expressionType: expressionTypeRaw,
    optionsSource,
  }
}

/**
 * Parses optional offset directive from ICU plural options.
 *
 * @param optionsSource Options string that may start with offset.
 * @returns Offset value and starting index for options parsing.
 */
export const parseIcuOffset = (
  optionsSource: string
): { offset: number; startIndex: number } | null => {
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

/**
 * Parses ICU options map from selector-message pairs.
 *
 * @param optionsSource Options string with selectors and messages.
 * @param allowOffset Whether to parse offset directive.
 * @returns Parsed options with offset or null if invalid.
 */
export const parseIcuOptions = (
  optionsSource: string,
  allowOffset: boolean
): ParsedIcuOptions | null => {
  const options = new Map<string, string>()
  const offsetResult = allowOffset ? parseIcuOffset(optionsSource) : { offset: 0, startIndex: 0 }
  if (!offsetResult) {
    return null
  }

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

    const message = optionsSource.slice(blockStart + 1, blockEnd)
    options.set(selector, message)
    index = blockEnd + 1
  }

  return options.size > 0 ? { options, offset: offsetResult.offset } : null
}
