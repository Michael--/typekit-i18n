import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Code,
  Container,
  Divider,
  Group,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { createIcuTranslator, createTranslator } from '@number10/typekit-i18n'
import { createFormatjsIcuTranslator } from '@number10/typekit-i18n/runtime/icu-formatjs'
import type {
  MissingTranslationEvent,
  Placeholder,
  PlaceholderFormatterMap,
  PlaceholderValue,
} from '@number10/typekit-i18n'
import { LanguageCodes, type TranslateKey, type TranslateLanguage } from '@gen/translationKeys'
import { translationTable } from '@gen/translationTable'

type TranslationMode = 'fallback' | 'strict'
type ScenarioGroup = 'all' | 'core' | 'icu' | 'divergence' | 'fallback'
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
  color: string
}

interface RuntimeResult {
  status: 'ok' | 'error'
  value: string
}

interface LoggedMissingEvent extends MissingTranslationEvent<TranslateKey, TranslateLanguage> {
  runtime: RuntimeId
}

const runtimeDescriptors: ReadonlyArray<RuntimeDescriptor> = [
  {
    id: 'basic',
    label: 'basic',
    subtitle: 'createTranslator',
    color: 'gray',
  },
  {
    id: 'icu-subset',
    label: 'icu-subset',
    subtitle: 'createIcuTranslator',
    color: 'blue',
  },
  {
    id: 'icu-formatjs',
    label: 'icu-formatjs',
    subtitle: 'createFormatjsIcuTranslator',
    color: 'teal',
  },
]

const scenarioGroups: { value: ScenarioGroup; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core' },
  { value: 'icu', label: 'ICU' },
  { value: 'divergence', label: 'Divergence' },
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
    description: 'Identical baseline lookup without placeholders.',
    key: 'greeting_title',
  },
  {
    id: 'core-placeholder',
    group: 'core',
    title: 'Simple placeholder',
    description: 'Raw placeholder substitution for {name}.',
    key: 'greeting_body',
    placeholder: {
      data: [{ key: 'name', value: 'Developer' }],
    },
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
    id: 'core-date-formatter',
    group: 'core',
    title: 'Date formatter hook',
    description: 'Custom formatter callback with Date values.',
    key: 'date_formatted',
    placeholder: {
      data: [{ key: 'date', value: fixedDate }],
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
    id: 'icu-plural-categories',
    group: 'icu',
    title: 'Plural categories',
    description: 'Locale category handling (zero/one/few/many/other).',
    key: 'plural_categories_demo',
    placeholder: {
      data: [{ key: 'count', value: 11 }],
    },
  },
  {
    id: 'icu-ordinal',
    group: 'icu',
    title: 'Selectordinal',
    description: 'Ordinal suffix handling by language.',
    key: 'ranking_place',
    placeholder: {
      data: [{ key: 'place', value: 3 }],
    },
  },
  {
    id: 'icu-offset',
    group: 'icu',
    title: 'Plural offset',
    description: 'Offset subtraction for group invite style messages.',
    key: 'group_invite',
    placeholder: {
      data: [{ key: 'count', value: 5 }],
    },
  },
  {
    id: 'icu-argument-style',
    group: 'icu',
    title: 'ICU style arguments',
    description: 'Number/date/time styles in ICU argument expressions.',
    key: 'icu_argument_style_demo',
    placeholder: {
      data: [
        { key: 'amount', value: 1234.56 },
        { key: 'ratio', value: 0.42 },
        { key: 'when', value: fixedDate },
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
    id: 'icu-escape',
    group: 'icu',
    title: 'ICU escaping',
    description: 'Apostrophe escaping and literal brace output.',
    key: 'icu_escape_demo',
    placeholder: {
      data: [{ key: 'name', value: 'Alice' }],
    },
  },
  {
    id: 'divergence-sign',
    group: 'divergence',
    title: 'Divergence: sign-always skeleton',
    description: 'FormatJS supports ::sign-always compact-short, built-in subset rejects it.',
    key: 'icu_formatjs_sign_demo',
    placeholder: {
      data: [{ key: 'amount', value: 1234 }],
    },
  },
  {
    id: 'divergence-unit',
    group: 'divergence',
    title: 'Divergence: unit skeleton',
    description: 'FormatJS supports ::unit/kilometer, built-in subset rejects it.',
    key: 'icu_formatjs_unit_demo',
    placeholder: {
      data: [{ key: 'distance', value: 5 }],
    },
  },
  {
    id: 'fallback-missing-language',
    group: 'fallback',
    title: 'Missing language fallback',
    description: 'In "strict" mode this key throws because ES text is empty.',
    key: 'fallback_demo',
  },
]

/**
 * Custom formatters used by all runtime variants.
 */
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

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Playground app that compares runtime output across three translator variants.
 *
 * @returns Interactive comparison view.
 */
export const App = (): JSX.Element => {
  const [language, setLanguage] = useState<TranslateLanguage>('en')
  const [mode, setMode] = useState<TranslationMode>('fallback')
  const [activeGroup, setActiveGroup] = useState<ScenarioGroup>('all')
  const [missingEvents, setMissingEvents] = useState<LoggedMissingEvent[]>([])

  const missingEventsRef = useRef<LoggedMissingEvent[]>([])
  const seenMissingEventKeysRef = useRef<Set<string>>(new Set<string>())

  const clearDiagnostics = useCallback((): void => {
    missingEventsRef.current = []
    seenMissingEventKeysRef.current.clear()
    setMissingEvents([])
  }, [])

  const reportMissing = useCallback(
    (runtime: RuntimeId, event: MissingTranslationEvent<TranslateKey, TranslateLanguage>): void => {
      const dedupeKey = `${runtime}::${event.key}::${event.language}::${event.reason}`
      if (seenMissingEventKeysRef.current.has(dedupeKey)) {
        return
      }
      seenMissingEventKeysRef.current.add(dedupeKey)
      missingEventsRef.current.push({
        ...event,
        runtime,
      })
    },
    []
  )

  const basic = useMemo(
    () =>
      createTranslator(translationTable, {
        language,
        missingStrategy: mode,
        formatters,
        onMissingTranslation: (event) => reportMissing('basic', event),
      }),
    [language, mode, reportMissing]
  )

  const icuSubset = useMemo(
    () =>
      createIcuTranslator(translationTable, {
        language,
        missingStrategy: mode,
        formatters,
        onMissingTranslation: (event) => reportMissing('icu-subset', event),
      }),
    [language, mode, reportMissing]
  )

  const icuFormatjs = useMemo(
    () =>
      createFormatjsIcuTranslator(translationTable, {
        language,
        missingStrategy: mode,
        formatters,
        onMissingTranslation: (event) => reportMissing('icu-formatjs', event),
      }),
    [language, mode, reportMissing]
  )

  const filteredScenarios = useMemo(
    () =>
      activeGroup === 'all'
        ? scenarios
        : scenarios.filter((scenario) => scenario.group === activeGroup),
    [activeGroup]
  )

  useEffect(() => {
    if (missingEventsRef.current.length !== missingEvents.length) {
      setMissingEvents([...missingEventsRef.current])
    }
  }, [missingEvents.length, language, mode, activeGroup])

  const runScenario = useCallback(
    (runtime: RuntimeId, key: TranslateKey, placeholder?: Placeholder): RuntimeResult => {
      try {
        if (runtime === 'basic') {
          return {
            status: 'ok',
            value: placeholder ? basic(key, placeholder) : basic(key),
          }
        }
        if (runtime === 'icu-subset') {
          return {
            status: 'ok',
            value: placeholder ? icuSubset(key, placeholder) : icuSubset(key),
          }
        }
        return {
          status: 'ok',
          value: placeholder ? icuFormatjs(key, placeholder) : icuFormatjs(key),
        }
      } catch (error: unknown) {
        return {
          status: 'error',
          value: toErrorMessage(error),
        }
      }
    },
    [basic, icuSubset, icuFormatjs]
  )

  const handleLanguageChange = (value: string | null): void => {
    if (!value) {
      return
    }
    clearDiagnostics()
    setLanguage(value as TranslateLanguage)
  }

  const handleModeChange = (value: string | null): void => {
    if (!value) {
      return
    }
    clearDiagnostics()
    setMode(value as TranslationMode)
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Paper
          p="lg"
          radius="lg"
          withBorder
          style={{
            background:
              'linear-gradient(160deg, rgba(32, 40, 62, 0.95) 0%, rgba(19, 29, 52, 0.95) 45%, rgba(10, 46, 57, 0.95) 100%)',
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="xs" c="cyan.2" tt="uppercase" fw={700}>
                  Runtime Comparison Playground
                </Text>
                <Title order={1} size="1.6rem" c="white">
                  {basic('greeting_title')}
                </Title>
                <Text c="gray.2">
                  Compare output of all three runtimes on the same translation key and payload.
                </Text>
              </Stack>
              <Badge size="lg" variant="light" color="cyan">
                {language.toUpperCase()} / {mode}
              </Badge>
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Stack gap="sm">
            <Group grow align="flex-end">
              <Select
                label={basic('language_label')}
                value={language}
                onChange={handleLanguageChange}
                data={LanguageCodes.map((lang) => ({
                  value: lang,
                  label: lang.toUpperCase(),
                }))}
              />
              <Select
                label={basic('mode_label')}
                value={mode}
                onChange={handleModeChange}
                data={[
                  { value: 'fallback', label: basic('mode_fallback') },
                  { value: 'strict', label: basic('mode_strict') },
                ]}
              />
            </Group>
            <SegmentedControl
              fullWidth
              value={activeGroup}
              onChange={(value) => setActiveGroup(value as ScenarioGroup)}
              data={scenarioGroups}
            />
          </Stack>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Stack gap="xs">
            <Text fw={600}>Runtime Labels</Text>
            <Group gap="xs">
              {runtimeDescriptors.map((runtime) => (
                <Badge key={runtime.id} color={runtime.color} variant="light">
                  {runtime.label}: {runtime.subtitle}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Paper>

        <Stack gap="md">
          {filteredScenarios.map((scenario) => {
            const placeholderPreview = toPlaceholderPreview(scenario.placeholder)
            return (
              <Paper key={scenario.id} p="md" radius="md" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Stack gap={2}>
                      <Text fw={600}>{scenario.title}</Text>
                      <Text size="sm" c="dimmed">
                        {scenario.description}
                      </Text>
                    </Stack>
                    <Badge variant="light" color="indigo">
                      {scenario.group}
                    </Badge>
                  </Group>

                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      key
                    </Text>
                    <Code>{scenario.key}</Code>
                    {placeholderPreview && (
                      <>
                        <Text size="xs" c="dimmed">
                          placeholder
                        </Text>
                        <Code>{placeholderPreview}</Code>
                      </>
                    )}
                  </Group>

                  <Divider />

                  <Stack gap="xs">
                    {runtimeDescriptors.map((runtime) => {
                      const result = runScenario(runtime.id, scenario.key, scenario.placeholder)
                      return (
                        <Paper key={runtime.id} p="sm" radius="sm" withBorder>
                          <Stack gap={6}>
                            <Group justify="space-between" align="center">
                              <Badge color={runtime.color} variant="light">
                                {runtime.label}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {runtime.subtitle}
                              </Text>
                            </Group>
                            {result.status === 'ok' ? (
                              <Text ff="monospace" size="sm">
                                {result.value}
                              </Text>
                            ) : (
                              <Alert color="red" variant="light" title="Runtime Error">
                                <Text ff="monospace" size="xs">
                                  {result.value}
                                </Text>
                              </Alert>
                            )}
                          </Stack>
                        </Paper>
                      )
                    })}
                  </Stack>
                </Stack>
              </Paper>
            )
          })}
        </Stack>

        <Paper p="md" radius="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>{basic('diagnostics_title')}</Text>
              <Badge color={missingEvents.length > 0 ? 'orange' : 'green'} variant="light">
                {missingEvents.length}
              </Badge>
            </Group>
            {missingEvents.length === 0 ? (
              <Alert color="green" variant="light">
                <Text size="sm">{basic('no_issues')}</Text>
              </Alert>
            ) : (
              <Stack gap="xs">
                {missingEvents.map((event, index) => (
                  <Paper
                    key={`${event.runtime}-${event.key}-${index}`}
                    p="xs"
                    withBorder
                    radius="sm"
                  >
                    <Group gap="xs">
                      <Badge variant="light">{event.runtime}</Badge>
                      <Code>{event.key}</Code>
                      <Code>{event.language}</Code>
                      <Code>{event.reason}</Code>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
