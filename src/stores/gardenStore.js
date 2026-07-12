import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { OBJECT_TYPES } from '@/constants/objectTypes'

const AUTOSAVE_KEY = 'dave-garden-planner-v1'
const MAX_HISTORY = 50

export const useGardenStore = defineStore('garden', () => {
  const plot = ref({ name: 'Moje zahrada', width: 20, height: 15 })
  const objects = ref([])

  // Undo/redo history
  const history = ref([])
  const historyIdx = ref(-1)

  const canUndo = computed(() => historyIdx.value > 0)
  const canRedo = computed(() => historyIdx.value < history.value.length - 1)

  function _snapshot() {
    const state = {
      plot: JSON.parse(JSON.stringify(plot.value)),
      objects: JSON.parse(JSON.stringify(objects.value))
    }
    // Truncate redo history
    history.value = history.value.slice(0, historyIdx.value + 1)
    history.value.push(state)
    if (history.value.length > MAX_HISTORY) history.value.shift()
    historyIdx.value = history.value.length - 1
    autoSave()
  }

  function _applyState(state) {
    plot.value = JSON.parse(JSON.stringify(state.plot))
    objects.value = JSON.parse(JSON.stringify(state.objects))
    autoSave()
  }

  function undo() {
    if (!canUndo.value) return
    historyIdx.value--
    _applyState(history.value[historyIdx.value])
  }

  function redo() {
    if (!canRedo.value) return
    historyIdx.value++
    _applyState(history.value[historyIdx.value])
  }

  // --- Plot ---
  function updatePlot(changes) {
    Object.assign(plot.value, changes)
    _snapshot()
  }

  // --- Objects ---
  function addObject(typeId, options = {}) {
    const typeDef = OBJECT_TYPES[typeId]
    if (!typeDef) return
    const obj = {
      id: uuidv4(),
      type: typeId,
      x: options.x ?? Math.max(0, (plot.value.width - typeDef.defaultW) / 2),
      y: options.y ?? Math.max(0, (plot.value.height - typeDef.defaultH) / 2),
      width: typeDef.defaultW,
      height: typeDef.defaultH,
      rotation: 0,
      label: typeDef.label,
      color: typeDef.color,
      notes: ''
    }
    objects.value.push(obj)
    _snapshot()
    return obj.id
  }

  function updateObject(changes) {
    const idx = objects.value.findIndex(o => o.id === changes.id)
    if (idx === -1) return
    Object.assign(objects.value[idx], changes)
    _snapshot()
  }

  function removeObject(id) {
    objects.value = objects.value.filter(o => o.id !== id)
    _snapshot()
  }

  function getObject(id) {
    return objects.value.find(o => o.id === id)
  }

  // --- Persistence ---
  function toData() {
    return {
      version: __APP_VERSION__,
      savedAt: new Date().toISOString(),
      plot: JSON.parse(JSON.stringify(plot.value)),
      objects: JSON.parse(JSON.stringify(objects.value))
    }
  }

  function loadFromData(data) {
    if (data.plot) plot.value = { name: 'Moje zahrada', width: 20, height: 15, ...data.plot }
    if (data.objects) objects.value = data.objects
    _snapshot()
  }

  function autoSave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(toData()))
    } catch { /* storage full */ }
  }

  function loadAutoSave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (!raw) return false
      loadFromData(JSON.parse(raw))
      return true
    } catch {
      return false
    }
  }

  // Init: seed first history snapshot on load
  function init() {
    const restored = loadAutoSave()
    if (!restored) _snapshot()
    else {
      // History starts from loaded state
      history.value = [{ plot: JSON.parse(JSON.stringify(plot.value)), objects: JSON.parse(JSON.stringify(objects.value)) }]
      historyIdx.value = 0
    }
  }

  return {
    plot, objects,
    canUndo, canRedo,
    undo, redo,
    updatePlot,
    addObject, updateObject, removeObject, getObject,
    toData, loadFromData, autoSave, loadAutoSave, init
  }
})
