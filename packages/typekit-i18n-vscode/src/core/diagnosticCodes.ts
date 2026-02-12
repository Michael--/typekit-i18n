/**
 * Stable diagnostic codes emitted by the extension.
 */
export const DIAGNOSTIC_CODES = {
  parseError: 'TKI001',
  invalidSchema: 'TKI002',
  missingKeyHeader: 'TKI003',
  invalidValueType: 'TKI004',
  duplicateKey: 'TKI100',
  missingLocaleValue: 'TKI101',
  placeholderMismatch: 'TKI102',
  invalidIcuPluralShape: 'TKI103',
  missingKeyUsage: 'TKI200',
} as const

/**
 * Union of all supported diagnostic code values.
 */
export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES]
