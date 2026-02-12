import * as vscode from 'vscode'

import { findUsageAtPosition, isCodeDocument } from '../../core/keyUsage'
import type { TranslationWorkspace } from '../../core/translationWorkspace'

const codeSelector: vscode.DocumentSelector = [
  { language: 'typescript', scheme: 'file' },
  { language: 'typescriptreact', scheme: 'file' },
  { language: 'javascript', scheme: 'file' },
  { language: 'javascriptreact', scheme: 'file' },
]

/**
 * Registers completion and hover providers for translation keys.
 *
 * @param workspace Shared translation workspace index.
 * @returns Disposable that unregisters completion and hover providers.
 */
export const registerCompletionAndHover = (workspace: TranslationWorkspace): vscode.Disposable => {
  const completionDisposable = vscode.languages.registerCompletionItemProvider(
    codeSelector,
    {
      provideCompletionItems: (document, position) => {
        if (!isCodeDocument(document) || !isLikelyTranslationCall(document, position)) {
          return undefined
        }

        const preferredLocales = workspace.getKnownLanguages().slice(0, 2)
        return workspace.getAllKeys().map((key) => {
          const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Constant)
          item.insertText = key
          item.detail = toPreviewLine(workspace, key, preferredLocales)
          item.sortText = key
          return item
        })
      },
    },
    '.',
    '"',
    "'"
  )

  const hoverDisposable = vscode.languages.registerHoverProvider(codeSelector, {
    provideHover: (document, position) => {
      const usage = findUsageAtPosition(document, position)
      if (!usage) {
        return undefined
      }

      const entries = workspace.getEntriesForKey(usage.key)
      if (entries.length === 0) {
        return undefined
      }

      const markdown = new vscode.MarkdownString()
      markdown.appendMarkdown(`**${usage.key}**\n\n`)

      const locales = workspace.getKnownLanguages()
      const firstEntry = entries[0]
      locales.forEach((locale) => {
        const value = firstEntry.values.get(locale)
        if (typeof value === 'string' && value.trim().length > 0) {
          markdown.appendMarkdown(`- \`${locale}\`: ${escapeMarkdownInline(value)}\n`)
        } else {
          markdown.appendMarkdown(`- \`${locale}\`: _(missing)_\n`)
        }
      })

      if (entries.length > 1) {
        markdown.appendMarkdown('\nDuplicate key definitions detected.\n')
      }

      return new vscode.Hover(markdown)
    },
  })

  return vscode.Disposable.from(completionDisposable, hoverDisposable)
}

const toPreviewLine = (
  workspace: TranslationWorkspace,
  key: string,
  locales: readonly string[]
): string => {
  const entry = workspace.getEntriesForKey(key)[0]
  if (!entry) {
    return 'No preview available'
  }
  const segments = locales
    .map((locale) => {
      const value = entry.values.get(locale)
      return typeof value === 'string' && value.trim().length > 0
        ? `${locale}: ${value}`
        : `${locale}: (missing)`
    })
    .slice(0, 2)

  return segments.join(' | ')
}

const isLikelyTranslationCall = (
  document: vscode.TextDocument,
  position: vscode.Position
): boolean => {
  const linePrefix = document.lineAt(position.line).text.slice(0, position.character)
  return /\b(?:t|icu)(?:\.in)?\([^)]*$/.test(linePrefix)
}

const escapeMarkdownInline = (value: string): string =>
  value.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1')
