import * as vscode from 'vscode'

const schemaCollectionName = 'typekit-i18n-schema'

const isRawTranslationDocument = (document: vscode.TextDocument): boolean => {
  const lowerCaseName = document.fileName.toLowerCase()
  return (
    lowerCaseName.endsWith('.yaml') ||
    lowerCaseName.endsWith('.yml') ||
    lowerCaseName.endsWith('.csv')
  )
}

/**
 * Registers schema validation triggers for YAML and CSV translation raw data.
 *
 * @returns Disposable that unregisters schema-validation resources.
 */
export const registerSchemaValidation = (): vscode.Disposable => {
  const schemaCollection = vscode.languages.createDiagnosticCollection(schemaCollectionName)

  const validateDocument = (document: vscode.TextDocument): void => {
    if (!isRawTranslationDocument(document)) {
      return
    }

    schemaCollection.set(document.uri, [])
  }

  const openDocumentSubscription = vscode.workspace.onDidOpenTextDocument((document) => {
    validateDocument(document)
  })
  const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument((document) => {
    validateDocument(document)
  })
  const closeDocumentSubscription = vscode.workspace.onDidCloseTextDocument((document) => {
    schemaCollection.delete(document.uri)
  })

  for (const openDocument of vscode.workspace.textDocuments) {
    validateDocument(openDocument)
  }

  return vscode.Disposable.from(
    schemaCollection,
    openDocumentSubscription,
    saveDocumentSubscription,
    closeDocumentSubscription
  )
}
