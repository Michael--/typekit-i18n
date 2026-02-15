#!/usr/bin/env node

import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import console from 'node:console'

const fixtureDirectoryPath = dirname(fileURLToPath(import.meta.url))
const tempDirectoryPath = join(fixtureDirectoryPath, '.tmp')
const swiftModuleCachePath = join(tempDirectoryPath, 'swift-module-cache')
const clangModuleCachePath = join(tempDirectoryPath, 'clang-module-cache')
const swiftBinaryPath = join(tempDirectoryPath, 'smoke-app-swift')
const kotlinJarPath = join(tempDirectoryPath, 'smoke-app-kotlin.jar')

const runCommand = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: fixtureDirectoryPath,
    stdio: 'inherit',
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const hasCommand = (command, versionArgs = ['--version']) =>
  spawnSync(command, versionArgs, { stdio: 'ignore' }).status === 0

const resolveKotlinCompiler = () => {
  const candidates = [
    { command: 'kotlinc', args: [] },
    { command: 'kotlinc-jvm', args: [] },
    {
      command: 'bash',
      args: ['/Applications/Android Studio.app/Contents/plugins/Kotlin/kotlinc/bin/kotlinc'],
    },
    {
      command: 'bash',
      args: ['/Applications/Android Studio.app/Contents/plugins/Kotlin/kotlinc/bin/kotlinc-jvm'],
    },
  ]

  return (
    candidates.find((candidate) =>
      hasCommand(candidate.command, [...candidate.args, '-version'])
    ) ?? null
  )
}

if (process.platform === 'win32') {
  console.log('Skipping native smoke apps on Windows.')
  process.exit(0)
}

if (process.platform === 'darwin') {
  const hasXcode = spawnSync('xcode-select', ['-p'], { stdio: 'ignore' }).status === 0
  if (!hasXcode) {
    console.error('Xcode command line tools are required on macOS.')
    process.exit(1)
  }
}

const hasSwiftCompiler = hasCommand('swiftc')
if (process.platform === 'darwin' && !hasSwiftCompiler) {
  console.error('swiftc was not found. Please install Xcode command line tools.')
  process.exit(1)
}

const kotlinCompiler = resolveKotlinCompiler()
const hasKotlinCompiler = kotlinCompiler !== null
const hasJavaRuntime = hasCommand('java', ['-version'])
const canRunKotlin = hasKotlinCompiler && hasJavaRuntime

if (!hasSwiftCompiler && !canRunKotlin) {
  console.log('Skipping native smoke apps because no supported compiler was found.')
  process.exit(0)
}

const targets = [hasSwiftCompiler ? 'swift' : null, canRunKotlin ? 'kotlin' : null]
  .filter((target) => target !== null)
  .join(',')

runCommand('node', [
  '--import',
  'tsx',
  '../../../src/codegen/cli.ts',
  'generate',
  '--config',
  './typekit.config.ts',
  '--target',
  targets,
])

if (hasSwiftCompiler) {
  mkdirSync(swiftModuleCachePath, { recursive: true })
  mkdirSync(clangModuleCachePath, { recursive: true })

  runCommand('swiftc', ['./generated/translation.swift', './SmokeApp.swift', '-o', swiftBinaryPath], {
    env: {
      ...process.env,
      SWIFT_MODULECACHE_PATH: swiftModuleCachePath,
      CLANG_MODULE_CACHE_PATH: clangModuleCachePath,
      HOME: fixtureDirectoryPath,
    },
  })

  runCommand(swiftBinaryPath, [])
} else {
  console.log('Skipping Swift smoke app because swiftc is not available.')
}

if (canRunKotlin) {
  if (kotlinCompiler === null) {
    console.error('Kotlin compiler detection failed unexpectedly.')
    process.exit(1)
  }
  runCommand(
    kotlinCompiler.command,
    [
      ...kotlinCompiler.args,
      './generated/translation.kt',
      './SmokeApp.kt',
      '-include-runtime',
      '-d',
      kotlinJarPath,
    ]
  )
  runCommand('java', ['-jar', kotlinJarPath])
} else {
  if (!hasKotlinCompiler) {
    console.log('Skipping Kotlin smoke app because kotlinc is not available.')
  }
  if (!hasJavaRuntime) {
    console.log('Skipping Kotlin smoke app because java runtime is not available.')
  }
}
