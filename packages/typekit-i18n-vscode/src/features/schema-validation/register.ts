import * as vscode from 'vscode'

import type { TranslationWorkspace } from '../../core/translationWorkspace'

const schemaCollectionName = 'typekit-i18n-schema'

/**
 * Registers schema and semantic diagnostics for YAML/CSV translation files.
 *
 * @param workspace Shared translation workspace index.
 * @returns Disposable that unregisters schema-validation resources.
 */
export const registerSchemaValidation = (workspace: TranslationWorkspace): vscode.Disposable => {
  const schemaCollection = vscode.languages.createDiagnosticCollection(schemaCollectionName)

  const publishWorkspaceDiagnostics = (): void => {
    schemaCollection.clear()
    workspace.getDiagnosticsByUri().forEach((diagnostics, uriString) => {
      schemaCollection.set(vscode.Uri.parse(uriString), [...diagnostics])
    })
  }

  const refreshSubscription = workspace.onDidRefresh(() => {
    publishWorkspaceDiagnostics()
  })

  publishWorkspaceDiagnostics()

  return vscode.Disposable.from(schemaCollection, refreshSubscription)
}
