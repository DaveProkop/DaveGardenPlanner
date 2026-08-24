import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed } from 'vue'
import { DEFAULT_COLOR } from '@/constants/colorPresets'

// Volitelné rozestupy mřížky (v metrech), nabízené v panelu nástrojů.
export const GRID_SIZES = [0.25, 0.5, 1, 2, 5]

export const useUiStore = defineStore('ui', () => {
  // Zdroj pravdy pro výběr je pole selectedIds — [] žádný výběr, [id] jeden
  // objekt, [id, id, ...] víc objektů (multi-select). selectedId níže je jen
  // odvozený computed pro místa v appce, která pracují s jedním objektem
  // (editor vlastností jednoho tvaru, úchyty vrcholů/textu/elipsy) — u nich
  // dává smysl zobrazit se/fungovat jen když je vybraný přesně jeden tvar.
  const selectedIds     = ref([])
  const selectedId       = computed(() => selectedIds.value.length === 1 ? selectedIds.value[0] : null)
  const activeTool      = ref('select')   // 'select' | 'move' | 'marquee' | 'rect' | 'polygon' | 'circle' | 'text'
  const activeColor     = ref(DEFAULT_COLOR)
  const activeTexture   = ref(null)       // textureKey pro příští nakreslený tvar, nebo null (plná barva)
  const pendingLabel    = ref('')         // předvyplněný název dalšího tvaru (typ objektu), '' = generický "Objekt N"
  const activePresetId  = ref(null)       // id vybraného typu objektu (pro zvýraznění v panelu)
  const showGrid         = ref(true)
  const snapToGrid        = ref(true)     // přichytávat kreslení/tažení k mřížce
  const gridSize          = ref(1)        // rozestup mřížky v metrech
  const showPlotDistance  = ref(true)     // zobrazovat vzdálenost vybraného objektu od hranice pozemku
                                           // (nahoru/dolů/doleva/doprava) — na plátně i v pravém panelu
  const clipboard         = ref(null)     // pole zkopírovaných dat objektů (bez id) pro Ctrl+V, nebo null
  const drawTarget        = ref('shape')  // 'shape' (běžný addShape) | 'plot' (příští rect/circle/polygon commit jde do gardenStore.setPlot)
  const dragDelta         = ref(null)     // { id, dx, dy } | null — živý (ještě nezapsaný) posun taženého tvaru, pro vzdálenost k hranici pozemku
  const focusNameTick     = ref(0)        // inkrementuje se jen při výběru NOVĚ vytvořeného objektu —
                                           // PropertyEditor na to zareaguje zaostřením pole Název/Text.
                                           // Obyčejný klik na existující objekt focus nekrade (jinak by
                                           // ukradl focus canvasu a přestaly by fungovat klávesové zkratky).
  const mobilePanel       = ref(null)     // null | 'tools' | 'properties' — který boční panel je na
                                           // úzké obrazovce (pod md) vysunutý jako překryvný drawer.
                                           // Na desktopu (md+) je bez efektu, panely jsou tam vždy vidět.

  // additive = true (shift/ctrl+klik) přidá/odebere id z výběru místo jeho nahrazení —
  // základ pro multi-select. Znovu-klik na už vybraný objekt s additive ho z výběru odebere.
  function selectObject(id, { focusName = false, additive = false } = {}) {
    if (additive) {
      selectedIds.value = selectedIds.value.includes(id)
        ? selectedIds.value.filter(i => i !== id)
        : [...selectedIds.value, id]
    } else {
      selectedIds.value = [id]
    }
    if (focusName) focusNameTick.value++
    if (selectedIds.value.length) mobilePanel.value = 'properties'
  }
  // Nahradí výběr celým polem id najednou — používá se pro výběr rámečkem (marquee)
  // tažením po prázdném plátně v nástroji Přesun (viz GardenCanvas.onMouseup).
  function selectMultiple(ids) {
    selectedIds.value = [...new Set(ids)]
    if (selectedIds.value.length) mobilePanel.value = 'properties'
  }
  function deselect() {
    selectedIds.value = []
    if (mobilePanel.value === 'properties') mobilePanel.value = null
  }
  // Ruční přepnutí nástroje vždy zruší rozkreslený pozemek (viz startPlotDrawing) —
  // i Escape prochází přes setTool('select'), takže tohle stačí jako jediné místo resetu.
  function setTool(tool) {
    activeTool.value = tool
    drawTarget.value = 'shape'
    if (mobilePanel.value === 'tools') mobilePanel.value = null
  }
  function openMobilePanel(name) { mobilePanel.value = mobilePanel.value === name ? null : name }
  function closeMobilePanel()    { mobilePanel.value = null }
  function setColor(color)  { activeColor.value = color; activePresetId.value = null }
  function toggleGrid()     { showGrid.value = !showGrid.value }
  function toggleSnap()     { snapToGrid.value = !snapToGrid.value }
  function setGridSize(size) { gridSize.value = size }
  function togglePlotDistance() { showPlotDistance.value = !showPlotDistance.value }

  // Aktivuje nástroj Polygon, ale příští dokončený tvar zapíše do gardenStore.plot
  // (hranice pozemku) místo běžného gardenStore.addShape.
  function startPlotDrawing() {
    setTool('polygon')
    drawTarget.value = 'plot'
  }

  function setDragDelta(payload) { dragDelta.value = payload }
  function clearDragDelta()      { dragDelta.value = null }

  // Uloží snímek jednoho nebo víc tvarů do schránky — kopíruje se stav v
  // okamžiku zkopírování, takže vložení funguje i po smazání/úpravě originálu.
  function copySelection(shapes) {
    if (!shapes || !shapes.length) return
    clipboard.value = shapes.map(({ id, ...data }) => JSON.parse(JSON.stringify(data)))
  }

  // Vybere přednastavený typ objektu (rostlina, stavba, ...): nastaví barvu,
  // texturu, výchozí název a aktivuje odpovídající kreslicí nástroj.
  function selectObjectType(type) {
    activeColor.value    = type.color
    activeTexture.value  = type.textureKey
    pendingLabel.value   = type.label
    activePresetId.value = type.id
    activeTool.value     = type.shape === 'circle' || type.shape === 'polygon' ? type.shape : 'rect'
    if (mobilePanel.value === 'tools') mobilePanel.value = null
  }

  // Zruší vybraný typ objektu — použije se při ručním přepnutí na obecný nástroj.
  function clearPreset() {
    activeTexture.value  = null
    pendingLabel.value   = ''
    activePresetId.value = null
  }

  return {
    selectedId, selectedIds, activeTool, activeColor, activeTexture, pendingLabel, activePresetId,
    showGrid, snapToGrid, gridSize, showPlotDistance, clipboard, focusNameTick, drawTarget, dragDelta, mobilePanel,
    selectObject, selectMultiple, deselect, setTool, setColor, toggleGrid, toggleSnap, setGridSize, togglePlotDistance, copySelection,
    selectObjectType, clearPreset, startPlotDrawing, setDragDelta, clearDragDelta,
    openMobilePanel, closeMobilePanel,
  }
})

// Za běhu dev serveru nahradí store novou verzí místo ponechání staré
// instance bez nově přidaných polí (jinak by po úpravě store souboru
// zůstal běžet stav bez nich, dokud by se stránka ručně neobnovila).
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
