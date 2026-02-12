import * as vscode from 'vscode'

import { createTranslationWorkspace } from './core/translationWorkspace'
import { registerCompletionAndHover } from './features/completion-hover/register'
import { registerDiagnostics } from './features/diagnostics/register'
import { registerKeyIntelligence } from './features/key-intelligence/register'
import { registerSchemaValidation } from './features/schema-validation/register'

/**
 * Activates the typekit-i18n VSCode extension.
 *
 * @param context VSCode extension context.
 * @returns Promise resolved after initial feature registration and indexing.
 */
export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const translationWorkspace = createTranslationWorkspace()
  context.subscriptions.push(translationWorkspace)

  let refreshTimer: NodeJS.Timeout | null = null
  const scheduleRefresh = (): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
    }
    refreshTimer = setTimeout(() => {
      void translationWorkspace.refresh()
    }, 150)
  }

  const registerTranslationWatchers = (): vscode.Disposable => {
    const translationGlobs = vscode.workspace
      .getConfiguration('typekitI18n')
      .get<readonly string[]>('translationGlobs', ['**/translations/**/*.{yaml,yml,csv}'])

    const watchers = translationGlobs.map((globPattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(globPattern)
      watcher.onDidCreate(() => scheduleRefresh())
      watcher.onDidChange(() => scheduleRefresh())
      watcher.onDidDelete(() => scheduleRefresh())
      return watcher
    })
    return vscode.Disposable.from(...watchers)
  }

  let translationWatchers = registerTranslationWatchers()
  context.subscriptions.push(translationWatchers)

  context.subscriptions.push(registerKeyIntelligence(translationWorkspace))
  context.subscriptions.push(registerDiagnostics(translationWorkspace))
  context.subscriptions.push(registerSchemaValidation(translationWorkspace))
  context.subscriptions.push(registerCompletionAndHover(translationWorkspace))
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('typekitI18n.translationGlobs')) {
        translationWatchers.dispose()
        translationWatchers = registerTranslationWatchers()
        context.subscriptions.push(translationWatchers)
        await translationWorkspace.refresh()
      }
    })
  )

  await translationWorkspace.refresh()
}

/**
 * Deactivates the extension.
 */
export const deactivate = (): void => {}
