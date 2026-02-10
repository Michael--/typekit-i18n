import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { generateTranslationTable } from '../../src/codegen/generate.js'
import { TypekitI18nConfig } from '../../src/codegen/types.js'

const tempDirectories: string[] = []

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'typekit-i18n-codegen-'))
  tempDirectories.push(directory)
  return directory
}

const normalizeTempPath = (value: string, directory: string): string =>
  value.split(directory).join('<TEMP_DIR>')

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('generateTranslationTable', () => {
  test('generates deterministic output for multiple input files', async () => {
    const directory = await createTempDirectory()
    const aCsvPath = join(directory, 'a.csv')
    const bCsvPath = join(directory, 'b.csv')
    const outputTablePath = join(directory, 'translationTable.ts')
    const outputKeysPath = join(directory, 'translationKeys.ts')

    await writeFile(
      bCsvPath,
      `key;description;en;de
b_key;Text B;B english;B deutsch
`,
      'utf-8'
    )
    await writeFile(
      aCsvPath,
      `key;description;en;de
a_key;Text A;A english;A deutsch
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [bCsvPath, aCsvPath],
      output: outputTablePath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await generateTranslationTable(config)
    const tableSource = await readFile(outputTablePath, 'utf-8')
    const keysSource = await readFile(outputKeysPath, 'utf-8')
    const normalizedTableSource = normalizeTempPath(tableSource, directory)
    const normalizedKeysSource = normalizeTempPath(keysSource, directory)

    expect(normalizedTableSource).toMatchInlineSnapshot(`
      "/*
         This file is generated.
         Source files:
         [1/2] "<TEMP_DIR>/a.csv"
         [2/2] "<TEMP_DIR>/b.csv"
      */
      // cspell:disable

      export const translationTable = {
        "a_key": {
          description: "Text A",
          en: "A english",
          de: "A deutsch",
        },
        "b_key": {
          description: "Text B",
          en: "B english",
          de: "B deutsch",
        },
      } as const

      export type { TranslateKey, TranslateKeys, TranslateLanguage } from "./translationKeys.js"
      "
    `)

    expect(normalizedKeysSource).toMatchInlineSnapshot(`
      "/*
         This file is generated.
         Source files:
         [1/2] "<TEMP_DIR>/a.csv"
         [2/2] "<TEMP_DIR>/b.csv"
      */
      // cspell:disable

      export type TranslateKey = "a_key" | "b_key"
      export type TranslateKeys = TranslateKey
      export type TranslateLanguage = "en" | "de"
      "
    `)
  })

  test('throws when duplicate keys exist across files', async () => {
    const directory = await createTempDirectory()
    const firstCsvPath = join(directory, 'first.csv')
    const secondCsvPath = join(directory, 'second.csv')
    const outputTablePath = join(directory, 'translationTable.ts')

    await writeFile(
      firstCsvPath,
      `key;description;en;de
same_key;First row;First EN;First DE
`,
      'utf-8'
    )
    await writeFile(
      secondCsvPath,
      `key;description;en;de
same_key;Second row;Second EN;Second DE
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [firstCsvPath, secondCsvPath],
      output: outputTablePath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await expect(generateTranslationTable(config)).rejects.toThrow(
      /Duplicate key "same_key" found in .*second\.csv at row 2\./
    )
  })

  test('throws when default language value is empty', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputTablePath = join(directory, 'translationTable.ts')

    await writeFile(
      csvPath,
      `key;description;en;de
empty_default;Default is empty;;Nicht leer
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [csvPath],
      output: outputTablePath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await expect(generateTranslationTable(config)).rejects.toThrow(
      /Missing value for default language "en" in .*translations\.csv at row 2\./
    )
  })

  test('throws when output and outputKeys target the same file', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputPath = join(directory, 'translations.generated.ts')

    await writeFile(
      csvPath,
      `key;description;en;de
one;Only row;One;Eins
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [csvPath],
      output: outputPath,
      outputKeys: outputPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await expect(generateTranslationTable(config)).rejects.toThrow(
      /"output" and "outputKeys" must not point to the same file/
    )
  })

  test('generates deterministic output from YAML resources', async () => {
    const directory = await createTempDirectory()
    const yamlPath = join(directory, 'translations.yaml')
    const outputTablePath = join(directory, 'translationTable.ts')
    const outputKeysPath = join(directory, 'translationKeys.ts')

    await writeFile(
      yamlPath,
      `version: "1"
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: title
    description: Main title
    values:
      en: Welcome
      de: Willkommen
  - key: subtitle
    description: Main subtitle
    values:
      en: Hello world
      de: Hallo Welt
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [yamlPath],
      format: 'yaml',
      output: outputTablePath,
      outputKeys: outputKeysPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await generateTranslationTable(config)
    const tableSource = await readFile(outputTablePath, 'utf-8')
    const keysSource = await readFile(outputKeysPath, 'utf-8')
    const normalizedTableSource = normalizeTempPath(tableSource, directory)
    const normalizedKeysSource = normalizeTempPath(keysSource, directory)

    expect(normalizedTableSource).toMatchInlineSnapshot(`
      "/*
         This file is generated.
         Source files:
         [1/1] "<TEMP_DIR>/translations.yaml"
      */
      // cspell:disable

      export const translationTable = {
        "title": {
          description: "Main title",
          en: "Welcome",
          de: "Willkommen",
        },
        "subtitle": {
          description: "Main subtitle",
          en: "Hello world",
          de: "Hallo Welt",
        },
      } as const

      export type { TranslateKey, TranslateKeys, TranslateLanguage } from "./translationKeys.js"
      "
    `)

    expect(normalizedKeysSource).toMatchInlineSnapshot(`
      "/*
         This file is generated.
         Source files:
         [1/1] "<TEMP_DIR>/translations.yaml"
      */
      // cspell:disable

      export type TranslateKey = "title" | "subtitle"
      export type TranslateKeys = TranslateKey
      export type TranslateLanguage = "en" | "de"
      "
    `)
  })
})
