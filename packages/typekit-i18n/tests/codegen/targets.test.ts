import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
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

  test('accepts supported swift target', () => {
    expect(resolveCodegenTargets(['swift'])).toEqual(['swift'])
  })

  test('throws for unsupported targets', () => {
    expect(() => resolveCodegenTargets(['kotlin'])).toThrow(
      /Unsupported generation target\(s\): kotlin/
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

  test('generates swift target artifact', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputPath = join(directory, 'translationTable.ts')
    const outputSwiftPath = join(directory, 'translation.swift')

    await writeFile(
      csvPath,
      `key;description;en;de
checkout.total;Total label;Total;Summe
`,
      'utf-8'
    )

    const config: TypekitI18nConfig<'en' | 'de'> = {
      input: [csvPath],
      output: outputPath,
      outputSwift: outputSwiftPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
      localeByLanguage: {
        en: 'en-US',
        de: 'de-DE',
      },
    }

    const result = await generateTranslations(config, {
      targets: ['swift'],
    })
    expect(result.targets).toEqual(['swift'])
    expect(result.targetResults).toEqual([
      {
        target: 'swift',
        outputPaths: [outputSwiftPath],
      },
    ])

    const swiftSource = await readFile(outputSwiftPath, 'utf-8')
    expect(swiftSource).toContain('public enum TranslationLanguage')
    expect(swiftSource).toContain('public enum TranslationKey')
    expect(swiftSource).toContain('public final class TypekitTranslator')
    expect(swiftSource).toContain('checkout.total')
    expect(swiftSource).toContain('JavaScriptCoreTranslationRuntimeBridge')
  })

  test('throws when outputSwift collides with output', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputPath = join(directory, 'translationTable.ts')

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
      outputSwift: outputPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await expect(generateTranslations(config, { targets: ['swift'] })).rejects.toThrow(
      /"outputSwift" must not point to the same file as "output" or "outputKeys"/
    )
  })

  test.runIf(spawnSync('swiftc', ['--version'], { stdio: 'ignore' }).status === 0)(
    'swift target compiles in a consumer smoke project',
    async () => {
      const directory = await createTempDirectory()
      const csvPath = join(directory, 'translations.csv')
      const outputPath = join(directory, 'translationTable.ts')
      const outputSwiftPath = join(directory, 'translation.swift')
      const smokePath = join(directory, 'smoke.swift')
      const binaryPath = join(directory, 'smoke')
      const moduleCachePath = join(directory, 'swift-module-cache')
      const clangModuleCachePath = join(directory, 'clang-module-cache')

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
        outputSwift: outputSwiftPath,
        languages: ['en', 'de'],
        defaultLanguage: 'en',
      }

      await generateTranslations(config, { targets: ['swift'] })
      await Promise.all([
        mkdir(moduleCachePath, { recursive: true }),
        mkdir(clangModuleCachePath, { recursive: true }),
      ])

      await writeFile(
        smokePath,
        `import Foundation

@main
struct SmokeApp {
  static func main() throws {
    let bridge = ClosureTranslationRuntimeBridge { key, language, placeholders in
      return "\\(key):\\(language):\\(placeholders.count)"
    }
    let translator = TypekitTranslator(bridge: bridge)
    let value = try translator.translate(
      .title,
      language: .de,
      placeholders: [TranslationPlaceholder(key: "name", value: .string("Ada"))]
    )
    print(value)
  }
}
`,
        'utf-8'
      )

      const compileResult = spawnSync('swiftc', [outputSwiftPath, smokePath, '-o', binaryPath], {
        encoding: 'utf-8',
        env: {
          ...process.env,
          SWIFT_MODULECACHE_PATH: moduleCachePath,
          CLANG_MODULE_CACHE_PATH: clangModuleCachePath,
          HOME: directory,
        },
      })
      if (compileResult.status !== 0) {
        throw new Error(compileResult.stderr || compileResult.stdout)
      }

      const runResult = spawnSync(binaryPath, [], { encoding: 'utf-8' })
      if (runResult.status !== 0) {
        throw new Error(runResult.stderr || runResult.stdout)
      }

      expect(runResult.stdout.trim()).toBe('title:de:1')
    }
  )
})
