import { describe, expect, test } from 'vitest'
import { parseCsvContent, parseCsvHeaders } from '../../src/codegen/csv.js'

describe('parseCsvContent', () => {
  test('parses semicolon-delimited rows with headers', async () => {
    const content = `key;description;en;de
welcome;Welcome message; Hello ; Hallo
`

    const rows = await parseCsvContent(content)

    expect(rows).toEqual([
      {
        key: 'welcome',
        description: 'Welcome message',
        en: 'Hello',
        de: 'Hallo',
      },
    ])
  })

  test('parses comma-delimited rows with headers', async () => {
    const content = `key,description,en,de
welcome,Welcome message, Hello , Hallo
`

    const rows = await parseCsvContent(content)

    expect(rows).toEqual([
      {
        key: 'welcome',
        description: 'Welcome message',
        en: 'Hello',
        de: 'Hallo',
      },
    ])
  })

  test('throws when one row has fewer columns than header', async () => {
    const content = `key,description,en,de
welcome,Welcome message,Hello,Hallo
bye,Bye message,Goodbye
`

    await expect(parseCsvContent(content)).rejects.toThrow(
      /Invalid column count at row 3: expected 4, got 3\./
    )
  })

  test('parses header names', async () => {
    const content = `key,description,en,de
welcome,Welcome message,Hello,Hallo
`

    const headers = await parseCsvHeaders(content)
    expect(headers).toEqual(['key', 'description', 'en', 'de'])
  })
})
