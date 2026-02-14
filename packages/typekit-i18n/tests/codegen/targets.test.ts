import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { generateTranslations, resolveCodegenTargets } from '../../src/codegen/generate.js'
import { TypekitI18nConfig } from '../../src/codegen/types.js'

const tempDirectories: string[] = []

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'typekit-i18n-targets-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('resolveCodegenTargets', () => {
  test('returns ts by default when no explicit targets are provided', () => {
    expect(resolveCodegenTargets()).toEqual(['ts'])
  })

  test('deduplicates repeated targets while preserving order', () => {
    expect(resolveCodegenTargets(['ts', 'ts'])).toEqual(['ts'])
  })

  test('throws for unsupported targets', () => {
    expect(() => resolveCodegenTargets(['swift'])).toThrow(
      /Unsupported generation target\(s\): swift/
    )
  })
})

describe('generateTranslations', () => {
  test('generates artifacts for explicit ts target', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputPath = join(directory, 'translationTable.ts')
    const outputKeysPath = join(directory, 'translationKeys.ts')
    const outputContractPath = join(directory, 'translation.contract.json')

    await writeFile(
      csvPath,
      `key;description;en;de
title;Main title;Welcome;Willkommen
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [csvPath],
      output: outputPath,
      outputKeys: outputKeysPath,
      outputContract: outputContractPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    const result = await generateTranslations(config, {
      targets: ['ts'],
    })

    expect(result.targets).toEqual(['ts'])
    expect(result.keyCount).toBe(1)
    expect(result.outputContractPath).toBe(outputContractPath)
    expect(result.targetResults).toEqual([
      {
        target: 'ts',
        outputPaths: [outputPath, outputKeysPath],
      },
    ])

    const contractSource = await readFile(outputContractPath, 'utf-8')
    expect(contractSource).toContain('"schemaVersion": "1"')
    expect(contractSource).toContain('"key": "title"')
  })
})
