// Uložení naposledy otevřeného FileSystemFileHandle napříč návštěvami stránky.
// FileSystemFileHandle NELZE uložit do localStorage (není JSON), ale JE
// structured-cloneable, takže funguje jako hodnota v IndexedDB — to je jediný
// způsob, jak si "pamatovat" lokální soubor mezi reloady/zavřením záložky.
const DB_NAME  = 'dave-garden-planner'
const STORE    = 'handles'
const KEY      = 'lastLocalFile'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const result = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror    = () => reject(tx.error)
  })
}

export function saveLocalHandle(handle) {
  return withStore('readwrite', (store) => store.put(handle, KEY))
}

export function loadLocalHandle() {
  return withStore('readonly', (store) => store.get(KEY))
}

export function clearLocalHandle() {
  return withStore('readwrite', (store) => store.delete(KEY))
}
