import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { strToU8, unzipSync, zipSync } from 'fflate'

const ROOT = process.cwd()
const DEFAULT_SOURCE_URL =
  'https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip'
const CACHE_DIR = path.join(ROOT, '.cache', 'dictionary')
const OUTPUT_DIR = path.join(ROOT, 'public', 'dictionaries')
const PACK_ID = 'en-oewn-2025'
const PACK_FILENAME = `${PACK_ID}.rawaydict`
const CATALOG_FILENAME = 'manifest.json'
const SOURCE_VERSION = '2025'
const FORMAT_VERSION = 1

const IRREGULAR_FORMS = new Map([
  ['children', 'child'],
  ['men', 'man'],
  ['women', 'woman'],
  ['gentlemen', 'gentleman'],
  ['was', 'be'],
  ['were', 'be'],
  ['been', 'be'],
  ['being', 'be'],
  ['went', 'go'],
  ['gone', 'go'],
  ['did', 'do'],
  ['done', 'do'],
  ['had', 'have'],
  ['made', 'make'],
  ['took', 'take'],
  ['taken', 'take'],
  ['gave', 'give'],
  ['given', 'give'],
  ['saw', 'see'],
  ['seen', 'see'],
  ['came', 'come'],
  ['became', 'become'],
  ['thought', 'think'],
  ['brought', 'bring'],
  ['found', 'find'],
  ['left', 'leave'],
  ['felt', 'feel'],
  ['kept', 'keep'],
  ['knew', 'know'],
  ['known', 'know'],
  ['better', 'good'],
  ['best', 'good'],
  ['worse', 'bad'],
  ['worst', 'bad'],
])

const POS_LABELS = {
  a: 'adj',
  n: 'noun',
  r: 'adv',
  s: 'adj',
  v: 'verb',
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE_URL
  const zipBytes = await readSourceZip(source)
  const sourceSha256 = sha256Hex(zipBytes)
  const files = unzipSync(zipBytes)

  const synsets = readSynsets(files)
  const entryMap = readEntries(files, synsets)
  const forms = buildForms(entryMap)

  const entries = [...entryMap.values()].sort((a, b) =>
    a.lemma.localeCompare(b.lemma),
  )
  const entriesJson = JSON.stringify(entries)
  const formsJson = JSON.stringify(Object.fromEntries([...forms].sort()))
  const contentSha256 = sha256Hex(`${entriesJson}\n${formsJson}`)

  const packManifest = {
    formatVersion: FORMAT_VERSION,
    dictionaryId: PACK_ID,
    language: 'en',
    title: 'English Dictionary',
    sourceName: 'Open English WordNet',
    sourceVersion: SOURCE_VERSION,
    license: 'CC-BY 4.0',
    attribution: 'Open English WordNet contributors',
    generatedAt: Date.now(),
    entryCount: entries.length,
    formCount: forms.size,
    contentSha256,
    sourceSha256,
  }

  const packBytes = zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(packManifest, null, 2)),
      'entries.json': strToU8(entriesJson),
      'forms.json': strToU8(formsJson),
    },
    { level: 9 },
  )
  const packSha256 = sha256Hex(packBytes)

  const catalog = {
    version: 1,
    generatedAt: Date.now(),
    dictionaries: [
      {
        id: PACK_ID,
        language: 'en',
        title: 'English Dictionary',
        sourceName: 'Open English WordNet',
        sourceVersion: SOURCE_VERSION,
        license: 'CC-BY 4.0',
        attribution: 'Open English WordNet contributors',
        url: `/dictionaries/${PACK_FILENAME}`,
        sha256: packSha256,
        sizeBytes: packBytes.byteLength,
        entryCount: entries.length,
        formCount: forms.size,
      },
    ],
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(path.join(OUTPUT_DIR, PACK_FILENAME), packBytes)
  writeFileSync(
    path.join(OUTPUT_DIR, CATALOG_FILENAME),
    `${JSON.stringify(catalog, null, 2)}\n`,
  )

  console.log(`Dictionary pack: ${path.join('public', 'dictionaries', PACK_FILENAME)}`)
  console.log(`Catalog: ${path.join('public', 'dictionaries', CATALOG_FILENAME)}`)
  console.log(`Source: ${source}`)
  console.log(`Entries: ${entries.length}`)
  console.log(`Forms: ${forms.size}`)
  console.log(`Pack size: ${formatBytes(packBytes.byteLength)}`)
  console.log(`Pack sha256: ${packSha256}`)
}

async function readSourceZip(source) {
  if (isUrl(source)) {
    return downloadSourceZip(source)
  }

  return new Uint8Array(readFileSync(path.resolve(source)))
}

async function downloadSourceZip(url) {
  const cachePath = getSourceCachePath(url)

  if (existsSync(cachePath)) {
    console.log(`Using cached source: ${path.relative(ROOT, cachePath)}`)
    return new Uint8Array(readFileSync(cachePath))
  }

  console.log(`Downloading source: ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download source zip: ${response.status}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cachePath, bytes)
  return bytes
}

function getSourceCachePath(url) {
  const { pathname } = new URL(url)
  const filename = path.basename(pathname) || 'source.zip'
  return path.join(CACHE_DIR, filename)
}

function isUrl(value) {
  return /^https?:\/\//i.test(value)
}

function readSynsets(files) {
  const synsets = new Map()

  for (const [filename, bytes] of Object.entries(files)) {
    if (
      !filename.endsWith('.json') ||
      filename.startsWith('entries-') ||
      filename === 'frames.json'
    ) {
      continue
    }

    const data = JSON.parse(Buffer.from(bytes).toString('utf8'))
    for (const [id, synset] of Object.entries(data)) {
      synsets.set(id, {
        id,
        pos: POS_LABELS[synset.partOfSpeech] ?? synset.partOfSpeech,
        definitions: cleanStringArray(synset.definition),
        examples: cleanStringArray(synset.example),
        members: cleanStringArray(synset.members).map(displayLemma),
      })
    }
  }

  return synsets
}

function readEntries(files, synsets) {
  const entryMap = new Map()

  for (const [filename, bytes] of Object.entries(files)) {
    if (!filename.startsWith('entries-') || !filename.endsWith('.json')) {
      continue
    }

    const data = JSON.parse(Buffer.from(bytes).toString('utf8'))
    for (const [lemma, byPos] of Object.entries(data)) {
      const normalizedLemma = normalizeWord(lemma)
      if (!normalizedLemma) continue

      const record =
        entryMap.get(normalizedLemma) ?? {
          lemma: displayLemma(lemma),
          entries: [],
        }
      const seenDefinitions = new Set(
        record.entries.flatMap((entry) =>
          entry.definitions.map((definition) => `${entry.pos}:${definition}`),
        ),
      )

      for (const posData of Object.values(byPos)) {
        const senses = Array.isArray(posData?.sense) ? posData.sense : []
        for (const sense of senses) {
          const synset = synsets.get(sense.synset)
          if (!synset || synset.definitions.length === 0) continue

          const definitions = synset.definitions.filter((definition) => {
            const key = `${synset.pos}:${definition}`
            if (seenDefinitions.has(key)) return false
            seenDefinitions.add(key)
            return true
          })
          if (definitions.length === 0) continue

          record.entries.push({
            pos: synset.pos,
            definitions,
            examples: synset.examples,
            synonyms: synset.members
              .filter((member) => normalizeWord(member) !== normalizedLemma)
              .slice(0, 8),
          })
        }
      }

      if (record.entries.length > 0) {
        entryMap.set(normalizedLemma, record)
      }
    }
  }

  return entryMap
}

function buildForms(entryMap) {
  const forms = new Map()
  const lemmas = new Set(entryMap.keys())

  for (const [form, lemma] of IRREGULAR_FORMS) {
    addForm(forms, lemmas, form, lemma, true)
  }

  for (const lemma of lemmas) {
    if (!/^[a-z][a-z'-]*$/.test(lemma) || lemma.includes("'")) continue

    for (const form of getGeneratedForms(lemma)) {
      addForm(forms, lemmas, form, lemma, false)
    }
  }

  return forms
}

function addForm(forms, lemmas, form, lemma, allowExistingForm) {
  const normalizedForm = normalizeWord(form)
  const normalizedLemma = normalizeWord(lemma)
  if (!normalizedForm || !normalizedLemma) return
  if (!lemmas.has(normalizedLemma)) return
  if (!allowExistingForm && lemmas.has(normalizedForm)) return
  if (normalizedForm === normalizedLemma) return

  const current = forms.get(normalizedForm) ?? []
  if (!current.includes(normalizedLemma)) {
    current.push(normalizedLemma)
    forms.set(normalizedForm, current)
  }
}

function getGeneratedForms(lemma) {
  const forms = new Set()

  if (lemma.endsWith('y') && !/[aeiou]y$/.test(lemma)) {
    forms.add(`${lemma.slice(0, -1)}ies`)
    forms.add(`${lemma.slice(0, -1)}ied`)
    forms.add(`${lemma.slice(0, -1)}ier`)
    forms.add(`${lemma.slice(0, -1)}iest`)
  } else {
    forms.add(`${lemma}s`)
    forms.add(`${lemma}ed`)
    forms.add(`${lemma}er`)
    forms.add(`${lemma}est`)
  }

  if (/(s|x|z|ch|sh)$/.test(lemma)) {
    forms.add(`${lemma}es`)
  }

  if (lemma.endsWith('e')) {
    forms.add(`${lemma}d`)
    forms.add(`${lemma.slice(0, -1)}ing`)
  } else {
    forms.add(`${lemma}ing`)
  }

  return forms
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => typeof item === 'string'))]
}

function displayLemma(value) {
  return String(value).replaceAll('_', ' ').trim()
}

function normalizeWord(value) {
  return displayLemma(value)
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .trim()
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
