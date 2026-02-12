# ICU Implementation Decision Notes

Date: 2026-02-12
Status: Informational (for future decision making)
Scope: `packages/typekit-i18n/src/runtime/icuTranslator.ts` and related ICU runtime modules

## Why the project currently uses a proprietary ICU subset

- Keep public translator APIs stable and tightly integrated with existing typing/scoping behavior.
- Control runtime size and avoid additional runtime dependencies for the default path.
- Keep feature scope focused on currently required syntax:
  - `plural`, `select`, `selectordinal`
  - `number`, `date`, `time` argument formats
  - plural `offset`, exact matches (`=n`), `#` replacement
  - apostrophe escaping

## Current implementation footprint

- ICU runtime code is a dedicated subsystem (parser, renderer, formatters, translator, escaping):
  - `src/runtime/icuParser.ts`
  - `src/runtime/icuRenderer.ts`
  - `src/runtime/icuFormatters.ts`
  - `src/runtime/icuTranslator.ts`
  - `src/runtime/icuEscape.ts`
- Approximate source size: 1.4k LOC in ICU runtime files.
- Build artifact reference in this repository:
  - `dist/icu.js` is about 16.0 KB raw and about 4.3 KB gzip.
- Test signal:
  - `tests/runtime/icu-translator.test.ts`: 28 tests
  - `tests/runtime/icu-escape.test.ts`: 9 tests

## Trade-off summary

### Proprietary subset (current)

Benefits:

- Small and predictable runtime behavior.
- Full control of error messaging and integration points.
- No third-party ICU runtime dependency.

Costs:

- Ongoing ownership of parsing/rendering edge cases.
- Duplicate ICU-like parsing logic in codegen validation and runtime.
- Higher future maintenance cost if aiming for full ICU parity.

### External ICU modules (future option)

Primary candidates reviewed:

- `intl-messageformat` (FormatJS)
- `@messageformat/core` + `@messageformat/runtime`
- `messageformat`
- `i18next-icu` (plugin, mainly for i18next stacks)

Potential gains:

- Better ICU compatibility and parser correctness.
- Lower long-term risk for ICU corner cases.

Potential downsides:

- Additional dependency and upgrade surface.
- Migration effort to preserve current API semantics.
- Possible runtime/bundle footprint increase depending on integration strategy.

## Package metadata snapshot (npm, retrieved 2026-02-12)

- `intl-messageformat`
  - version: `11.1.2`
  - modified: `2026-02-01`
  - unpacked size: `104624`
  - dependencies: `@formatjs/ecma402-abstract`, `@formatjs/icu-messageformat-parser`, `@formatjs/fast-memoize`, `tslib`
- `@messageformat/core`
  - version: `3.4.0`
  - modified: `2024-10-02`
  - unpacked size: `301893`
  - dependencies include parser/runtime/skeleton packages and `make-plural`
- `messageformat`
  - version: `4.0.0`
  - modified: `2025-11-25`
  - unpacked size: `172022`
- `i18next-icu`
  - version: `2.4.3`
  - modified: `2026-01-31`
  - unpacked size: `752511`
  - peer dependency: `intl-messageformat >=10.3.3 <12.0.0`

Notes:

- Unpacked size is not equal to shipped bundle size.
- Actual footprint depends on tree-shaking, build target, and chosen integration model.

## Practical migration directions (if revisited)

1. Low-risk path:
   - Keep `createIcuTranslator` public API unchanged.
   - Replace only internal parser/renderer with a proven ICU engine.
2. Compile-time path:
   - Use `@messageformat/core` to precompile messages.
   - Keep runtime small via generated functions and minimal runtime package.
3. Validation alignment:
   - If external parser is adopted, align codegen ICU validation with the same parser to avoid semantic drift.

## References

- https://www.npmjs.com/package/intl-messageformat
- https://www.npmjs.com/package/@messageformat/core
- https://www.npmjs.com/package/@messageformat/runtime
- https://www.npmjs.com/package/messageformat
- https://www.npmjs.com/package/i18next-icu
