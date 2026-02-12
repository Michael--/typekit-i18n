import * as vscode from 'vscode'

import type { TranslationWorkspace } from '../../core/translationWorkspace'

const codeSelector: vscode.DocumentSelector = [
  { language: 'typescript', scheme: 'file' },
  { language: 'typescriptreact', scheme: 'file' },
  { language: 'javascript', scheme: 'file' },
  { language: 'javascriptreact', scheme: 'file' },
]

const keyCompletionProvider: vscode.CompletionItemProvider = {
  provideCompletionItems: (_document, _position, _token, _context) => undefined,
}

const keyHoverProvider: vscode.HoverProvider = {
  provideHover: (_document, _position, _token) => undefined,
}

/**
 * Registers completion and hover MVP scaffolding for translation key authoring.
 *
 * @param _workspace Shared translation workspace index.
 * @returns Disposable that unregisters completion and hover providers.
 */
export const registerCompletionAndHover = (_workspace: TranslationWorkspace): vscode.Disposable => {
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    codeSelector,
    keyCompletionProvider,
    '.',
    '"',
    "'"
  )
  const hoverDisposable = vscode.languages.registerHoverProvider(codeSelector, keyHoverProvider)

  return vscode.Disposable.from(completionDisposable, hoverDisposable)
}
