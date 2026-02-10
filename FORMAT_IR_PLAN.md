# Typekit i18n Format + IR Plan (v0.1)

## Goal

Define one neutral internal representation (IR) so that multiple source formats are possible:

- CSV for spreadsheet-heavy translation workflows
- YAML for richer metadata and future ICU-oriented workflows

The generator should consume IR only.

## Non-Goals (v0.1)

- No hard switch to YAML-only
- No UI/editor lock-in
- No runtime ICU implementation in this step

## Canonical Model Decision

Short term:

- Canonical in repo remains configurable (`csv` or `yaml`)
- Converters must always pass through IR

Medium term:

- Prefer YAML as canonical for projects that need metadata/ICU
- Keep CSV as first-class import/export for non-developer workflows

## IR v0.1 (concept)

```ts
export interface TranslationIrProject {
  version: '1'
  sourceLanguage: string
  languages: ReadonlyArray<string>
  entries: ReadonlyArray<TranslationIrEntry>
}

export interface TranslationIrEntry {
  key: string
  description: string
  tags?: ReadonlyArray<string>
  status?: 'draft' | 'review' | 'approved'
  placeholders?: ReadonlyArray<IrPlaceholder>
  values: Record<string, string>
}

export interface IrPlaceholder {
  name: string
  type?: 'string' | 'number' | 'boolean' | 'date' | 'currency'
  formatHint?: string
}
```

## YAML v0.1 (proposed)

```yaml
version: '1'
sourceLanguage: en
languages:
  - en
  - de

entries:
  - key: greeting_title
    description: Headline text for the playground
    status: approved
    tags: [ui, home]
    values:
      en: Welcome to typekit-i18n
      de: Willkommen bei typekit-i18n

  - key: item_count
    description: Summary line with count placeholder
    placeholders:
      - name: count
        type: number
    values:
      en: You currently have {count} items.
      de: Du hast aktuell {count} Eintraege.
```

## CSV Mapping Rules

Minimal CSV schema:

- `key`
- `description`
- one column per language

Optional extension columns:

- `status`
- `tags` (comma-separated)
- `placeholders` (e.g. `count:number,name:string`)

Mapping:

- `key`, `description`, language columns -> `entry.values`
- `tags` -> string array (trimmed)
- `placeholders` -> parsed into `IrPlaceholder[]`

## Conversion Semantics

`csv -> yaml`:

- Usually lossless for minimal schema
- If custom/unknown CSV columns exist, map to `entry.meta.<column>` (future extension)

`yaml -> csv`:

- Potentially lossy for nested metadata if no target columns configured
- Default behavior should emit warnings for fields not representable in selected CSV schema

## Validation Rules (shared on IR)

- Unique keys across all entries
- Required: `key`, `description`, default language value
- Languages declared in project must exist in all entries (empty non-default allowed by policy)
- Placeholder token consistency per entry (all language values reference known placeholder names)

## CLI Surface (target)

- `typekit-i18n validate --input <path> --format csv|yaml`
- `typekit-i18n convert --from csv --to yaml --input <path> --output <path>`
- `typekit-i18n convert --from yaml --to csv --input <path> --output <path>`
- `typekit-i18n generate --config <path>`

## VS Code Extension (target, staged)

Stage 1:

- Commands: `Generate`, `Validate`, `Convert CSV<->YAML`
- Diagnostics panel from CLI/IR validation output

Stage 2:

- Side view for missing translations/status
- Quick fixes for missing placeholders and missing language values

## Migration Plan (incremental)

1. Introduce IR types and adapters internally (`csv -> ir`), keep current behavior.
2. Add YAML reader (`yaml -> ir`) behind config flag.
3. Add converters (`ir -> csv`, `ir -> yaml`) and roundtrip tests.
4. Switch generator internals to consume only IR.
5. Add VS Code extension command wrapper over CLI.

## Acceptance Criteria

- Existing CSV projects continue working without config break.
- Same translation table output for equivalent CSV/YAML inputs.
- Roundtrip tests exist (`csv -> yaml -> csv`, `yaml -> csv -> yaml`) with documented loss rules.
- Validation output includes file + row/path references.
