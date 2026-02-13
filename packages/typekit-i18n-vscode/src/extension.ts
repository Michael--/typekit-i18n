import * as vscode from 'vscode'

import {
  resolveEffectiveTranslationGlobs,
  TYPEKIT_CONFIG_DISCOVERY_GLOBS,
} from './core/configDiscovery'
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
  let pendingWatcherReconfiguration = false
  let translationWatchers: vscode.Disposable = vscode.Disposable.from()
  const configWatchGlobs = new Set(TYPEKIT_CONFIG_DISCOVERY_GLOBS)

  const registerTranslationWatchers = async (): Promise<vscode.Disposable> => {
    const translationGlobs = await resolveEffectiveTranslationGlobs()
    const watcherGlobs = [...new Set([...translationGlobs, ...TYPEKIT_CONFIG_DISCOVERY_GLOBS])]

    const watchers = watcherGlobs.map((globPattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(globPattern)
      const requiresWatcherReconfiguration = configWatchGlobs.has(globPattern)
      const handleFileEvent = (): void => {
        scheduleRefresh({ reconfigureWatchers: requiresWatcherReconfiguration })
      }
      watcher.onDidCreate(handleFileEvent)
      watcher.onDidChange(handleFileEvent)
      watcher.onDidDelete(handleFileEvent)
      return watcher
    })

    return vscode.Disposable.from(...watchers)
  }

  const reconfigureWatchers = async (): Promise<void> => {
    translationWatchers.dispose()
    translationWatchers = await registerTranslationWatchers()
  }

  const runRefreshCycle = async (): Promise<void> => {
    if (pendingWatcherReconfiguration) {
      pendingWatcherReconfiguration = false
      await reconfigureWatchers()
    }
    await translationWorkspace.refresh()
  }

  const scheduleRefresh = (options?: { reconfigureWatchers?: boolean }): void => {
    if (options?.reconfigureWatchers) {
      pendingWatcherReconfiguration = true
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer)
    }
    refreshTimer = setTimeout(() => {
      void runRefreshCycle()
    }, 150)
  }

  await reconfigureWatchers()
  context.subscriptions.push(new vscode.Disposable(() => translationWatchers.dispose()))

  context.subscriptions.push(registerKeyIntelligence(translationWorkspace))
  context.subscriptions.push(registerDiagnostics(translationWorkspace))
  context.subscriptions.push(registerSchemaValidation(translationWorkspace))
  context.subscriptions.push(registerCompletionAndHover(translationWorkspace))
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('typekitI18n.translationGlobs')) {
        scheduleRefresh({ reconfigureWatchers: true })
      }
    })
  )

  await translationWorkspace.refresh()
}

/**
 * Deactivates the extension.
 */
export const deactivate = (): void => {}
