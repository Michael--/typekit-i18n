import { describe, expect, test } from 'vitest'
import { TranslationIrProject } from '../../src/codegen/ir/types.js'
import {
  toIrProjectFromYamlContent,
  toYamlContentFromIrProject,
} from '../../src/codegen/ir/yaml.js'

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

  test('throws when placeholder tokens are inconsistent across languages', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: item_count
    description: Summary line
    placeholders:
      - name: count
        type: number
    values:
      en: "You currently have {count} items."
      de: "Du hast aktuell Elemente."
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(
      /Missing placeholder\(s\) "\{count\}" in language "de" at root.entries\[0\]\./
    )
  })

  test('ignores ICU-quoted literal braces in placeholder token checks', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: escaped_braces
    description: ICU escaped braces demo
    placeholders:
      - name: name
        type: string
    values:
      en: "Hello {name}, use '{braces}' for literals."
      de: "Hallo {name}, nutze '{geschweifte Klammern}' fuer literale Klammern."
`

    const project = toIrProjectFromYamlContent(content)
    expect(project.entries[0].values.en).toContain("'{braces}'")
    expect(project.entries[0].values.de).toContain("'{geschweifte Klammern}'")
  })

  test('validates ICU expression variables as placeholder tokens', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: inbox_count
    description: ICU plural count
    placeholders:
      - name: count
        type: number
    values:
      en: "{count, plural, one {# message} other {# messages}}"
      de: "Postfach."
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(
      /Missing placeholder\(s\) "\{count\}" in language "de" at root.entries\[0\]\./
    )
  })

  test('validates formatter placeholders in token consistency checks', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: total
    description: Formatter placeholder
    placeholders:
      - name: amount
        type: number
        formatHint: currency
    values:
      en: "Total: {amount|currency}"
      de: "Summe."
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(
      /Missing placeholder\(s\) "\{amount\}" in language "de" at root.entries\[0\]\./
    )
  })

  test('validates ICU number/date/time argument variables in token consistency checks', () => {
    const content = `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: argument_formats
    description: ICU argument format demo
    placeholders:
      - name: amount
        type: number
      - name: when
        type: date
    values:
      en: "Amount: {amount, number, ::currency/EUR}; Date: {when, date, short}"
      de: "Betrag."
`

    expect(() => toIrProjectFromYamlContent(content)).toThrow(
      /Missing placeholder\(s\) "\{amount\}", "\{when\}" in language "de" at root.entries\[0\]\./
    )
  })

  test('roundtrips IR through YAML content', () => {
    const project: TranslationIrProject<'en' | 'de'> = {
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'item_count',
          description: 'Summary line with count placeholder',
          status: 'approved',
          tags: ['ui', 'summary'],
          placeholders: [{ name: 'count', type: 'number', formatHint: 'integer' }],
          values: {
            en: 'You currently have {count} items.',
            de: 'Du hast aktuell {count} Eintraege.',
          },
        },
      ],
    }

    const content = toYamlContentFromIrProject(project)
    const parsed = toIrProjectFromYamlContent(content)
    expect(parsed).toEqual(project)
  })

  test('omits optional metadata fields when empty', () => {
    const project: TranslationIrProject<'en' | 'de'> = {
      version: '1',
      sourceLanguage: 'en',
      languages: ['en', 'de'],
      entries: [
        {
          key: 'title',
          description: 'Simple title',
          values: {
            en: 'Title',
            de: 'Titel',
          },
        },
      ],
    }

    const content = toYamlContentFromIrProject(project)
    expect(content).not.toContain('status:')
    expect(content).not.toContain('tags:')
    expect(content).not.toContain('placeholders:')
  })
})
