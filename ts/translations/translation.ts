import { translationTable, TranslateKeys } from "./translationTable"
import { FormatPlaceholder, Placeholder } from "./translationTypes"

/** all supported languages code */
export const Iso639Codes = ["en", "de"] as const
export type Iso639CodeType = (typeof Iso639Codes)[number]

/** interface to map iso codes to a display name */
export interface ILanguages {
    /** the display name of the language */
    name: string
    /** the iso code of the language */
    iso: Iso639CodeType
}

/** the complete supported table of all languages */
export const supportedLanguages: ILanguages[] = [
    // cspell:disable
    { name: "English", iso: "en" },
    { name: "Deutsch", iso: "de" },
    // cspell:enable
]

/**
 * Retrieves the translation for a given key and language code.
 * Falls back to the default language ("en") if the specified language translation is missing.
 * Returns the key as string if neither the requested nor the default language translation is available.
 *
 * @param language - The ISO 639 language code for the requested translation. May not exist.
 * @param key - The translation key, guaranteed to exist due to TypeScript's type safety.
 * @param {Record<string, string | number | boolean>} placeholders - An object mapping placeholder names to their replacement values, which can be strings, numbers, or booleans.
 * @returns The translation string for the given key and language.
 *
 * * @example
 * // Assuming your translation file has an entry like this:
 * // "page_info": "{pageCount} pages in [{aiPagesList}]"
 *
 * // To use `translateFormat` to fill in the placeholders:
 * const pageInfo = translateFormat("page_info", "page_info", { pageCount: 5, aiPagesList: "3, 5-8" });
 * // Returns: "5 pages in [3, 5-8]"
 */
export function translate(key: TranslateKeys, language: Iso639CodeType, placeholder?: Placeholder): string {
    const translation = translationTable[key]

    // console.log(`translate key="${key}" language="${language}"`)

    // try requested language
    let rs = translation[language] as string
    if (rs?.length <= 0) {
        // try "en" as the default language and always present as a fallback.
        rs = translation["en"]
        if (rs?.length > 0) {
            console.warn(`use default language for key: "${key}"`)
        }
    }

    // found something, may be empty string, fill placeholders if any
    if (rs?.length > 0) {
        // If placeholders are provided, replace them in the translation string
        placeholder?.data.forEach(p => {
            rs = rs.replace(new RegExp(`{${p.key}}`, "g"), p.value)
        })
        // translated and filled
        return rs
    }

    console.warn(`no translation for key found: "${key}"`)
    return key
}
