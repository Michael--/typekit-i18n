import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import {
  parseTranslationContractContent,
  validateTranslationContract,
} from '../../src/codegen/contract.js'
import { generateTranslationTable } from '../../src/codegen/generate.js'
import { TypekitI18nConfig } from '../../src/codegen/types.js'

const tempDirectories: string[] = []

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'typekit-i18n-contract-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('translation contract schema', () => {
  test('parses generated contract content', async () => {
    const directory = await createTempDirectory()
    const yamlPath = join(directory, 'translations.yaml')
    const outputPath = join(directory, 'translationTable.ts')
    const outputContractPath = join(directory, 'translation.contract.json')

    await writeFile(
      yamlPath,
      `version: "1"
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: checkout_total
    category: checkout
    description: Total label
    status: approved
    tags: [billing]
    placeholders:
      - name: amount
        type: number
        formatHint: currency/EUR
    values:
      en: "Total {amount, number, currency/EUR}"
      de: "Summe {amount, number, currency/EUR}"
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [yamlPath],
      output: outputPath,
      outputContract: outputContractPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
      localeByLanguage: {
        en: 'en-US',
        de: 'de-DE',
      },
    }

    await generateTranslationTable(config)
    const content = await readFile(outputContractPath, 'utf-8')
    const contract = parseTranslationContractContent(content)

    expect(contract.schemaVersion).toBe('1')
    expect(contract.sourceLanguage).toBe('en')
    expect(contract.languages).toEqual(['en', 'de'])
    expect(contract.localeByLanguage).toEqual({
      en: 'en-US',
      de: 'de-DE',
    })
    expect(contract.entries).toEqual([
      {
        category: 'checkout',
        key: 'checkout_total',
        description: 'Total label',
        status: 'approved',
        tags: ['billing'],
        placeholders: [
          {
            name: 'amount',
            type: 'number',
            formatHint: 'currency/EUR',
          },
        ],
        values: {
          en: 'Total {amount, number, currency/EUR}',
          de: 'Summe {amount, number, currency/EUR}',
        },
      },
    ])
  })

  test('rejects contracts with invalid schema version', () => {
    expect(() =>
      validateTranslationContract({
        schemaVersion: '2',
        sourceLanguage: 'en',
        languages: ['en'],
        localeByLanguage: {},
        entries: [],
      })
    ).toThrow(/schemaVersion/)
  })

  test('rejects contracts when entry values are missing a declared language', () => {
    expect(() =>
      validateTranslationContract({
        schemaVersion: '1',
        sourceLanguage: 'en',
        languages: ['en', 'de'],
        localeByLanguage: {},
        entries: [
          {
            category: 'default',
            key: 'title',
            description: 'Main title',
            values: {
              en: 'Welcome',
            },
          },
        ],
      })
    ).toThrow(/entries\[0\]\.values\.de/)
  })
})
