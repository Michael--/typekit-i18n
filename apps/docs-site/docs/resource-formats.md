# Resource Formats

`typekit-i18n` supports CSV and YAML translation resources.

## CSV

Behavior:

- delimiter auto-detection: `;` or `,`
- header-based rows
- strict language validation against configured language list

Required columns:

- `key`
- `description`
- one column per configured language

Optional metadata columns:

- `status` (`draft | review | approved`)
- `tags` (comma-separated)
- `placeholders` (comma-separated definitions)

Placeholder column syntax:

- `name`
- `name:type`
- `name:type:formatHint`

Supported placeholder `type` values:

- `string`
- `number`
- `boolean`
- `date`
- `currency`

Example:

```csv
key;description;status;tags;placeholders;en;de
greeting_title;Main greeting;approved;ui,home;name:string;Hello {name};Hallo {name}
price_label;Price line;review;billing;amount:number:currency;Price {amount|currency};Preis {amount|currency}
```

## YAML

Root fields:

- `version: '1'`
- `sourceLanguage`
- `languages`
- `entries`

Entry fields:

- required: `key`, `description`, `values`
- optional: `status`, `tags`, `placeholders`

Example:

```yaml
version: '1'
sourceLanguage: en
languages:
  - en
  - de
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
```

## Placeholder Consistency Rules

Validation checks:

- source-language placeholders must exist in all languages
- extra placeholders in non-source languages are rejected
- if `placeholders` are declared, all used placeholders must be declared
- duplicate placeholder declarations are rejected

This applies to plain placeholders and ICU-related variable references.

## Merged Multi-File Inputs

You can split resources by domain and format (for example CSV + YAML mixed).

Generation guarantees:

- deterministic file ordering
- deterministic key union output
- duplicate key rejection across all files
- aggregated validation errors with file context
