import { describe, expect, test } from 'vitest'
import { isQuotedPosition, unescapeIcuText } from '../../src/runtime/icuEscape.js'

describe('unescapeIcuText', () => {
  test('handles double apostrophes as literal apostrophe', () => {
    expect(unescapeIcuText("It''s working")).toBe("It's working")
    expect(unescapeIcuText("Don''t panic")).toBe("Don't panic")
  })

  test('removes single apostrophes used for quoting', () => {
    expect(unescapeIcuText("Use '{braces}' for literals")).toBe('Use {braces} for literals')
    expect(unescapeIcuText("The '#' symbol")).toBe('The # symbol')
  })

  test('handles mixed apostrophe usage', () => {
    expect(unescapeIcuText("It''s a '{test}' case")).toBe("It's a {test} case")
  })

  test('handles text without apostrophes', () => {
    expect(unescapeIcuText('Hello world')).toBe('Hello world')
    expect(unescapeIcuText('No special chars')).toBe('No special chars')
  })

  test('handles empty and edge cases', () => {
    expect(unescapeIcuText('')).toBe('')
    expect(unescapeIcuText("''")).toBe("'")
    expect(unescapeIcuText("''''")).toBe("''")
  })
})

describe('isQuotedPosition', () => {
  test('detects unquoted positions', () => {
    const text = 'Hello {name}'
    expect(isQuotedPosition(text, 0)).toBe(false)
    expect(isQuotedPosition(text, 6)).toBe(false)
    expect(isQuotedPosition(text, 7)).toBe(false)
  })

  test('detects quoted positions', () => {
    const text = "Use '{name}' here"
    expect(isQuotedPosition(text, 4)).toBe(false) // Opening ' delimiter
    expect(isQuotedPosition(text, 5)).toBe(true) // Inside quoted: {
    expect(isQuotedPosition(text, 6)).toBe(true) // Inside quoted: n
    expect(isQuotedPosition(text, 10)).toBe(true) // Inside quoted: }
    expect(isQuotedPosition(text, 11)).toBe(false) // Closing ' delimiter
    expect(isQuotedPosition(text, 12)).toBe(false) // After closing '
  })

  test('handles double apostrophes correctly', () => {
    const text = "It''s '{test}'"
    // It''s => It's (positions 0,1,2=I,t,', 3=', 4=s, 5=space)
    // Then 6=', 7={, 8-11=test, 12=}, 13=')
    expect(isQuotedPosition(text, 0)).toBe(false) // I
    expect(isQuotedPosition(text, 2)).toBe(false) // First ' of ''
    expect(isQuotedPosition(text, 6)).toBe(false) // Opening ' (quote delimiter itself)
    expect(isQuotedPosition(text, 7)).toBe(true) // { (first char after opening ')
    expect(isQuotedPosition(text, 12)).toBe(true) // } (last char before closing ')
    expect(isQuotedPosition(text, 13)).toBe(false) // Closing ' (quote delimiter itself)
    expect(isQuotedPosition(text, 14)).toBe(false) // After closing '
  })

  test('handles nested and complex quoting', () => {
    const text = "Start 'quoted {brace}' end"
    // Positions: 0-4=Start, 5=space, 6=', 7=q, ..., 20=}, 21=', 22=space
    expect(isQuotedPosition(text, 6)).toBe(false) // Opening ' delimiter
    expect(isQuotedPosition(text, 7)).toBe(true) // First char after opening '
    expect(isQuotedPosition(text, 14)).toBe(true) // Inside quoted: {
    expect(isQuotedPosition(text, 21)).toBe(false) // Closing ' delimiter
    expect(isQuotedPosition(text, 22)).toBe(false) // After closing '
  })
})
