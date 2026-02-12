import * as ts from 'typescript'
import * as vscode from 'vscode'

/**
 * One detected translation key usage in code.
 */
export interface KeyUsage {
  /**
   * Referenced translation key.
   */
  readonly key: string
  /**
   * URI of the code document.
   */
  readonly uri: vscode.Uri
  /**
   * Range of the key string content (without quotes).
   */
  readonly range: vscode.Range
}

const codeFileGlob = '**/*.{ts,tsx,js,jsx}'
const excludeGlob = '**/{node_modules,dist,build,.git}/**'

/**
 * Extracts translation key usages from a TS/JS document using AST traversal.
 *
 * @param document Source code document.
 * @returns All translation key occurrences from supported call forms.
 */
export const extractKeyUsages = (document: vscode.TextDocument): readonly KeyUsage[] => {
  const sourceFile = ts.createSourceFile(
    document.fileName,
    document.getText(),
    ts.ScriptTarget.Latest,
    true,
    inferScriptKind(document.fileName)
  )

  const usages: KeyUsage[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const usage = toUsageFromCall(node, document, sourceFile)
      if (usage) {
        usages.push(usage)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return usages
}

/**
 * Finds the translation key usage under a cursor position.
 *
 * @param document Source code document.
 * @param position Cursor position.
 * @returns Matching usage or null.
 */
export const findUsageAtPosition = (
  document: vscode.TextDocument,
  position: vscode.Position
): KeyUsage | null => {
  const usage = extractKeyUsages(document).find((item) => item.range.contains(position))
  return usage ?? null
}

/**
 * Collects usages for one key from all code files in the workspace.
 *
 * @param key Translation key.
 * @returns All matching usages.
 */
export const findWorkspaceUsages = async (key: string): Promise<readonly KeyUsage[]> => {
  const uris = await vscode.workspace.findFiles(codeFileGlob, excludeGlob)
  const usages: KeyUsage[] = []
  for (const uri of uris) {
    const document = await vscode.workspace.openTextDocument(uri)
    const matches = extractKeyUsages(document).filter((usage) => usage.key === key)
    usages.push(...matches)
  }
  return usages
}

/**
 * Checks if a text document should be analyzed for key usages.
 *
 * @param document Text document.
 * @returns True for supported TS/JS documents.
 */
export const isCodeDocument = (document: vscode.TextDocument): boolean =>
  ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(document.languageId)

const toUsageFromCall = (
  node: ts.CallExpression,
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile
): KeyUsage | null => {
  if (ts.isIdentifier(node.expression)) {
    if (!isTranslatorFunction(node.expression.text)) {
      return null
    }
    const firstArgument = node.arguments[0]
    const keyLiteral = toStringLiteral(firstArgument)
    if (!keyLiteral) {
      return null
    }
    return {
      key: keyLiteral.text,
      uri: document.uri,
      range: toStringContentRange(keyLiteral.node, document, sourceFile),
    }
  }

  if (ts.isPropertyAccessExpression(node.expression)) {
    const object = node.expression.expression
    const method = node.expression.name
    if (!ts.isIdentifier(object) || !ts.isIdentifier(method)) {
      return null
    }
    if (!isTranslatorFunction(object.text) || method.text !== 'in') {
      return null
    }
    const keyLiteral = toStringLiteral(node.arguments[1])
    if (!keyLiteral) {
      return null
    }
    return {
      key: keyLiteral.text,
      uri: document.uri,
      range: toStringContentRange(keyLiteral.node, document, sourceFile),
    }
  }

  return null
}

const toStringLiteral = (
  node: ts.Node | undefined
): { readonly node: ts.StringLiteralLike; readonly text: string } | null => {
  if (!node) {
    return null
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return {
      node,
      text: node.text,
    }
  }
  return null
}

const toStringContentRange = (
  literal: ts.StringLiteralLike,
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile
): vscode.Range => {
  const start = literal.getStart(sourceFile) + 1
  const end = Math.max(start, literal.getEnd() - 1)
  return new vscode.Range(document.positionAt(start), document.positionAt(end))
}

const inferScriptKind = (fileName: string): ts.ScriptKind => {
  if (fileName.endsWith('.tsx')) {
    return ts.ScriptKind.TSX
  }
  if (fileName.endsWith('.ts')) {
    return ts.ScriptKind.TS
  }
  if (fileName.endsWith('.jsx')) {
    return ts.ScriptKind.JSX
  }
  return ts.ScriptKind.JS
}

const isTranslatorFunction = (identifier: string): boolean =>
  identifier === 't' || identifier === 'icu'
