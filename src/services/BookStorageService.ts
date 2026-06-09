/**
 * BookStorageService
 *
 * Stores and retrieves EPUB files using OPFS (Origin Private File System)
 * when available, falling back to IndexedDB.
 *
 * The original imported file is never used after import.
 */

const STORAGE_DIR = 'epubs'

let opfsRoot: FileSystemDirectoryHandle | null = null

async function getOPFSRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (opfsRoot) return opfsRoot
  try {
    const root = await navigator.storage.getDirectory()
    opfsRoot = root
    return root
  } catch {
    return null
  }
}

async function hasOPFS(): Promise<boolean> {
  return (await getOPFSRoot()) !== null
}

/**
 * Store EPUB blob bytes in browser-managed storage.
 * Returns a storage key that can be used to retrieve the file.
 */
export async function storeEpub(
  storageKey: string,
  epubBytes: ArrayBuffer,
): Promise<void> {
  if (await hasOPFS()) {
    await storeInOPFS(storageKey, epubBytes)
  } else {
    await storeInIndexedDB(storageKey, epubBytes)
  }
}

/**
 * Retrieve EPUB bytes from storage.
 */
export async function getEpub(storageKey: string): Promise<ArrayBuffer | null> {
  if (await hasOPFS()) {
    return getFromOPFS(storageKey)
  }
  return getFromIndexedDB(storageKey)
}

/**
 * Delete an EPUB from storage.
 */
export async function deleteEpub(storageKey: string): Promise<void> {
  if (await hasOPFS()) {
    await deleteFromOPFS(storageKey)
  } else {
    await deleteFromIndexedDB(storageKey)
  }
}

// ============================================================
// OPFS implementation
// ============================================================

async function storeInOPFS(
  key: string,
  bytes: ArrayBuffer,
): Promise<void> {
  const root = await getOPFSRoot()
  if (!root) throw new Error('OPFS not available')

  // Ensure the epubs directory exists
  let dir: FileSystemDirectoryHandle
  try {
    dir = await root.getDirectoryHandle(STORAGE_DIR, { create: true })
  } catch {
    dir = await root.getDirectoryHandle(STORAGE_DIR, { create: true })
  }

  const fileHandle = await dir.getFileHandle(key, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(bytes)
  await writable.close()
}

async function getFromOPFS(key: string): Promise<ArrayBuffer | null> {
  const root = await getOPFSRoot()
  if (!root) return null

  try {
    const dir = await root.getDirectoryHandle(STORAGE_DIR)
    const fileHandle = await dir.getFileHandle(key)
    const file = await fileHandle.getFile()
    return file.arrayBuffer()
  } catch {
    return null
  }
}

async function deleteFromOPFS(key: string): Promise<void> {
  const root = await getOPFSRoot()
  if (!root) return

  try {
    const dir = await root.getDirectoryHandle(STORAGE_DIR)
    await dir.removeEntry(key)
  } catch {
    // File may not exist — that's ok
  }
}

// ============================================================
// IndexedDB fallback
// ============================================================

function idbEpubStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ReadAwayEpubStorage', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('epubs')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeInIndexedDB(
  key: string,
  bytes: ArrayBuffer,
): Promise<void> {
  const db = await idbEpubStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('epubs', 'readwrite')
    tx.objectStore('epubs').put(bytes, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getFromIndexedDB(key: string): Promise<ArrayBuffer | null> {
  const db = await idbEpubStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('epubs', 'readonly')
    const request = tx.objectStore('epubs').get(key)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function deleteFromIndexedDB(key: string): Promise<void> {
  const db = await idbEpubStore()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('epubs', 'readwrite')
    tx.objectStore('epubs').delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
