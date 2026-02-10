// placeholders can be string only for simplicity
export interface FormatPlaceholder {
  key: string
  value: string
}

export interface Placeholder {
  data: FormatPlaceholder[]
}
