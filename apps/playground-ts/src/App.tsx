import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Container,
  Title,
  Text,
  Select,
  Group,
  Stack,
  Paper,
  Badge,
  Grid,
  Alert,
  Code,
  Divider,
  NavLink,
} from '@mantine/core'
import { createIcuTranslator, createTranslator } from 'typekit-i18n'
import { LanguageCodes, type TranslateKey, type TranslateLanguage } from '@gen/translationKeys'
import { translationTable } from '@gen/translationTable'
import type { MissingTranslationEvent, PlaceholderFormatterMap } from 'typekit-i18n'

type TranslationMode = 'fallback' | 'strict'
type DemoCase =
  | 'overview'
  | 'basic'
  | 'placeholders'
  | 'formatters'
  | 'icu-arguments'
  | 'icu-select'
  | 'icu-plural'
  | 'icu-selectordinal'
  | 'icu-offset'
  | 'icu-escape'
  | 'fallback'
  | 'diagnostics'

interface DemoCaseDefinition {
  id: DemoCase
  title: string
  description: string
}

const demoCases: ReadonlyArray<DemoCaseDefinition> = [
  {
    id: 'overview',
    title: 'Overview',
    description: 'Runtime state and mode',
  },
  {
    id: 'basic',
    title: 'Basic Translation',
    description: 'Simple key lookup',
  },
  {
    id: 'placeholders',
    title: 'Placeholders',
    description: 'Inject values into text',
  },
  {
    id: 'formatters',
    title: 'Custom Formatters',
    description: 'Named format hooks in templates',
  },
  {
    id: 'icu-arguments',
    title: 'ICU Arguments',
    description: 'number, date, time with style/skeleton',
  },
  {
    id: 'icu-select',
    title: 'ICU Select',
    description: 'Gender and value-based selection',
  },
  {
    id: 'icu-plural',
    title: 'ICU Plural',
    description: 'Zero, one, other plural categories',
  },
  {
    id: 'icu-selectordinal',
    title: 'ICU Selectordinal',
    description: 'Ordinal number formatting (1st, 2nd)',
  },
  {
    id: 'icu-offset',
    title: 'ICU Plural Offset',
    description: 'Offset for plurals (you and N others)',
  },
  {
    id: 'icu-escape',
    title: 'ICU Escaping',
    description: 'Apostrophe and literal text handling',
  },
  {
    id: 'fallback',
    title: 'Fallback Behavior',
    description: 'Missing language and strict mode',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics',
    description: 'Collected missing translation events',
  },
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

/**
 * Custom formatters for demonstrating placeholder formatting feature.
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

export const App = (): JSX.Element => {
  const [mode, setMode] = useState<TranslationMode>('fallback')
  const [activeCase, setActiveCase] = useState<DemoCase>('overview')
  const [missingEvents, setMissingEvents] = useState<
    MissingTranslationEvent<TranslateKey, TranslateLanguage>[]
  >([])

  // Use ref to collect missing translations without triggering re-renders during render
  const missingEventsRef = useRef<MissingTranslationEvent<TranslateKey, TranslateLanguage>[]>([])

  const onMissingTranslation = useCallback(
    (event: MissingTranslationEvent<TranslateKey, TranslateLanguage>) => {
      // Check if this event already exists
      const exists = missingEventsRef.current.some(
        (e) => e.key === event.key && e.language === event.language && e.reason === event.reason
      )
      if (!exists) {
        missingEventsRef.current.push(event)
      }
    },
    []
  )

  // Sync ref to state after render
  useEffect(() => {
    if (missingEventsRef.current.length > 0) {
      setMissingEvents([...missingEventsRef.current])
    }
  }, [activeCase, mode])

  const t = useMemo(
    () =>
      createTranslator(translationTable, {
        missingStrategy: mode,
        formatters,
        onMissingTranslation,
      }),
    [mode, onMissingTranslation]
  )

  const icu = useMemo(
    () =>
      createIcuTranslator(translationTable, {
        missingStrategy: mode,
        formatters,
        onMissingTranslation,
      }),
    [mode, onMissingTranslation]
  )

  // Derive language from active case for demonstration purposes
  const setLanguage = useCallback(
    (newLanguage: TranslateLanguage) => {
      t.setLanguage(newLanguage)
      icu.setLanguage(newLanguage)
    },
    [t, icu]
  )

  // Get current language from translator (they are kept in sync)
  const language = useMemo(() => {
    return t.getLanguage()
  }, [t])

  const clearDiagnostics = (): void => {
    missingEventsRef.current = []
    setMissingEvents([])
  }

  const handleLanguageChange = (newLanguage: string | null): void => {
    if (!newLanguage) return
    clearDiagnostics()
    setLanguage(newLanguage as TranslateLanguage)
  }

  const handleModeChange = (newMode: string | null): void => {
    if (!newMode) return
    clearDiagnostics()
    setMode(newMode as TranslationMode)
  }

  const languages = LanguageCodes
  const activeCaseDefinition = demoCases.find((item) => item.id === activeCase) ?? demoCases[0]

  const renderDemoCard = (label: string, value: string): JSX.Element => (
    <Paper p="md" bg="dark.6" radius="sm">
      <Text size="xs" c="dimmed" mb={4}>
        {label}
      </Text>
      <Text>{value}</Text>
    </Paper>
  )

  const renderFallbackCaseResult = (): JSX.Element => {
    try {
      return <Text>{t('fallback_demo')}</Text>
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return (
        <Alert variant="light" color="red" title="Strict mode error">
          <Text size="sm" ff="monospace">
            {message}
          </Text>
        </Alert>
      )
    }
  }

  const renderCaseContent = (): JSX.Element => {
    if (activeCase === 'overview') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            Overview
          </Title>
          <Group gap="xs">
            <Badge color="blue" variant="light">
              Language: {language.toUpperCase()}
            </Badge>
            <Badge color={mode === 'strict' ? 'red' : 'green'} variant="light">
              Mode: {mode}
            </Badge>
            <Badge color="orange" variant="light">
              Missing events: {missingEvents.length}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Use the left sidebar to isolate one runtime behavior at a time.
          </Text>
          {renderDemoCard('greeting_title', t.in('playground', 'greeting_title'))}
          {renderDemoCard(
            'greeting_body with name="Developer"',
            t('greeting_body', {
              data: [{ key: 'name', value: 'Developer' }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'basic') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            Basic Translation
          </Title>
          {renderDemoCard('greeting_title', t('greeting_title'))}
        </Stack>
      )
    }

    if (activeCase === 'placeholders') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            Placeholder Replacement
          </Title>
          {renderDemoCard(
            'greeting_body with name="Mara"',
            t('greeting_body', {
              data: [{ key: 'name', value: 'Mara' }],
            })
          )}
          {renderDemoCard(
            'item_count with count=42',
            t('item_count', {
              data: [{ key: 'count', value: 42 }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'formatters') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            Custom Formatters
          </Title>
          {renderDemoCard(
            'price_formatted with amount=99.99',
            t('price_formatted', {
              data: [{ key: 'amount', value: 99.99 }],
            })
          )}
          {renderDemoCard(
            'date_formatted with date=now',
            t('date_formatted', {
              data: [{ key: 'date', value: new Date() }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'icu-arguments') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            ICU Arguments
          </Title>
          <Text size="sm" c="dimmed">
            Number, date, and time arguments support both named styles and ICU skeletons.
          </Text>
          {renderDemoCard(
            'icu_argument_style_demo',
            icu('icu_argument_style_demo', {
              data: [
                { key: 'amount', value: 1234.56 },
                { key: 'ratio', value: 0.42 },
                { key: 'when', value: new Date('2025-01-15T12:34:56.000Z') },
              ],
            })
          )}
          {renderDemoCard(
            'icu_argument_skeleton_demo',
            icu('icu_argument_skeleton_demo', {
              data: [
                { key: 'amount', value: 1234567 },
                { key: 'when', value: new Date('2025-01-15T12:34:56.000Z') },
              ],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'icu-select') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            ICU Select
          </Title>
          <Text size="sm" c="dimmed">
            Select expressions choose text based on a variable value.
          </Text>
          {renderDemoCard(
            'inbox_summary with gender="female"',
            icu('inbox_summary', {
              data: [
                { key: 'gender', value: 'female' },
                { key: 'count', value: 1 },
              ],
            })
          )}
          {renderDemoCard(
            'inbox_summary with gender="male"',
            icu('inbox_summary', {
              data: [
                { key: 'gender', value: 'male' },
                { key: 'count', value: 1 },
              ],
            })
          )}
          {renderDemoCard(
            'inbox_summary with gender="other"',
            icu('inbox_summary', {
              data: [
                { key: 'gender', value: 'other' },
                { key: 'count', value: 5 },
              ],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'icu-plural') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            ICU Plural
          </Title>
          <Text size="sm" c="dimmed">
            Plural expressions handle language-specific plural categories.
          </Text>
          <Divider label="Basic Plural" labelPosition="left" />
          {renderDemoCard(
            'inbox_summary with count=0',
            icu('inbox_summary', {
              data: [
                { key: 'gender', value: 'other' },
                { key: 'count', value: 0 },
              ],
            })
          )}
          {renderDemoCard(
            'inbox_summary with count=1',
            icu('inbox_summary', {
              data: [
                { key: 'gender', value: 'other' },
                { key: 'count', value: 1 },
              ],
            })
          )}
          {renderDemoCard(
            'inbox_summary with count=5',
            icu('inbox_summary', {
              data: [
                { key: 'gender', value: 'other' },
                { key: 'count', value: 5 },
              ],
            })
          )}
          <Divider label="Category Coverage (zero/two/few/many)" labelPosition="left" />
          <Text size="xs" c="dimmed">
            Category resolution follows the currently selected language.
          </Text>
          {renderDemoCard(
            'plural_categories_demo with count=0',
            icu('plural_categories_demo', {
              data: [{ key: 'count', value: 0 }],
            })
          )}
          {renderDemoCard(
            'plural_categories_demo with count=2',
            icu('plural_categories_demo', {
              data: [{ key: 'count', value: 2 }],
            })
          )}
          {renderDemoCard(
            'plural_categories_demo with count=3',
            icu('plural_categories_demo', {
              data: [{ key: 'count', value: 3 }],
            })
          )}
          {renderDemoCard(
            'plural_categories_demo with count=11',
            icu('plural_categories_demo', {
              data: [{ key: 'count', value: 11 }],
            })
          )}
          {renderDemoCard(
            'plural_categories_demo with count=100',
            icu('plural_categories_demo', {
              data: [{ key: 'count', value: 100 }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'icu-selectordinal') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            ICU Selectordinal
          </Title>
          <Text size="sm" c="dimmed">
            Ordinal numbers with locale-aware suffixes (1st, 2nd, 3rd).
          </Text>
          {renderDemoCard(
            'ranking_place with place=1',
            icu('ranking_place', {
              data: [{ key: 'place', value: 1 }],
            })
          )}
          {renderDemoCard(
            'ranking_place with place=2',
            icu('ranking_place', {
              data: [{ key: 'place', value: 2 }],
            })
          )}
          {renderDemoCard(
            'ranking_place with place=3',
            icu('ranking_place', {
              data: [{ key: 'place', value: 3 }],
            })
          )}
          {renderDemoCard(
            'ranking_place with place=11',
            icu('ranking_place', {
              data: [{ key: 'place', value: 11 }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'icu-offset') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            ICU Plural Offset
          </Title>
          <Text size="sm" c="dimmed">
            Offset subtracts from the count for "you and N others" patterns.
          </Text>
          {renderDemoCard(
            'group_invite with count=0',
            icu('group_invite', {
              data: [{ key: 'count', value: 0 }],
            })
          )}
          {renderDemoCard(
            'group_invite with count=1',
            icu('group_invite', {
              data: [{ key: 'count', value: 1 }],
            })
          )}
          {renderDemoCard(
            'group_invite with count=2',
            icu('group_invite', {
              data: [{ key: 'count', value: 2 }],
            })
          )}
          {renderDemoCard(
            'group_invite with count=5',
            icu('group_invite', {
              data: [{ key: 'count', value: 5 }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'icu-escape') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            ICU Escaping
          </Title>
          <Text size="sm" c="dimmed">
            Apostrophes escape special characters and literal braces.
          </Text>
          {renderDemoCard(
            'icu_escape_demo',
            icu('icu_escape_demo', {
              data: [{ key: 'name', value: 'Alice' }],
            })
          )}
        </Stack>
      )
    }

    if (activeCase === 'fallback') {
      return (
        <Stack gap="sm">
          <Title order={2} size="h4" c="blue">
            Fallback Behavior
          </Title>
          <Divider label="Complete Translation" labelPosition="left" />
          {renderDemoCard('greeting_title (available in all languages)', t('greeting_title'))}
          <Divider label="Partial Translation" labelPosition="left" />
          <Paper p="md" bg="dark.6" radius="sm">
            <Text size="xs" c="dimmed" mb={4}>
              fallback_demo (missing in ES)
            </Text>
            {renderFallbackCaseResult()}
          </Paper>
        </Stack>
      )
    }

    return (
      <Stack gap="sm">
        <Title order={2} size="h4" c="orange">
          {t('diagnostics_title')}
        </Title>

        {missingEvents.length === 0 ? (
          <Alert variant="light" color="green" title={t('no_issues')}>
            <Group gap="xs">
              <Badge color="green" variant="filled">
                ✓
              </Badge>
              <Text size="sm">{t('no_issues')}</Text>
            </Group>
          </Alert>
        ) : (
          <>
            <Alert variant="light" color="orange">
              <Group gap="xs">
                <Badge color="orange" variant="filled">
                  !
                </Badge>
                <Text size="sm">
                  {t('missing_count', {
                    data: [{ key: 'count', value: missingEvents.length }],
                  })}
                </Text>
              </Group>
            </Alert>

            <Paper p="sm" bg="dark.6" radius="sm" withBorder>
              {missingEvents.map((event, index) => (
                <Text key={index} size="sm" ff="monospace">
                  Key: <Code>{event.key}</Code>: <Code>{event.language}</Code>, Reason:{' '}
                  <Code>{event.reason}</Code>
                </Text>
              ))}
            </Paper>
          </>
        )}
      </Stack>
    )
  }

  return (
    <Container size="lg" py="md">
      <Stack gap="md">
        {/* Header */}
        <Stack gap="xs" align="center">
          <Title
            order={1}
            size="1.5rem"
            fw={700}
            style={{
              background: 'linear-gradient(135deg, #228be6 0%, #7950f2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('greeting_title')}
          </Title>
          <Text size="lg" c="dimmed">
            {t('greeting_body', {
              data: [{ key: 'name', value: 'Developer' }],
            })}
          </Text>
        </Stack>

        {/* Controls */}
        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Group gap="lg" grow>
            <Select
              label={t('language_label')}
              value={language}
              onChange={handleLanguageChange}
              data={languages.map((lang) => ({
                value: lang,
                label: lang.toUpperCase(),
              }))}
            />
            <Select
              label={t('mode_label')}
              value={mode}
              onChange={handleModeChange}
              data={[
                { value: 'fallback', label: t('mode_fallback') },
                { value: 'strict', label: t('mode_strict') },
              ]}
            />
          </Group>
        </Paper>

        <Grid align="flex-start">
          <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
            <Paper shadow="sm" p="sm" radius="md" withBorder>
              <Stack gap="xs">
                <Title order={3} size="h5">
                  Cases
                </Title>
                {demoCases.map((item) => (
                  <NavLink
                    key={item.id}
                    label={item.title}
                    description={item.description}
                    active={activeCase === item.id}
                    onClick={() => setActiveCase(item.id)}
                    variant="filled"
                  />
                ))}
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
            <Paper shadow="sm" p="md" radius="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Title order={2} size="h4">
                    {activeCaseDefinition.title}
                  </Title>
                  <Badge variant="light">{activeCaseDefinition.id}</Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {activeCaseDefinition.description}
                </Text>
                <Divider />
                {renderCaseContent()}
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  )
}
