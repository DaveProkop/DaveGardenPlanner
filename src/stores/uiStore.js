import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_COLOR } from '@/constants/colorPresets'

// Volitelné rozestupy mřížky (v metrech), nabízené v panelu nástrojů.
export const GRID_SIZES = [0.25, 0.5, 1, 2, 5]

export const useUiStore = defineStore('ui', () => {
  const selectedId      = ref(null)
  const activeTool      = ref('select')   // 'select' | 'rect' | 'polygon' | 'circle'
  const activeColor     = ref(DEFAULT_COLOR)
  const activeTexture   = ref(null)       // textureKey pro příští nakreslený tvar, nebo null (plná barva)
  const pendingLabel    = ref('')         // předvyplněný název dalšího tvaru (typ objektu), '' = generický "Objekt N"
  const activePresetId  = ref(null)       // id vybraného typu objektu (pro zvýraznění v panelu)
  const showGrid         = ref(true)
  const snapToGrid        = ref(true)     // přichytávat kreslení/tažení k mřížce
  const gridSize          = ref(1)        // rozestup mřížky v metrech
  const clipboard         = ref(null)     // zkopírovaná data objektu (bez id) pro Ctrl+V, nebo null
  const focusNameTick     = ref(0)        // inkrementuje se jen při výběru NOVĚ vytvořeného objektu —
                                           // PropertyEditor na to zareaguje zaostřením pole Název/Text.
                                           // Obyčejný klik na existující objekt focus nekrade (jinak by
                                           // ukradl focus canvasu a přestaly by fungovat klávesové zkratky).

  function selectObject(id, { focusName = false } = {}) {
    selectedId.value = id
    if (focusName) focusNameTick.value++
  }
  function deselect()       { selectedId.value = null }
  function setTool(tool)    { activeTool.value = tool }
  function setColor(color)  { activeColor.value = color; activePresetId.value = null }
  function toggleGrid()     { showGrid.value = !showGrid.value }
  function toggleSnap()     { snapToGrid.value = !snapToGrid.value }
  function setGridSize(size) { gridSize.value = size }

  // Uloží snímek tvaru do schránky — kopíruje se stav v okamžiku zkopírování,
  // takže vložení funguje i po smazání/úpravě originálu.
  function copyShape(shape) {
    if (!shape) return
    const { id, ...data } = shape
    clipboard.value = JSON.parse(JSON.stringify(data))
  }

  // Vybere přednastavený typ objektu (rostlina, stavba, ...): nastaví barvu,
  // texturu, výchozí název a aktivuje odpovídající kreslicí nástroj.
  function selectObjectType(type) {
    activeColor.value    = type.color
    activeTexture.value  = type.textureKey
    pendingLabel.value   = type.label
    activePresetId.value = type.id
    activeTool.value     = type.shape === 'circle' || type.shape === 'polygon' ? type.shape : 'rect'
  }

  // Zruší vybraný typ objektu — použije se při ručním přepnutí na obecný nástroj.
  function clearPreset() {
    activeTexture.value  = null
    pendingLabel.value   = ''
    activePresetId.value = null
  }

  return {
    selectedId, activeTool, activeColor, activeTexture, pendingLabel, activePresetId,
    showGrid, snapToGrid, gridSize, clipboard, focusNameTick,
    selectObject, deselect, setTool, setColor, toggleGrid, toggleSnap, setGridSize, copyShape,
    selectObjectType, clearPreset,
  }
})

// Za běhu dev serveru nahradí store novou verzí místo ponechání staré
// instance bez nově přidaných polí (jinak by po úpravě store souboru
// zůstal běžet stav bez nich, dokud by se stránka ručně neobnovila).
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
