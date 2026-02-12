import * as vscode from 'vscode'

import { findUsageAtPosition, findWorkspaceUsages, isCodeDocument } from '../../core/keyUsage'
import type { TranslationEntry, TranslationWorkspace } from '../../core/translationWorkspace'

const codeSelector: vscode.DocumentSelector = [
  { language: 'typescript', scheme: 'file' },
  { language: 'typescriptreact', scheme: 'file' },
  { language: 'javascript', scheme: 'file' },
  { language: 'javascriptreact', scheme: 'file' },
]

/**
 * Registers definition/reference/rename providers for translation keys.
 *
 * @param workspace Shared translation workspace index.
 * @returns Disposable that unregisters all key-intelligence providers.
 */
export const registerKeyIntelligence = (workspace: TranslationWorkspace): vscode.Disposable => {
  const output = vscode.window.createOutputChannel('typekit-i18n')

  const refreshIndexCommand = vscode.commands.registerCommand(
    'typekitI18n.refreshIndex',
    async () => {
      const startTime = performance.now()
      await workspace.refresh()
      const elapsedMs = performance.now() - startTime
      const indexedCount = workspace.documents.length
      output.appendLine(
        `[refresh] ${new Date().toISOString()} files=${indexedCount} duration=${elapsedMs.toFixed(1)}ms`
      )
      void vscode.window.showInformationMessage(
        `typekit-i18n indexed ${indexedCount} translation files in ${elapsedMs.toFixed(1)} ms.`
      )
    }
  )

  const measureIndexPerformanceCommand = vscode.commands.registerCommand(
    'typekitI18n.measureIndexPerformance',
    async () => {
      const runs = 3
      const durationsMs: number[] = []

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'typekit-i18n: measuring refresh performance',
        },
        async (progress) => {
          for (let runIndex = 0; runIndex < runs; runIndex += 1) {
            progress.report({ message: `Run ${runIndex + 1}/${runs}` })
            const startTime = performance.now()
            await workspace.refresh()
            const elapsedMs = performance.now() - startTime
            durationsMs.push(elapsedMs)
          }
        }
      )

      const sortedDurations = [...durationsMs].sort((left, right) => left - right)
      const averageMs = durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length
      const medianMs = sortedDurations[Math.floor(sortedDurations.length / 2)] ?? averageMs
      const indexedCount = workspace.documents.length
      output.appendLine(
        `[perf] ${new Date().toISOString()} files=${indexedCount} runs=${runs} avg=${averageMs.toFixed(
          1
        )}ms median=${medianMs.toFixed(1)}ms samples=[${durationsMs
          .map((duration) => duration.toFixed(1))
          .join(', ')}]`
      )
      output.show(true)
      void vscode.window.showInformationMessage(
        `typekit-i18n refresh baseline: avg ${averageMs.toFixed(1)} ms, median ${medianMs.toFixed(
          1
        )} ms (${runs} runs).`
      )
    }
  )

  const definitionDisposable = vscode.languages.registerDefinitionProvider(codeSelector, {
    provideDefinition: async (document, position) => {
      const resolvedKey = resolveKeyAtPosition(document, position, workspace)
      if (!resolvedKey) {
        return undefined
      }
      const locations = toDefinitionLocations(workspace.getEntriesForKey(resolvedKey.key))
      return locations.length === 0 ? undefined : locations
    },
  })

  const referenceDisposable = vscode.languages.registerReferenceProvider(codeSelector, {
    provideReferences: async (document, position, context) => {
      const resolvedKey = resolveKeyAtPosition(document, position, workspace)
      if (!resolvedKey) {
        return []
      }

      const definitions = workspace.getEntriesForKey(resolvedKey.key)
      const definitionLocations = context.includeDeclaration
        ? toDefinitionLocations(definitions)
        : []
      const usageLocations = (await findWorkspaceUsages(resolvedKey.key)).map(
        (usage) => new vscode.Location(usage.uri, usage.range)
      )
      return [...definitionLocations, ...usageLocations]
    },
  })

  const renameDisposable = vscode.languages.registerRenameProvider(codeSelector, {
    prepareRename: (document, position) => {
      const resolvedKey = resolveKeyAtPosition(document, position, workspace)
      if (!resolvedKey) {
        throw new Error('No translation key under cursor.')
      }
      return resolvedKey.range
    },
    provideRenameEdits: async (document, position, newName) => {
      const resolvedKey = resolveKeyAtPosition(document, position, workspace)
      if (!resolvedKey) {
        return null
      }

      const edit = new vscode.WorkspaceEdit()
      const definitions = workspace.getEntriesForKey(resolvedKey.key)
      definitions.forEach((definition) => {
        edit.replace(definition.uri, definition.keyRange, newName)
      })

      const usages = await findWorkspaceUsages(resolvedKey.key)
      usages.forEach((usage) => {
        edit.replace(usage.uri, usage.range, newName)
      })

      return edit
    },
  })

  return vscode.Disposable.from(
    output,
    refreshIndexCommand,
    measureIndexPerformanceCommand,
    definitionDisposable,
    referenceDisposable,
    renameDisposable
  )
}

interface ResolvedKey {
  readonly key: string
  readonly range: vscode.Range
}

const resolveKeyAtPosition = (
  document: vscode.TextDocument,
  position: vscode.Position,
  workspace: TranslationWorkspace
): ResolvedKey | null => {
  if (isCodeDocument(document)) {
    const usage = findUsageAtPosition(document, position)
    if (!usage) {
      return null
    }
    return {
      key: usage.key,
      range: usage.range,
    }
  }

  const entry = workspace.findEntryAtPosition(document.uri, position)
  if (!entry) {
    return null
  }
  return {
    key: entry.key,
    range: entry.keyRange,
  }
}

const toDefinitionLocations = (entries: readonly TranslationEntry[]): vscode.Location[] =>
  entries.map((entry) => new vscode.Location(entry.uri, entry.keyRange))
