# Resource Formats

`typekit-i18n` supports CSV and YAML translation resources.

## CSV Format

Parser behavior:

- Delimiter auto-detection: `;` or `,`
- Header-based rows
- Strict column handling

Required columns:

- `key`
- `description`
- one column for each configured language

Optional metadata columns:

- `status` (`draft | review | approved`)
- `tags` (comma-separated)
- `placeholders` (comma-separated items in form `name:type:formatHint`)

Rules:

- Source/default language value must be non-empty
- Declared language columns must match configured languages
- Duplicate keys across all inputs are rejected

Example:

```csv
key;description;status;tags;placeholders;en;de;fr
greeting_title;Main greeting;approved;ui,home;name:string;Hello {name};Hallo {name};Bonjour {name}
price_formatted;Price line;review;billing;amount:number:currency;Price {amount|currency};Preis {amount|currency};Prix {amount|currency}
```

## YAML Format

Project-level fields:

- `version: '1'`
- `sourceLanguage`
- `languages`
- `entries`

Entry fields:

- `key`
- `description`
- `values`
- optional `status`, `tags`, `placeholders`

Example:

```yaml
version: '1'
sourceLanguage: en
languages:
  - en
  - de
  - fr
entries:
  - key: greeting_title
    description: Main greeting
    status: approved
    tags: [ui, home]
    placeholders:
      - name: name
        type: string
    values:
      en: 'Hello {name}'
      de: 'Hallo {name}'
      fr: 'Bonjour {name}'
```

## Placeholder Tokens

Template tokens in translation values:

- `{name}`: plain placeholder replacement
- `{amount|currency}`: named formatter token

Runtime formatter hooks are optional; missing formatters fall back to plain value strings.

## Validation Scope

Validation checks include:

- schema/structure correctness
- language declaration consistency
- source/default language completeness
- placeholder declaration and token consistency
- duplicate key detection across merged input files
