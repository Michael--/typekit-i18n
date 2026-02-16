<script setup lang="ts">
import { computed, ref } from 'vue'
import { createIcuTranslator, createTranslator } from '@number10/typekit-i18n'
import { createFormatjsIcuTranslator } from '@number10/typekit-i18n/runtime/icu-formatjs'
import type {
  Placeholder,
  PlaceholderFormatterMap,
  PlaceholderValue,
} from '@number10/typekit-i18n'
import { LanguageCodes, type TranslateKey, type TranslateLanguage } from '@playground-gen/translationKeys'
import { translationTable } from '@playground-gen/translationTable'

type TranslationMode = 'fallback' | 'strict'
type ScenarioGroup = 'all' | 'core' | 'icu' | 'fallback'
type RuntimeId = 'basic' | 'icu-subset' | 'icu-formatjs'

interface ScenarioDefinition {
  id: string
  group: Exclude<ScenarioGroup, 'all'>
  title: string
  description: string
  key: TranslateKey
  placeholder?: Placeholder
}

interface RuntimeDescriptor {
  id: RuntimeId
  label: string
  subtitle: string
}

interface RuntimeResult {
  status: 'ok' | 'error'
  value: string
}

interface ScenarioRow {
  scenario: ScenarioDefinition
  placeholderPreview: string | null
  results: ReadonlyArray<{
    runtime: RuntimeDescriptor
    result: RuntimeResult
  }>
}

const runtimeDescriptors: ReadonlyArray<RuntimeDescriptor> = [
  {
    id: 'basic',
    label: 'basic',
    subtitle: 'createTranslator',
  },
  {
    id: 'icu-subset',
    label: 'icu-subset',
    subtitle: 'createIcuTranslator',
  },
  {
    id: 'icu-formatjs',
    label: 'icu-formatjs',
    subtitle: 'createFormatjsIcuTranslator',
  },
]

const scenarioGroups: ReadonlyArray<{ value: ScenarioGroup; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core' },
  { value: 'icu', label: 'ICU' },
  { value: 'fallback', label: 'Fallback' },
]

const numberLocaleByLanguage: Record<TranslateLanguage, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar-SA',
  pl: 'pl-PL',
}

const currencyByLanguage: Record<TranslateLanguage, 'USD' | 'EUR' | 'SAR' | 'PLN'> = {
  en: 'USD',
  de: 'EUR',
  es: 'EUR',
  fr: 'EUR',
  ar: 'SAR',
  pl: 'PLN',
}

const fixedDate = new Date('2025-01-15T12:34:56.000Z')

const scenarios: ReadonlyArray<ScenarioDefinition> = [
  {
    id: 'core-title',
    group: 'core',
    title: 'Static title',
    description: 'Baseline lookup without placeholders.',
    key: 'greeting_title',
  },
  {
    id: 'core-formatter',
    group: 'core',
    title: 'Legacy formatter placeholder',
    description: 'Backward-compatible {amount|currency} rendering.',
    key: 'invoice_total',
    placeholder: {
      data: [{ key: 'amount', value: 99.99 }],
    },
  },
  {
    id: 'icu-select-plural',
    group: 'icu',
    title: 'Select + plural',
    description: 'Combined ICU select/plural expression.',
    key: 'inbox_summary',
    placeholder: {
      data: [
        { key: 'gender', value: 'female' },
        { key: 'count', value: 1 },
      ],
    },
  },
  {
    id: 'icu-argument-skeleton',
    group: 'icu',
    title: 'ICU skeleton arguments',
    description: 'Compact number and date/time skeleton forms.',
    key: 'icu_argument_skeleton_demo',
    placeholder: {
      data: [
        { key: 'amount', value: 1234567 },
        { key: 'when', value: fixedDate },
      ],
    },
  },
  {
    id: 'icu-plus-rounding-floor',
    group: 'icu',
    title: 'ICU rounding mode floor',
    description: 'FormatJS extension token support comparison.',
    key: 'icu_formatjs_rounding_floor_demo',
    placeholder: {
      data: [{ key: 'amount', value: 1.239 }],
    },
  },
  {
    id: 'fallback-missing-language',
    group: 'fallback',
    title: 'Missing language fallback',
    description: 'In strict mode this key throws because ES text is empty.',
    key: 'fallback_demo',
  },
]

const formatters: PlaceholderFormatterMap<string, TranslateLanguage> = {
  currency: (value, context) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    const locale = numberLocaleByLanguage[context.language]
    const currency = currencyByLanguage[context.language]
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(num)
  },
  dateShort: (value, context) => {
    const date = value instanceof Date ? value : new Date(String(value))
    const locale = numberLocaleByLanguage[context.language]
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  },
}

const language = ref<TranslateLanguage>('en')
const mode = ref<TranslationMode>('fallback')
const activeGroup = ref<ScenarioGroup>('all')

const basic = computed(() =>
  createTranslator(translationTable, {
    language: language.value,
    missingStrategy: mode.value,
    formatters,
  })
)

const icuSubset = computed(() =>
  createIcuTranslator(translationTable, {
    language: language.value,
    missingStrategy: mode.value,
    formatters,
  })
)

const icuFormatjs = computed(() =>
  createFormatjsIcuTranslator(translationTable, {
    language: language.value,
    missingStrategy: mode.value,
    formatters,
  })
)

const filteredScenarios = computed(() =>
  activeGroup.value === 'all'
    ? scenarios
    : scenarios.filter((scenario) => scenario.group === activeGroup.value)
)

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const runScenario = (runtime: RuntimeId, key: TranslateKey, placeholder?: Placeholder): RuntimeResult => {
  try {
    if (runtime === 'basic') {
      return {
        status: 'ok',
        value: placeholder ? basic.value(key, placeholder) : basic.value(key),
      }
    }
    if (runtime === 'icu-subset') {
      return {
        status: 'ok',
        value: placeholder ? icuSubset.value(key, placeholder) : icuSubset.value(key),
      }
    }
    return {
      status: 'ok',
      value: placeholder ? icuFormatjs.value(key, placeholder) : icuFormatjs.value(key),
    }
  } catch (error: unknown) {
    return {
      status: 'error',
      value: toErrorMessage(error),
    }
  }
}

const toSerializableValue = (value: PlaceholderValue): string | number | boolean => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'bigint') {
    return `${value.toString()}n`
  }
  return value
}

const toPlaceholderPreview = (placeholder?: Placeholder): string | null => {
  if (!placeholder) {
    return null
  }
  const serialized = placeholder.data.map((entry) => ({
    key: entry.key,
    value: toSerializableValue(entry.value),
  }))
  return JSON.stringify(serialized)
}

const scenarioRows = computed<ReadonlyArray<ScenarioRow>>(() =>
  filteredScenarios.value.map((scenario) => ({
    scenario,
    placeholderPreview: toPlaceholderPreview(scenario.placeholder),
    results: runtimeDescriptors.map((runtime) => ({
      runtime,
      result: runScenario(runtime.id, scenario.key, scenario.placeholder),
    })),
  }))
)
</script>

<template>
  <section class="runtime-playground">
    <p>
      Public Vue demo based on the same generated keys/table and translation resources used by
      <code>apps/playground-ts</code>.
    </p>

    <div class="control-grid">
      <label>
        Language
        <select v-model="language">
          <option v-for="lang in LanguageCodes" :key="lang" :value="lang">
            {{ lang.toUpperCase() }}
          </option>
        </select>
      </label>

      <label>
        Missing strategy
        <select v-model="mode">
          <option value="fallback">fallback</option>
          <option value="strict">strict</option>
        </select>
      </label>
    </div>

    <div class="group-switch">
      <button
        v-for="group in scenarioGroups"
        :key="group.value"
        type="button"
        :class="{ active: activeGroup === group.value }"
        @click="activeGroup = group.value"
      >
        {{ group.label }}
      </button>
    </div>

    <article v-for="row in scenarioRows" :key="row.scenario.id" class="scenario-card">
      <header>
        <h3>{{ row.scenario.title }}</h3>
        <span class="badge">{{ row.scenario.group }}</span>
      </header>

      <p>{{ row.scenario.description }}</p>

      <div class="meta-row">
        <span>key</span>
        <code>{{ row.scenario.key }}</code>
        <template v-if="row.placeholderPreview">
          <span>placeholder</span>
          <code>{{ row.placeholderPreview }}</code>
        </template>
      </div>

      <table>
        <thead>
          <tr>
            <th>Runtime</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in row.results" :key="entry.runtime.id">
            <td>
              <strong>{{ entry.runtime.label }}</strong>
              <div class="subtitle">{{ entry.runtime.subtitle }}</div>
            </td>
            <td :class="entry.result.status">
              <code>{{ entry.result.value }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>

<style scoped>
.runtime-playground {
  display: grid;
  gap: 1rem;
}

.control-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.9rem;
}

select {
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: var(--vp-c-bg-soft);
}

.group-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.group-switch button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  background: transparent;
  cursor: pointer;
}

.group-switch button.active {
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.scenario-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.75rem;
  padding: 0.9rem;
  background: var(--vp-c-bg-soft);
}

.scenario-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.scenario-card h3 {
  margin: 0;
  font-size: 1rem;
}

.badge {
  border: 1px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
  margin-bottom: 0.8rem;
  font-size: 0.82rem;
}

.meta-row span {
  color: var(--vp-c-text-2);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  border-top: 1px solid var(--vp-c-divider);
  vertical-align: top;
  padding: 0.45rem 0;
}

.subtitle {
  color: var(--vp-c-text-2);
  font-size: 0.78rem;
}

td.ok code {
  color: var(--vp-c-text-1);
}

td.error code {
  color: var(--vp-c-danger-1);
}

code {
  white-space: pre-wrap;
}
</style>
