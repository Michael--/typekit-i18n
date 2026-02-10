import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { validateTranslationFile, validateYamlTranslationFile } from '../../src/codegen/validate.js'

const tempDirectories: string[] = []

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'typekit-i18n-validate-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('validateYamlTranslationFile', () => {
  test('validates the schema-complete YAML example file', async () => {
    const filePath = resolve('resources/translations/translationTableExample.yaml')
    const project = await validateYamlTranslationFile(filePath)

    expect(project.version).toBe('1')
    expect(project.sourceLanguage).toBe('en')
    expect(project.languages).toEqual(['en', 'de'])
    expect(project.entries.length).toBeGreaterThanOrEqual(6)
  })

  test('throws when placeholder tokens are inconsistent', async () => {
    const directory = await createTempDirectory()
    const yamlPath = join(directory, 'invalid.yaml')
    await writeFile(
      yamlPath,
      `version: "1"
sourceLanguage: en
languages: [en, de]
entries:
  - key: item_count
    description: Summary line
    placeholders:
      - name: count
        type: number
    values:
      en: "You have {count} items."
      de: "Du hast Eintraege."
`,
      'utf-8'
    )

    await expect(validateYamlTranslationFile(yamlPath)).rejects.toThrow(
      /Missing placeholder\(s\) "\{count\}" in language "de"/
    )
  })
})

describe('validateTranslationFile', () => {
  test('throws for CSV input without required language context', async () => {
    await expect(
      validateTranslationFile({
        inputPath: resolve('resources/translations/translationTableCommon.csv'),
        format: 'csv',
      })
    ).rejects.toThrow(/CSV validation requires "languages"/)
  })
})
