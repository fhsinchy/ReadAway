/**
 * DictionaryService
 *
 * Installs and queries ReadAway dictionary packs.
 * Dictionary data is static, user-installed, and fully offline after install.
 */

import { strFromU8, unzipSync } from 'fflate'
import type {
  DictionaryCatalog,
  DictionaryCatalogItem,
  DictionaryDefinitionGroup,
  DictionaryEntryRecord,
  DictionaryFormRecord,
  DictionaryLookupResult,
  DictionaryPackManifest,
  DictionaryRecord,
} from '@/types'
import { db } from '@/db'

const DICTIONARY_CATALOG_URL = '/dictionaries/manifest.json'
const DEFAULT_DICTIONARY_ID = 'en-oewn-2025'
const INSTALL_CHUNK_SIZE = 2000

interface DictionaryPackEntry {
  lemma: string
  entries: DictionaryDefinitionGroup[]
}

export type DictionaryInstallProgress = {
  stage: 'downloading' | 'verifying' | 'installing' | 'complete'
  percent: number
}

// ============================================================
// Catalog / Status
// ============================================================

export async function getDictionaryCatalog(): Promise<DictionaryCatalog> {
  const response = await fetch(DICTIONARY_CATALOG_URL, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error('Dictionary catalog could not be loaded')
  }

  const catalog = (await response.json()) as DictionaryCatalog
  if (catalog.version !== 1 || !Array.isArray(catalog.dictionaries)) {
    throw new Error('Dictionary catalog is invalid')
  }

  return catalog
}

export async function getDefaultDictionaryCatalogItem(): Promise<DictionaryCatalogItem> {
  const catalog = await getDictionaryCatalog()
  const dictionary =
    catalog.dictionaries.find((item) => item.id === DEFAULT_DICTIONARY_ID) ??
    catalog.dictionaries[0]

  if (!dictionary) {
    throw new Error('No dictionary is available')
  }

  return dictionary
}

export async function getInstalledDictionary(): Promise<DictionaryRecord | null> {
  return (await db.dictionaries.get(DEFAULT_DICTIONARY_ID)) ?? null
}

// ============================================================
// Install / Remove
// ============================================================

export async function installDefaultDictionary(
  onProgress?: (progress: DictionaryInstallProgress) => void,
): Promise<DictionaryRecord> {
  const catalogItem = await getDefaultDictionaryCatalogItem()

  onProgress?.({ stage: 'downloading', percent: 0 })
  const packBytes = await downloadDictionaryPack(catalogItem, (percent) => {
    onProgress?.({ stage: 'downloading', percent })
  })

  onProgress?.({ stage: 'verifying', percent: 100 })
  const actualSha256 = await sha256Hex(packBytes)
  if (actualSha256 !== catalogItem.sha256) {
    throw new Error('Dictionary checksum did not match')
  }

  const pack = parseDictionaryPack(packBytes)
  if (pack.manifest.dictionaryId !== catalogItem.id) {
    throw new Error('Dictionary pack does not match catalog')
  }

  const contentSha256 = await sha256Hex(
    `${pack.entriesJson}\n${pack.formsJson}`,
  )
  if (contentSha256 !== pack.manifest.contentSha256) {
    throw new Error('Dictionary content checksum did not match')
  }

  onProgress?.({ stage: 'installing', percent: 0 })
  const record = await installPack(catalogItem, pack, (percent) => {
    onProgress?.({ stage: 'installing', percent })
  })
  onProgress?.({ stage: 'complete', percent: 100 })

  return record
}

export async function removeDictionary(dictionaryId = DEFAULT_DICTIONARY_ID): Promise<void> {
  await db.transaction(
    'rw',
    db.dictionaries,
    db.dictionaryEntries,
    db.dictionaryForms,
    async () => {
      await Promise.all([
        db.dictionaryEntries.where('dictionaryId').equals(dictionaryId).delete(),
        db.dictionaryForms.where('dictionaryId').equals(dictionaryId).delete(),
      ])
      await db.dictionaries.delete(dictionaryId)
    },
  )
}

async function downloadDictionaryPack(
  catalogItem: DictionaryCatalogItem,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(catalogItem.url)
  if (!response.ok) {
    throw new Error('Dictionary download failed')
  }

  const total =
    Number(response.headers.get('content-length')) || catalogItem.sizeBytes
  if (!response.body) {
    const buffer = await response.arrayBuffer()
    onProgress?.(100)
    return new Uint8Array(buffer)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    received += value.byteLength
    if (total > 0) {
      onProgress?.(Math.min(99, Math.round((received / total) * 100)))
    }
  }

  onProgress?.(100)
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

function parseDictionaryPack(packBytes: Uint8Array): {
  manifest: DictionaryPackManifest
  entries: DictionaryPackEntry[]
  forms: Record<string, string[]>
  entriesJson: string
  formsJson: string
} {
  const unzipped = unzipSync(packBytes)
  const manifestBytes = unzipped['manifest.json']
  const entriesBytes = unzipped['entries.json']
  const formsBytes = unzipped['forms.json']
  if (!manifestBytes || !entriesBytes || !formsBytes) {
    throw new Error('Dictionary pack is missing required files')
  }

  const manifest = JSON.parse(strFromU8(manifestBytes)) as DictionaryPackManifest
  const entriesJson = strFromU8(entriesBytes)
  const formsJson = strFromU8(formsBytes)
  const entries = JSON.parse(entriesJson) as DictionaryPackEntry[]
  const forms = JSON.parse(formsJson) as Record<string, string[]>

  if (
    manifest.formatVersion !== 1 ||
    !Array.isArray(entries) ||
    typeof forms !== 'object' ||
    forms === null
  ) {
    throw new Error('Dictionary pack is invalid')
  }

  return { manifest, entries, forms, entriesJson, formsJson }
}

async function installPack(
  catalogItem: DictionaryCatalogItem,
  pack: {
    manifest: DictionaryPackManifest
    entries: DictionaryPackEntry[]
    forms: Record<string, string[]>
  },
  onProgress?: (percent: number) => void,
): Promise<DictionaryRecord> {
  const dictionaryId = pack.manifest.dictionaryId
  const formEntries = Object.entries(pack.forms)
  const totalRecords = pack.entries.length + formEntries.length
  let writtenRecords = 0

  const record: DictionaryRecord = {
    id: dictionaryId,
    language: pack.manifest.language,
    title: pack.manifest.title,
    sourceName: pack.manifest.sourceName,
    sourceVersion: pack.manifest.sourceVersion,
    license: pack.manifest.license,
    attribution: pack.manifest.attribution,
    entryCount: pack.entries.length,
    formCount: formEntries.length,
    installedAt: Date.now(),
    sizeBytes: catalogItem.sizeBytes,
  }

  await db.transaction(
    'rw',
    db.dictionaries,
    db.dictionaryEntries,
    db.dictionaryForms,
    async () => {
      await Promise.all([
        db.dictionaryEntries.where('dictionaryId').equals(dictionaryId).delete(),
        db.dictionaryForms.where('dictionaryId').equals(dictionaryId).delete(),
      ])

      for (let i = 0; i < pack.entries.length; i += INSTALL_CHUNK_SIZE) {
        const chunk = pack.entries
          .slice(i, i + INSTALL_CHUNK_SIZE)
          .map((entry): DictionaryEntryRecord => {
            const normalizedLemma = normalizeLookupWord(entry.lemma)
            return {
              key: dictionaryKey(dictionaryId, normalizedLemma),
              dictionaryId,
              lemma: entry.lemma,
              normalizedLemma,
              entriesJson: JSON.stringify(entry.entries),
            }
          })
          .filter((entry) => entry.normalizedLemma)

        await db.dictionaryEntries.bulkPut(chunk)
        writtenRecords += chunk.length
        onProgress?.(progressPercent(writtenRecords, totalRecords))
      }

      for (let i = 0; i < formEntries.length; i += INSTALL_CHUNK_SIZE) {
        const chunk = formEntries
          .slice(i, i + INSTALL_CHUNK_SIZE)
          .map(([form, lemmas]): DictionaryFormRecord => {
            const normalizedForm = normalizeLookupWord(form)
            return {
              key: dictionaryKey(dictionaryId, normalizedForm),
              dictionaryId,
              normalizedForm,
              lemmasJson: JSON.stringify(lemmas),
            }
          })
          .filter((entry) => entry.normalizedForm)

        await db.dictionaryForms.bulkPut(chunk)
        writtenRecords += chunk.length
        onProgress?.(progressPercent(writtenRecords, totalRecords))
      }

      await db.dictionaries.put(record)
    },
  )

  return record
}

// ============================================================
// Lookup
// ============================================================

export async function lookupWord(text: string): Promise<DictionaryLookupResult> {
  const query = extractLookupWord(text)
  const normalizedQuery = normalizeLookupWord(query)
  const installed = await getInstalledDictionary()

  if (!installed) {
    return { status: 'not_installed', query, normalizedQuery }
  }

  if (!normalizedQuery) {
    return { status: 'not_found', query, normalizedQuery }
  }

  const exact = await lookupEntry(installed.id, normalizedQuery)
  if (exact) {
    return {
      status: 'found',
      query,
      normalizedQuery,
      lemma: exact.lemma,
      entries: exact.entries,
    }
  }

  for (const lemma of await getLookupCandidates(installed.id, normalizedQuery)) {
    const entry = await lookupEntry(installed.id, lemma)
    if (entry) {
      return {
        status: 'found',
        query,
        normalizedQuery,
        lemma: entry.lemma,
        entries: entry.entries,
      }
    }
  }

  return { status: 'not_found', query, normalizedQuery }
}

async function lookupEntry(
  dictionaryId: string,
  normalizedLemma: string,
): Promise<{ lemma: string; entries: DictionaryDefinitionGroup[] } | null> {
  const record = await db.dictionaryEntries.get(
    dictionaryKey(dictionaryId, normalizedLemma),
  )
  if (!record) return null

  return {
    lemma: record.lemma,
    entries: JSON.parse(record.entriesJson) as DictionaryDefinitionGroup[],
  }
}

async function getLookupCandidates(
  dictionaryId: string,
  normalizedQuery: string,
): Promise<string[]> {
  const candidates = new Set<string>()

  const formRecord = await db.dictionaryForms.get(
    dictionaryKey(dictionaryId, normalizedQuery),
  )
  if (formRecord) {
    const lemmas = JSON.parse(formRecord.lemmasJson) as string[]
    for (const lemma of lemmas) {
      candidates.add(lemma)
    }
  }

  for (const candidate of getRuleBasedCandidates(normalizedQuery)) {
    candidates.add(candidate)
  }

  candidates.delete(normalizedQuery)
  return [...candidates]
}

export function extractLookupWord(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const firstWord = normalized.match(/[\p{L}\p{M}'’-]+/u)?.[0] ?? ''
  return firstWord
}

export function extractSingleLookupWord(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  const words = normalized.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu)
  if (!words || words.length !== 1) return null

  const strippedSelection = normalized.replace(
    /^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu,
    '',
  )
  if (strippedSelection !== words[0]) return null

  return words[0]
}

export function normalizeLookupWord(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}']+$/gu, '')
    .replace(/'s$/, '')
    .replace(/s'$/, 's')
}

function getRuleBasedCandidates(word: string): string[] {
  const candidates = new Set<string>()

  if (word.endsWith('ies') && word.length > 4) {
    candidates.add(`${word.slice(0, -3)}y`)
  }
  if (word.endsWith('ied') && word.length > 4) {
    candidates.add(`${word.slice(0, -3)}y`)
  }
  if (word.endsWith('ing') && word.length > 5) {
    const base = word.slice(0, -3)
    candidates.add(base)
    candidates.add(`${base}e`)
  }
  if (word.endsWith('ed') && word.length > 4) {
    const base = word.slice(0, -2)
    candidates.add(base)
    candidates.add(`${base}e`)
  }
  if (word.endsWith('es') && word.length > 4) {
    candidates.add(word.slice(0, -2))
  }
  if (word.endsWith('s') && word.length > 3) {
    candidates.add(word.slice(0, -1))
  }
  if (word.endsWith('ier') && word.length > 4) {
    candidates.add(`${word.slice(0, -3)}y`)
  }
  if (word.endsWith('iest') && word.length > 5) {
    candidates.add(`${word.slice(0, -4)}y`)
  }
  if (word.endsWith('er') && word.length > 4) {
    candidates.add(word.slice(0, -2))
  }
  if (word.endsWith('est') && word.length > 5) {
    candidates.add(word.slice(0, -3))
  }

  return [...candidates].filter(Boolean)
}

function dictionaryKey(dictionaryId: string, normalizedWord: string): string {
  return `${dictionaryId}:${normalizedWord}`
}

function progressPercent(done: number, total: number): number {
  if (total <= 0) return 100
  return Math.min(99, Math.round((done / total) * 100))
}

async function sha256Hex(value: Uint8Array | string): Promise<string> {
  const data = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digestInput = new Uint8Array(data.byteLength)
  digestInput.set(data)
  const digest = await crypto.subtle.digest('SHA-256', digestInput.buffer)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
