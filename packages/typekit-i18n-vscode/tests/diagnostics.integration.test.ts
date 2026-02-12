import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MockWorkspaceState {
  filesByPath: Map<string, string>
  translationGlobs: readonly string[]
}

const state: MockWorkspaceState = {
  filesByPath: new Map<string, string>(),
  translationGlobs: ['**/translations/**/*.{yaml,yml,csv}'],
}

vi.mock('vscode', () => {
  class Position {
    public readonly line: number
    public readonly character: number

    public constructor(line: number, character: number) {
      this.line = line
      this.character = character
    }
  }

  class Range {
    public readonly start: Position
    public readonly end: Position

    public constructor(
      startLineOrPosition: number | Position,
      startCharacterOrPosition: number | Position,
      endLine?: number,
      endCharacter?: number
    ) {
      if (startLineOrPosition instanceof Position && startCharacterOrPosition instanceof Position) {
        this.start = startLineOrPosition
        this.end = startCharacterOrPosition
        return
      }
      this.start = new Position(startLineOrPosition as number, startCharacterOrPosition as number)
      this.end = new Position(endLine ?? this.start.line, endCharacter ?? this.start.character)
    }

    public contains(position: Position): boolean {
      const startsBefore =
        this.start.line < position.line ||
        (this.start.line === position.line && this.start.character <= position.character)
      const endsAfter =
        this.end.line > position.line ||
        (this.end.line === position.line && this.end.character >= position.character)
      return startsBefore && endsAfter
    }
  }

  class Uri {
    public readonly path: string
    public readonly fsPath: string

    private constructor(path: string) {
      this.path = path
      this.fsPath = path
    }

    public static file(path: string): Uri {
      return new Uri(path)
    }

    public static parse(value: string): Uri {
      if (value.startsWith('file://')) {
        return new Uri(value.slice('file://'.length))
      }
      return new Uri(value)
    }

    public toString(): string {
      return `file://${this.path}`
    }
  }

  enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
  }

  class Diagnostic {
    public code: string | undefined
    public source: string | undefined
    public readonly range: Range
    public readonly message: string
    public readonly severity: DiagnosticSeverity

    public constructor(range: Range, message: string, severity: DiagnosticSeverity) {
      this.range = range
      this.message = message
      this.severity = severity
    }
  }

  class EventEmitter<T> {
    private listeners = new Set<(event: T) => unknown>()

    public readonly event = (listener: (event: T) => unknown): { dispose: () => void } => {
      this.listeners.add(listener)
      return {
        dispose: () => {
          this.listeners.delete(listener)
        },
      }
    }

    public fire(event: T): void {
      this.listeners.forEach((listener) => {
        listener(event)
      })
    }

    public dispose(): void {
      this.listeners.clear()
    }
  }

  class WorkspaceEdit {
    public insert(): void {}
    public replace(): void {}
    public delete(): void {}
  }

  const splitLines = (content: string): readonly string[] => {
    const lines = content.split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      return lines.slice(0, -1)
    }
    return lines
  }

  const positionAt = (content: string, offset: number): Position => {
    const boundedOffset = Math.max(0, Math.min(offset, content.length))
    const prefix = content.slice(0, boundedOffset)
    const line = prefix.split('\n').length - 1
    const lastLineBreak = prefix.lastIndexOf('\n')
    const character = boundedOffset - (lastLineBreak + 1)
    return new Position(line, character)
  }

  const toLineOffsets = (content: string): readonly number[] => {
    const offsets = [0]
    for (let index = 0; index < content.length; index += 1) {
      if (content[index] === '\n') {
        offsets.push(index + 1)
      }
    }
    return offsets
  }

  class MockTextDocument {
    public readonly uri: Uri
    private readonly content: string
    private readonly lines: readonly string[]
    private readonly lineOffsets: readonly number[]

    public constructor(uri: Uri, content: string) {
      this.uri = uri
      this.content = content
      this.lines = splitLines(content)
      this.lineOffsets = toLineOffsets(content)
    }

    public getText(): string {
      return this.content
    }

    public positionAt(offset: number): Position {
      return positionAt(this.content, offset)
    }

    public lineAt(line: number): { text: string; rangeIncludingLineBreak: Range } {
      const safeLine = Math.max(0, Math.min(line, Math.max(0, this.lines.length - 1)))
      const text = this.lines[safeLine] ?? ''
      const lineStartOffset = this.lineOffsets[safeLine] ?? 0
      const hasNextLine = safeLine + 1 < this.lineOffsets.length
      const lineEndOffset = hasNextLine
        ? (this.lineOffsets[safeLine + 1] ?? lineStartOffset) - 1
        : lineStartOffset + text.length
      const lineEndWithBreakOffset = hasNextLine
        ? (this.lineOffsets[safeLine + 1] ?? lineEndOffset)
        : lineEndOffset

      return {
        text,
        rangeIncludingLineBreak: new Range(
          positionAt(this.content, lineStartOffset),
          positionAt(this.content, lineEndWithBreakOffset)
        ),
      }
    }
  }

  const workspace = {
    getConfiguration: () => ({
      get: <T>(key: string, defaultValue: T): T => {
        if (key === 'translationGlobs') {
          return state.translationGlobs as T
        }
        return defaultValue
      },
    }),
    findFiles: async (): Promise<Uri[]> =>
      [...state.filesByPath.keys()].map((path) => Uri.file(path)),
    openTextDocument: async (uri: Uri): Promise<MockTextDocument> => {
      const content = state.filesByPath.get(uri.fsPath)
      if (typeof content !== 'string') {
        throw new Error(`File not found: ${uri.fsPath}`)
      }
      return new MockTextDocument(uri, content)
    },
  }

  return {
    Diagnostic,
    DiagnosticSeverity,
    EventEmitter,
    Position,
    Range,
    Uri,
    WorkspaceEdit,
    workspace,
  }
})

const { DIAGNOSTIC_CODES } = await import('../src/core/diagnosticCodes')
const { createTranslationWorkspace } = await import('../src/core/translationWorkspace')

interface WorkspaceDiagnostic {
  readonly code: string
  readonly message: string
}

const setWorkspaceFiles = (filesByPath: Record<string, string>): void => {
  state.filesByPath = new Map<string, string>(Object.entries(filesByPath))
}

const decodePayload = (code: string): Record<string, string> | null => {
  const separatorIndex = code.indexOf('|')
  if (separatorIndex < 0) {
    return null
  }
  const encodedPayload = code.slice(separatorIndex + 1)
  const decodedPayload = Buffer.from(encodedPayload, 'base64').toString('utf8')
  return JSON.parse(decodedPayload) as Record<string, string>
}

const flattenDiagnostics = (workspaceDiagnostics: ReadonlyMap<string, readonly unknown[]>) => {
  const diagnostics: WorkspaceDiagnostic[] = []
  workspaceDiagnostics.forEach((uriDiagnostics) => {
    uriDiagnostics.forEach((diagnostic) => {
      const typedDiagnostic = diagnostic as { code?: unknown; message?: unknown }
      const code = typeof typedDiagnostic.code === 'string' ? typedDiagnostic.code : ''
      const message = typeof typedDiagnostic.message === 'string' ? typedDiagnostic.message : ''
      diagnostics.push({ code, message })
    })
  })
  return diagnostics
}

describe('translation workspace diagnostics integration', () => {
  beforeEach(() => {
    state.translationGlobs = ['**/translations/**/*.{yaml,yml,csv}']
    setWorkspaceFiles({})
  })

  it('parses semicolon CSV headers and values without schema errors', async () => {
    setWorkspaceFiles({
      '/workspace/translations/common.csv': 'key;en;de\nwelcome;"Hello";Hallo\n',
    })

    const workspace = createTranslationWorkspace()
    await workspace.refresh()

    const diagnostics = flattenDiagnostics(workspace.getDiagnosticsByUri())
    const schemaCodes = diagnostics.map((item) => item.code.split('|')[0])
    expect(schemaCodes).not.toContain(DIAGNOSTIC_CODES.missingKeyHeader)
    expect(schemaCodes).not.toContain(DIAGNOSTIC_CODES.invalidSchema)
    expect(workspace.getKnownLanguages()).toEqual(['de', 'en'])
  })

  it('emits value type diagnostics with payload for YAML non-string values', async () => {
    setWorkspaceFiles({
      '/workspace/translations/features.yaml': `
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: profile_label
    values:
      en: "Profile"
      de: 123
`,
    })

    const workspace = createTranslationWorkspace()
    await workspace.refresh()

    const diagnostics = flattenDiagnostics(workspace.getDiagnosticsByUri())
    const invalidValueDiagnostic = diagnostics.find((item) =>
      item.code.startsWith(DIAGNOSTIC_CODES.invalidValueType)
    )
    expect(invalidValueDiagnostic).toBeDefined()
    expect(invalidValueDiagnostic?.message).toContain('must be a string')
    const payload = decodePayload(invalidValueDiagnostic?.code ?? '')
    expect(payload).toEqual({ key: 'profile_label', locale: 'de' })
  })

  it('emits ICU plural shape diagnostics with locale and base locale payload', async () => {
    setWorkspaceFiles({
      '/workspace/translations/icu.yaml': `
sourceLanguage: en
languages:
  - en
  - de
entries:
  - key: inbox_summary
    values:
      en: "{count, plural, one {One item} other {# items}}"
      de: "{count, plural, one {Ein Element}}"
`,
    })

    const workspace = createTranslationWorkspace()
    await workspace.refresh()

    const diagnostics = flattenDiagnostics(workspace.getDiagnosticsByUri())
    const icuDiagnostic = diagnostics.find((item) =>
      item.code.startsWith(DIAGNOSTIC_CODES.invalidIcuPluralShape)
    )
    expect(icuDiagnostic).toBeDefined()
    const payload = decodePayload(icuDiagnostic?.code ?? '')
    expect(payload).toEqual({
      key: 'inbox_summary',
      locale: 'de',
      baseLocale: 'en',
    })
  })

  it('emits duplicate key diagnostics in every affected definition', async () => {
    setWorkspaceFiles({
      '/workspace/translations/a.yaml': `
sourceLanguage: en
languages: [en]
entries:
  - key: duplicated_key
    values:
      en: "A"
`,
      '/workspace/translations/b.yaml': `
sourceLanguage: en
languages: [en]
entries:
  - key: duplicated_key
    values:
      en: "B"
`,
    })

    const workspace = createTranslationWorkspace()
    await workspace.refresh()

    const diagnostics = flattenDiagnostics(workspace.getDiagnosticsByUri()).filter((item) =>
      item.code.startsWith(DIAGNOSTIC_CODES.duplicateKey)
    )
    expect(diagnostics).toHaveLength(2)
    diagnostics.forEach((diagnostic) => {
      expect(decodePayload(diagnostic.code)).toEqual({ key: 'duplicated_key' })
    })
  })
})
