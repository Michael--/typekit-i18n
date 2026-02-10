#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { parse } from "@typescript-eslint/typescript-estree"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "../..")

/**
 * Scan translation files to extract available translation keys automatically
 */
function scanTranslationKeys() {
    const translationKeys = new Set()

    try {
        // Option 1: Parse translationTable.ts using regex (simpler and more reliable)
        const translationTablePath = join(projectRoot, "ts/translations/translationTable.ts")
        if (fs.existsSync(translationTablePath)) {
            console.log("  📖 Scanning translationTable.ts for keys...")
            const content = readFileSync(translationTablePath, "utf-8")

            // Find the translationTable object and extract quoted keys
            // Use a simpler approach: just scan the whole file for quoted keys followed by colons
            const keyMatches = [...content.matchAll(/^\s*"([^"]+)":\s*\{/gm)]
            if (keyMatches.length > 0) {
                keyMatches.forEach(match => {
                    translationKeys.add(match[1])
                })
            }
        }

        // Option 2: Fallback - parse translation.ts for TranslateKeys type
        if (translationKeys.size === 0) {
            const translationPath = join(projectRoot, "ts/translations/translation.ts")
            if (fs.existsSync(translationPath)) {
                console.log("  📖 Fallback: Scanning translation.ts for TranslateKeys type...")
                const content = readFileSync(translationPath, "utf-8")

                // Look for TranslateKeys type definition
                const typeMatch = content.match(/type\s+TranslateKeys\s*=\s*([^;]+)/s)
                if (typeMatch) {
                    const typeContent = typeMatch[1]
                    const stringMatches = typeContent.match(/"([^"]+)"/g)
                    if (stringMatches) {
                        stringMatches.forEach(match => {
                            const key = match.slice(1, -1) // Remove quotes
                            translationKeys.add(key)
                        })
                    }
                }
            }
        }
    } catch (error) {
        console.warn("⚠️  Warning: Could not scan translation keys:", error.message)
    }

    const keys = Array.from(translationKeys).sort()
    console.log(`  🔍 Found ${keys.length} translation keys`)
    if (keys.length > 0) {
        console.log(`  📝 Keys: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? `, ... (+${keys.length - 5} more)` : ""}`)
    }
    return keys
}

/**
 * Generate Swift enum code for TranslationKey based on scanned keys
 */
function generateTranslationKeyEnum(translationKeys) {
    if (translationKeys.length === 0) {
        // Fallback enum if no keys found
        return `/// Translation keys - No keys found, fallback enum
public enum TranslationKey: String, CaseIterable {
    case unknown = "unknown"
}`
    }

    // Convert translation key strings to valid Swift enum cases
    const enumCases = translationKeys
        .map(key => {
            // Convert to camelCase Swift enum case name
            const caseName = key
                .replace(/[^a-zA-Z0-9]/g, " ") // Replace special chars with spaces
                .split(" ")
                .map((word, index) => {
                    if (index === 0) {
                        return word.toLowerCase()
                    }
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                })
                .join("")
                .replace(/^[0-9]/, "_$&") // Prefix with underscore if starts with number

            return `    case ${caseName} = "${key}"`
        })
        .join("\n")

    return `/// Translation keys - Auto-generated from translation files
/// Provides compile-time safety for translation keys
public enum TranslationKey: String, CaseIterable {
${enumCases}
}`
}

// Type mapping from TypeScript to Swift
const typeMapping = {
    string: "String",
    number: "Double",
    boolean: "Bool",
    any: "JSValue",
    Date: "Date", // Date will be converted to/from timestamp during transmission
}

function mapTypeToSwift(type, interfaces = {}) {
    if (typeof type === "string") {
        if (typeMapping[type]) {
            return typeMapping[type]
        }
        if (interfaces[type]) {
            return type // Custom interface/struct
        }

        // Handle array types like "number[]", "string[]", "SolarMeasurement[]"
        if (type.endsWith("[]")) {
            const elementType = type.slice(0, -2) // Remove "[]"
            const swiftElementType = mapTypeToSwift(elementType, interfaces)
            return `[${swiftElementType}]`
        }

        // Handle special Translation types
        if (type === "TranslateKeys") {
            return "String" // Swift String with enum-like behavior
        }
        if (type === "Iso639CodeType") {
            return "String" // Swift String constrained to "en" | "de"
        }

        // Handle nullable types like "string | null", "Date | null"
        if (type === "string | null") {
            return "String?"
        }
        if (type === "number | null") {
            return "Double?"
        }
        if (type === "Date | null") {
            return "Date?"
        }

        // Handle nullable array types like "number[] | null"
        if (type.includes("[] | null")) {
            const baseType = type.replace(" | null", "")
            const swiftType = mapTypeToSwift(baseType, interfaces)
            return `${swiftType}?`
        }

        return "Any" // Fallback
    }

    if (typeof type === "object") {
        // Handle object types
        return "[String: Any]"
    }

    return "Any"
}

function generateSwiftStruct(interfaceName, properties, interfaces = {}) {
    const structProperties = properties
        .map(prop => {
            const swiftType = mapTypeToSwift(prop.type, interfaces)
            // Use swiftName for the property if available, otherwise use name
            const propertyName = prop.swiftName || prop.name
            return `    public let ${propertyName}: ${swiftType}`
        })
        .join("\n")

    // Generate memberwise initializer parameters
    const memberwiseParams = properties
        .map(prop => {
            const swiftType = mapTypeToSwift(prop.type, interfaces)
            const propertyName = prop.swiftName || prop.name
            return `${propertyName}: ${swiftType}`
        })
        .join(", ")

    // Generate memberwise initializer body
    const memberwiseBody = properties
        .map(prop => {
            const propertyName = prop.swiftName || prop.name
            return `        self.${propertyName} = ${propertyName}`
        })
        .join("\n")

    return `
/// Auto-generated struct for ${interfaceName}
public struct ${interfaceName}: Codable, Equatable {
${structProperties}
    
    /// Memberwise initializer
    public init(${memberwiseParams}) {
${memberwiseBody}
    }
    
    /// Initialize from JSValue
    init?(from jsValue: JSValue) {
        guard let dict = jsValue.toDictionary() else { return nil }
        ${generateJSValueInitializationCode(properties, interfaces)}
    }
    
    /// Initialize from Dictionary
    init?(from dict: [String: Any]) {
        ${generateDictionaryInitializationCode(properties, interfaces)}
    }
    
    /// Convert to Dictionary for passing to JavaScript
    func toDictionary() -> [String: Any] {
        ${generateToDictionaryCode(properties, interfaces)}
    }
}`
}

function generateJSValueInitializationCode(properties, interfaces) {
    return properties
        .map(prop => {
            const key = prop.originalName || prop.name // Use original name for JS dict key
            const swiftPropertyName = prop.swiftName || prop.name // Use Swift name for property

            if (prop.type === "Date") {
                return `        guard let ${key}Ms = dict["${key}"] as? NSNumber else { return nil }
        self.${swiftPropertyName} = Date(timeIntervalSince1970: ${key}Ms.doubleValue / 1000.0)`
            } else if (prop.type === "Date | null") {
                return `        if let ${key}Ms = dict["${key}"] as? NSNumber {
            self.${swiftPropertyName} = Date(timeIntervalSince1970: ${key}Ms.doubleValue / 1000.0)
        } else {
            self.${swiftPropertyName} = nil
        }`
            } else if (prop.type === "number[]") {
                return `        if let ${key}Array = dict["${key}"] as? [NSNumber] {
            self.${swiftPropertyName} = ${key}Array.map { $0.doubleValue }
        } else {
            self.${swiftPropertyName} = []
        }`
            } else if (prop.type === "string[]") {
                return `        self.${swiftPropertyName} = dict["${key}"] as? [String] ?? []`
            } else if (prop.type === "number[] | null") {
                return `        if let ${key}Array = dict["${key}"] as? [NSNumber] {
            self.${swiftPropertyName} = ${key}Array.map { $0.doubleValue }
        } else {
            self.${swiftPropertyName} = nil
        }`
            } else if (prop.type === "string[] | null") {
                return `        self.${swiftPropertyName} = dict["${key}"] as? [String]`
            } else if (prop.type.endsWith("[]") && interfaces[prop.type.slice(0, -2)]) {
                // Handle arrays of struct types like "SolarMeasurement[]"
                const elementType = prop.type.slice(0, -2)
                return `        if let ${key}Array = dict["${key}"] as? [[String: Any]] {
            self.${swiftPropertyName} = ${key}Array.compactMap { ${elementType}(from: $0) }
        } else {
            self.${swiftPropertyName} = []
        }`
            } else if (prop.type === "number") {
                return `        guard let ${key} = dict["${key}"] as? NSNumber else { return nil }
        self.${swiftPropertyName} = ${key}.doubleValue`
            } else if (prop.type === "string") {
                return `        guard let ${key} = dict["${key}"] as? String else { return nil }
        self.${swiftPropertyName} = ${key}`
            } else if (prop.type === "string | null") {
                return `        self.${swiftPropertyName} = dict["${key}"] as? String`
            } else if (prop.type === "number | null") {
                return `        if let num = dict["${key}"] as? NSNumber {
            self.${swiftPropertyName} = num.doubleValue
        } else {
            self.${swiftPropertyName} = nil
        }`
            } else if (interfaces[prop.type]) {
                // Handle nested struct types - expect dictionary for JSValue case too
                return `        guard let ${key}Dict = dict["${key}"] as? [String: Any],
              let ${key} = ${prop.type}(from: ${key}Dict) else { return nil }
        self.${swiftPropertyName} = ${key}`
            } else {
                return `        self.${swiftPropertyName} = dict["${key}"] as? ${mapTypeToSwift(prop.type, interfaces)} ?? ${getDefaultValue(prop.type)}`
            }
        })
        .join("\n        ")
}

function generateDictionaryInitializationCode(properties, interfaces) {
    return properties
        .map(prop => {
            const key = prop.originalName || prop.name // Use original name for JS dict key
            const swiftPropertyName = prop.swiftName || prop.name // Use Swift name for property

            if (prop.type === "Date") {
                return `        guard let ${key}Ms = dict["${key}"] as? NSNumber else { return nil }
        self.${swiftPropertyName} = Date(timeIntervalSince1970: ${key}Ms.doubleValue / 1000.0)`
            } else if (prop.type === "Date | null") {
                return `        if let ${key}Ms = dict["${key}"] as? NSNumber {
            self.${swiftPropertyName} = Date(timeIntervalSince1970: ${key}Ms.doubleValue / 1000.0)
        } else {
            self.${swiftPropertyName} = nil
        }`
            } else if (prop.type === "number[]") {
                return `        if let ${key}Array = dict["${key}"] as? [NSNumber] {
            self.${swiftPropertyName} = ${key}Array.map { $0.doubleValue }
        } else {
            self.${swiftPropertyName} = []
        }`
            } else if (prop.type === "string[]") {
                return `        self.${swiftPropertyName} = dict["${key}"] as? [String] ?? []`
            } else if (prop.type === "number[] | null") {
                return `        if let ${key}Array = dict["${key}"] as? [NSNumber] {
            self.${swiftPropertyName} = ${key}Array.map { $0.doubleValue }
        } else {
            self.${swiftPropertyName} = nil
        }`
            } else if (prop.type === "string[] | null") {
                return `        self.${swiftPropertyName} = dict["${key}"] as? [String]`
            } else if (prop.type.endsWith("[]") && interfaces[prop.type.slice(0, -2)]) {
                // Handle arrays of struct types like "SolarMeasurement[]"
                const elementType = prop.type.slice(0, -2)
                return `        if let ${key}Array = dict["${key}"] as? [[String: Any]] {
            self.${swiftPropertyName} = ${key}Array.compactMap { ${elementType}(from: $0) }
        } else {
            self.${swiftPropertyName} = []
        }`
            } else if (prop.type === "number") {
                return `        guard let ${key} = dict["${key}"] as? NSNumber else { return nil }
        self.${swiftPropertyName} = ${key}.doubleValue`
            } else if (prop.type === "string") {
                return `        guard let ${key} = dict["${key}"] as? String else { return nil }
        self.${swiftPropertyName} = ${key}`
            } else if (prop.type === "string | null") {
                return `        self.${swiftPropertyName} = dict["${key}"] as? String`
            } else if (prop.type === "number | null") {
                return `        if let num = dict["${key}"] as? NSNumber {
            self.${swiftPropertyName} = num.doubleValue
        } else {
            self.${swiftPropertyName} = nil
        }`
            } else if (interfaces[prop.type]) {
                // Handle nested struct types - expect dictionary
                return `        guard let ${key}Dict = dict["${key}"] as? [String: Any],
              let ${key} = ${prop.type}(from: ${key}Dict) else { return nil }
        self.${swiftPropertyName} = ${key}`
            } else {
                return `        self.${swiftPropertyName} = dict["${key}"] as? ${mapTypeToSwift(prop.type, interfaces)} ?? ${getDefaultValue(prop.type)}`
            }
        })
        .join("\n        ")
}

function generateToDictionaryCode(properties, interfaces) {
    const dictEntries = properties
        .map(prop => {
            const key = prop.originalName || prop.name // Use original name for JS dict key
            const swiftPropertyName = prop.swiftName || prop.name // Use Swift name for property

            if (prop.type === "Date") {
                return `            "${key}": ${swiftPropertyName}.timeIntervalSince1970 * 1000.0`
            } else if (prop.type === "Date | null") {
                return `            "${key}": ${swiftPropertyName}.map { $0.timeIntervalSince1970 * 1000.0 } as Any`
            } else if (prop.type.endsWith("[]") && interfaces[prop.type.slice(0, -2)]) {
                // Handle arrays of struct types like "SolarMeasurement[]"
                return `            "${key}": ${swiftPropertyName}.map { $0.toDictionary() }`
            } else if (interfaces[prop.type]) {
                // Handle nested struct types
                return `            "${key}": ${swiftPropertyName}.toDictionary()`
            } else if (prop.type.includes(" | null")) {
                // Handle nullable types
                return `            "${key}": ${swiftPropertyName} as Any`
            } else {
                // Handle primitive types
                return `            "${key}": ${swiftPropertyName}`
            }
        })
        .join(",\n")

    return `return [
${dictEntries}
        ]`
}

function getDefaultValue(type) {
    switch (type) {
        case "string":
            return '""'
        case "number":
            return "0.0"
        case "boolean":
            return "false"
        case "Date":
            return "Date()"
        default:
            // Handle array types
            if (type.endsWith("[]")) {
                return "[]"
            }
            return "nil"
    }
}

function generateSwiftMethod(funcName, funcInfo, interfaces) {
    const params = funcInfo.params
        .map(param => {
            const swiftType = mapTypeToSwift(param.type, interfaces)
            // Use swiftName for the parameter if available, otherwise use name
            const parameterName = param.swiftName || param.name
            return `${parameterName}: ${swiftType}`
        })
        .join(", ")

    const returnType = mapTypeToSwift(funcInfo.returns, interfaces)
    const optionalReturn = returnType === "JSValue" ? "JSValue?" : `${returnType}?`

    // Generate parameter validation
    const paramValidation = funcInfo.params
        .map(param => {
            const parameterName = param.swiftName || param.name
            const originalName = param.originalName || param.name

            if (param.type === "string" || param.type === "TranslateKeys" || param.type === "Iso639CodeType") {
                return `        let ${originalName}Escaped = ${parameterName}.replacingOccurrences(of: "'", with: "\\\\'")`
            } else if (param.type === "Date") {
                return `        let ${originalName}Ms = ${parameterName}.timeIntervalSince1970 * 1000.0`
            } else if (interfaces[param.type]) {
                // Handle struct parameters - convert to JSON string with escaped quotes
                return `        let ${originalName}Dict = ${parameterName}.toDictionary()
        guard let ${originalName}Data = try? JSONSerialization.data(withJSONObject: ${originalName}Dict),
              let ${originalName}JSONRaw = String(data: ${originalName}Data, encoding: .utf8) else { return nil }
        let ${originalName}JSON = ${originalName}JSONRaw.replacingOccurrences(of: "\\\\", with: "\\\\\\\\").replacingOccurrences(of: "'", with: "\\\\'")`
            }
            return null
        })
        .filter(Boolean)
        .join("\n")

    // Generate script call
    const scriptParams = funcInfo.params
        .map(param => {
            const originalName = param.originalName || param.name

            if (param.type === "string" || param.type === "TranslateKeys" || param.type === "Iso639CodeType") {
                return `'\\(${originalName}Escaped)'`
            } else if (param.type === "Date") {
                return `\\(${originalName}Ms)`
            } else if (interfaces[param.type]) {
                // Handle struct parameters - parse JSON to object
                return `JSON.parse('\\(${originalName}JSON)')`
            } else {
                const parameterName = param.swiftName || param.name
                return `\\(${parameterName})`
            }
        })
        .join(", ")

    const script = `"HelioJS.${funcName}(${scriptParams})"`

    // Generate return value handling - FIXED: No optional chaining on non-optional result
    let returnHandling
    if (funcInfo.returns === "string") {
        returnHandling = "return result.toString()"
    } else if (funcInfo.returns === "number") {
        returnHandling = "return result.toDouble()"
    } else if (funcInfo.returns === "boolean") {
        returnHandling = "return result.toBool()"
    } else if (funcInfo.returns === "Date") {
        returnHandling = "return Date(timeIntervalSince1970: result.toDouble() / 1000.0)"
    } else if (interfaces[funcInfo.returns]) {
        returnHandling = `return ${funcInfo.returns}(from: result)`
    } else {
        returnHandling = "return result"
    }

    const description = funcInfo.description ? `    /// ${funcInfo.description.split("\n").join("\n    /// ")}\n` : ""

    return `
    ${description}/// ${funcName}(${funcInfo.params.map(p => `${p.name}: ${p.type}`).join(", ")}) -> ${funcInfo.returns}
    public func ${funcName}(${params}) -> ${optionalReturn} {
        guard isReady else { return nil }
        
${paramValidation}
        let script = ${script}
        guard let result = jsContext?.evaluateScript(script) else {
            return nil
        }
        
        ${returnHandling}
    }`
}

function generateSwiftAPI(manifest) {
    const { interfaces, functions } = manifest

    // Scan translation keys dynamically
    console.log("🔍 Scanning translation keys...")
    const translationKeys = scanTranslationKeys()

    // Generate structs for interfaces
    const structsCode = Object.entries(interfaces)
        .map(([name, properties]) => generateSwiftStruct(name, properties, interfaces))
        .join("\n")

    // Generate methods for functions
    const methodsCode = Object.entries(functions)
        .map(([name, info]) => generateSwiftMethod(name, info, interfaces))
        .join("\n")

    return `//
// HelioJSAPI.swift
// Auto-generated Swift API wrapper
// Generated from: ${manifest.source}
//

import Foundation
import JavaScriptCore
import SwiftUI
import Combine

// MARK: - Translation Support Types

/// Language codes supported by the translation system
public enum LanguageCode: String, CaseIterable, Codable, Equatable {
    case en = "en"
    case de = "de"
    
    var displayName: String {
        switch self {
        case .en: return "English"
        case .de: return "Deutsch"
        }
    }
}

${generateTranslationKeyEnum(translationKeys)}

${structsCode}

/// Auto-generated type-safe API wrapper for HelioJS
public class HelioJSAPI: ObservableObject {
    private var jsContext: JSContext?
    @Published public var isReady = false
    @Published public var lastError: String?
    
    public init() {
        loadBundle()
    }
    
    private func loadBundle() {
        guard let asset = NSDataAsset(name: "HelioJS"),
              let jsCode = String(data: asset.data, encoding: .utf8) else {
            lastError = "Failed to load HelioJS bundle"
            return
        }
        
        jsContext = JSContext()
        jsContext?.exceptionHandler = { [weak self] _, exception in
            DispatchQueue.main.async {
                self?.lastError = exception?.toString()
            }
        }
        setupConsoleForwarding()
        
        jsContext?.evaluateScript(jsCode)
        
        // Test if bundle loaded successfully
        if let testResult = jsContext?.evaluateScript("typeof HelioJS")?.toString(),
           testResult == "object" {
            isReady = true
            lastError = nil
        } else {
            lastError = "HelioJS object not available"
        }
    }


private func setupConsoleForwarding() {
    guard let ctx = jsContext else { return }

    // 1) Swift Blöcke: nehmen JEWEILS EIN JSValue (Array der Args)
    let logBlock: @convention(block) (JSValue) -> Void = { argsArray in
        print("JS log:", Self.stringifyArgsArray(argsArray))
    }
    let warnBlock: @convention(block) (JSValue) -> Void = { argsArray in
        print("⚠️ JS warn:", Self.stringifyArgsArray(argsArray))
    }
    let errorBlock: @convention(block) (JSValue) -> Void = { argsArray in
        print("❌ JS error:", Self.stringifyArgsArray(argsArray))
    }

    // 2) Unter Namen ins JS hängen
    ctx.setObject(logBlock,   forKeyedSubscript: "__swiftConsoleLog" as NSString)
    ctx.setObject(warnBlock,  forKeyedSubscript: "__swiftConsoleWarn" as NSString)
    ctx.setObject(errorBlock, forKeyedSubscript: "__swiftConsoleError" as NSString)

    // 3) JS-seitig console.* definieren → immer ein Args-Array an Swift geben
    let shim = """
    (function(){
      function forward(fnName, args){
        try { globalThis[fnName](args); } catch(e) {}
      }
      globalThis.console = {
        log:  (...args) => forward("__swiftConsoleLog",  args),
        warn: (...args) => forward("__swiftConsoleWarn", args),
        error:(...args) => forward("__swiftConsoleError",args)
      };
    })();
    """
    ctx.evaluateScript(shim)
}

// ---- Helpers ----

// Nimmt ein JS-Array (die console-Args) und baut einen String.
private static func stringifyArgsArray(_ arr: JSValue) -> String {
    guard arr.isObject else { return stringifyOne(arr) }
    // length ermitteln
    let length = Int(arr.forProperty("length")?.toInt32() ?? 0)
    var parts: [String] = []
    for i in 0..<length {
        if let v = arr.atIndex(i) {
            parts.append(stringifyOne(v))
        }
    }
    return parts.joined(separator: " ")
}

// Ein einzelnes JSValue hübsch als String ausgeben.
private static func stringifyOne(_ v: JSValue) -> String {
    // Versuche JSON.stringify() für Objekte/Arrays
    if v.isObject, let ctx = v.context,
       let jsonObj = ctx.objectForKeyedSubscript("JSON"),
       let stringifyFn = jsonObj.objectForKeyedSubscript("stringify"),
       stringifyFn.isObject,
       let jsonStr = stringifyFn.call(withArguments: [v])?.toString(),
       jsonStr != "undefined" {
        return jsonStr
    }
    // Primitive sauber behandeln
    if v.isString   { return v.toString() ?? "undefined" }
    if v.isNumber   { return v.toNumber()?.stringValue ?? "NaN" }
    if v.isBoolean  { return v.toBool() ? "true" : "false" }
    if v.isNull     { return "null" }
    if v.isUndefined{ return "undefined" }
    // Fallback
    return v.toString() ?? "undefined"
}

    // MARK: - Generated API Methods
    ${methodsCode}
    
    // MARK: - Type-Safe Translation API
    
    /// Type-safe translation using enums (recommended)
    public func translate(key: TranslationKey, language: LanguageCode, placeholder: Placeholder? = nil) -> String {
        return translate(key: key.rawValue, language: language.rawValue, placeholder: placeholder ?? Placeholder(data: [])) ?? key.rawValue
    }
    
    /// Get all supported language codes
    public static var supportedLanguageCodes: [LanguageCode] {
        return LanguageCode.allCases
    }
    
    /// Get all available translation keys
    public static var availableTranslationKeys: [TranslationKey] {
        return TranslationKey.allCases
    }
    
    // MARK: - Custom JavaScript Execution
    
    /// Execute arbitrary JavaScript code
    public func executeScript(_ script: String) -> JSValue? {
        guard isReady else { return nil }
        return jsContext?.evaluateScript(script)
    }
}

// MARK: - API Manifest Information

public extension HelioJSAPI {
    /// API version from manifest
    static let apiVersion = "${manifest.version}"
    
    /// Available function names
    static let availableFunctions = [${Object.keys(functions)
        .map(name => `"${name}"`)
        .join(", ")}]
    
    /// Available interface names  
    static let availableInterfaces = [${Object.keys(interfaces)
        .map(name => `"${name}"`)
        .join(", ")}]
}`
}

// Main execution
function main() {
    const manifestFile = join(__dirname, "../../ts/api.manifest.generated.ts")
    const outputPath = path.join(projectRoot, "native/Helio11/Helio11/generated/HelioJSAPI.generated.swift")

    console.log("🔧 Generating Swift API from manifest...")

    try {
        // Read and parse the manifest
        const manifestContent = readFileSync(manifestFile, "utf-8")
        const manifestMatch = manifestContent.match(/export default ({.*?}) as const;/s)

        if (!manifestMatch) {
            throw new Error("Could not parse manifest file")
        }

        const manifest = JSON.parse(manifestMatch[1])

        // Generate Swift code
        const swiftCode = generateSwiftAPI(manifest)

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }

        // Write API file
        writeFileSync(outputPath, swiftCode)
        console.log(`✅ Swift API generated: ${outputPath}`)

        console.log(`📊 Generated ${Object.keys(manifest.functions).length} methods and ${Object.keys(manifest.interfaces).length} structs`)

        // Print summary
        console.log("\n🏗️  Generated Swift API:")
        Object.entries(manifest.functions).forEach(([name, info]) => {
            const params = info.params.map(p => `${p.name}: ${mapTypeToSwift(p.type)}`).join(", ")
            const returnType = mapTypeToSwift(info.returns)
            console.log(`  func ${name}(${params}) -> ${returnType}?`)
        })

        if (Object.keys(manifest.interfaces).length > 0) {
            console.log("\n📋 Generated Structs:")
            Object.entries(manifest.interfaces).forEach(([name, props]) => {
                console.log(`  struct ${name} (${props.length} properties)`)
            })
        }
    } catch (error) {
        console.error("❌ Error generating Swift API:", error)
        process.exit(1)
    }
}

main()
