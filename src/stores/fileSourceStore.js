import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, shallowRef } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { saveLocalHandle, loadLocalHandle, clearLocalHandle } from '@/utils/idbHandle'
import { pickLocalFile, readFileFromHandle, writeToHandle, verifyPermission, downloadJSON } from '@/utils/localFileAccess'
import * as googleDrive from '@/utils/googleDrive'

// Sjednocené "naposledy otevřený soubor" napříč lokálním diskem i Google
// Diskem — díky tomu se uživatel po návratu na stránku nemusí (pokud to
// prohlížeč/oprávnění dovolí) znovu prokliknout k výběru souboru.
const META_KEY = 'dave-garden-planner-last-source-v1'

export const useFileSourceStore = defineStore('fileSource', () => {
  const gardenStore = useGardenStore()

  const sourceType   = ref(null)       // null | 'local' | 'drive'
  const fileName     = ref('')
  const driveFileId  = ref(null)
  const localHandle  = shallowRef(null) // FileSystemFileHandle — nikdy nedávat do hluboce reaktivního refu (rozbilo by to jeho metody)
  const lastSavedToSourceAt = ref(null)
  const fileError    = ref('')
  const busy         = ref(false)      // probíhá otevírání/ukládání (OAuth popup, čtení souboru...)

  // Když si appka pamatuje soubor, ale k jeho tichému znovuotevření chybí
  // oprávnění (vyžaduje gesto uživatele) — banner v UI nabídne "Pokračovat".
  const pendingResume = shallowRef(null) // { type, name, fileId? , handle? }

  function _saveMeta() {
    if (sourceType.value === 'local') {
      localStorage.setItem(META_KEY, JSON.stringify({ type: 'local', name: fileName.value }))
    } else if (sourceType.value === 'drive') {
      localStorage.setItem(META_KEY, JSON.stringify({ type: 'drive', name: fileName.value, fileId: driveFileId.value }))
    } else {
      localStorage.removeItem(META_KEY)
    }
  }

  function _setSource(type, name, extra = {}) {
    sourceType.value  = type
    fileName.value    = name
    driveFileId.value = extra.fileId ?? null
    localHandle.value = extra.handle ?? null
    pendingResume.value = null
    fileError.value = ''
    _saveMeta()
  }

  function forgetSource() {
    sourceType.value  = null
    fileName.value    = ''
    driveFileId.value = null
    localHandle.value = null
    pendingResume.value = null
    localStorage.removeItem(META_KEY)
    clearLocalHandle().catch(() => {})
  }

  // Volat jednou při startu appky. Lokální soubor s uděleným oprávněním se
  // načte úplně potichu (queryPermission nevyžaduje gesto uživatele); Disk
  // vždy vyžaduje klik kvůli OAuth popupu, proto jen nabídneme banner.
  async function initResume() {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return
    let meta
    try { meta = JSON.parse(raw) } catch { localStorage.removeItem(META_KEY); return }

    if (meta.type === 'local') {
      const handle = await loadLocalHandle().catch(() => null)
      if (!handle) { forgetSource(); return }
      const granted = await handle.queryPermission({ mode: 'read' }).catch(() => 'denied')
      if (granted === 'granted') {
        try {
          const text = await readFileFromHandle(handle)
          gardenStore.loadFromData(JSON.parse(text))
          _setSource('local', meta.name, { handle })
          return
        } catch { /* soubor zmizel/poškozen — necháme uživatele u autosave a nabídneme ruční pokus */ }
      }
      pendingResume.value = { type: 'local', name: meta.name, handle }
    } else if (meta.type === 'drive') {
      pendingResume.value = { type: 'drive', name: meta.name, fileId: meta.fileId }
    }
  }

  async function resume() {
    const p = pendingResume.value
    if (!p) return
    busy.value = true
    fileError.value = ''
    try {
      if (p.type === 'local') {
        const ok = await verifyPermission(p.handle, 'read')
        if (!ok) throw new Error('Přístup k souboru nebyl povolen.')
        const text = await readFileFromHandle(p.handle)
        gardenStore.loadFromData(JSON.parse(text))
        _setSource('local', p.name, { handle: p.handle })
      } else {
        const text = await googleDrive.downloadFile(p.fileId)
        gardenStore.loadFromData(JSON.parse(text))
        _setSource('drive', p.name, { fileId: p.fileId })
      }
    } catch (e) {
      fileError.value = e.message
    } finally {
      busy.value = false
    }
  }

  function dismissResume() {
    forgetSource()
  }

  async function openLocal() {
    busy.value = true
    fileError.value = ''
    try {
      const { handle, name, text } = await pickLocalFile()
      gardenStore.loadFromData(JSON.parse(text))
      _setSource('local', name, { handle })
      if (handle) await saveLocalHandle(handle)
      else localStorage.removeItem(META_KEY) // fallback input[type=file] nemá handle — nelze si "pamatovat"
    } catch (e) {
      if (e?.name !== 'AbortError') fileError.value = e.message || 'Otevření souboru selhalo.'
    } finally {
      busy.value = false
    }
  }

  async function openDrivePicker() {
    busy.value = true
    fileError.value = ''
    try {
      const picked = await googleDrive.pickFile()
      if (!picked) return // uživatel zrušil výběr
      const text = await googleDrive.downloadFile(picked.fileId)
      gardenStore.loadFromData(JSON.parse(text))
      _setSource('drive', picked.name, { fileId: picked.fileId })
      await clearLocalHandle().catch(() => {})
    } catch (e) {
      fileError.value = e.message || 'Otevření z Google Disku selhalo.'
    } finally {
      busy.value = false
    }
  }

  // "Chytré" uložení — zapíše zpět do naposledy otevřeného zdroje, pokud
  // existuje a máme/získáme oprávnění; jinak spadne na stažení nové kopie.
  async function save() {
    const text = JSON.stringify(gardenStore.toData(), null, 2)
    busy.value = true
    fileError.value = ''
    try {
      if (sourceType.value === 'local' && localHandle.value) {
        const ok = await verifyPermission(localHandle.value, 'readwrite')
        if (!ok) throw new Error('Chybí oprávnění k zápisu do souboru.')
        await writeToHandle(localHandle.value, text)
        lastSavedToSourceAt.value = new Date()
        return { target: 'local', name: fileName.value }
      }
      if (sourceType.value === 'drive' && driveFileId.value) {
        await googleDrive.updateFile(driveFileId.value, text)
        lastSavedToSourceAt.value = new Date()
        return { target: 'drive', name: fileName.value }
      }
      downloadCopy()
      return { target: 'download' }
    } catch (e) {
      fileError.value = e.message || 'Uložení selhalo.'
      return { target: 'error' }
    } finally {
      busy.value = false
    }
  }

  function downloadCopy() {
    const text = JSON.stringify(gardenStore.toData(), null, 2)
    const name = fileName.value ? fileName.value.replace(/\.json$/i, '') + '.json' : `zahrada-${new Date().toISOString().slice(0, 10)}.json`
    downloadJSON(text, name)
  }

  async function saveAsNewDriveFile() {
    busy.value = true
    fileError.value = ''
    try {
      const text = JSON.stringify(gardenStore.toData(), null, 2)
      const name = fileName.value || `zahrada-${new Date().toISOString().slice(0, 10)}.json`
      const created = await googleDrive.createFile(name, text)
      _setSource('drive', created.name, { fileId: created.id })
      await clearLocalHandle().catch(() => {})
      lastSavedToSourceAt.value = new Date()
    } catch (e) {
      fileError.value = e.message || 'Uložení na Google Disk selhalo.'
    } finally {
      busy.value = false
    }
  }

  return {
    sourceType, fileName, driveFileId, lastSavedToSourceAt, fileError, busy, pendingResume,
    initResume, resume, dismissResume,
    openLocal, openDrivePicker, save, downloadCopy, saveAsNewDriveFile, forgetSource,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFileSourceStore, import.meta.hot))
}
