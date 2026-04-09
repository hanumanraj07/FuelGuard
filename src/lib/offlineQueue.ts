type QueuedUpload = {
  id: string
  file: Blob
  fileName: string
  fileType: string
  meta: {
    pumpName: string
    city: string
    licenseNumber: string
    language: string
    lat: string
    lng: string
  }
  createdAt: number
}

const DB_NAME = 'fuelguard'
const STORE_NAME = 'uploadQueue'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `queue_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export async function enqueueUpload(input: Omit<QueuedUpload, 'id' | 'createdAt'>) {
  const db = await openDatabase()
  const payload: QueuedUpload = {
    ...input,
    id: generateId(),
    createdAt: Date.now(),
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(payload)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getQueuedUploads(): Promise<QueuedUpload[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as QueuedUpload[])
    request.onerror = () => reject(request.error)
  })
}

export async function removeQueuedUpload(id: string) {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export type { QueuedUpload }
