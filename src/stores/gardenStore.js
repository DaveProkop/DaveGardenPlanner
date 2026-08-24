import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

const AUTOSAVE_KEY = 'dave-garden-planner-v2'
const MAX_HISTORY  = 50

export const useGardenStore = defineStore('garden', () => {
  const shapes = ref([])  // [{ id, name, color, texture, notes, typeId, age, points: [x1,y1,x2,y2,...] }] — metry
  const plot   = ref(null) // { points: [x1,y1,...] } | null — hranice pozemku, mimo shapes (viz gardenStore.setPlot)

  const history    = ref([])
  const historyIdx = ref(-1)
  const lastSavedAt = ref(null) // Date posledního úspěšného auto-uložení do localStorage

  const canUndo = computed(() => historyIdx.value > 0)
  const canRedo = computed(() => historyIdx.value < history.value.length - 1)

  function _snapshot() {
    const state = {
      shapes: JSON.parse(JSON.stringify(shapes.value)),
      plot:   plot.value ? JSON.parse(JSON.stringify(plot.value)) : null,
    }
    history.value = history.value.slice(0, historyIdx.value + 1)
    history.value.push(state)
    if (history.value.length > MAX_HISTORY) history.value.shift()
    historyIdx.value = history.value.length - 1
    _autoSave()
  }

  function _apply(state) {
    shapes.value = JSON.parse(JSON.stringify(state.shapes))
    plot.value   = state.plot ? JSON.parse(JSON.stringify(state.plot)) : null
    _autoSave()
  }

  function undo() { if (canUndo.value) { historyIdx.value--; _apply(history.value[historyIdx.value]) } }
  function redo() { if (canRedo.value) { historyIdx.value++; _apply(history.value[historyIdx.value]) } }

  // --- Shapes ---
  // points = flat array [x1,y1,x2,y2,...] v metrech
  // kind: null (obecný polygon) | 'ellipse' (nakresleno nástrojem Kruh/Elipsa —
  // nejde do něj přidávat další vrcholy, jen měnit rozměry / posouvat stávající body)
  // typeId = klíč z OBJECT_TYPES, ze kterého byl tvar nakreslen (viz uiStore.activePresetId),
  // nebo null pro volně nakreslený tvar bez zvoleného typu. Určuje např. dostupnost pole
  // Stáří a zobrazení vzdálenosti od hranice pozemku (jen tree/shrub/bed).
  function addShape(points, name, color, texture = null, kind = null, typeId = null) {
    const id = uuidv4()
    shapes.value.push({ id, name, color, texture, kind, typeId, age: null, notes: '', points: [...points] })
    _snapshot()
    return id
  }

  // Volný text na plánu — na rozdíl od ostatních tvarů nemá polygonová data
  // (points = jediný ukotvující bod [x,y]) a místo plochy se zobrazuje jako
  // popisek, jehož velikost určuje fontSize (v metrech).
  function addText(x, y, name, color, fontSize) {
    const id = uuidv4()
    shapes.value.push({ id, name, color, texture: null, kind: 'text', notes: '', fontSize, points: [x, y] })
    _snapshot()
    return id
  }

  // Vloží kopie dříve zkopírovaných tvarů (viz uiStore.copySelection) mírně
  // posunuté stranou, ať nesedí přesně na originálu. Jeden snapshot pro celou
  // dávku, takže vložení víc objektů najednou je jeden krok zpět/vpřed.
  function pasteShapes(dataArray, offset = 0.5) {
    const ids = dataArray.map(data => {
      const id = uuidv4()
      const points = data.points.map(v => v + offset)
      shapes.value.push({ ...JSON.parse(JSON.stringify(data)), id, name: `${data.name} (kopie)`, points })
      return id
    })
    _snapshot()
    return ids
  }

  function updateShape(changes) {
    const s = shapes.value.find(s => s.id === changes.id)
    if (!s) return
    Object.assign(s, changes)
    _snapshot()
  }

  // Hromadná úprava společných polí (barva, název, poznámky, ...) víc tvarů
  // najednou (multi-select bulk edit) — jeden snapshot pro celou dávku.
  function updateShapes(ids, changes) {
    const set = new Set(ids)
    shapes.value.forEach(s => { if (set.has(s.id)) Object.assign(s, changes) })
    _snapshot()
  }

  // Posunout celý tvar o (dx, dy) metrů
  function moveShape(id, dx, dy) {
    const s = shapes.value.find(s => s.id === id)
    if (!s) return
    s.points = s.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
    _snapshot()
  }

  // Posunout víc tvarů zároveň o stejné (dx, dy) metrů (skupinový přesun při
  // tažení/šipkách s aktivním multi-select) — jeden snapshot pro celou dávku.
  function moveShapes(ids, dx, dy) {
    const set = new Set(ids)
    shapes.value.forEach(s => {
      if (!set.has(s.id)) return
      s.points = s.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
    })
    _snapshot()
  }

  // Aktualizovat jeden vrchol (vtxIdx = index vrcholu, ne indexu v poli)
  function updateVertex(id, vtxIdx, x, y) {
    const s = shapes.value.find(s => s.id === id)
    if (!s) return
    const pts = [...s.points]
    pts[vtxIdx * 2]     = x
    pts[vtxIdx * 2 + 1] = y
    s.points = pts
    _snapshot()
  }

  // Vloží nový vrchol hned za vrchol s indexem afterIdx (0-based, wraparound
  // pro uzavírací hranu poslední→první = vloží na konec pole)
  function insertVertex(id, afterIdx, x, y) {
    const s = shapes.value.find(s => s.id === id)
    if (!s) return
    const pts = [...s.points]
    pts.splice((afterIdx + 1) * 2, 0, x, y)
    s.points = pts
    _snapshot()
  }

  // Smaže vrchol s indexem vtxIdx — tvar musí mít po smazání aspoň 3 vrcholy
  function removeVertex(id, vtxIdx) {
    const s = shapes.value.find(s => s.id === id)
    if (!s) return
    if (s.points.length / 2 <= 3) return
    const pts = [...s.points]
    pts.splice(vtxIdx * 2, 2)
    s.points = pts
    _snapshot()
  }

  function removeShape(id) {
    shapes.value = shapes.value.filter(s => s.id !== id)
    _snapshot()
  }

  // Smaže víc tvarů najednou (multi-select) — jeden snapshot pro celou dávku.
  function removeShapes(ids) {
    const set = new Set(ids)
    shapes.value = shapes.value.filter(s => !set.has(s.id))
    _snapshot()
  }

  function getShape(id) { return shapes.value.find(s => s.id === id) }

  // --- Pozemek (hranice) ---
  // Samostatný stav mimo shapes — ať se ho nemůže dotknout Ctrl+C/V ani Delete
  // (obě pracují jen přes uiStore.selectedIds → shapes[]), a ať je počet objektů
  // v gardenStore.shapes.length i nový seznam objektů čistý bez filtrování.
  function setPlot(points) {
    plot.value = { points: [...points] }
    _snapshot()
  }

  function clearPlot() {
    plot.value = null
    _snapshot()
  }

  // --- Persistence ---
  function toData() {
    return {
      version:  __APP_VERSION__,
      savedAt:  new Date().toISOString(),
      shapes:   JSON.parse(JSON.stringify(shapes.value)),
      plot:     plot.value ? JSON.parse(JSON.stringify(plot.value)) : null,
    }
  }

  function loadFromData(data) {
    if (data.shapes) shapes.value = data.shapes
    // Zpětná kompatibilita se starým formátem (v1 měl `objects`)
    else if (data.objects) shapes.value = []
    // Starší uložené plány nemají klíč `plot` vůbec — ?? ho bezpečně převede na null.
    plot.value = data.plot ?? null
    _snapshot()
  }

  function _autoSave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(toData()))
      lastSavedAt.value = new Date()
    } catch { /* plná storage */ }
  }

  function init() {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (raw) {
      try {
        loadFromData(JSON.parse(raw))
        history.value   = [{ shapes: JSON.parse(JSON.stringify(shapes.value)), plot: plot.value ? JSON.parse(JSON.stringify(plot.value)) : null }]
        historyIdx.value = 0
        return
      } catch { /* poškozená data, začneme znovu */ }
    }
    _snapshot()
  }

  return {
    shapes, plot, lastSavedAt,
    canUndo, canRedo, undo, redo,
    addShape, addText, pasteShapes, updateShape, updateShapes, moveShape, moveShapes, updateVertex, insertVertex, removeVertex, removeShape, removeShapes, getShape,
    setPlot, clearPlot,
    toData, loadFromData, init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGardenStore, import.meta.hot))
}
