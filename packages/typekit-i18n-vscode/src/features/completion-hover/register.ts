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
        if (!isCodeDocument(document)) {
          return undefined
        }

        const callContext = findTranslationCallContext(document, position)
        if (!callContext) {
          return undefined
        }

        const settings = readCompletionAndPreviewSettings()
        if (!shouldProvideCompletion(document, settings.completionMode)) {
          return undefined
        }

        return workspace.getAllKeys().map((key) => {
          const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Constant)
          const placeholders = resolvePlaceholdersForKey(workspace, key)
          const insertion = buildCompletionInsertion(key, placeholders, callContext, settings)
          item.insertText = insertion.isSnippet
            ? new vscode.SnippetString(insertion.text)
            : insertion.text
          item.range = insertion.range
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

const escapeMarkdownInline = (value: string): string =>
  value.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1')

interface CompletionAndPreviewSettings {
  readonly completionMode: 'fallback' | 'always' | 'alwaysPreferExtension'
  readonly enablePlaceholderSnippets: boolean
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
  const enablePlaceholderSnippets = config.get<boolean>('enablePlaceholderSnippets', true)

  const configuredLocales = config.get<readonly string[]>('previewLocales', [])
  const previewLocales = configuredLocales
    .map((locale) => locale.trim())
    .filter((locale) => locale.length > 0)

  const configuredMax = config.get<number>('previewMaxLocales', 1)
  const previewMaxLocales = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 1

  return {
    completionMode,
    enablePlaceholderSnippets,
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

interface TranslationCallContext {
  readonly quote: '"' | "'"
  readonly literalRange: vscode.Range
  readonly literalWithClosingQuoteRange: vscode.Range | null
  readonly hasAdditionalArguments: boolean
}

interface CompletionInsertion {
  readonly text: string
  readonly range: vscode.Range
  readonly isSnippet: boolean
}

const findTranslationCallContext = (
  document: vscode.TextDocument,
  position: vscode.Position
): TranslationCallContext | null => {
  const lineText = document.lineAt(position.line).text
  const linePrefix = lineText.slice(0, position.character)
  const match = /\b(?:t|icu)(?:\.in)?\(\s*(["'])([^"'\\]*)$/u.exec(linePrefix)
  if (!match) {
    return null
  }

  const quote = match[1] as '"' | "'"
  const literalPrefix = match[2] ?? ''
  const literalStart = position.character - literalPrefix.length
  const closingQuote = findUnescapedQuote(lineText, quote, position.character)

  const literalRange = new vscode.Range(
    position.line,
    literalStart,
    position.line,
    closingQuote >= 0 ? closingQuote : position.character
  )
  if (closingQuote < 0) {
    return {
      quote,
      literalRange,
      literalWithClosingQuoteRange: null,
      hasAdditionalArguments: false,
    }
  }

  const literalWithClosingQuoteRange = new vscode.Range(
    position.line,
    literalStart,
    position.line,
    closingQuote + 1
  )
  const trailingAfterQuote = lineText.slice(closingQuote + 1)
  const firstSignificantCharacter = readFirstNonWhitespaceCharacter(trailingAfterQuote)

  return {
    quote,
    literalRange,
    literalWithClosingQuoteRange,
    hasAdditionalArguments: firstSignificantCharacter === ',',
  }
}

const findUnescapedQuote = (line: string, quote: '"' | "'", startIndex: number): number => {
  for (let index = startIndex; index < line.length; index += 1) {
    if (line[index] !== quote) {
      continue
    }
    if (line[index - 1] === '\\') {
      continue
    }
    return index
  }
  return -1
}

const readFirstNonWhitespaceCharacter = (value: string): string | null => {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (!/\s/u.test(character)) {
      return character
    }
  }
  return null
}

const resolvePlaceholdersForKey = (
  workspace: TranslationWorkspace,
  key: string
): readonly string[] => {
  const entry = workspace.getEntriesForKey(key)[0]
  if (!entry) {
    return []
  }

  const candidates: readonly (readonly string[])[] = [
    ...entry.placeholdersByLocale.values(),
    entry.declaredPlaceholders,
  ]
  const firstNonEmpty = candidates.find((placeholderNames) => placeholderNames.length > 0) ?? []
  return [...firstNonEmpty]
}

const buildCompletionInsertion = (
  key: string,
  placeholders: readonly string[],
  callContext: TranslationCallContext,
  settings: CompletionAndPreviewSettings
): CompletionInsertion => {
  const canInsertPlaceholderSnippet =
    settings.enablePlaceholderSnippets &&
    placeholders.length > 0 &&
    !callContext.hasAdditionalArguments &&
    callContext.literalWithClosingQuoteRange !== null
  if (!canInsertPlaceholderSnippet) {
    return {
      text: key,
      range: callContext.literalRange,
      isSnippet: false,
    }
  }

  const placeholderAssignments = placeholders
    .map((placeholder, index) => `${placeholder}: \${${index + 1}:${placeholder}}`)
    .join(', ')

  return {
    text: `${key}${callContext.quote}, { ${placeholderAssignments} }`,
    range: callContext.literalWithClosingQuoteRange,
    isSnippet: true,
  }
}
