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

  context.subscriptions.push(registerKeyIntelligence(translationWorkspace))
  context.subscriptions.push(registerDiagnostics(translationWorkspace))
  context.subscriptions.push(registerSchemaValidation(translationWorkspace))
  context.subscriptions.push(registerCompletionAndHover(translationWorkspace))
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('typekitI18n.translationGlobs')) {
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
