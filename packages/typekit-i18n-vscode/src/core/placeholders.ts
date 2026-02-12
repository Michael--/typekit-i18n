const simplePlaceholderPattern = /^([A-Za-z0-9_]+)(?:\|[A-Za-z0-9_-]+)?$/u

const isQuotedPosition = (text: string, position: number): boolean => {
  let inQuoted = false

  for (let index = 0; index <= position && index < text.length; index += 1) {
    const character = text[index]
    if (character !== "'") {
      continue
    }

    const nextCharacter = text[index + 1]
    if (nextCharacter === "'") {
      index += 1
      continue
    }
    if (index === position) {
      return false
    }
    inQuoted = !inQuoted
  }

  return inQuoted
}

const findMatchingBrace = (value: string, startIndex: number): number => {
  let depth = 0
  for (let index = startIndex; index < value.length; index += 1) {
    if (isQuotedPosition(value, index)) {
      continue
    }

    const character = value[index]
    if (character === '{') {
      depth += 1
      continue
    }
    if (character === '}') {
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

    const character = value[index]
    if (character === '{') {
      depth += 1
      continue
    }
    if (character === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }
    if (character === ',' && depth === 0) {
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
): readonly string[] | null => {
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

const collectPlaceholderTokensFromTemplate = (value: string, result: Set<string>): void => {
  let index = 0
  while (index < value.length) {
    const character = value[index]
    if (character !== '{' || isQuotedPosition(value, index)) {
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

/**
 * Extracts placeholder names from translation template strings.
 *
 * Supports simple templates and ICU message syntax while ignoring quoted ICU literals.
 *
 * @param value Translation message template.
 * @returns Sorted unique placeholder names.
 */
export const extractPlaceholderNames = (value: string): readonly string[] => {
  const names = new Set<string>()
  collectPlaceholderTokensFromTemplate(value, names)
  return [...names].sort((left, right) => left.localeCompare(right))
}
