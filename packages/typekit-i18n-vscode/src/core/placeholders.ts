const placeholderExpression = /\{([a-zA-Z0-9_]+)(?:[|,][^}]*)?\}/g

/**
 * Extracts placeholder names from translation template strings.
 *
 * @param value Translation message template.
 * @returns Sorted unique placeholder names.
 */
export const extractPlaceholderNames = (value: string): readonly string[] => {
  const names = new Set<string>()
  let match: RegExpExecArray | null = placeholderExpression.exec(value)
  while (match !== null) {
    names.add(match[1])
    match = placeholderExpression.exec(value)
  }
  return [...names].sort((left, right) => left.localeCompare(right))
}
