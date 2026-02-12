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

        const settings = readCompletionAndPreviewSettings()
        if (!shouldProvideCompletion(document, settings.completionMode)) {
          return undefined
        }

        return workspace.getAllKeys().map((key) => {
          const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Constant)
          item.insertText = key
          item.detail = toPreviewLine(workspace, key, settings)
          item.sortText = toSortTextForMode(key, settings.completionMode)
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

      const firstEntry = entries[0]
      const settings = readCompletionAndPreviewSettings()
      const previewLocales = resolvePreviewLocales(workspace, settings)

      previewLocales.forEach((locale) => {
        const value = firstEntry.values.get(locale)
        if (typeof value === 'string' && value.trim().length > 0) {
          markdown.appendMarkdown(`- \`${locale}\`: ${escapeMarkdownInline(value)}\n`)
        } else {
          markdown.appendMarkdown(`- \`${locale}\`: _(missing)_\n`)
        }
      })

      const remainingLocaleCount = Math.max(
        0,
        workspace.getKnownLanguages().length - previewLocales.length
      )
      if (remainingLocaleCount > 0) {
        markdown.appendMarkdown(
          `\n_+ ${remainingLocaleCount} more locale(s). Configure \`typekitI18n.previewLocales\` or \`typekitI18n.previewMaxLocales\`._\n`
        )
      }

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
  settings: CompletionAndPreviewSettings
): string => {
  const entry = workspace.getEntriesForKey(key)[0]
  if (!entry) {
    return 'No preview available'
  }
  const locales = resolvePreviewLocales(workspace, settings)
  const segments = locales.map((locale) => {
    const value = entry.values.get(locale)
    return typeof value === 'string' && value.trim().length > 0
      ? `${locale}: ${value}`
      : `${locale}: (missing)`
  })

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

interface CompletionAndPreviewSettings {
  readonly completionMode: 'fallback' | 'always' | 'alwaysPreferExtension'
  readonly previewLocales: readonly string[]
  readonly previewMaxLocales: number
}

const readCompletionAndPreviewSettings = (): CompletionAndPreviewSettings => {
  const config = vscode.workspace.getConfiguration('typekitI18n')

  const configuredMode = config.get<string>('completionMode', 'fallback')
  const completionMode: 'fallback' | 'always' | 'alwaysPreferExtension' =
    configuredMode === 'always' || configuredMode === 'alwaysPreferExtension'
      ? configuredMode
      : 'fallback'

  const configuredLocales = config.get<readonly string[]>('previewLocales', [])
  const previewLocales = configuredLocales
    .map((locale) => locale.trim())
    .filter((locale) => locale.length > 0)

  const configuredMax = config.get<number>('previewMaxLocales', 1)
  const previewMaxLocales = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 1

  return {
    completionMode,
    previewLocales,
    previewMaxLocales,
  }
}

const shouldProvideCompletion = (
  document: vscode.TextDocument,
  mode: 'fallback' | 'always' | 'alwaysPreferExtension'
): boolean => {
  if (mode === 'always' || mode === 'alwaysPreferExtension') {
    return true
  }
  return document.languageId !== 'typescript' && document.languageId !== 'typescriptreact'
}

const toSortTextForMode = (
  key: string,
  mode: 'fallback' | 'always' | 'alwaysPreferExtension'
): string => {
  if (mode === 'alwaysPreferExtension') {
    return `!${key}`
  }
  return key
}

const resolvePreviewLocales = (
  workspace: TranslationWorkspace,
  settings: CompletionAndPreviewSettings
): readonly string[] => {
  const knownLocales = workspace.getKnownLanguages()
  if (knownLocales.length === 0) {
    return []
  }

  if (settings.previewLocales.length > 0) {
    const configuredLocales = settings.previewLocales
      .filter((locale) => knownLocales.includes(locale))
      .slice(0, settings.previewMaxLocales)
    if (configuredLocales.length > 0) {
      return configuredLocales
    }
  }

  const defaultLocale = knownLocales.find((locale) => locale === 'en') ?? knownLocales[0]
  return [defaultLocale].slice(0, settings.previewMaxLocales)
}
