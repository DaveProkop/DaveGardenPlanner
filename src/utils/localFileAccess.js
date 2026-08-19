// Otevírání/ukládání souborů z lokálního disku. Preferuje File System Access
// API (Chrome/Edge) — vrací FileSystemFileHandle, díky kterému lze soubor
// později (i po reloadu stránky, viz utils/idbHandle.js) znovu přečíst nebo do
// něj rovnou zapsat, bez nutnosti stahovat novou kopii do složky Stažené
// soubory. V prohlížečích bez podpory (Firefox, Safari) spadne zpět na
// klasický <input type="file"> — tam handle nejde získat, takže "pamatování"
// posledního souboru tam není možné.
export const supportsFileSystemAccess =
  typeof window !== 'undefined' && 'showOpenFilePicker' in window

const PICKER_TYPES = [
  { description: 'JSON plán zahrady', accept: { 'application/json': ['.json'] } },
]

// { handle, name, text } — handle je null ve fallback větvi
export async function pickLocalFile() {
  if (supportsFileSystemAccess) {
    const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES })
    const text = await readFileFromHandle(handle)
    return { handle, name: handle.name, text }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return reject(new Error('Žádný soubor'))
      const reader = new FileReader()
      reader.onload  = (ev) => resolve({ handle: null, name: file.name, text: ev.target.result })
      reader.onerror = () => reject(new Error('Chyba čtení souboru'))
      reader.readAsText(file)
    }
    input.click()
  })
}

export async function readFileFromHandle(handle) {
  const file = await handle.getFile()
  return file.text()
}

export async function writeToHandle(handle, text) {
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

// mode: 'read' | 'readwrite'. queryPermission nikdy nevyžaduje gesto uživatele
// (bezpečné volat i při startu appky); requestPermission ho vyžaduje — smí se
// volat jen jako reakce na klik.
export async function verifyPermission(handle, mode = 'read') {
  const opts = { mode }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  if ((await handle.requestPermission(opts)) === 'granted') return true
  return false
}

export function downloadJSON(text, filename) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = filename
  a.href = url
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
