import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { generateTranslations, resolveCodegenTargets } from '../../src/codegen/generate.js'
import { TypekitI18nConfig } from '../../src/codegen/types.js'
import { fileURLToPath } from 'node:url'

const tempDirectories: string[] = []
const hasSwiftCompiler = spawnSync('swiftc', ['--version'], { stdio: 'ignore' }).status === 0
const hasKotlinCompiler = spawnSync('kotlinc', ['-version'], { stdio: 'ignore' }).status === 0
const hasJavaCompiler = spawnSync('javac', ['-version'], { stdio: 'ignore' }).status === 0
const hasJavaRuntime = spawnSync('java', ['-version'], { stdio: 'ignore' }).status === 0
const fixturesRootPath = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures')

const findKotlinStdlibPath = (): string | null => {
  const candidates: string[] = []
  const kotlinHome = process.env.KOTLIN_HOME
  if (kotlinHome) {
    candidates.push(join(kotlinHome, 'lib', 'kotlin-stdlib.jar'))
  }

  const whichResult = spawnSync('which', ['kotlinc'], { encoding: 'utf-8' })
  if (whichResult.status === 0) {
    const compilerPath = whichResult.stdout.trim()
    if (compilerPath.length > 0) {
      const binDir = dirname(compilerPath)
      candidates.push(
        join(binDir, '..', 'lib', 'kotlin-stdlib.jar'),
        join(binDir, '..', 'libexec', 'lib', 'kotlin-stdlib.jar'),
        join(binDir, '..', '..', 'lib', 'kotlin-stdlib.jar')
      )
    }
  }

  const resolved = candidates.map((candidate) => resolve(candidate))
  return resolved.find((candidate) => existsSync(candidate)) ?? null
}

const kotlinStdlibPath = hasKotlinCompiler ? findKotlinStdlibPath() : null

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

  test('accepts supported kotlin target', () => {
    expect(resolveCodegenTargets(['kotlin'])).toEqual(['kotlin'])
  })

  test('throws for unsupported targets', () => {
    expect(() => resolveCodegenTargets(['dart'])).toThrow(
      /Unsupported generation target\(s\): dart/
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
    expect(result.runtimeBridgePath).toBe(join(directory, 'translation.runtime.mjs'))
    expect(result.runtimeBridgeBundlePath).toBe(join(directory, 'translation.runtime.bundle.js'))
    expect(result.targetResults).toEqual([
      {
        target: 'swift',
        outputPaths: [outputSwiftPath],
      },
    ])
    expect(result.runtimeBridgePath).toBeDefined()
    if (!result.runtimeBridgePath) {
      throw new Error('Expected runtime bridge output path to be defined for swift target.')
    }
    if (!result.runtimeBridgeBundlePath) {
      throw new Error('Expected runtime bridge bundle output path to be defined for swift target.')
    }

    const swiftSource = await readFile(outputSwiftPath, 'utf-8')
    const runtimeBridgeSource = await readFile(result.runtimeBridgePath, 'utf-8')
    const runtimeBridgeBundleSource = await readFile(result.runtimeBridgeBundlePath, 'utf-8')
    expect(swiftSource).toContain('public enum TranslationLanguage')
    expect(swiftSource).toContain('public enum TranslationKey')
    expect(swiftSource).toContain('public final class TypekitTranslator')
    expect(swiftSource).toContain('checkout.total')
    expect(swiftSource).toContain('JavaScriptCoreTranslationRuntimeBridge')
    expect(runtimeBridgeSource).toContain('createIcuTranslator')
    expect(runtimeBridgeSource).toContain('installTypekitRuntimeBridge')
    expect(runtimeBridgeSource).toContain('__typekitTranslate')
    expect(runtimeBridgeBundleSource).toContain('__typekitTranslate')
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

  test('generates kotlin target artifact', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputPath = join(directory, 'translationTable.ts')
    const outputKotlinPath = join(directory, 'translation.kt')

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
      outputKotlin: outputKotlinPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
      localeByLanguage: {
        en: 'en-US',
        de: 'de-DE',
      },
    }

    const result = await generateTranslations(config, {
      targets: ['kotlin'],
    })
    expect(result.targets).toEqual(['kotlin'])
    expect(result.runtimeBridgePath).toBe(join(directory, 'translation.runtime.mjs'))
    expect(result.runtimeBridgeBundlePath).toBe(join(directory, 'translation.runtime.bundle.js'))
    expect(result.targetResults).toEqual([
      {
        target: 'kotlin',
        outputPaths: [outputKotlinPath],
      },
    ])
    expect(result.runtimeBridgePath).toBeDefined()
    if (!result.runtimeBridgePath) {
      throw new Error('Expected runtime bridge output path to be defined for kotlin target.')
    }
    if (!result.runtimeBridgeBundlePath) {
      throw new Error('Expected runtime bridge bundle output path to be defined for kotlin target.')
    }

    const kotlinSource = await readFile(outputKotlinPath, 'utf-8')
    const runtimeBridgeSource = await readFile(result.runtimeBridgePath, 'utf-8')
    const runtimeBridgeBundleSource = await readFile(result.runtimeBridgeBundlePath, 'utf-8')
    expect(kotlinSource).toContain('enum class TranslationLanguage')
    expect(kotlinSource).toContain('enum class TranslationKey')
    expect(kotlinSource).toContain('class TypekitTranslator')
    expect(kotlinSource).toContain('class NodeTranslationRuntimeBridge')
    expect(kotlinSource).toContain('object TypekitJavaInterop')
    expect(kotlinSource).toContain('@JvmStatic')
    expect(runtimeBridgeSource).toContain('createIcuTranslator')
    expect(runtimeBridgeSource).toContain('installTypekitRuntimeBridge')
    expect(runtimeBridgeBundleSource).toContain('__typekitTranslate')
  })

  test('throws when outputKotlin collides with output', async () => {
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
      outputKotlin: outputPath,
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    await expect(generateTranslations(config, { targets: ['kotlin'] })).rejects.toThrow(
      /"outputKotlin" must not point to the same file as "output" or "outputKeys"/
    )
  })

  test('supports basic runtime bridge mode and custom function name', async () => {
    const directory = await createTempDirectory()
    const csvPath = join(directory, 'translations.csv')
    const outputPath = join(directory, 'translationTable.ts')
    const outputKotlinPath = join(directory, 'translation.kt')
    const outputRuntimeBridgePath = join(directory, 'typekit.bridge.mjs')
    const outputRuntimeBridgeBundlePath = join(directory, 'typekit.bridge.bundle.js')

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
      outputKotlin: outputKotlinPath,
      outputRuntimeBridge: outputRuntimeBridgePath,
      outputRuntimeBridgeBundle: outputRuntimeBridgeBundlePath,
      runtimeBridgeMode: 'basic',
      runtimeBridgeFunctionName: '__translate',
      languages: ['en', 'de'],
      defaultLanguage: 'en',
    }

    const result = await generateTranslations(config, {
      targets: ['kotlin'],
    })

    expect(result.runtimeBridgePath).toBe(outputRuntimeBridgePath)
    expect(result.runtimeBridgeBundlePath).toBe(outputRuntimeBridgeBundlePath)
    const runtimeBridgeSource = await readFile(outputRuntimeBridgePath, 'utf-8')
    const runtimeBridgeBundleSource = await readFile(outputRuntimeBridgeBundlePath, 'utf-8')
    expect(runtimeBridgeSource).toContain('import { createTranslator }')
    expect(runtimeBridgeSource).not.toContain('createIcuTranslator')
    expect(runtimeBridgeSource).toContain('__translate')
    expect(runtimeBridgeBundleSource).toContain('__translate')
  })

  test.runIf(hasSwiftCompiler)('swift target compiles in a consumer smoke project', async () => {
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

    const fixtureSource = await readFile(
      join(fixturesRootPath, 'consumer-swift', 'SmokeApp.swift'),
      'utf-8'
    )
    await writeFile(smokePath, fixtureSource, 'utf-8')

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
  })

  test.runIf(hasSwiftCompiler)(
    'swift target compiles and runs with generated runtime bridge bundle',
    async () => {
      const directory = await createTempDirectory()
      const translationDirectoryPath = join(directory, 'translations')
      const generatedDirectoryPath = join(directory, 'generated')
      const yamlPath = join(translationDirectoryPath, 'ui.yaml')
      const outputPath = join(generatedDirectoryPath, 'translationTable.ts')
      const outputSwiftPath = join(generatedDirectoryPath, 'translation.swift')
      const outputRuntimeBridgePath = join(generatedDirectoryPath, 'translation.runtime.mjs')
      const outputRuntimeBridgeBundlePath = join(
        generatedDirectoryPath,
        'translation.runtime.bundle.js'
      )
      const smokePath = join(directory, 'smoke.swift')
      const binaryPath = join(directory, 'smoke')
      const moduleCachePath = join(directory, 'swift-module-cache')
      const clangModuleCachePath = join(directory, 'clang-module-cache')

      await Promise.all([
        mkdir(translationDirectoryPath, { recursive: true }),
        mkdir(moduleCachePath, { recursive: true }),
        mkdir(clangModuleCachePath, { recursive: true }),
      ])

      const fixtureYamlSource = await readFile(
        join(fixturesRootPath, 'smoke-runtime', 'translations', 'ui.yaml'),
        'utf-8'
      )
      await writeFile(yamlPath, fixtureYamlSource, 'utf-8')

      const config: TypekitI18nConfig<'en' | 'de' | 'es'> = {
        input: [yamlPath],
        output: outputPath,
        outputSwift: outputSwiftPath,
        outputRuntimeBridge: outputRuntimeBridgePath,
        outputRuntimeBridgeBundle: outputRuntimeBridgeBundlePath,
        languages: ['en', 'de', 'es'],
        defaultLanguage: 'en',
        localeByLanguage: {
          en: 'en-US',
          de: 'de-DE',
          es: 'es-ES',
        },
      }

      const result = await generateTranslations(config, { targets: ['swift'] })
      expect(result.runtimeBridgePath).toBe(outputRuntimeBridgePath)
      expect(result.runtimeBridgeBundlePath).toBe(outputRuntimeBridgeBundlePath)

      const fixtureSource = await readFile(
        join(fixturesRootPath, 'smoke-runtime', 'SmokeApp.swift'),
        'utf-8'
      )
      await writeFile(smokePath, fixtureSource, 'utf-8')

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

      const runResult = spawnSync(binaryPath, [], { encoding: 'utf-8', cwd: directory })
      if (runResult.status !== 0) {
        throw new Error(runResult.stderr || runResult.stdout)
      }

      const outputLines = runResult.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      expect(outputLines).toEqual([
        'Starting Swift SmokeApp...',
        'Translating welcome message for all supported languages:',
        'en: Hello World',
        'de: Herzlich Willkommen',
        'es: Hola Mundo',
        'Translating ICU plural examples:',
        'No items',
        'One item',
        '2 items',
      ])
    }
  )

  test.runIf(hasKotlinCompiler && hasJavaRuntime)(
    'kotlin target compiles and runs in a consumer smoke project',
    async () => {
      const directory = await createTempDirectory()
      const csvPath = join(directory, 'translations.csv')
      const outputPath = join(directory, 'translationTable.ts')
      const outputKotlinPath = join(directory, 'translation.kt')
      const smokePath = join(directory, 'smoke.kt')
      const jarPath = join(directory, 'smoke.jar')

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
        outputKotlin: outputKotlinPath,
        languages: ['en', 'de'],
        defaultLanguage: 'en',
      }

      await generateTranslations(config, { targets: ['kotlin'] })
      const fixtureSource = await readFile(
        join(fixturesRootPath, 'consumer-kotlin', 'SmokeApp.kt'),
        'utf-8'
      )
      await writeFile(smokePath, fixtureSource, 'utf-8')

      const compileResult = spawnSync(
        'kotlinc',
        [outputKotlinPath, smokePath, '-include-runtime', '-d', jarPath],
        {
          encoding: 'utf-8',
        }
      )
      if (compileResult.status !== 0) {
        throw new Error(compileResult.stderr || compileResult.stdout)
      }

      const runResult = spawnSync('java', ['-jar', jarPath], { encoding: 'utf-8' })
      if (runResult.status !== 0) {
        throw new Error(runResult.stderr || runResult.stdout)
      }

      expect(runResult.stdout.trim()).toBe('title:de:1')
    }
  )

  test.runIf(hasKotlinCompiler && hasJavaCompiler && hasJavaRuntime && kotlinStdlibPath !== null)(
    'kotlin target passes Java interoperability compile and runtime smoke checks',
    async () => {
      const directory = await createTempDirectory()
      const csvPath = join(directory, 'translations.csv')
      const outputPath = join(directory, 'translationTable.ts')
      const outputKotlinPath = join(directory, 'translation.kt')
      const classesPath = join(directory, 'classes')
      const javaSourcePath = join(directory, 'JavaInteropSmoke.java')

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
        outputKotlin: outputKotlinPath,
        languages: ['en', 'de'],
        defaultLanguage: 'en',
      }

      await generateTranslations(config, { targets: ['kotlin'] })
      await mkdir(classesPath, { recursive: true })

      const kotlinCompileResult = spawnSync('kotlinc', [outputKotlinPath, '-d', classesPath], {
        encoding: 'utf-8',
      })
      if (kotlinCompileResult.status !== 0) {
        throw new Error(kotlinCompileResult.stderr || kotlinCompileResult.stdout)
      }

      const javaFixtureSource = await readFile(
        join(fixturesRootPath, 'consumer-kotlin', 'JavaInteropSmoke.java'),
        'utf-8'
      )
      await writeFile(javaSourcePath, javaFixtureSource, 'utf-8')

      const compileClasspath = [classesPath, kotlinStdlibPath as string].join(delimiter)
      const javaCompileResult = spawnSync(
        'javac',
        ['-cp', compileClasspath, '-d', classesPath, javaSourcePath],
        {
          encoding: 'utf-8',
        }
      )
      if (javaCompileResult.status !== 0) {
        throw new Error(javaCompileResult.stderr || javaCompileResult.stdout)
      }

      const runClasspath = [classesPath, kotlinStdlibPath as string].join(delimiter)
      const javaRunResult = spawnSync('java', ['-cp', runClasspath, 'JavaInteropSmoke'], {
        encoding: 'utf-8',
      })
      if (javaRunResult.status !== 0) {
        throw new Error(javaRunResult.stderr || javaRunResult.stdout)
      }

      expect(javaRunResult.stdout.trim()).toBe('title:de:0')
    }
  )
})
