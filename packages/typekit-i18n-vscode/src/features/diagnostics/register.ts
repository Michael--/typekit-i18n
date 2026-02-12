import * as vscode from 'vscode'

import { extractKeyUsages, isCodeDocument } from '../../core/keyUsage'
import { DIAGNOSTIC_CODES } from '../../core/diagnosticCodes'
import type { TranslationEntry, TranslationWorkspace } from '../../core/translationWorkspace'

const diagnosticsCollectionName = 'typekit-i18n'
const codeSelector: vscode.DocumentSelector = [
  { language: 'typescript', scheme: 'file' },
  { language: 'typescriptreact', scheme: 'file' },
  { language: 'javascript', scheme: 'file' },
  { language: 'javascriptreact', scheme: 'file' },
]
const translationSelector: vscode.DocumentSelector = [
  { language: 'yaml', scheme: 'file' },
  { language: 'csv', scheme: 'file' },
]
const codeFileGlob = '**/*.{ts,tsx,js,jsx}'
const excludeGlob = '**/{node_modules,dist,build,.git}/**'

/**
 * Registers missing-key diagnostics and quick fixes.
 *
 * @param workspace Shared translation workspace index.
 * @returns Disposable that unregisters diagnostics resources.
 */
export const registerDiagnostics = (workspace: TranslationWorkspace): vscode.Disposable => {
  const diagnosticsCollection =
    vscode.languages.createDiagnosticCollection(diagnosticsCollectionName)

  const runDocumentDiagnostics = (document: vscode.TextDocument): void => {
    if (!isCodeDocument(document)) {
      diagnosticsCollection.delete(document.uri)
      return
    }

    const diagnostics = extractKeyUsages(document)
      .filter((usage) => !workspace.hasKey(usage.key))
      .map((usage) => {
        const diagnostic = new vscode.Diagnostic(
          usage.range,
          `Unknown translation key "${usage.key}".`,
          vscode.DiagnosticSeverity.Error
        )
        diagnostic.code = DIAGNOSTIC_CODES.missingKeyUsage
        diagnostic.source = 'typekit-i18n'
        return diagnostic
      })

    diagnosticsCollection.set(document.uri, diagnostics)
  }

  const runWorkspaceCodeDiagnostics = async (): Promise<void> => {
    const uris = await vscode.workspace.findFiles(codeFileGlob, excludeGlob)
    await Promise.all(
      uris.map(async (uri) => {
        const document = await vscode.workspace.openTextDocument(uri)
        runDocumentDiagnostics(document)
      })
    )
  }

  const runDiagnosticsCommand = vscode.commands.registerCommand(
    'typekitI18n.runDiagnostics',
    async () => {
      await workspace.refresh()
      await runWorkspaceCodeDiagnostics()
      void vscode.window.showInformationMessage('typekit-i18n diagnostics refresh completed.')
    }
  )

  const createMissingKeyCommand = vscode.commands.registerCommand(
    'typekitI18n.createMissingKey',
    async (key: string) => {
      if (!key || workspace.hasKey(key)) {
        return
      }

      const edit = workspace.createMissingKeyEdit(key)
      if (!edit) {
        void vscode.window.showWarningMessage(
          'No translation target file available for key creation.'
        )
        return
      }

      const applied = await vscode.workspace.applyEdit(edit)
      if (!applied) {
        return
      }

      await workspace.refresh()
      await runWorkspaceCodeDiagnostics()
    }
  )

  const fillMissingLocaleCommand = vscode.commands.registerCommand(
    'typekitI18n.fillMissingLocale',
    async (uriString: string, key: string, locale: string) => {
      const entry = findEntry(workspace, uriString, key)
      if (!entry) {
        return
      }

      const edit = workspace.createMissingLocaleEdit(entry, locale)
      if (!edit) {
        return
      }

      const applied = await vscode.workspace.applyEdit(edit)
      if (!applied) {
        return
      }

      await workspace.refresh()
      await runWorkspaceCodeDiagnostics()
    }
  )

  const codeActionsDisposable = vscode.languages.registerCodeActionsProvider(
    [...codeSelector, ...translationSelector],
    {
      provideCodeActions: (document, _range, context) => {
        const actions: vscode.CodeAction[] = []

        context.diagnostics.forEach((diagnostic) => {
          if (diagnostic.source !== 'typekit-i18n') {
            return
          }

          if (diagnostic.code === DIAGNOSTIC_CODES.missingKeyUsage) {
            const key = readMissingKeyFromMessage(diagnostic.message)
            if (!key) {
              return
            }
            const action = new vscode.CodeAction(
              `Create translation key "${key}"`,
              vscode.CodeActionKind.QuickFix
            )
            action.command = {
              title: `Create translation key "${key}"`,
              command: 'typekitI18n.createMissingKey',
              arguments: [key],
            }
            action.diagnostics = [diagnostic]
            action.isPreferred = true
            actions.push(action)
            return
          }

          if (isDiagnosticCode(diagnostic.code, DIAGNOSTIC_CODES.missingLocaleValue)) {
            const payload = decodeDiagnosticPayload(diagnostic.code)
            const key = payload?.key
            const locale = payload?.locale
            if (!key || !locale) {
              return
            }
            const action = new vscode.CodeAction(
              `Add missing locale "${locale}"`,
              vscode.CodeActionKind.QuickFix
            )
            action.command = {
              title: `Add missing locale "${locale}"`,
              command: 'typekitI18n.fillMissingLocale',
              arguments: [document.uri.toString(), key, locale],
            }
            action.diagnostics = [diagnostic]
            actions.push(action)
          }
        })

        return actions
      },
    },
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }
  )

  const openDocumentSubscription = vscode.workspace.onDidOpenTextDocument((document) => {
    runDocumentDiagnostics(document)
  })
  const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
    runDocumentDiagnostics(event.document)
  })
  const closeDocumentSubscription = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnosticsCollection.delete(document.uri)
  })
  const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (
      document.fileName.endsWith('.yaml') ||
      document.fileName.endsWith('.yml') ||
      document.fileName.endsWith('.csv')
    ) {
      await workspace.refresh()
      await runWorkspaceCodeDiagnostics()
      return
    }
    runDocumentDiagnostics(document)
  })

  workspace.onDidRefresh(() => {
    vscode.workspace.textDocuments.forEach((document) => {
      runDocumentDiagnostics(document)
    })
  })

  void runWorkspaceCodeDiagnostics()

  return vscode.Disposable.from(
    diagnosticsCollection,
    runDiagnosticsCommand,
    createMissingKeyCommand,
    fillMissingLocaleCommand,
    codeActionsDisposable,
    openDocumentSubscription,
    changeDocumentSubscription,
    closeDocumentSubscription,
    saveDocumentSubscription
  )
}

const findEntry = (
  workspace: TranslationWorkspace,
  uriString: string,
  key: string
): TranslationEntry | null => {
  const entry =
    workspace.getEntriesForKey(key).find((candidate) => candidate.uri.toString() === uriString) ??
    null
  return entry
}

const readMissingKeyFromMessage = (message: string): string | null => {
  const match = message.match(/^Unknown translation key "(.+)"\.$/)
  return match?.[1] ?? null
}

const isDiagnosticCode = (code: vscode.Diagnostic['code'], expected: string): boolean => {
  if (typeof code === 'string') {
    return code === expected || code.startsWith(`${expected}|`)
  }
  if (typeof code === 'object' && code !== null && typeof code.value === 'string') {
    return code.value === expected || code.value.startsWith(`${expected}|`)
  }
  return false
}

const decodeDiagnosticPayload = (
  code: vscode.Diagnostic['code']
): Record<string, string> | null => {
  const rawValue =
    typeof code === 'string'
      ? code
      : typeof code === 'object' && code !== null
        ? String(code.value)
        : ''
  const separator = rawValue.indexOf('|')
  if (separator === -1) {
    return null
  }

  const encodedPayload = rawValue.slice(separator + 1)
  try {
    const decoded = Buffer.from(encodedPayload, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const payload: Record<string, string> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'string') {
        payload[key] = value
      }
    })
    return payload
  } catch {
    return null
  }
}
