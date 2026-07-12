import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'

const AUTOSAVE_KEY = 'dave-garden-planner-v2'
const MAX_HISTORY  = 50

export const useGardenStore = defineStore('garden', () => {
  const plot   = ref({ name: 'Moje zahrada', width: 20, height: 15 })
  const shapes = ref([])  // [{ id, name, color, notes, points: [x1,y1,x2,y2,...] }] — metry

  const history    = ref([])
  const historyIdx = ref(-1)

  const canUndo = computed(() => historyIdx.value > 0)
  const canRedo = computed(() => historyIdx.value < history.value.length - 1)

  function _snapshot() {
    const state = {
      plot:   JSON.parse(JSON.stringify(plot.value)),
      shapes: JSON.parse(JSON.stringify(shapes.value)),
    }
    history.value = history.value.slice(0, historyIdx.value + 1)
    history.value.push(state)
    if (history.value.length > MAX_HISTORY) history.value.shift()
    historyIdx.value = history.value.length - 1
    _autoSave()
  }

  function _apply(state) {
    plot.value   = JSON.parse(JSON.stringify(state.plot))
    shapes.value = JSON.parse(JSON.stringify(state.shapes))
    _autoSave()
  }

  function undo() { if (canUndo.value) { historyIdx.value--; _apply(history.value[historyIdx.value]) } }
  function redo() { if (canRedo.value) { historyIdx.value++; _apply(history.value[historyIdx.value]) } }

  // --- Plot ---
  function updatePlot(changes) { Object.assign(plot.value, changes); _snapshot() }

  // --- Shapes ---
  // points = flat array [x1,y1,x2,y2,...] v metrech
  function addShape(points, name, color) {
    const id = uuidv4()
    shapes.value.push({ id, name, color, notes: '' , points: [...points] })
    _snapshot()
    return id
  }

  function updateShape(changes) {
    const s = shapes.value.find(s => s.id === changes.id)
    if (!s) return
    Object.assign(s, changes)
    _snapshot()
  }

  // Posunout celý tvar o (dx, dy) metrů
  function moveShape(id, dx, dy) {
    const s = shapes.value.find(s => s.id === id)
    if (!s) return
    s.points = s.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
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

  function removeShape(id) {
    shapes.value = shapes.value.filter(s => s.id !== id)
    _snapshot()
  }

  function getShape(id) { return shapes.value.find(s => s.id === id) }

  // --- Persistence ---
  function toData() {
    return {
      version:  __APP_VERSION__,
      savedAt:  new Date().toISOString(),
      plot:     JSON.parse(JSON.stringify(plot.value)),
      shapes:   JSON.parse(JSON.stringify(shapes.value)),
    }
  }

  function loadFromData(data) {
    if (data.plot)   plot.value   = { name: 'Moje zahrada', width: 20, height: 15, ...data.plot }
    if (data.shapes) shapes.value = data.shapes
    // Zpětná kompatibilita se starým formátem (v1 měl `objects`)
    else if (data.objects) shapes.value = []
    _snapshot()
  }

  function _autoSave() {
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(toData())) } catch { /* plná storage */ }
  }

  function init() {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (raw) {
      try {
        loadFromData(JSON.parse(raw))
        history.value   = [{ plot: JSON.parse(JSON.stringify(plot.value)), shapes: JSON.parse(JSON.stringify(shapes.value)) }]
        historyIdx.value = 0
        return
      } catch { /* poškozená data, začneme znovu */ }
    }
    _snapshot()
  }

  return {
    plot, shapes,
    canUndo, canRedo, undo, redo,
    updatePlot,
    addShape, updateShape, moveShape, updateVertex, removeShape, getShape,
    toData, loadFromData, init,
  }
})
