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
const binaryPath = join(tempDirectoryPath, 'smoke-app')

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

if (process.platform === 'win32') {
  console.log('Skipping swift smoke app on Windows.')
  process.exit(0)
}

if (process.platform === 'darwin') {
  const hasXcode = spawnSync('xcode-select', ['-p'], { stdio: 'ignore' }).status === 0
  if (!hasXcode) {
    console.error('Xcode command line tools are required on macOS.')
    process.exit(1)
  }
}

const hasSwiftCompiler = spawnSync('swiftc', ['--version'], { stdio: 'ignore' }).status === 0
if (!hasSwiftCompiler) {
  if (process.platform === 'darwin') {
    console.error('swiftc was not found. Please install Xcode command line tools.')
    process.exit(1)
  }
  console.log('Skipping swift smoke app because swiftc is not available.')
  process.exit(0)
}

mkdirSync(swiftModuleCachePath, { recursive: true })
mkdirSync(clangModuleCachePath, { recursive: true })

runCommand('swiftc', ['./generated/translation.swift', './SmokeApp.swift', '-o', binaryPath], {
  env: {
    ...process.env,
    SWIFT_MODULECACHE_PATH: swiftModuleCachePath,
    CLANG_MODULE_CACHE_PATH: clangModuleCachePath,
    HOME: fixtureDirectoryPath,
  },
})

runCommand(binaryPath, [])
