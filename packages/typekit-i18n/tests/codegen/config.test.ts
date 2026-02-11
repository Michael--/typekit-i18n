import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { loadTypekitI18nConfig } from '../../src/codegen/config.js'

const tempDirectories: string[] = []

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'typekit-i18n-config-'))
  tempDirectories.push(directory)
  return directory
}

const withWorkingDirectory = async <T>(directory: string, run: () => Promise<T>): Promise<T> => {
  const previousWorkingDirectory = process.cwd()
  process.chdir(directory)
  try {
    return await run()
  } finally {
    process.chdir(previousWorkingDirectory)
  }
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('loadTypekitI18nConfig', () => {
  test('loads JSON config from explicit path', async () => {
    const directory = await createTempDirectory()
    const configPath = join(directory, 'typekit.config.json')
    await writeFile(
      configPath,
      JSON.stringify(
        {
          input: ['./translations/*.csv'],
          output: './generated/translationTable.ts',
          outputKeys: './generated/translationKeys.ts',
          languages: ['en', 'de'],
          defaultLanguage: 'en',
        },
        null,
        2
      ),
      'utf-8'
    )

    const loaded = await loadTypekitI18nConfig<'en' | 'de'>(configPath)
    expect(loaded).not.toBeNull()
    expect(loaded?.config.output).toBe('./generated/translationTable.ts')
    expect(loaded?.config.defaultLanguage).toBe('en')
  })

  test('loads YAML config from explicit path', async () => {
    const directory = await createTempDirectory()
    const configPath = join(directory, 'typekit.config.yaml')
    await writeFile(
      configPath,
      `input:
  - ./translations/*.yaml
format: yaml
output: ./generated/translationTable.ts
outputKeys: ./generated/translationKeys.ts
languages:
  - en
  - de
defaultLanguage: en
`,
      'utf-8'
    )

    const loaded = await loadTypekitI18nConfig<'en' | 'de'>(configPath)
    expect(loaded).not.toBeNull()
    expect(loaded?.config.format).toBe('yaml')
    expect(loaded?.config.input).toEqual(['./translations/*.yaml'])
  })

  test('auto-discovers modern config filename before legacy filename', async () => {
    const directory = await createTempDirectory()
    await writeFile(
      join(directory, 'typekit.config.yaml'),
      `input: ./translations/modern.csv
output: ./generated/modern.ts
languages: [en, de]
defaultLanguage: en
`,
      'utf-8'
    )
    await writeFile(
      join(directory, 'typekit-i18n.config.yaml'),
      `input: ./translations/legacy.csv
output: ./generated/legacy.ts
languages: [en, de]
defaultLanguage: en
`,
      'utf-8'
    )

    const loaded = await withWorkingDirectory(directory, () => loadTypekitI18nConfig<'en' | 'de'>())
    expect(loaded).not.toBeNull()
    expect(loaded?.configPath.endsWith('/typekit.config.yaml')).toBe(true)
    expect(loaded?.config.output).toBe('./generated/modern.ts')
  })

  test('auto-discovers legacy config filename when modern filename is missing', async () => {
    const directory = await createTempDirectory()
    await writeFile(
      join(directory, 'typekit-i18n.config.json'),
      JSON.stringify(
        {
          input: ['./translations/*.csv'],
          output: './generated/legacy.ts',
          languages: ['en', 'de'],
          defaultLanguage: 'en',
        },
        null,
        2
      ),
      'utf-8'
    )

    const loaded = await withWorkingDirectory(directory, () => loadTypekitI18nConfig<'en' | 'de'>())
    expect(loaded).not.toBeNull()
    expect(loaded?.configPath.endsWith('/typekit-i18n.config.json')).toBe(true)
    expect(loaded?.config.output).toBe('./generated/legacy.ts')
  })
})
