#!/usr/bin/env node

import { parse } from '@typescript-eslint/typescript-estree'
import fs, { readFileSync, writeFileSync } from 'fs'
import path, { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Helper functions for date parameter detection and naming
function isDateParameter(paramName) {
  const datePatterns = [
    /^date$/i, // Exact match for 'date'
    /^timestamp$/i, // Exact match for 'timestamp'
    /^time$/i, // Exact match for 'time'
    /msSince1970/i, // Contains 'msSince1970'
    /dateMs$/i, // Ends with 'dateMs'
    /timeMs$/i, // Ends with 'timeMs'
    /Date$/, // Ends with 'Date' (case sensitive)
    /startDate$/i, // Ends with 'startDate'
    /endDate$/i, // Ends with 'endDate'
  ]
  return datePatterns.some((pattern) => pattern.test(paramName))
}

function getSemanticDateParameterName(originalName) {
  // Map common date parameter names to semantic Swift names
  const nameMap = {
    msSince1970: 'date',
    timestamp: 'timestamp', // Keep timestamp as is
    dateMs: 'date',
    timeMs: 'time',
    time: 'time',
    date: 'date', // Keep date as is
    startDate: 'start', // Semantic: startDate -> start
    endDate: 'end', // Semantic: endDate -> end
  }

  // If we have a direct mapping, use it
  if (nameMap[originalName]) {
    return nameMap[originalName]
  }

  // If it contains msSince1970, make it 'date'
  if (originalName.includes('msSince1970')) {
    return 'date'
  }

  // If it ends with Date, remove Date suffix
  if (originalName.endsWith('Date')) {
    return originalName.slice(0, -4).toLowerCase() || 'date'
  }

  // Default fallback
  return originalName.toLowerCase()
}

// Parse TypeScript file and extract API information
function extractAPIFromTS(filePath, skipInheritanceResolution = false) {
  const content = readFileSync(filePath, 'utf-8')
  const ast = parse(content, {
    loc: true,
    range: true,
    tokens: true,
    comments: true,
    errorOnUnknownASTType: false,
    errorOnTypeScriptSyntacticAndSemanticIssues: false,
    jsx: false,
  })

  const api = {}
  const interfaces = {}

  // Extract interfaces first
  ast.body.forEach((node) => {
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration &&
      node.declaration.type === 'TSInterfaceDeclaration'
    ) {
      const interfaceName = node.declaration.id.name
      const properties = []

      // Handle interface inheritance (extends)
      let extendedInterface = null
      if (node.declaration.extends && node.declaration.extends.length > 0) {
        try {
          // Handle different AST structures for extends clause
          const extendsClause = node.declaration.extends[0]
          if (extendsClause.expression) {
            extendedInterface = extendsClause.expression.name
          } else if (extendsClause.typeName) {
            extendedInterface = extendsClause.typeName.name
          } else if (typeof extendsClause === 'string') {
            extendedInterface = extendsClause
          }

          if (extendedInterface) {
            console.log(`  Interface ${interfaceName} extends ${extendedInterface}`)
          }
        } catch (error) {
          console.warn(
            `  Warning: Could not parse extends clause for ${interfaceName}:`,
            error.message
          )
        }
      }

      node.declaration.body.body.forEach((member) => {
        if (member.type === 'TSPropertySignature') {
          const propName = member.key.name
          let propType = getTypeAnnotation(member.typeAnnotation)

          // Special case: detect date-related properties and mark as Date type
          if (
            isDateParameter(propName) &&
            (propType === 'number' || propType === 'number | null')
          ) {
            propType = propType === 'number | null' ? 'Date | null' : 'Date'
          }

          properties.push({
            name: propName,
            type: propType,
            // Store original name for JS transmission
            originalName: propName,
            // Generate semantic Swift name for Date properties
            swiftName:
              isDateParameter(propName) && (propType === 'Date' || propType === 'Date | null')
                ? getSemanticDateParameterName(propName)
                : propName,
          })
        }
      })

      // Store interface with inheritance info
      interfaces[interfaceName] = {
        properties,
        extends: extendedInterface,
      }
    }
  })

  // Extract exported functions
  ast.body.forEach((node) => {
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration &&
      node.declaration.type === 'FunctionDeclaration'
    ) {
      const funcName = node.declaration.id.name
      const params = []
      const returnType = getTypeAnnotation(node.declaration.returnType)

      // Extract parameters
      node.declaration.params.forEach((param) => {
        if (param.type === 'Identifier') {
          const paramName = param.name
          let paramType = getTypeAnnotation(param.typeAnnotation)

          // Special case: detect date-related parameters and mark as Date type
          if (
            isDateParameter(paramName) &&
            (paramType === 'number' || paramType === 'number | null')
          ) {
            paramType = paramType === 'number | null' ? 'Date | null' : 'Date'
          }

          params.push({
            name: paramName,
            type: paramType,
            // Store original name for JS transmission
            originalName: paramName,
            // Generate semantic Swift name for Date parameters
            swiftName:
              isDateParameter(paramName) && (paramType === 'Date' || paramType === 'Date | null')
                ? getSemanticDateParameterName(paramName)
                : paramName,
          })
        }
      })

      api[funcName] = {
        params,
        returns: returnType,
        // Add JSDoc comments if available
        description: extractJSDocComment(node),
      }
    }

    // Handle re-exports: export { name1, name2 } from "./other-file"
    if (node.type === 'ExportNamedDeclaration' && node.source && node.specifiers) {
      // Type-only re-exports do not affect runtime API and should be ignored.
      if (node.exportKind === 'type') {
        return
      }

      const valueSpecifiers = node.specifiers.filter(
        (spec) => spec.type === 'ExportSpecifier' && spec.exportKind !== 'type'
      )
      if (valueSpecifiers.length === 0) {
        return
      }

      const sourceFile = node.source.value
      const reExports = processReExports(sourceFile, valueSpecifiers, path.dirname(filePath))

      // Merge re-exported functions and interfaces
      Object.assign(api, reExports.functions)
      Object.assign(interfaces, reExports.interfaces)
    }
  })

  // Resolve interface inheritance only if not skipped
  if (!skipInheritanceResolution) {
    resolveInterfaceInheritance(interfaces)
  }

  return { api, interfaces }
}

function getTypeAnnotation(typeAnnotation) {
  if (!typeAnnotation || !typeAnnotation.typeAnnotation) return 'any'

  const type = typeAnnotation.typeAnnotation

  switch (type.type) {
    case 'TSStringKeyword':
      return 'string'
    case 'TSNumberKeyword':
      return 'number'
    case 'TSBooleanKeyword':
      return 'boolean'
    case 'TSTypeReference':
      return type.typeName.name
    case 'TSArrayType':
      // Handle array types like "number[]", "string[]", "SolarMeasurement[]"
      const elementType = getTypeAnnotation({ typeAnnotation: type.elementType })
      return `${elementType}[]`
    case 'TSUnionType':
      // Handle union types like "number | null"
      const types = type.types.map((t) => {
        if (t.type === 'TSNumberKeyword') return 'number'
        if (t.type === 'TSStringKeyword') return 'string'
        if (t.type === 'TSBooleanKeyword') return 'boolean'
        if (t.type === 'TSNullKeyword') return 'null'
        if (t.type === 'TSTypeReference') return t.typeName.name
        if (t.type === 'TSArrayType') {
          const elementType = getTypeAnnotation({ typeAnnotation: t.elementType })
          return `${elementType}[]`
        }
        return 'any'
      })
      return types.join(' | ')
    case 'TSTypeLiteral':
      // Handle object types
      const properties = {}
      type.members.forEach((member) => {
        if (member.type === 'TSPropertySignature') {
          properties[member.key.name] = getTypeAnnotation(member.typeAnnotation)
        }
      })
      return properties
    default:
      return 'any'
  }
}

function extractJSDocComment(node) {
  // Simple JSDoc extraction - could be enhanced
  if (node.leadingComments) {
    const jsdocComment = node.leadingComments.find(
      (comment) => comment.type === 'Block' && comment.value.trim().startsWith('*')
    )
    if (jsdocComment) {
      return jsdocComment.value.replace(/^\s*\*\s?/gm, '').trim()
    }
  }
  return undefined
}

/**
 * Resolve interface inheritance (extends clauses)
 */
function resolveInterfaceInheritance(interfaces) {
  for (const [interfaceName, interfaceData] of Object.entries(interfaces)) {
    if (interfaceData.extends) {
      const parentInterface = interfaces[interfaceData.extends]
      if (parentInterface) {
        console.log(`  Resolving inheritance: ${interfaceName} extends ${interfaceData.extends}`)

        // Get parent properties (which might be in old format or new format)
        const parentProperties = Array.isArray(parentInterface)
          ? parentInterface
          : parentInterface.properties

        // Combine parent properties with current properties
        const combinedProperties = [...parentProperties, ...interfaceData.properties]

        // Update interface with combined properties
        interfaces[interfaceName] = combinedProperties
      } else {
        console.warn(
          `  Warning: Parent interface ${interfaceData.extends} not found for ${interfaceName}`
        )
        // Just use the interface's own properties
        interfaces[interfaceName] = interfaceData.properties
      }
    } else if (interfaceData.properties) {
      // Convert new format back to old format for compatibility
      interfaces[interfaceName] = interfaceData.properties
    }
  }
}

// Generate API manifest from multiple TypeScript files
function generateManifestFromMultipleFiles(inputFiles, outputFile) {
  console.log(`🔧 Generating API manifest from multiple files...`)

  const combinedAPI = {}
  const combinedInterfaces = {}
  let exportedFromMainFile = new Set()

  // First pass: analyze main.ts to see what's exported (no inheritance resolution yet)
  const mainFile = inputFiles.find((f) => f.includes('main.ts'))
  if (mainFile) {
    console.log(`📋 Analyzing main file: ${mainFile}`)
    const { api: mainAPI, interfaces: mainInterfaces } = extractAPIFromTS(mainFile, true) // Skip inheritance
    Object.assign(combinedAPI, mainAPI)
    Object.assign(combinedInterfaces, mainInterfaces)

    // Track what's exported from main
    Object.keys(mainAPI).forEach((name) => exportedFromMainFile.add(name))
    Object.keys(mainInterfaces).forEach((name) => exportedFromMainFile.add(name))
  }

  // Second pass: analyze other files and include everything
  inputFiles.forEach((filePath) => {
    if (filePath === mainFile) return // Skip main file, already processed

    console.log(`📋 Analyzing additional file: ${filePath}`)
    const { api, interfaces } = extractAPIFromTS(filePath)

    // Include all functions and interfaces from additional files
    Object.assign(combinedAPI, api)
    Object.assign(combinedInterfaces, interfaces)

    console.log(
      `  Found ${Object.keys(api).length} functions and ${Object.keys(interfaces).length} interfaces`
    )
  })

  // Resolve interface inheritance AFTER all files are analyzed
  console.log(`🔗 Resolving interface inheritance...`)
  resolveInterfaceInheritance(combinedInterfaces)

  const manifest = {
    version: '1.0.0',
    source: inputFiles.join(', '),
    interfaces: combinedInterfaces,
    functions: combinedAPI,
  }

  const manifestContent = `// Auto-generated API manifest - DO NOT EDIT
// Generated from: ${inputFiles.join(', ')}

export default ${JSON.stringify(manifest, null, 2)} as const;

export type APIManifest = typeof default;
`

  writeFileSync(outputFile, manifestContent)
  console.log(`✅ API manifest written to ${outputFile}`)
  console.log(
    `📊 Total found: ${Object.keys(combinedAPI).length} functions and ${Object.keys(combinedInterfaces).length} interfaces`
  )

  return manifest
}

const RE_EXPORT_SOURCE_EXTENSION_CANDIDATES = {
  '.js': ['.ts', '.mts', '.cts'],
  '.mjs': ['.mts', '.ts', '.cts'],
  '.cjs': ['.cts', '.ts', '.mts'],
}

const TS_SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts']

/**
 * Resolve a re-export source path to an existing TypeScript source file.
 */
function resolveReExportSourcePath(sourceFile, basePath) {
  const absoluteSourcePath = path.resolve(basePath, sourceFile)
  const extension = path.extname(absoluteSourcePath)
  const candidates = []
  const addCandidate = (candidate) => {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  if (extension.length === 0) {
    TS_SOURCE_EXTENSIONS.forEach((tsExtension) => {
      addCandidate(`${absoluteSourcePath}${tsExtension}`)
    })
  } else if (Object.hasOwn(RE_EXPORT_SOURCE_EXTENSION_CANDIDATES, extension)) {
    const mappedExtensions = RE_EXPORT_SOURCE_EXTENSION_CANDIDATES[extension]
    mappedExtensions.forEach((mappedExtension) => {
      addCandidate(`${absoluteSourcePath.slice(0, -extension.length)}${mappedExtension}`)
    })
  } else {
    addCandidate(absoluteSourcePath)
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Process re-exports by parsing the referenced file
 */
function processReExports(sourceFile, specifiers, basePath) {
  const functions = {}
  const interfaces = {}

  try {
    const resolvedPath = resolveReExportSourcePath(sourceFile, basePath)

    if (!resolvedPath) {
      console.warn(`⚠️  Re-export source file not found for "${sourceFile}" in ${basePath}`)
      return { functions, interfaces }
    }

    // Parse the referenced file
    const sourceCode = fs.readFileSync(resolvedPath, 'utf-8')
    const sourceAst = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['typescript'],
    })

    // Extract exports from the source file
    const sourceExports = extractExports(sourceAst)

    // Map the re-exported names
    specifiers.forEach((spec) => {
      if (spec.type === 'ExportSpecifier') {
        const exportedName = spec.exported.name
        const localName = spec.local.name

        // Check if it's a function
        if (sourceExports.functions[localName]) {
          functions[exportedName] = sourceExports.functions[localName]
        }

        // Check if it's an interface
        if (sourceExports.interfaces[localName]) {
          interfaces[exportedName] = sourceExports.interfaces[localName]
        }
      }
    })
  } catch (error) {
    console.warn(`⚠️  Error processing re-export from ${sourceFile}:`, error.message)
  }

  return { functions, interfaces }
}

/**
 * Extract all exports from an AST (reused logic)
 */
function extractExports(ast) {
  const functions = {}
  const interfaces = {}

  ast.body.forEach((node) => {
    // Extract interfaces
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration &&
      node.declaration.type === 'TSInterfaceDeclaration'
    ) {
      const interfaceName = node.declaration.id.name
      const properties = []

      node.declaration.body.body.forEach((member) => {
        if (member.type === 'TSPropertySignature') {
          const propName = member.key.name
          const propType = getTypeAnnotation(member.typeAnnotation)
          properties.push({ name: propName, type: propType })
        }
      })

      interfaces[interfaceName] = properties
    }

    // Extract functions
    if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration &&
      node.declaration.type === 'FunctionDeclaration'
    ) {
      const funcName = node.declaration.id.name
      const params = []
      const returnType = getTypeAnnotation(node.declaration.returnType)

      // Extract parameters
      node.declaration.params.forEach((param) => {
        if (param.type === 'Identifier') {
          const paramName = param.name
          const paramType = getTypeAnnotation(param.typeAnnotation)
          params.push({ name: paramName, type: paramType })
        }
      })

      functions[funcName] = {
        params,
        returns: returnType,
        description: extractJSDocComment(node),
      }
    }
  })

  return { functions, interfaces }
}

// Main execution
const inputFiles = [
  join(__dirname, '../../ts/main.ts'),
  join(__dirname, '../../ts/calculateSunPosition.ts'),
  join(__dirname, '../../ts/sunSummary.ts'),
  //join(__dirname, "../../ts/translations/translation.ts"), // would cause issues not desired...
  join(__dirname, '../../ts/translations/translationTypes.ts'),
  join(__dirname, '../../ts/translations/translationTable.ts'),
  join(__dirname, '../../ts/pvPower.ts'),
  join(__dirname, '../../ts/pvTypes.ts'),
]
const outputFile = join(__dirname, '../../ts/api.manifest.generated.ts')

try {
  const manifest = generateManifestFromMultipleFiles(inputFiles, outputFile)

  // Print summary
  console.log('\n📋 API Summary:')
  Object.entries(manifest.functions).forEach(([name, info]) => {
    const params = info.params.map((p) => `${p.name}: ${p.type}`).join(', ')
    console.log(`  ${name}(${params}) -> ${info.returns}`)
  })

  if (Object.keys(manifest.interfaces).length > 0) {
    console.log('\n🏗️  Interfaces:')
    Object.entries(manifest.interfaces).forEach(([name, props]) => {
      console.log(`  ${name}: ${props.length} properties`)
    })
  }
} catch (error) {
  console.error('❌ Error generating manifest:', error)
  process.exit(1)
}
