import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'

const ROOT = process.cwd()
const CATALOG_PATH = path.join(ROOT, 'public', 'dictionaries', 'manifest.json')

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  if (catalog.version !== 1 || !Array.isArray(catalog.dictionaries)) {
    throw new Error('Invalid dictionary catalog')
  }

  for (const dictionary of catalog.dictionaries) {
    verifyDictionary(dictionary)
  }

  console.log(`Verified ${catalog.dictionaries.length} dictionary pack(s).`)
}

function verifyDictionary(dictionary) {
  const packPath = path.join(ROOT, dictionary.url.replace(/^\//, 'public/'))
  const packBytes = new Uint8Array(readFileSync(packPath))
  const packSha256 = sha256Hex(packBytes)
  if (packSha256 !== dictionary.sha256) {
    throw new Error(`Checksum mismatch for ${dictionary.id}`)
  }

  const files = unzipSync(packBytes)
  const manifestBytes = files['manifest.json']
  const entriesBytes = files['entries.json']
  const formsBytes = files['forms.json']
  if (!manifestBytes || !entriesBytes || !formsBytes) {
    throw new Error(`Missing required files in ${dictionary.id}`)
  }

  const manifest = JSON.parse(strFromU8(manifestBytes))
  const entries = JSON.parse(strFromU8(entriesBytes))
  const forms = JSON.parse(strFromU8(formsBytes))
  const contentSha256 = sha256Hex(
    `${strFromU8(entriesBytes)}\n${strFromU8(formsBytes)}`,
  )

  if (manifest.contentSha256 !== contentSha256) {
    throw new Error(`Content checksum mismatch for ${dictionary.id}`)
  }
  if (manifest.dictionaryId !== dictionary.id) {
    throw new Error(`Manifest/catalog ID mismatch for ${dictionary.id}`)
  }
  if (!Array.isArray(entries) || entries.length !== dictionary.entryCount) {
    throw new Error(`Entry count mismatch for ${dictionary.id}`)
  }
  if (
    typeof forms !== 'object' ||
    forms === null ||
    Object.keys(forms).length !== dictionary.formCount
  ) {
    throw new Error(`Form count mismatch for ${dictionary.id}`)
  }

  for (const word of ['genuine', 'child', 'gentleman', 'walk', 'good']) {
    if (!entries.some((entry) => entry.lemma.toLowerCase() === word)) {
      throw new Error(`Expected lemma missing: ${word}`)
    }
  }

  console.log(
    `${dictionary.id}: ${formatBytes(packBytes.byteLength)}, ${entries.length} entries, ${Object.keys(forms).length} forms`,
  )
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

main()
