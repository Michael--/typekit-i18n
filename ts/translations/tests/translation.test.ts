import { describe, expect, test } from "vitest"
import { translate } from "../translation"

// cspell:disable

describe("translateKey function", () => {
    test("should return the correct translation for existing keys", () => {
        expect(translate("Summary", "en")).toBe("Summary")
        expect(translate("Summary", "de")).toBe("Übersicht")
    })
})
