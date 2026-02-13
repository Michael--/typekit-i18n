import { accessSync, constants, readFileSync, statSync } from 'node:fs'
import { dirname, extname, isAbsolute, resolve } from 'node:path'
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
const TRANSLATOR_FACTORY_EXPORT_NAMES = new Set<string>(['createTranslator', 'createIcuTranslator'])
const DEFAULT_TRANSLATOR_IDENTIFIERS = new Set<string>(['t', 'icu'])
const RESOLVABLE_MODULE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
] as const

interface ModuleTranslatorMetadata {
  readonly exportedTranslatorNames: ReadonlySet<string>
}

interface CachedModuleMetadata {
  readonly modifiedAtMs: number
  readonly metadata: ModuleTranslatorMetadata | null
}

const moduleTranslatorMetadataCache = new Map<string, CachedModuleMetadata>()

/**
 * Extracts translation key usages from a TS/JS document using AST traversal.
 *
 * @param document Source code document.
 * @returns All translation key occurrences from supported call forms.
 */
export const extractKeyUsages = (document: vscode.TextDocument): readonly KeyUsage[] => {
  const sourceFile = toSourceFile(document)
  const translatorAnalysis = collectTranslatorIdentifierAnalysis(sourceFile, document.fileName, [
    document.fileName,
  ])

  const usages: KeyUsage[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const usage = toUsageFromCall(node, document, sourceFile, translatorAnalysis)
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
 * Checks whether an identifier is recognized as a translation function in one document.
 *
 * Recognized identifiers include:
 * - built-ins (`t`, `icu`)
 * - variables initialized from `createTranslator(...)` / `createIcuTranslator(...)`
 * - aliases imported from `@number10/typekit-i18n*`
 *
 * @param document Source code document.
 * @param identifier Function identifier name to verify.
 * @returns True when identifier is recognized as translation function.
 */
export const isTranslatorIdentifierInDocument = (
  document: vscode.TextDocument,
  identifier: string
): boolean => {
  const sourceFile = toSourceFile(document)
  return collectTranslatorIdentifierAnalysis(sourceFile, document.fileName, [
    document.fileName,
  ]).identifiers.has(identifier)
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
  sourceFile: ts.SourceFile,
  translatorAnalysis: TranslatorIdentifierAnalysis
): KeyUsage | null => {
  if (ts.isIdentifier(node.expression)) {
    if (!isTranslatorIdentifier(node.expression.text, translatorAnalysis.identifiers)) {
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

    if (method.text === 'in') {
      if (!isTranslatorIdentifier(object.text, translatorAnalysis.identifiers)) {
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

    const namespaceMembers = translatorAnalysis.namespaceMemberTranslators.get(object.text)
    if (!namespaceMembers || !namespaceMembers.has(method.text)) {
      return null
    }
    const keyLiteral = toStringLiteral(node.arguments[0])
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
  if (fileName.endsWith('.ts') || fileName.endsWith('.mts') || fileName.endsWith('.cts')) {
    return ts.ScriptKind.TS
  }
  if (fileName.endsWith('.jsx')) {
    return ts.ScriptKind.JSX
  }
  return ts.ScriptKind.JS
}

const isTranslatorIdentifier = (
  identifier: string,
  translatorIdentifiers: ReadonlySet<string>
): boolean => translatorIdentifiers.has(identifier)

const toSourceFile = (document: vscode.TextDocument): ts.SourceFile =>
  ts.createSourceFile(
    document.fileName,
    document.getText(),
    ts.ScriptTarget.Latest,
    true,
    inferScriptKind(document.fileName)
  )

interface TranslatorFactoryResolution {
  readonly identifierFactories: ReadonlySet<string>
  readonly namespaceFactories: ReadonlySet<string>
}

interface TranslatorIdentifierAnalysis {
  readonly identifiers: ReadonlySet<string>
  readonly namespaceMemberTranslators: ReadonlyMap<string, ReadonlySet<string>>
}

const collectTranslatorIdentifierAnalysis = (
  sourceFile: ts.SourceFile,
  sourceFilePath: string,
  activeChainInput?: Iterable<string>
): TranslatorIdentifierAnalysis => {
  const activeChain = new Set<string>(activeChainInput ?? [])
  const identifiers = new Set<string>(DEFAULT_TRANSLATOR_IDENTIFIERS)
  const namespaceMemberTranslators = new Map<string, ReadonlySet<string>>()
  const factoryResolution = collectTranslatorFactoryResolution(sourceFile)

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      return
    }

    const importClause = statement.importClause
    if (!importClause) {
      return
    }
    const resolvedImportPath = resolveImportFilePath(sourceFilePath, statement.moduleSpecifier.text)
    if (!resolvedImportPath) {
      return
    }

    const importedMetadata = readModuleTranslatorMetadata(resolvedImportPath, activeChain)
    if (!importedMetadata) {
      return
    }
    const exportedNames = importedMetadata.exportedTranslatorNames

    if (importClause.name && exportedNames.has('default')) {
      identifiers.add(importClause.name.text)
    }

    const namedBindings = importClause.namedBindings
    if (!namedBindings) {
      return
    }
    if (ts.isNamespaceImport(namedBindings)) {
      namespaceMemberTranslators.set(namedBindings.name.text, exportedNames)
      return
    }

    namedBindings.elements.forEach((importSpecifier) => {
      const importedName = importSpecifier.propertyName?.text ?? importSpecifier.name.text
      if (!exportedNames.has(importedName)) {
        return
      }
      identifiers.add(importSpecifier.name.text)
    })
  })

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (isTranslatorFactoryInitializer(node.initializer, factoryResolution)) {
        identifiers.add(node.name.text)
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      if (isTranslatorFactoryInitializer(node.right, factoryResolution)) {
        identifiers.add(node.left.text)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return {
    identifiers,
    namespaceMemberTranslators,
  }
}

const collectTranslatorFactoryResolution = (
  sourceFile: ts.SourceFile
): TranslatorFactoryResolution => {
  const identifierFactories = new Set<string>(TRANSLATOR_FACTORY_EXPORT_NAMES)
  const namespaceFactories = new Set<string>()

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      return
    }

    const moduleName = statement.moduleSpecifier.text
    if (!isTypekitModuleName(moduleName)) {
      return
    }

    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings) {
      return
    }

    if (ts.isNamespaceImport(namedBindings)) {
      namespaceFactories.add(namedBindings.name.text)
      return
    }

    namedBindings.elements.forEach((importSpecifier) => {
      const importedName = importSpecifier.propertyName?.text ?? importSpecifier.name.text
      if (!TRANSLATOR_FACTORY_EXPORT_NAMES.has(importedName)) {
        return
      }
      identifierFactories.add(importSpecifier.name.text)
    })
  })

  return {
    identifierFactories,
    namespaceFactories,
  }
}

const isTypekitModuleName = (moduleName: string): boolean =>
  moduleName === '@number10/typekit-i18n' || moduleName.startsWith('@number10/typekit-i18n/')

const hasExportModifier = (node: { readonly modifiers?: ts.NodeArray<ts.ModifierLike> }): boolean =>
  node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false

const isReadableFile = (filePath: string): boolean => {
  try {
    accessSync(filePath, constants.R_OK)
    return true
  } catch {
    return false
  }
}

const resolveImportFilePath = (fromFilePath: string, moduleSpecifier: string): string | null => {
  if (!moduleSpecifier.startsWith('.') && !isAbsolute(moduleSpecifier)) {
    return null
  }
  const basePath = isAbsolute(moduleSpecifier)
    ? moduleSpecifier
    : resolve(dirname(fromFilePath), moduleSpecifier)
  const explicitExtension = extname(basePath)

  const candidates: string[] = []
  if (explicitExtension.length > 0) {
    candidates.push(basePath)
  } else {
    RESOLVABLE_MODULE_EXTENSIONS.forEach((extension) => {
      candidates.push(`${basePath}${extension}`)
    })
    RESOLVABLE_MODULE_EXTENSIONS.forEach((extension) => {
      candidates.push(resolve(basePath, `index${extension}`))
    })
  }

  const readableCandidate =
    candidates.find((candidatePath) => isReadableFile(candidatePath)) ?? null
  return readableCandidate
}

const readModuleTranslatorMetadata = (
  modulePath: string,
  activeChain: Set<string>
): ModuleTranslatorMetadata | null => {
  if (activeChain.has(modulePath)) {
    return null
  }

  let modifiedAtMs: number
  try {
    modifiedAtMs = statSync(modulePath).mtimeMs
  } catch {
    return null
  }

  const cached = moduleTranslatorMetadataCache.get(modulePath)
  if (cached && cached.modifiedAtMs === modifiedAtMs) {
    return cached.metadata
  }

  let content: string
  try {
    content = readFileSync(modulePath, 'utf8')
  } catch {
    moduleTranslatorMetadataCache.set(modulePath, {
      modifiedAtMs,
      metadata: null,
    })
    return null
  }

  const sourceFile = ts.createSourceFile(
    modulePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    inferScriptKind(modulePath)
  )
  const nextChain = new Set(activeChain)
  nextChain.add(modulePath)
  const exportedTranslatorNames = collectExportedTranslatorNames(sourceFile, modulePath, nextChain)
  const metadata: ModuleTranslatorMetadata = {
    exportedTranslatorNames,
  }
  moduleTranslatorMetadataCache.set(modulePath, {
    modifiedAtMs,
    metadata,
  })
  return metadata
}

const collectExportedTranslatorNames = (
  sourceFile: ts.SourceFile,
  sourceFilePath: string,
  activeChain: Set<string>
): ReadonlySet<string> => {
  const exportedNames = new Set<string>()
  const localAnalysis = collectTranslatorIdentifierAnalysis(sourceFile, sourceFilePath, activeChain)
  const factoryResolution = collectTranslatorFactoryResolution(sourceFile)

  sourceFile.statements.forEach((statement) => {
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      statement.declarationList.declarations.forEach((declaration) => {
        if (!ts.isIdentifier(declaration.name)) {
          return
        }
        if (
          localAnalysis.identifiers.has(declaration.name.text) ||
          isTranslatorFactoryInitializer(declaration.initializer, factoryResolution)
        ) {
          exportedNames.add(declaration.name.text)
        }
      })
      return
    }

    if (ts.isExportAssignment(statement)) {
      if (
        ts.isIdentifier(statement.expression) &&
        localAnalysis.identifiers.has(statement.expression.text)
      ) {
        exportedNames.add('default')
        return
      }
      if (isTranslatorFactoryInitializer(statement.expression, factoryResolution)) {
        exportedNames.add('default')
      }
      return
    }

    if (!ts.isExportDeclaration(statement) || !statement.exportClause) {
      return
    }

    if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const reExportPath = resolveImportFilePath(sourceFilePath, statement.moduleSpecifier.text)
      if (!reExportPath) {
        return
      }
      const reExportMetadata = readModuleTranslatorMetadata(reExportPath, activeChain)
      if (!reExportMetadata) {
        return
      }

      if (ts.isNamedExports(statement.exportClause)) {
        statement.exportClause.elements.forEach((element) => {
          const importedName = element.propertyName?.text ?? element.name.text
          if (!reExportMetadata.exportedTranslatorNames.has(importedName)) {
            return
          }
          exportedNames.add(element.name.text)
        })
      }
      return
    }

    if (ts.isNamedExports(statement.exportClause)) {
      statement.exportClause.elements.forEach((element) => {
        const localName = element.propertyName?.text ?? element.name.text
        if (!localAnalysis.identifiers.has(localName)) {
          return
        }
        exportedNames.add(element.name.text)
      })
    }
  })

  return exportedNames
}

const isTranslatorFactoryInitializer = (
  initializer: ts.Expression | undefined,
  factoryResolution: TranslatorFactoryResolution
): boolean => {
  if (!initializer) {
    return false
  }

  const expression = unwrapExpression(initializer)
  if (!ts.isCallExpression(expression)) {
    return false
  }

  return isTranslatorFactoryExpression(expression.expression, factoryResolution)
}

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression)
  }
  if (ts.isAsExpression(expression)) {
    return unwrapExpression(expression.expression)
  }
  if (ts.isTypeAssertionExpression(expression)) {
    return unwrapExpression(expression.expression)
  }
  if (ts.isNonNullExpression(expression)) {
    return unwrapExpression(expression.expression)
  }
  if (ts.isSatisfiesExpression(expression)) {
    return unwrapExpression(expression.expression)
  }
  return expression
}

const isTranslatorFactoryExpression = (
  expression: ts.Expression,
  factoryResolution: TranslatorFactoryResolution
): boolean => {
  const unwrappedExpression = unwrapExpression(expression)
  if (ts.isIdentifier(unwrappedExpression)) {
    return factoryResolution.identifierFactories.has(unwrappedExpression.text)
  }
  if (!ts.isPropertyAccessExpression(unwrappedExpression)) {
    return false
  }
  if (!ts.isIdentifier(unwrappedExpression.expression)) {
    return false
  }
  return (
    factoryResolution.namespaceFactories.has(unwrappedExpression.expression.text) &&
    TRANSLATOR_FACTORY_EXPORT_NAMES.has(unwrappedExpression.name.text)
  )
}
