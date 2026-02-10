import { useState, useCallback } from 'react'
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

  const handleLanguageChange = (newLanguage: TranslateLanguage): void => {
    clearDiagnostics()
    setLanguage(newLanguage)
  }

  const handleModeChange = (newMode: TranslationMode): void => {
    clearDiagnostics()
    setMode(newMode)
  }

  const languages: TranslateLanguage[] = ['en', 'de', 'es', 'fr']

  return (
    <div className="container">
      <header className="header">
        <h1>{translate('greeting_title', language)}</h1>
        <p>
          {translate('greeting_body', language, {
            data: [{ key: 'name', value: 'Developer' }],
          })}
        </p>
      </header>

      <div className="controls">
        <div className="control-group">
          <div className="control-item">
            <label>{translate('language_label', language)}</label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as TranslateLanguage)}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="control-item">
            <label>{translate('mode_label', language)}</label>
            <select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as TranslationMode)}
            >
              <option value="fallback">{translate('mode_fallback', language)}</option>
              <option value="strict">{translate('mode_strict', language)}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>{translate('features_title', language)}</h2>

          <h3>Basic Translation</h3>
          <div className="demo-item">
            <div className="demo-label">greeting_title</div>
            <div className="demo-value">{translate('greeting_title', language)}</div>
          </div>

          <h3>Placeholder Replacement</h3>
          <div className="demo-item">
            <div className="demo-label">greeting_body with name=&quot;Mara&quot;</div>
            <div className="demo-value">
              {translate('greeting_body', language, {
                data: [{ key: 'name', value: 'Mara' }],
              })}
            </div>
          </div>
          <div className="demo-item">
            <div className="demo-label">item_count with count=42</div>
            <div className="demo-value">
              {translate('item_count', language, {
                data: [{ key: 'count', value: 42 }],
              })}
            </div>
          </div>

          <h3>Custom Formatters</h3>
          <div className="demo-item">
            <div className="demo-label">price_formatted with currency formatter</div>
            <div className="demo-value">
              {translate('price_formatted', language, {
                data: [{ key: 'amount', value: 99.99 }],
              })}
            </div>
          </div>
          <div className="demo-item">
            <div className="demo-label">date_formatted with dateShort formatter</div>
            <div className="demo-value">
              {translate('date_formatted', language, {
                data: [{ key: 'date', value: new Date() }],
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Fallback Behavior</h2>

          <h3>Complete Translation</h3>
          <div className="demo-item">
            <div className="demo-label">greeting_title (available in all languages)</div>
            <div className="demo-value">{translate('greeting_title', language)}</div>
          </div>

          <h3>Partial Translation</h3>
          <div className="demo-item">
            <div className="demo-label">
              fallback_demo (missing in ES, should fallback to EN in fallback mode)
            </div>
            <div className="demo-value">{translate('fallback_demo', language)}</div>
          </div>
        </div>
      </div>

      <div className="diagnostics">
        <h2>{translate('diagnostics_title', language)}</h2>

        {missingEvents.length === 0 ? (
          <div className="diagnostics-status success">
            <span className="badge badge-success">✓</span>
            <span>{translate('no_issues', language)}</span>
          </div>
        ) : (
          <>
            <div className="diagnostics-status warning">
              <span className="badge badge-warning">!</span>
              <span>
                {translate('missing_count', language, {
                  data: [{ key: 'count', value: missingEvents.length }],
                })}
              </span>
            </div>

            <ul className="diagnostics-list">
              {missingEvents.map((event, index) => (
                <li key={index} className="diagnostics-item">
                  Key: <code>{event.key}</code>, Language: <code>{event.language}</code>, Reason:{' '}
                  <code>{event.reason}</code>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
