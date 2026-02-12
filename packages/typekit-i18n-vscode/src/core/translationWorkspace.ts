import * as vscode from 'vscode'
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from 'yaml'

import { parseCsvDocument } from './csvParser'
import { DIAGNOSTIC_CODES } from './diagnosticCodes'
import { extractPlaceholderNames } from './placeholders'

/**
 * Supported raw translation file formats.
 */
export type TranslationFormat = 'yaml' | 'yml' | 'csv'

/**
 * One indexed translation entry from YAML or CSV input.
 */
export interface TranslationEntry {
  /**
   * Stable translation key.
   */
  readonly key: string
  /**
   * Source file URI where the key is defined.
   */
  readonly uri: vscode.Uri
  /**
   * Source format of the translation entry.
   */
  readonly format: TranslationFormat
  /**
   * Range of the key token in the source file.
   */
  readonly keyRange: vscode.Range
  /**
   * Per-locale translated values.
   */
  readonly values: ReadonlyMap<string, string>
  /**
   * Per-locale value ranges when present in the source file.
   */
  readonly valueRanges: ReadonlyMap<string, vscode.Range>
  /**
   * Per-locale extracted placeholders from message templates.
   */
  readonly placeholdersByLocale: ReadonlyMap<string, readonly string[]>
  /**
   * Explicit placeholder names declared by metadata, if available.
   */
  readonly declaredPlaceholders: readonly string[]
  /**
   * Insert position for adding missing locale values when supported.
   */
  readonly valueInsertPosition: vscode.Position | null
}

/**
 * One indexed translation source document.
 */
export interface TranslationDocument {
  /**
   * File URI for the source document.
   */
  readonly uri: vscode.Uri
  /**
   * Source format inferred from file extension.
   */
  readonly format: TranslationFormat
  /**
   * Locale codes discovered for this document.
   */
  readonly languages: readonly string[]
  /**
   * Source language if provided by the document.
   */
  readonly sourceLanguage?: string
  /**
   * Parsed translation entries for this document.
   */
  readonly entries: readonly TranslationEntry[]
  /**
   * Preferred append position for creating new keys.
   */
  readonly appendPosition: vscode.Position
  /**
   * CSV header column order when this document is CSV.
   */
  readonly csvHeaders?: readonly string[]
  /**
   * Locale column names when this document is CSV.
   */
  readonly csvLocaleHeaders?: readonly string[]
}

/**
 * Mutable workspace-wide translation index contract.
 */
export interface TranslationWorkspace extends vscode.Disposable {
  /**
   * Emits after each refresh with the current indexed document list.
   */
  readonly onDidRefresh: vscode.Event<readonly TranslationDocument[]>
  /**
   * Current indexed translation documents.
   */
  readonly documents: readonly TranslationDocument[]
  /**
   * Rebuilds the translation index from configured workspace globs.
   *
   * @returns Promise resolved after the index has been rebuilt.
   */
  refresh(): Promise<void>
  /**
   * Returns all indexed translation keys sorted alphabetically.
   *
   * @returns Sorted list of unique keys.
   */
  getAllKeys(): readonly string[]
  /**
   * Checks whether a translation key exists.
   *
   * @param key Translation key.
   * @returns True when at least one definition exists.
   */
  hasKey(key: string): boolean
  /**
   * Returns all definitions for a translation key.
   *
   * @param key Translation key.
   * @returns Indexed entries for the key.
   */
  getEntriesForKey(key: string): readonly TranslationEntry[]
  /**
   * Finds an entry under a cursor position in translation source files.
   *
   * @param uri Source document URI.
   * @param position Cursor position.
   * @returns Matching entry or null.
   */
  findEntryAtPosition(uri: vscode.Uri, position: vscode.Position): TranslationEntry | null
  /**
   * Returns workspace-level translation diagnostics grouped by URI.
   *
   * @returns Map keyed by URI string.
   */
  getDiagnosticsByUri(): ReadonlyMap<string, readonly vscode.Diagnostic[]>
  /**
   * Returns all known locale codes discovered from indexed documents.
   *
   * @returns Sorted locale list.
   */
  getKnownLanguages(): readonly string[]
  /**
   * Builds an edit to create a missing key in a preferred translation file.
   *
   * @param key Missing translation key.
   * @returns Workspace edit or null when no target file exists.
   */
  createMissingKeyEdit(key: string): vscode.WorkspaceEdit | null
  /**
   * Builds an edit to add or fill a missing locale value.
   *
   * @param entry Translation entry requiring locale value.
   * @param locale Locale to fill.
   * @returns Workspace edit or null when no safe edit can be generated.
   */
  createMissingLocaleEdit(entry: TranslationEntry, locale: string): vscode.WorkspaceEdit | null
}

class DefaultTranslationWorkspace implements TranslationWorkspace {
  private readonly refreshEmitter = new vscode.EventEmitter<readonly TranslationDocument[]>()
  private indexedDocuments: readonly TranslationDocument[] = []
  private entriesByKey = new Map<string, readonly TranslationEntry[]>()
  private diagnosticsByUri = new Map<string, readonly vscode.Diagnostic[]>()
  private knownLanguages: readonly string[] = []

  public get onDidRefresh(): vscode.Event<readonly TranslationDocument[]> {
    return this.refreshEmitter.event
  }

  public get documents(): readonly TranslationDocument[] {
    return this.indexedDocuments
  }

  public async refresh(): Promise<void> {
    const translationGlobs = vscode.workspace
      .getConfiguration('typekitI18n')
      .get<readonly string[]>('translationGlobs', ['**/translations/**/*.{yaml,yml,csv}'])

    const discoveredByUri = new Map<string, TranslationDocument>()
    const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>()
    const excludeGlob = '**/{node_modules,dist,build,.git}/**'

    await Promise.all(
      translationGlobs.map(async (globPattern) => {
        const uris = await vscode.workspace.findFiles(globPattern, excludeGlob)
        await Promise.all(
          uris.map(async (uri) => {
            const format = inferTranslationFormat(uri)
            if (format === null) {
              return
            }

            const parsedDocument = await parseTranslationDocument(uri, format)
            discoveredByUri.set(uri.toString(), parsedDocument.document)
            if (parsedDocument.diagnostics.length > 0) {
              diagnosticsByUri.set(uri.toString(), [...parsedDocument.diagnostics])
            }
          })
        )
      })
    )

    this.indexedDocuments = [...discoveredByUri.values()].sort((left, right) =>
      left.uri.fsPath.localeCompare(right.uri.fsPath)
    )
    this.rebuildEntryIndexAndDiagnostics(diagnosticsByUri)
    this.refreshEmitter.fire(this.indexedDocuments)
  }

  public getAllKeys(): readonly string[] {
    return [...this.entriesByKey.keys()].sort((left, right) => left.localeCompare(right))
  }

  public hasKey(key: string): boolean {
    return this.entriesByKey.has(key)
  }

  public getEntriesForKey(key: string): readonly TranslationEntry[] {
    return this.entriesByKey.get(key) ?? []
  }

  public findEntryAtPosition(uri: vscode.Uri, position: vscode.Position): TranslationEntry | null {
    const document = this.indexedDocuments.find((item) => item.uri.toString() === uri.toString())
    if (!document) {
      return null
    }

    const matchingEntry =
      document.entries.find((entry) => entry.keyRange.contains(position)) ?? null
    return matchingEntry
  }

  public getDiagnosticsByUri(): ReadonlyMap<string, readonly vscode.Diagnostic[]> {
    return this.diagnosticsByUri
  }

  public getKnownLanguages(): readonly string[] {
    return this.knownLanguages
  }

  public createMissingKeyEdit(key: string): vscode.WorkspaceEdit | null {
    if (this.indexedDocuments.length === 0) {
      return null
    }

    const target =
      this.indexedDocuments.find(
        (document) => document.format === 'yaml' || document.format === 'yml'
      ) ?? this.indexedDocuments[0]

    const locales = target.languages.length > 0 ? target.languages : this.knownLanguages
    const edit = new vscode.WorkspaceEdit()

    if (target.format === 'yaml' || target.format === 'yml') {
      const escapedKey = key.replace(/'/g, "''")
      const valuesBlock =
        locales.length > 0
          ? `\n${locales.map((locale) => `      ${locale}: ''`).join('\n')}`
          : "\n      en: ''"
      const newEntryBlock = `\n  - key: '${escapedKey}'\n    values:${valuesBlock}\n`
      edit.insert(target.uri, target.appendPosition, newEntryBlock)
      return edit
    }

    const headers = target.csvHeaders ?? ['key']
    const localeHeaders = target.csvLocaleHeaders ?? []
    const rowValues = headers.map((header) => {
      if (header === 'key') {
        return key
      }
      if (header === 'description') {
        return ''
      }
      if (localeHeaders.includes(header)) {
        return ''
      }
      return ''
    })
    const csvRow = rowValues.map(toCsvCell).join(',')
    const prefix = target.appendPosition.character === 0 ? '' : '\n'
    edit.insert(target.uri, target.appendPosition, `${prefix}${csvRow}\n`)
    return edit
  }

  public createMissingLocaleEdit(
    entry: TranslationEntry,
    locale: string
  ): vscode.WorkspaceEdit | null {
    const edit = new vscode.WorkspaceEdit()
    const existingRange = entry.valueRanges.get(locale)
    const existingValue = entry.values.get(locale)

    if (existingRange && typeof existingValue === 'string') {
      edit.replace(entry.uri, existingRange, "''")
      return edit
    }

    if (!existingRange && entry.valueInsertPosition && entry.format !== 'csv') {
      edit.insert(entry.uri, entry.valueInsertPosition, `\n      ${locale}: ''`)
      return edit
    }

    if (entry.format === 'csv') {
      return null
    }

    return null
  }

  public dispose(): void {
    this.refreshEmitter.dispose()
  }

  private rebuildEntryIndexAndDiagnostics(
    baseDiagnosticsByUri: Map<string, vscode.Diagnostic[]>
  ): void {
    const entriesByKey = new Map<string, TranslationEntry[]>()
    const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>()

    for (const [uriString, diagnostics] of baseDiagnosticsByUri.entries()) {
      diagnosticsByUri.set(uriString, [...diagnostics])
    }

    const languageSet = new Set<string>()
    for (const document of this.indexedDocuments) {
      document.languages.forEach((language) => {
        languageSet.add(language)
      })
      document.entries.forEach((entry) => {
        entry.values.forEach((_value, locale) => {
          languageSet.add(locale)
        })
        const bucket = entriesByKey.get(entry.key) ?? []
        bucket.push(entry)
        entriesByKey.set(entry.key, bucket)
      })
    }

    this.knownLanguages = [...languageSet].sort((left, right) => left.localeCompare(right))

    for (const duplicateEntries of entriesByKey.values()) {
      if (duplicateEntries.length <= 1) {
        continue
      }

      duplicateEntries.forEach((entry) => {
        this.pushDiagnostic(
          diagnosticsByUri,
          entry.uri,
          createDiagnostic(
            entry.keyRange,
            `Duplicate translation key "${entry.key}" found in multiple files.`,
            vscode.DiagnosticSeverity.Error,
            DIAGNOSTIC_CODES.duplicateKey
          )
        )
      })
    }

    for (const document of this.indexedDocuments) {
      const requiredLocales =
        document.languages.length > 0 ? document.languages : this.knownLanguages

      document.entries.forEach((entry) => {
        requiredLocales.forEach((locale) => {
          const value = entry.values.get(locale)
          if (typeof value === 'string' && value.trim().length > 0) {
            return
          }

          this.pushDiagnostic(
            diagnosticsByUri,
            entry.uri,
            createDiagnostic(
              entry.keyRange,
              `Missing translation value for locale "${locale}" in key "${entry.key}".`,
              vscode.DiagnosticSeverity.Warning,
              encodeDiagnosticCode(DIAGNOSTIC_CODES.missingLocaleValue, {
                key: entry.key,
                locale,
              })
            )
          )
        })

        const baseLocale =
          document.sourceLanguage ??
          requiredLocales.find((locale) => {
            const value = entry.values.get(locale)
            return typeof value === 'string' && value.trim().length > 0
          })

        if (!baseLocale) {
          return
        }

        const basePlaceholders =
          entry.placeholdersByLocale.get(baseLocale) ?? entry.declaredPlaceholders
        const baseFingerprint = basePlaceholders.join('|')
        requiredLocales.forEach((locale) => {
          const current = entry.placeholdersByLocale.get(locale) ?? []
          if (current.join('|') === baseFingerprint) {
            return
          }

          this.pushDiagnostic(
            diagnosticsByUri,
            entry.uri,
            createDiagnostic(
              entry.keyRange,
              `Placeholder mismatch for key "${entry.key}" in locale "${locale}" compared with "${baseLocale}".`,
              vscode.DiagnosticSeverity.Warning,
              DIAGNOSTIC_CODES.placeholderMismatch
            )
          )
        })
      })
    }

    this.entriesByKey = new Map(
      [...entriesByKey.entries()].map(([key, entries]) => [key, [...entries]])
    )
    this.diagnosticsByUri = new Map(
      [...diagnosticsByUri.entries()].map(([uri, diagnostics]) => [uri, [...diagnostics]])
    )
  }

  private pushDiagnostic(
    diagnosticsByUri: Map<string, vscode.Diagnostic[]>,
    uri: vscode.Uri,
    diagnostic: vscode.Diagnostic
  ): void {
    const key = uri.toString()
    const diagnostics = diagnosticsByUri.get(key) ?? []
    diagnostics.push(diagnostic)
    diagnosticsByUri.set(key, diagnostics)
  }
}

interface ParsedDocumentResult {
  readonly document: TranslationDocument
  readonly diagnostics: readonly vscode.Diagnostic[]
}

const parseTranslationDocument = async (
  uri: vscode.Uri,
  format: TranslationFormat
): Promise<ParsedDocumentResult> => {
  const document = await vscode.workspace.openTextDocument(uri)
  const content = document.getText()
  return format === 'csv'
    ? parseCsvTranslationDocument(document, content)
    : parseYamlTranslationDocument(document, content, format)
}

const parseYamlTranslationDocument = (
  document: vscode.TextDocument,
  content: string,
  format: 'yaml' | 'yml'
): ParsedDocumentResult => {
  const diagnostics: vscode.Diagnostic[] = []
  const lineCounter = new LineCounter()
  const parsed = parseDocument(content, {
    lineCounter,
    uniqueKeys: false,
  })

  parsed.errors.forEach((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Invalid YAML syntax.'
    const position =
      typeof error === 'object' &&
      error !== null &&
      'pos' in error &&
      Array.isArray((error as { pos: unknown }).pos) &&
      (error as { pos: unknown[] }).pos.length >= 2 &&
      typeof (error as { pos: unknown[] }).pos[0] === 'number' &&
      typeof (error as { pos: unknown[] }).pos[1] === 'number'
        ? [(error as { pos: [number, number] }).pos[0], (error as { pos: [number, number] }).pos[1]]
        : [0, 1]
    diagnostics.push(
      new vscode.Diagnostic(
        toRangeFromOffsets(position[0], position[1], lineCounter),
        message,
        vscode.DiagnosticSeverity.Error
      )
    )
    diagnostics[diagnostics.length - 1].source = 'typekit-i18n'
    diagnostics[diagnostics.length - 1].code = DIAGNOSTIC_CODES.parseError
  })

  const entries: TranslationEntry[] = []
  const languages: string[] = []
  let sourceLanguage: string | undefined

  if (!isMap(parsed.contents)) {
    diagnostics.push(
      createDiagnostic(
        new vscode.Range(0, 0, 0, 1),
        'YAML root must be an object.',
        vscode.DiagnosticSeverity.Error,
        DIAGNOSTIC_CODES.invalidSchema
      )
    )
  } else {
    const sourceLanguageNode = parsed.contents.get('sourceLanguage', true)
    if (isScalar(sourceLanguageNode) && typeof sourceLanguageNode.value === 'string') {
      sourceLanguage = sourceLanguageNode.value
    }

    const languagesNode = parsed.contents.get('languages', true)
    if (languagesNode && !isSeq(languagesNode)) {
      diagnostics.push(
        createDiagnostic(
          toRangeFromNode(languagesNode, lineCounter),
          '"languages" must be an array.',
          vscode.DiagnosticSeverity.Error,
          DIAGNOSTIC_CODES.invalidSchema
        )
      )
    }
    if (isSeq(languagesNode)) {
      const items = [...languagesNode.items]
      items.forEach((itemNode: unknown) => {
        if (isScalar(itemNode) && typeof itemNode.value === 'string') {
          languages.push(itemNode.value)
        }
      })
    }

    const entriesNode = parsed.contents.get('entries', true)
    if (!entriesNode || !isSeq(entriesNode)) {
      diagnostics.push(
        createDiagnostic(
          new vscode.Range(0, 0, 0, 1),
          '"entries" must be an array.',
          vscode.DiagnosticSeverity.Error,
          DIAGNOSTIC_CODES.invalidSchema
        )
      )
    } else {
      const items = [...entriesNode.items]
      items.forEach((entryNode: unknown) => {
        if (!isMap(entryNode)) {
          diagnostics.push(
            createDiagnostic(
              toRangeFromNode(entryNode, lineCounter),
              'Each entry must be an object.',
              vscode.DiagnosticSeverity.Error,
              DIAGNOSTIC_CODES.invalidSchema
            )
          )
          return
        }

        const keyNode = entryNode.get('key', true)
        if (!isScalar(keyNode) || typeof keyNode.value !== 'string') {
          diagnostics.push(
            createDiagnostic(
              toRangeFromNode(entryNode, lineCounter),
              'Entry key must be a string.',
              vscode.DiagnosticSeverity.Error,
              DIAGNOSTIC_CODES.invalidSchema
            )
          )
          return
        }

        const valuesNode = entryNode.get('values', true)
        if (!valuesNode || !isMap(valuesNode)) {
          diagnostics.push(
            createDiagnostic(
              toRangeFromNode(entryNode, lineCounter),
              'Entry "values" must be an object.',
              vscode.DiagnosticSeverity.Error,
              DIAGNOSTIC_CODES.invalidSchema
            )
          )
          return
        }

        const declaredPlaceholders = parseDeclaredPlaceholders(entryNode)
        const valueMap = new Map<string, string>()
        const valueRanges = new Map<string, vscode.Range>()
        const placeholdersByLocale = new Map<string, readonly string[]>()

        const valuePairs = [...valuesNode.items]
        valuePairs.forEach((pair: unknown) => {
          if (!pair || typeof pair !== 'object' || !('key' in pair)) {
            return
          }
          const typedPair = pair as {
            key: unknown
            value: unknown
          }
          if (!isScalar(typedPair.key) || typeof typedPair.key.value !== 'string') {
            return
          }
          const locale = typedPair.key.value
          const valueNode = typedPair.value
          const valueText =
            isScalar(valueNode) && typeof valueNode.value === 'string' ? valueNode.value : ''
          valueMap.set(locale, valueText)
          valueRanges.set(locale, toRangeFromNode(valueNode ?? typedPair.key, lineCounter))
          placeholdersByLocale.set(locale, extractPlaceholderNames(valueText))
        })

        entries.push({
          key: keyNode.value,
          uri: document.uri,
          format,
          keyRange: toRangeFromNode(keyNode, lineCounter),
          values: valueMap,
          valueRanges,
          placeholdersByLocale,
          declaredPlaceholders,
          valueInsertPosition: toPositionFromOffset((valuesNode.range?.[1] ?? 0) - 1, lineCounter),
        })
      })
    }
  }

  const parsedDocument: TranslationDocument = {
    uri: document.uri,
    format,
    languages,
    sourceLanguage,
    entries,
    appendPosition: document.positionAt(content.length),
  }

  return {
    document: parsedDocument,
    diagnostics,
  }
}

const parseCsvTranslationDocument = (
  document: vscode.TextDocument,
  content: string
): ParsedDocumentResult => {
  const diagnostics: vscode.Diagnostic[] = []
  const parsedCsv = parseCsvDocument(content)
  parsedCsv.errors.forEach((error) => {
    diagnostics.push(
      createDiagnostic(
        new vscode.Range(error.line - 1, 0, error.line - 1, 1),
        `CSV parse error: ${error.message}`,
        vscode.DiagnosticSeverity.Error,
        DIAGNOSTIC_CODES.parseError
      )
    )
  })

  if (parsedCsv.rows.length === 0) {
    return {
      document: {
        uri: document.uri,
        format: 'csv',
        languages: [],
        entries: [],
        appendPosition: document.positionAt(content.length),
      },
      diagnostics,
    }
  }

  const headerRow = parsedCsv.rows[0]
  const headers = headerRow.cells.map((cell) => cell.value)
  const keyColumnIndex = headers.indexOf('key')
  if (keyColumnIndex === -1) {
    diagnostics.push(
      createDiagnostic(
        headerRow.cells[0]?.range ?? new vscode.Range(0, 0, 0, 1),
        'CSV header must include "key" column.',
        vscode.DiagnosticSeverity.Error,
        DIAGNOSTIC_CODES.missingKeyHeader
      )
    )
  }

  const localeColumns = headers.filter((header) => isLocaleColumn(header, headers, keyColumnIndex))
  if (localeColumns.length === 0) {
    diagnostics.push(
      createDiagnostic(
        headerRow.cells[0]?.range ?? new vscode.Range(0, 0, 0, 1),
        'CSV requires at least one locale column.',
        vscode.DiagnosticSeverity.Error,
        DIAGNOSTIC_CODES.invalidSchema
      )
    )
  }

  const entries: TranslationEntry[] = []
  parsedCsv.rows.slice(1).forEach((row) => {
    const keyCell = row.cells[keyColumnIndex]
    const key = keyCell?.value ?? ''
    if (key.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(
          keyCell?.range ?? new vscode.Range(row.line - 1, 0, row.line - 1, 1),
          'CSV row has empty key.',
          vscode.DiagnosticSeverity.Error,
          DIAGNOSTIC_CODES.invalidSchema
        )
      )
      return
    }

    const valueMap = new Map<string, string>()
    const valueRanges = new Map<string, vscode.Range>()
    const placeholdersByLocale = new Map<string, readonly string[]>()

    localeColumns.forEach((localeHeader) => {
      const localeIndex = headers.indexOf(localeHeader)
      const localeCell = row.cells[localeIndex]
      const localeValue = localeCell?.value ?? ''
      valueMap.set(localeHeader, localeValue)
      if (localeCell) {
        valueRanges.set(localeHeader, localeCell.range)
      }
      placeholdersByLocale.set(localeHeader, extractPlaceholderNames(localeValue))
    })

    entries.push({
      key,
      uri: document.uri,
      format: 'csv',
      keyRange: keyCell?.range ?? new vscode.Range(row.line - 1, 0, row.line - 1, key.length),
      values: valueMap,
      valueRanges,
      placeholdersByLocale,
      declaredPlaceholders: [],
      valueInsertPosition: null,
    })
  })

  return {
    document: {
      uri: document.uri,
      format: 'csv',
      languages: localeColumns,
      entries,
      appendPosition: document.positionAt(content.length),
      csvHeaders: headers,
      csvLocaleHeaders: localeColumns,
    },
    diagnostics,
  }
}

const parseDeclaredPlaceholders = (entryNode: unknown): readonly string[] => {
  if (!entryNode || !isMap(entryNode)) {
    return []
  }

  const placeholdersNode = entryNode.get('placeholders', true)
  if (!placeholdersNode || !isSeq(placeholdersNode)) {
    return []
  }

  const names = new Set<string>()
  const items = [...placeholdersNode.items]
  items.forEach((placeholderNode: unknown) => {
    if (!isMap(placeholderNode)) {
      return
    }
    const nameNode = placeholderNode.get('name', true)
    if (isScalar(nameNode) && typeof nameNode.value === 'string') {
      names.add(nameNode.value)
    }
  })

  return [...names].sort((left, right) => left.localeCompare(right))
}

const isLocaleColumn = (
  header: string,
  headers: readonly string[],
  keyColumnIndex: number
): boolean => {
  if (keyColumnIndex === -1) {
    return false
  }
  if (header === 'key') {
    return false
  }
  if (
    header === 'description' ||
    header === 'status' ||
    header === 'category' ||
    header === 'tags' ||
    header === 'placeholders'
  ) {
    return false
  }
  if (header.startsWith('placeholder')) {
    return false
  }
  return headers.indexOf(header) >= 0
}

const toRangeFromNode = (node: unknown, lineCounter: LineCounter): vscode.Range => {
  if (!node || typeof node !== 'object' || !('range' in node)) {
    return new vscode.Range(0, 0, 0, 1)
  }

  const range = (node as { range?: readonly number[] }).range
  const startOffset = range?.[0] ?? 0
  const endOffset = range?.[1] ?? startOffset + 1
  return toRangeFromOffsets(startOffset, endOffset, lineCounter)
}

const toRangeFromOffsets = (
  startOffset: number,
  endOffset: number,
  lineCounter: LineCounter
): vscode.Range => {
  const safeStart = Math.max(0, startOffset)
  const safeEnd = Math.max(safeStart + 1, endOffset)
  const start = toPositionFromOffset(safeStart, lineCounter)
  const end = toPositionFromOffset(safeEnd, lineCounter)
  return new vscode.Range(start, end)
}

const toPositionFromOffset = (offset: number, lineCounter: LineCounter): vscode.Position => {
  const safeOffset = Math.max(0, offset)
  const position = lineCounter.linePos(safeOffset)
  return new vscode.Position(Math.max(0, position.line - 1), Math.max(0, position.col - 1))
}

const createDiagnostic = (
  range: vscode.Range,
  message: string,
  severity: vscode.DiagnosticSeverity,
  code: string
): vscode.Diagnostic => {
  const diagnostic = new vscode.Diagnostic(range, message, severity)
  diagnostic.code = code
  diagnostic.source = 'typekit-i18n'
  return diagnostic
}

const encodeDiagnosticCode = (code: string, payload: Record<string, string>): string => {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  return `${code}|${encodedPayload}`
}

const inferTranslationFormat = (uri: vscode.Uri): TranslationFormat | null => {
  const lowerCasePath = uri.path.toLowerCase()
  if (lowerCasePath.endsWith('.yaml')) {
    return 'yaml'
  }
  if (lowerCasePath.endsWith('.yml')) {
    return 'yml'
  }
  if (lowerCasePath.endsWith('.csv')) {
    return 'csv'
  }
  return null
}

const toCsvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`

/**
 * Creates the in-memory translation workspace index.
 *
 * @returns Translation workspace instance used by feature modules.
 */
export const createTranslationWorkspace = (): TranslationWorkspace =>
  new DefaultTranslationWorkspace()
