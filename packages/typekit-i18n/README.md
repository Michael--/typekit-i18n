# typekit-i18n package

This package is the consolidated v1 target for:

- Runtime translation API
- CSV resource contract and validation
- Code generation pipeline
- Optional provider contracts
- Optional multi-target emitters

Current state: skeleton, ready for gradual migration from root blueprint files.

## YAML Example + Validation

- Example file: `resources/translations/translationTableExample.yaml`
- Validate example:

```bash
pnpm --filter typekit-i18n run validate:yaml-example
```
