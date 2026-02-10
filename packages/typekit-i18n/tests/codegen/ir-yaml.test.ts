import { describe, expect, test } from 'vitest'
import { toIrProjectFromYamlContent } from '../../src/codegen/ir/yaml.js'

describe('toIrProjectFromYamlContent', () => {
  test('parses valid YAML document into IR', () => {
    const content = `version: "1"
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: greeting
    description: Greeting text
    status: approved
    tags: [ui, home]
    placeholders:
      - name: name
        type: string
        formatHint: plain
    values:
      en: "Hello {name}"
      de: "Hallo {name}"
`

    const project = toIrProjectFromYamlContent(content)
    expect(project).toEqual({
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'greeting',
          description: 'Greeting text',
          status: 'approved',
          tags: ['ui', 'home'],
          placeholders: [{ name: 'name', type: 'string', formatHint: 'plain' }],
          values: {
            en: 'Hello {name}',
            de: 'Hallo {name}',
          },
        },
      ],
    })
  })

  test('throws when status is invalid', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: greeting
    description: Greeting text
    status: invalid
    values:
      en: Hello
      de: Hallo
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(/Invalid status "invalid"/)
  })

  test('throws when source language is missing from languages', () => {
    const content = `version: "1"
sourceLanguage: fr
languages: [en, de]
entries: []
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(
      /Source language "fr" is not part of "root.languages"/
    )
  })

  test('throws when key is duplicated', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: greeting
    description: First
    values:
      en: Hello
      de: Hallo
  - key: greeting
    description: Second
    values:
      en: Hi
      de: Hi
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(
      /Duplicate key "greeting" at "root.entries\[1\]"/
    )
  })
})
