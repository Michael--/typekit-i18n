import { describe, expect, test } from 'vitest'
import { toIrProjectFromYamlContent } from '../../src/codegen/ir/yaml.js'

describe('toIrProjectFromYamlContent', () => {
  test('throws explicit not-implemented error', () => {
    expect(() => toIrProjectFromYamlContent('version: "1"')).toThrow(
      /YAML-to-IR adapter is not implemented yet/
    )
  })
})
