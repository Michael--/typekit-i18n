import type { CiRunnerConfig } from '@number10/ci-runner-cli/types'

const config = {
  continueOnError: true,
  cwd: '.',
  env: {
    FORCE_COLOR: '1',
  },
  output: {
    format: 'pretty',
    verbose: false,
  },
  watch: {
    exclude: ['.temp', '.husky', 'bin/**', '*.mjs', 'dist/**', 'coverage/**', 'node_modules/**'],
  },
  steps: [
    {
      id: 'clean',
      name: 'Clean',
      command: 'pnpm run clean',
      optional: true,
    },
    {
      id: 'gen',
      name: 'Generate',
      command: 'pnpm run gen',
    },
    {
      id: 'build',
      name: 'Build',
      command: 'pnpm run build',
    },
    {
      id: 'typecheck',
      name: 'Typecheck',
      command: 'pnpm run typecheck',
    },
    {
      id: 'lint',
      name: 'Lint',
      command: 'pnpm run lint',
    },
    {
      id: 'unit-tests',
      name: 'Unit Tests',
      command: 'pnpm run test',
    },
    {
      id: 'integration-tests',
      name: 'Integration Tests',
      command: 'pnpm run test:integration',
      when: {
        env: {
          RUN_INTEGRATION_TESTS: 'true',
        },
      },
    },
    {
      id: 'e2e-tests',
      name: 'E2E Tests',
      command: 'pnpm run test:e2e',
    },
  ],
  targets: [
    {
      id: 'full',
      name: 'Full Tests',
      includeStepIds: ['gen', 'typecheck', 'lint', 'unit-tests'],
    },
    {
      id: 'quick',
      name: 'Quick Tests',
      includeStepIds: ['typecheck', 'lint', 'unit-tests'],
    },
    {
      id: 'build',
      name: 'Build',
      includeStepIds: ['build'],
    },
  ],
} satisfies CiRunnerConfig

export default config
