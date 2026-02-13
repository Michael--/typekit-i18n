import * as vscode from 'vscode'

import {
  resolveEffectiveTranslationGlobsStatus,
  TYPEKIT_CONFIG_DISCOVERY_GLOBS,
  type TranslationDiscoveryStatus,
} from './core/configDiscovery'
import { createTranslationWorkspace } from './core/translationWorkspace'
import { registerCompletionAndHover } from './features/completion-hover/register'
import { registerDiagnostics } from './features/diagnostics/register'
import { registerKeyIntelligence } from './features/key-intelligence/register'
import { registerSchemaValidation } from './features/schema-validation/register'

const STATUS_PREFIX = '[status]'
const REFRESH_DEBOUNCE_MS = 150
const MAX_LOG_ITEMS = 6

const toUniqueSorted = (values: ReadonlyArray<string>): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right))

const toReadableList = (values: ReadonlyArray<string>, maxItems = MAX_LOG_ITEMS): string => {
  if (values.length === 0) {
    return '(none)'
  }

  const visibleItems = values.slice(0, maxItems)
  const remainingItemCount = values.length - visibleItems.length
  if (remainingItemCount <= 0) {
    return visibleItems.join(', ')
  }

  return `${visibleItems.join(', ')}, +${remainingItemCount} more`
}

const appendStatus = (output: vscode.OutputChannel, message: string): void => {
  output.appendLine(`${STATUS_PREFIX} ${new Date().toISOString()} ${message}`)
}

const countWorkspaceDiagnostics = (
  workspace: ReturnType<typeof createTranslationWorkspace>
): number =>
  [...workspace.getDiagnosticsByUri().values()].reduce(
    (totalCount, diagnostics) => totalCount + diagnostics.length,
    0
  )

/**
 * Activates the typekit-i18n VSCode extension.
 *
 * @param context VSCode extension context.
 * @returns Promise resolved after initial feature registration and indexing.
 */
export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const output = vscode.window.createOutputChannel('typekit-i18n')
  context.subscriptions.push(output)

  const translationWorkspace = createTranslationWorkspace()
  context.subscriptions.push(translationWorkspace)
  appendStatus(output, 'Extension activated.')

  let refreshTimer: NodeJS.Timeout | null = null
  let pendingWatcherReconfiguration = false
  const pendingRefreshReasons = new Set<string>(['startup'])
  let translationWatchers: vscode.Disposable = vscode.Disposable.from()
  let watcherGlobs: readonly string[] = []
  let lastDiscoverySignature = ''
  const configWatchGlobs = new Set(TYPEKIT_CONFIG_DISCOVERY_GLOBS)

  const logDiscoveryStatusIfChanged = (discoveryStatus: TranslationDiscoveryStatus): void => {
    const signature = JSON.stringify({
      configuredGlobs: discoveryStatus.configuredGlobs,
      configGlobs: discoveryStatus.configGlobs,
      loadedConfigPaths: discoveryStatus.loadedConfigPaths,
      discoveryWarnings: discoveryStatus.discoveryWarnings,
      effectiveGlobs: discoveryStatus.effectiveGlobs,
    })
    if (signature === lastDiscoverySignature) {
      return
    }
    lastDiscoverySignature = signature

    appendStatus(
      output,
      `Configured translation globs (${discoveryStatus.configuredGlobs.length}): ${toReadableList(
        discoveryStatus.configuredGlobs
      )}`
    )
    appendStatus(
      output,
      `Config-derived translation globs (${discoveryStatus.configGlobs.length}): ${toReadableList(
        discoveryStatus.configGlobs
      )}`
    )
    appendStatus(
      output,
      `Loaded typekit config files (${discoveryStatus.loadedConfigPaths.length}): ${toReadableList(
        discoveryStatus.loadedConfigPaths
      )}`
    )
    discoveryStatus.discoveryWarnings.forEach((warning) => {
      appendStatus(output, `Warning: ${warning}`)
    })
  }

  const scheduleRefresh = (options?: {
    readonly reconfigureWatchers?: boolean
    readonly reason?: string
  }): void => {
    if (options?.reconfigureWatchers) {
      pendingWatcherReconfiguration = true
    }
    if (options?.reason) {
      pendingRefreshReasons.add(options.reason)
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer)
    }
    refreshTimer = setTimeout(() => {
      void runRefreshCycle()
    }, REFRESH_DEBOUNCE_MS)
  }

  const registerTranslationWatchers = async (): Promise<vscode.Disposable> => {
    const discoveryStatus = await resolveEffectiveTranslationGlobsStatus()
    logDiscoveryStatusIfChanged(discoveryStatus)
    watcherGlobs = toUniqueSorted([
      ...discoveryStatus.effectiveGlobs,
      ...TYPEKIT_CONFIG_DISCOVERY_GLOBS,
    ])
    appendStatus(
      output,
      `Watcher globs updated (${watcherGlobs.length}): ${toReadableList(watcherGlobs)}`
    )

    const watchers = watcherGlobs.map((globPattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(globPattern)
      const requiresWatcherReconfiguration = configWatchGlobs.has(globPattern)
      const handleFileEvent = (
        eventType: 'create' | 'change' | 'delete',
        uri: vscode.Uri
      ): void => {
        const relativePath = vscode.workspace.asRelativePath(uri, false)
        scheduleRefresh({
          reconfigureWatchers: requiresWatcherReconfiguration,
          reason: `file ${eventType}: ${relativePath}`,
        })
      }
      watcher.onDidCreate((uri) => handleFileEvent('create', uri))
      watcher.onDidChange((uri) => handleFileEvent('change', uri))
      watcher.onDidDelete((uri) => handleFileEvent('delete', uri))
      return watcher
    })

    return vscode.Disposable.from(...watchers)
  }

  const reconfigureWatchers = async (): Promise<void> => {
    translationWatchers.dispose()
    translationWatchers = await registerTranslationWatchers()
  }

  const runRefreshCycle = async (): Promise<void> => {
    const refreshReasons = [...pendingRefreshReasons]
    pendingRefreshReasons.clear()

    if (pendingWatcherReconfiguration) {
      pendingWatcherReconfiguration = false
      appendStatus(output, 'Reconfiguring watchers before refresh.')
      await reconfigureWatchers()
    }

    const discoveryStatus = await resolveEffectiveTranslationGlobsStatus()
    logDiscoveryStatusIfChanged(discoveryStatus)

    const reasonSummary =
      refreshReasons.length > 0 ? refreshReasons.join(' | ') : 'unspecified trigger'
    appendStatus(
      output,
      `Refresh started (${reasonSummary}). Effective globs (${discoveryStatus.effectiveGlobs.length}): ${toReadableList(
        discoveryStatus.effectiveGlobs
      )}`
    )

    const startTime = performance.now()
    await translationWorkspace.refresh(discoveryStatus.effectiveGlobs)
    const elapsedMs = performance.now() - startTime

    const indexedFileCount = translationWorkspace.documents.length
    const keyCount = translationWorkspace.getAllKeys().length
    const languageCount = translationWorkspace.getKnownLanguages().length
    const diagnosticsCount = countWorkspaceDiagnostics(translationWorkspace)
    appendStatus(
      output,
      `Refresh completed in ${elapsedMs.toFixed(1)}ms. files=${indexedFileCount} keys=${keyCount} languages=${languageCount} diagnostics=${diagnosticsCount}`
    )

    if (indexedFileCount === 0) {
      appendStatus(
        output,
        `No translation files were indexed. Checked globs: ${toReadableList(
          discoveryStatus.effectiveGlobs
        )}.`
      )
      return
    }

    const indexedPaths = translationWorkspace.documents.map((document) =>
      vscode.workspace.asRelativePath(document.uri, false)
    )
    appendStatus(
      output,
      `Indexed translation files (${indexedPaths.length}): ${toReadableList(indexedPaths)}`
    )
  }

  await reconfigureWatchers()
  context.subscriptions.push(new vscode.Disposable(() => translationWatchers.dispose()))

  context.subscriptions.push(registerKeyIntelligence(translationWorkspace, output))
  context.subscriptions.push(registerDiagnostics(translationWorkspace))
  context.subscriptions.push(registerSchemaValidation(translationWorkspace))
  context.subscriptions.push(registerCompletionAndHover(translationWorkspace))
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('typekitI18n.translationGlobs')) {
        scheduleRefresh({
          reconfigureWatchers: true,
          reason: 'settings change: typekitI18n.translationGlobs',
        })
      }
    })
  )

  await runRefreshCycle()
}

/**
 * Deactivates the extension.
 */
export const deactivate = (): void => {}
