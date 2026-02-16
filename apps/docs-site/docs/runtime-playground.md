# Runtime Playground

Public docs can now run a Vue-based demo that mirrors selected runtime scenarios from
`apps/playground-ts`.

## Interactive Demo

<RuntimePlaygroundDemo />

## Shared Translation Base

The docs demo consumes the same generated keys and table from `apps/playground-ts/generated`.
`apps/docs-site` also runs `playground-ts` generation before docs dev/build, so translation
changes stay centralized.

Shared config source:

<<< ../../playground-ts/typekit.config.ts{1-20 ts}[apps/playground-ts/typekit.config.ts]

Generated key unions:

<<< ../../playground-ts/generated/translationKeys.ts{1-24 ts}[apps/playground-ts/generated/translationKeys.ts]

## Playground Source Alignment

The Vue demo is a public adaptation of the original React sample:

<<< ../../playground-ts/src/App.tsx{104-220 tsx}[apps/playground-ts/src/App.tsx]

Vue implementation inside docs:

<<< ./.vitepress/theme/components/RuntimePlaygroundDemo.vue{1-260 vue}[apps/docs-site/docs/.vitepress/theme/components/RuntimePlaygroundDemo.vue]
