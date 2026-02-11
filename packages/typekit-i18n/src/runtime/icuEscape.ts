/**
 * Handles ICU MessageFormat apostrophe escaping per ICU specification.
 *
 * Rules:
 * - Single apostrophe `'` quotes the next special character
 * - Double apostrophe `''` becomes a single literal apostrophe
 * - Quoted text (between apostrophes) treats special chars as literals
 * - Special characters: `{`, `}`, `#`
 */

/**
 * Unescapes an ICU message fragment according to ICU apostrophe rules.
 *
 * @param text Raw text with potential apostrophe escaping.
 * @returns Unescaped text with apostrophes processed.
 */
export const unescapeIcuText = (text: string): string => {
  let output = ''
  let index = 0
  let inQuoted = false

  while (index < text.length) {
    const char = text[index]

    if (char === "'") {
      const nextChar = text[index + 1]

      // Double apostrophe: '' → '
      if (nextChar === "'") {
        output += "'"
        index += 2
        continue
      }

      // Single apostrophe toggles quoted mode
      inQuoted = !inQuoted
      index += 1
      continue
    }

    output += char
    index += 1
  }

  return output
}

/**
 * Checks if a character position is inside a quoted section.
 *
 * @param text Text to analyze.
 * @param position Character position to check.
 * @returns True if the position is inside quoted text.
 */
export const isQuotedPosition = (text: string, position: number): boolean => {
  let inQuoted = false

  for (let index = 0; index <= position && index < text.length; index += 1) {
    const char = text[index]
    if (char === "'") {
      const nextChar = text[index + 1]
      if (nextChar === "'") {
        index += 1 // Skip double apostrophe
        continue
      }
      // Single apostrophe delimiter: never "inside" quoted text
      if (index === position) {
        return false
      }
      inQuoted = !inQuoted
    }
  }

  return inQuoted
}
