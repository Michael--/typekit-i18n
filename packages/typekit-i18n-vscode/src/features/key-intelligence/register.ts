import * as vscode from 'vscode'

import type { TranslationWorkspace } from '../../core/translationWorkspace'

const codeSelector: vscode.DocumentSelector = [
  { language: 'typescript', scheme: 'file' },
  { language: 'typescriptreact', scheme: 'file' },
  { language: 'javascript', scheme: 'file' },
  { language: 'javascriptreact', scheme: 'file' },
]

const keyDefinitionProvider: vscode.DefinitionProvider = {
  provideDefinition: (_document, _position, _token) => undefined,
}

const keyReferenceProvider: vscode.ReferenceProvider = {
  provideReferences: (_document, _position, _context, _token) => [],
}

const keyRenameProvider: vscode.RenameProvider = {
  prepareRename: (_document, _position, _token) => undefined,
  provideRenameEdits: (_document, _position, _newName, _token) => undefined,
}

/**
 * Registers MVP scaffolding for key navigation and rename workflows.
 *
 * @param workspace Shared translation workspace index.
 * @returns Disposable that unregisters all key-intelligence providers.
 */
export const registerKeyIntelligence = (workspace: TranslationWorkspace): vscode.Disposable => {
  const refreshIndexCommand = vscode.commands.registerCommand(
    'typekitI18n.refreshIndex',
    async () => {
      await workspace.refresh()
      const indexedCount = workspace.documents.length
      void vscode.window.showInformationMessage(
        `typekit-i18n indexed ${indexedCount} translation files.`
      )
    }
  )

  const definitionDisposable = vscode.languages.registerDefinitionProvider(
    codeSelector,
    keyDefinitionProvider
  )
  const referenceDisposable = vscode.languages.registerReferenceProvider(
    codeSelector,
    keyReferenceProvider
  )
  const renameDisposable = vscode.languages.registerRenameProvider(codeSelector, keyRenameProvider)

  return vscode.Disposable.from(
    refreshIndexCommand,
    definitionDisposable,
    referenceDisposable,
    renameDisposable
  )
}
