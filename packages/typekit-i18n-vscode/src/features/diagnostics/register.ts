import * as vscode from 'vscode'

import type { TranslationWorkspace } from '../../core/translationWorkspace'

const diagnosticsCollectionName = 'typekit-i18n'

/**
 * Registers diagnostics entry points for missing keys, locale gaps, and placeholder mismatches.
 *
 * @param workspace Shared translation workspace index.
 * @returns Disposable that unregisters diagnostics resources.
 */
export const registerDiagnostics = (workspace: TranslationWorkspace): vscode.Disposable => {
  const diagnosticsCollection =
    vscode.languages.createDiagnosticCollection(diagnosticsCollectionName)

  const runDiagnosticsCommand = vscode.commands.registerCommand(
    'typekitI18n.runDiagnostics',
    async () => {
      await workspace.refresh()
      diagnosticsCollection.clear()
      void vscode.window.showInformationMessage('typekit-i18n diagnostics refresh completed.')
    }
  )

  const workspaceRefreshSubscription = workspace.onDidRefresh(() => {
    diagnosticsCollection.clear()
  })

  const closeDocumentSubscription = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnosticsCollection.delete(document.uri)
  })

  return vscode.Disposable.from(
    diagnosticsCollection,
    runDiagnosticsCommand,
    workspaceRefreshSubscription,
    closeDocumentSubscription
  )
}
