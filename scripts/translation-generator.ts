import pc from 'picocolors'
import * as fs from 'fs'
import { glob } from 'glob'
import { IFlatEntryArray, ReadTranslationCSV } from './translation-tools.js'

const header = (input: string[]) => {
  const files = input.map((e, i) => `[${i + 1}/${input.length}] "${e}"`)

  return `/*
   This file is generated, please don't change manually
   Created by converting:
   ${files.join('\n   ')}
*/
// cspell:disable
/* eslint-disable sonarjs/no-duplicate-string */
/* eslint-disable prettier/prettier */

`
}
async function exportTranslationTable(filename: string, fa: IFlatEntryArray, input: string[]) {
  const ws = fs.createWriteStream(filename, 'utf-8')
  ws.write(header(input))

  ws.write('export const translationTable = {\n')
  fa.forEach((e) => {
    ws.write(`   "${e.key}": {\n`)
    ws.write(`      description: "${e.description}",\n`)
    // Iterating over dynamic properties
    for (const propName in e) {
      // Skip known fixed properties
      if (propName !== 'key' && propName !== 'description') {
        ws.write(`      ${propName}: "${e[propName]}",\n`)
      }
    }
    ws.write(`   },\n`)
  })
  ws.write(`} as const\n`)

  ws.write(`\n`)
  ws.write(`export type TranslateKeys = keyof typeof translationTable\n`)
  ws.close()
}

async function main() {
  const inputPattern = 'ts/translations/translation*.csv'
  const output = 'ts/translations/translationTable.ts'
  const files = await glob(inputPattern)

  let allTranslations: IFlatEntryArray = []
  for (const file of files) {
    const translations = await ReadTranslationCSV(file)
    allTranslations = allTranslations.concat(translations)
    console.log(pc.green(`Read "${file}" with ${translations.length} accessible translation keys`))
  }

  await exportTranslationTable(output, allTranslations, files)
  console.log(
    pc.yellow(
      `Write "${output}" created with ${allTranslations.length} accessible translation keys`
    )
  )
}

main()
