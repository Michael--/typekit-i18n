import { useState, useCallback } from 'react'
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
} from '@mantine/core'
import { createTranslator } from 'typekit-i18n'
import { type TranslateKey, type TranslateLanguage } from '@gen/translationKeys'
import { translationTable } from '@gen/translationTable'
import type { MissingTranslationEvent, PlaceholderFormatterMap } from 'typekit-i18n'

type TranslationMode = 'fallback' | 'strict'

/**
 * Custom formatters for demonstrating placeholder formatting feature.
 */
const formatters: PlaceholderFormatterMap<TranslateKey, TranslateLanguage> = {
  currency: (value, context) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    const locale = context.language === 'de' ? 'de-DE' : 'en-US'
    const currency = context.language === 'de' ? 'EUR' : 'USD'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(num)
  },
  dateShort: (value, context) => {
    const date = value instanceof Date ? value : new Date(String(value))
    const locale = context.language === 'de' ? 'de-DE' : 'en-US'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  },
}

export const App = (): JSX.Element => {
  const [language, setLanguage] = useState<TranslateLanguage>('en')
  const [mode, setMode] = useState<TranslationMode>('fallback')
  const [missingEvents, setMissingEvents] = useState<
    MissingTranslationEvent<TranslateKey, TranslateLanguage>[]
  >([])

  const onMissingTranslation = useCallback(
    (event: MissingTranslationEvent<TranslateKey, TranslateLanguage>) => {
      setMissingEvents((prev) => [...prev, event])
    },
    []
  )

  const translate = createTranslator<TranslateLanguage, TranslateKey, typeof translationTable>(
    translationTable,
    {
      defaultLanguage: 'en',
      missingStrategy: mode,
      formatters,
      onMissingTranslation,
    }
  )

  const clearDiagnostics = (): void => {
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

  const languages: TranslateLanguage[] = ['en', 'de', 'es', 'fr']

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="xs" align="center">
          <Title
            order={1}
            size="3rem"
            fw={700}
            style={{
              background: 'linear-gradient(135deg, #228be6 0%, #7950f2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {translate('greeting_title', language)}
          </Title>
          <Text size="lg" c="dimmed">
            {translate('greeting_body', language, {
              data: [{ key: 'name', value: 'Developer' }],
            })}
          </Text>
        </Stack>

        {/* Controls */}
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Group gap="xl" grow>
            <Select
              label={translate('language_label', language)}
              value={language}
              onChange={handleLanguageChange}
              data={languages.map((lang) => ({
                value: lang,
                label: lang.toUpperCase(),
              }))}
            />
            <Select
              label={translate('mode_label', language)}
              value={mode}
              onChange={handleModeChange}
              data={[
                { value: 'fallback', label: translate('mode_fallback', language) },
                { value: 'strict', label: translate('mode_strict', language) },
              ]}
            />
          </Group>
        </Paper>

        {/* Feature Grid */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper shadow="sm" p="lg" radius="md" withBorder h="100%">
              <Stack gap="md">
                <Title order={2} size="h3" c="blue">
                  {translate('features_title', language)}
                </Title>

                <Divider label="Basic Translation" labelPosition="left" />
                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    greeting_title
                  </Text>
                  <Text>{translate('greeting_title', language)}</Text>
                </Paper>

                <Divider label="Placeholder Replacement" labelPosition="left" />
                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    greeting_body with name=&quot;Mara&quot;
                  </Text>
                  <Text>
                    {translate('greeting_body', language, {
                      data: [{ key: 'name', value: 'Mara' }],
                    })}
                  </Text>
                </Paper>

                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    item_count with count=42
                  </Text>
                  <Text>
                    {translate('item_count', language, {
                      data: [{ key: 'count', value: 42 }],
                    })}
                  </Text>
                </Paper>

                <Divider label="Custom Formatters" labelPosition="left" />
                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    price_formatted with currency formatter
                  </Text>
                  <Text>
                    {translate('price_formatted', language, {
                      data: [{ key: 'amount', value: 99.99 }],
                    })}
                  </Text>
                </Paper>

                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    date_formatted with dateShort formatter
                  </Text>
                  <Text>
                    {translate('date_formatted', language, {
                      data: [{ key: 'date', value: new Date() }],
                    })}
                  </Text>
                </Paper>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper shadow="sm" p="lg" radius="md" withBorder h="100%">
              <Stack gap="md">
                <Title order={2} size="h3" c="blue">
                  Fallback Behavior
                </Title>

                <Divider label="Complete Translation" labelPosition="left" />
                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    greeting_title (available in all languages)
                  </Text>
                  <Text>{translate('greeting_title', language)}</Text>
                </Paper>

                <Divider label="Partial Translation" labelPosition="left" />
                <Paper p="md" bg="dark.6" radius="sm">
                  <Text size="xs" c="dimmed" mb={4}>
                    fallback_demo (missing in ES, should fallback to EN in fallback mode)
                  </Text>
                  <Text>{translate('fallback_demo', language)}</Text>
                </Paper>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Diagnostics */}
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2} size="h3" c="orange">
              {translate('diagnostics_title', language)}
            </Title>

            {missingEvents.length === 0 ? (
              <Alert variant="light" color="green" title={translate('no_issues', language)}>
                <Group gap="xs">
                  <Badge color="green" variant="filled">
                    ✓
                  </Badge>
                  <Text size="sm">{translate('no_issues', language)}</Text>
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
                      {translate('missing_count', language, {
                        data: [{ key: 'count', value: missingEvents.length }],
                      })}
                    </Text>
                  </Group>
                </Alert>

                <Stack gap="xs">
                  {missingEvents.map((event, index) => (
                    <Paper key={index} p="sm" bg="dark.6" radius="sm" withBorder>
                      <Text size="sm" ff="monospace">
                        Key: <Code>{event.key}</Code>, Language: <Code>{event.language}</Code>,
                        Reason: <Code>{event.reason}</Code>
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
