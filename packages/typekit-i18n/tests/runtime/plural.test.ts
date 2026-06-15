import { describe, expect, test } from 'vitest'
import { pluralCategory, pluralKey } from '../../src/runtime/plural.js'

describe('pluralCategory', () => {
  test('returns "one" for value 1 in English', () => {
    expect(pluralCategory(1, 'en')).toBe('one')
  })

  test('returns "other" for value 5 in English', () => {
    expect(pluralCategory(5, 'en')).toBe('other')
  })

  test('returns "other" for value 0 in English', () => {
    expect(pluralCategory(0, 'en')).toBe('other')
  })

  test('returns "zero" for value 0 in Arabic', () => {
    expect(pluralCategory(0, 'ar')).toBe('zero')
  })

  test('returns "few" for value 3 in Arabic', () => {
    expect(pluralCategory(3, 'ar')).toBe('few')
  })

  test('returns "many" for value 11 in Arabic', () => {
    expect(pluralCategory(11, 'ar')).toBe('many')
  })

  test('returns "few" for value 2 in Polish', () => {
    expect(pluralCategory(2, 'pl')).toBe('few')
  })

  test('returns "many" for value 5 in Polish', () => {
    expect(pluralCategory(5, 'pl')).toBe('many')
  })

  test('defaults to "en" when locale is omitted', () => {
    expect(pluralCategory(1)).toBe('one')
    expect(pluralCategory(5)).toBe('other')
  })
})

describe('pluralKey', () => {
  test('appends plural category to base key', () => {
    expect(pluralKey('item_count', 1, 'en')).toBe('item_count_one')
    expect(pluralKey('item_count', 5, 'en')).toBe('item_count_other')
  })

  test('respects Arabic plural rules', () => {
    expect(pluralKey('item_count', 0, 'ar')).toBe('item_count_zero')
    expect(pluralKey('item_count', 1, 'ar')).toBe('item_count_one')
    expect(pluralKey('item_count', 2, 'ar')).toBe('item_count_two')
    expect(pluralKey('item_count', 6, 'ar')).toBe('item_count_few')
    expect(pluralKey('item_count', 11, 'ar')).toBe('item_count_many')
  })
})
