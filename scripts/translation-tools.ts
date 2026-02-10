import colors from "colors"
import { simpleGit } from "simple-git"
import * as path from "path"
import * as fs from "fs"
import * as csv from "fast-csv"
import { Writable } from "stream"

colors.enable()

export async function getGitFileContent(filePath: string, ref: string) {
    const reference = `${ref}:${filePath}`
    try {
        const git = simpleGit()
        return await git.show([reference])
    } catch (error) {
        // console.log(`Failed to fetch file content for: [${reference}], anything in origin will found as difference`.magenta)
        return ""
    }
}

// Function to check if a file is modified or staged
export async function isFileModifiedOrStaged(filePath: string): Promise<boolean> {
    const normalizeFilePath = (filePath: string): string => {
        return path.normalize(filePath).replace(/^\.\/|^\.\.\/|\\/g, "")
    }

    const normalizedFilePath = normalizeFilePath(filePath)

    try {
        const git = simpleGit()
        const status = await git.status()

        // Check if the file is modified
        const isModified = status.modified.includes(normalizedFilePath)

        // Check if the file is staged
        const isStaged = status.staged.includes(normalizedFilePath)

        return isModified || isStaged
    } catch (error) {
        console.error("Failed to check file status:", error)
        return false
    }
}

export interface IFlatEntry {
    key: string
    description: string
    // eslint-disable-next-line @typescript-eslint/member-ordering
    [x: string]: string
}

export type IFlatEntryArray = IFlatEntry[]
export type IFlatEntryChunks = IFlatEntryArray[]

export async function ScanTranslationCSV(content: string): Promise<IFlatEntryArray> {
    return new Promise((resolve, reject) => {
        const rs: IFlatEntryArray = []
        csv.parseString<IFlatEntry, IFlatEntry>(content, { headers: true, delimiter: ";" })
            .on("data", (r: IFlatEntry) => {
                rs.push(r)
            })
            .on("end", () => resolve(rs))
            .on("error", reject)
    })
}

export async function ReadTranslationCSV(filename: string): Promise<IFlatEntryArray> {
    return ScanTranslationCSV(fs.readFileSync(filename).toString())
}

export async function createTranslationCSV(data: IFlatEntryArray): Promise<string> {
    return new Promise((resolve, reject) => {
        let csvString = "\ufeff" // Start with the BOM for UTF-8
        const csvStream = csv.format({ headers: true, delimiter: ";" })

        const writableStream = new Writable({
            write(chunk, encoding, callback) {
                csvString += chunk.toString() // Append the chunk to the CSV string
                callback()
            },
        })

        writableStream.on("finish", () => resolve(csvString))
        writableStream.on("error", reject)

        csvStream.pipe(writableStream)
        data.forEach(row => csvStream.write(row))
        csvStream.end()
    })
}
