import { describe, expect, test } from 'vitest'
import { parseCsvContent } from '../../src/codegen/csv.js'

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
})
