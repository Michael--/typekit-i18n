import * as vscode from 'vscode'

/**
 * Supported raw translation file formats.
 */
export type TranslationFormat = 'yaml' | 'yml' | 'csv'

/**
 * Translation source document metadata tracked by the extension index.
 */
export interface TranslationDocument {
  /**
   * Absolute URI to the translation source file.
   */
  readonly uri: vscode.Uri
  /**
   * Source format inferred from file extension.
   */
  readonly format: TranslationFormat
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
}

class DefaultTranslationWorkspace implements TranslationWorkspace {
  private readonly refreshEmitter = new vscode.EventEmitter<readonly TranslationDocument[]>()
  private indexedDocuments: readonly TranslationDocument[] = []

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

    const discoveredFiles = new Map<string, TranslationDocument>()
    const excludeGlob = '**/{node_modules,dist,build,.git}/**'

    await Promise.all(
      translationGlobs.map(async (globPattern) => {
        const uris = await vscode.workspace.findFiles(globPattern, excludeGlob)
        for (const uri of uris) {
          const format = inferTranslationFormat(uri)
          if (format === null) {
            continue
          }

          discoveredFiles.set(uri.toString(), {
            uri,
            format,
          })
        }
      })
    )

    this.indexedDocuments = [...discoveredFiles.values()].sort((left, right) =>
      left.uri.fsPath.localeCompare(right.uri.fsPath)
    )

    this.refreshEmitter.fire(this.indexedDocuments)
  }

  public dispose(): void {
    this.refreshEmitter.dispose()
  }
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

/**
 * Creates the in-memory translation workspace index.
 *
 * @returns Translation workspace instance used by feature modules.
 */
export const createTranslationWorkspace = (): TranslationWorkspace =>
  new DefaultTranslationWorkspace()
