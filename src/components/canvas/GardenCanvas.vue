<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore }     from '@/stores/uiStore'
import { ellipsePoints }  from '@/utils/shapes'
import { snapValue }      from '@/utils/grid'
import GardenObject    from './GardenObject.vue'
import VertexHandles   from './VertexHandles.vue'
import TextHandles     from './TextHandles.vue'
import EllipseHandles  from './EllipseHandles.vue'

const PPM = 50
const DEFAULT_TEXT_FONT_SIZE = 1 // metry

const gardenStore = useGardenStore()
const uiStore     = useUiStore()

const selectedShape = computed(() => gardenStore.getShape(uiStore.selectedId))

const containerRef = ref(null)
const stageRef     = ref(null)
const containerW   = ref(800)
const containerH   = ref(600)
const stagePos     = ref({ x: 0, y: 0 }) // aktuální pozice stage (pan), sledováno pro nekonečnou mřížku
const spacePressed = ref(false) // podržený mezerník = dočasný posun i uprostřed kreslení

// --- Stage config ---
const stageConfig = computed(() => ({
  width:     containerW.value,
  height:    containerH.value,
  // pan ve Výběru vždy, jinak jen při podrženém mezerníku (ať nekreslení nepřekáží)
  draggable: uiStore.activeTool === 'select' || spacePressed.value,
}))

function onStageDragMove(e) {
  // Konva "dragmove" bublá i z vnořených tažených uzlů (vrchol, celý objekt) —
  // zajímá nás jen tažení samotné stage (pan plátna), jinak by se stagePos
  // přepsal lokálními souřadnicemi taženého tvaru/vrcholu a mřížka by "uletěla".
  const stage = stageRef.value?.getStage()
  if (!stage || e.target !== stage) return
  stagePos.value = { x: stage.x(), y: stage.y() }
}

// --- Mřížka přes celou (neomezenou) kreslicí plochu ---
// Žádný pevný "pozemek" — mřížka se dopočítává jen pro aktuálně viditelnou
// oblast (podle panu a zoomu), takže pokryje canvas ať uživatel odjede kamkoliv.
const viewBounds = computed(() => {
  const scale = zoomScale.value || 1
  const { x: sx, y: sy } = stagePos.value
  return {
    x0: -sx / (PPM * scale),
    y0: -sy / (PPM * scale),
    x1: (containerW.value - sx) / (PPM * scale),
    y1: (containerH.value - sy) / (PPM * scale),
  }
})

const gridLines = computed(() => {
  const gs = uiStore.gridSize
  const { x0, y0, x1, y1 } = viewBounds.value
  const xStart = Math.floor(x0/gs)*gs - gs, xEnd = Math.ceil(x1/gs)*gs + gs
  const yStart = Math.floor(y0/gs)*gs - gs, yEnd = Math.ceil(y1/gs)*gs + gs
  const lines = []
  const eps = gs / 1000 // tolerance na zaokrouhlovací chyby plovoucí desetinné čárky
  for (let x = xStart; x <= xEnd + eps; x += gs) {
    const major = Math.round(x/gs) % 5 === 0
    lines.push({ points: [x*PPM, yStart*PPM, x*PPM, yEnd*PPM], stroke: major?'#A8C8A0':'#C8E0C0', strokeWidth: major?1:0.5 })
  }
  for (let y = yStart; y <= yEnd + eps; y += gs) {
    const major = Math.round(y/gs) % 5 === 0
    lines.push({ points: [xStart*PPM, y*PPM, xEnd*PPM, y*PPM], stroke: major?'#A8C8A0':'#C8E0C0', strokeWidth: major?1:0.5 })
  }
  return lines
})

// Popisky vzdálenosti podél os x=0 / y=0 (po 5 m), jen pro viditelnou oblast
const rulerLabels = computed(() => {
  const { x0, y0, x1, y1 } = viewBounds.value
  const xStart = Math.floor(x0/5)*5, xEnd = Math.ceil(x1/5)*5
  const yStart = Math.floor(y0/5)*5, yEnd = Math.ceil(y1/5)*5
  const labels = []
  for (let x = xStart; x <= xEnd; x += 5) {
    if (x === 0) continue
    labels.push({ x: x*PPM+3, y: Math.max(y0,0)*PPM+3, text:`${x}m`, fontSize:10, fill:'#4A7C3F' })
  }
  for (let y = yStart; y <= yEnd; y += 5) {
    if (y === 0) continue
    labels.push({ x: Math.max(x0,0)*PPM+3, y: y*PPM+3, text:`${y}m`, fontSize:10, fill:'#4A7C3F' })
  }
  return labels
})

// --- Drawing state ---
const isDrawing      = ref(false)
const drawPoints     = ref([])          // flat [x1,y1,...] v metrech (polygon)
const dragStart      = ref(null)        // { x, y } v metrech (obdélník i kruh/elipsa — tažením bbox)
const cursorPos      = ref({ x:0, y:0 }) // v metrech, pro preview

// Pozice v metrech ze Konva stage eventu, přichycená k mřížce (pokud je zapnuto)
function getMeterPos() {
  const stage = stageRef.value.getStage()
  const p     = stage.getPointerPosition()
  const sc    = stage.scaleX()
  const x = (p.x - stage.x()) / sc / PPM
  const y = (p.y - stage.y()) / sc / PPM
  if (!uiStore.snapToGrid) return { x, y }
  return { x: snapValue(x, uiStore.gridSize), y: snapValue(y, uiStore.gridSize) }
}

// Je cíl kliknutí prázdný canvas (pozadí)?
function isBackground(target) {
  const stage = stageRef.value?.getStage()
  return !target || target === stage
}

// --- Mouse handlers ---
function onMousedown(e) {
  if (spacePressed.value) return // posun plátna má přednost před kreslením
  const tool = uiStore.activeTool
  if (tool === 'select' || tool === 'move') return

  // V kreslicím režimu objekty nejsou draggable, takže klik i nad existujícím
  // tvarem (např. nad trávníkem) může rovnou začít kreslit nový objekt.
  const { x, y } = getMeterPos()

  if (tool === 'text') {
    const id = gardenStore.addText(x, y, 'Text', uiStore.activeColor, DEFAULT_TEXT_FONT_SIZE)
    uiStore.selectObject(id, { focusName: true })
    uiStore.setTool('select')
    // Tenhle mousedown je zároveň (bez tažení) "click" na pozadí stage — Konva
    // ho vzápětí sám vystřelí a onStageClick by nově vybraný text hned odselectoval.
    suppressNextClick = true
    return
  }

  if (tool === 'rect' || tool === 'circle') {
    dragStart.value  = { x, y }
    isDrawing.value  = true
  }

  if (tool === 'polygon') {
    if (!isDrawing.value) {
      isDrawing.value = true
      drawPoints.value = [x, y]
    } else {
      // Zavřít polygon při kliknutí blízko prvního bodu (< 0.5m)
      const [fx, fy] = drawPoints.value
      if (drawPoints.value.length >= 6 && Math.hypot(x-fx, y-fy) < 0.8) {
        _commitPolygon()
      } else {
        drawPoints.value = [...drawPoints.value, x, y]
      }
    }
  }
}

function onMousemove() {
  cursorPos.value = getMeterPos()
}

function onMouseup(e) {
  const tool = uiStore.activeTool
  if ((tool !== 'rect' && tool !== 'circle') || !isDrawing.value) return

  const { x, y } = getMeterPos()
  const { x: sx, y: sy } = dragStart.value
  const x0 = Math.min(sx,x), y0 = Math.min(sy,y)
  const x1 = Math.max(sx,x), y1 = Math.max(sy,y)

  if (x1-x0 > 0.2 && y1-y0 > 0.2) {
    const points = tool === 'rect'
      ? [x0,y0, x1,y0, x1,y1, x0,y1]
      : ellipsePoints((x0+x1)/2, (y0+y1)/2, (x1-x0)/2, (y1-y0)/2)
    const id = gardenStore.addShape(points, _nextName(), uiStore.activeColor, uiStore.activeTexture, tool === 'circle' ? 'ellipse' : null)
    uiStore.selectObject(id, { focusName: true })
    // Po nakreslení se vrátit na Výběr — pokud ale kreslíme podle vybraného
    // typu objektu (např. víc stromů za sebou), zůstat u stejného nástroje.
    if (!uiStore.activePresetId) uiStore.setTool('select')
  }

  isDrawing.value = false
  dragStart.value = null
}

function onDblclick() {
  if (uiStore.activeTool !== 'polygon' || !isDrawing.value) return
  if (drawPoints.value.length >= 6) _commitPolygon()
}

let suppressNextClick = false
function onStageClick(e) {
  if (suppressNextClick) { suppressNextClick = false; return }
  if (uiStore.activeTool === 'select' && isBackground(e.target)) {
    uiStore.deselect()
  }
}

function _commitPolygon() {
  const id = gardenStore.addShape([...drawPoints.value], _nextName(), uiStore.activeColor, uiStore.activeTexture)
  uiStore.selectObject(id, { focusName: true })
  if (!uiStore.activePresetId) uiStore.setTool('select')
  drawPoints.value = []
  isDrawing.value  = false
}

function _nextName() {
  const label = uiStore.pendingLabel
  if (!label) return `Objekt ${gardenStore.shapes.length + 1}`
  const re = new RegExp(`^${label}( \\d+)?$`)
  const count = gardenStore.shapes.filter(s => re.test(s.name)).length
  return count === 0 ? label : `${label} ${count + 1}`
}

// --- Preview configs ---
// Preview pro polygon (čára od posledního bodu ke kurzoru + tečky na vrcholech)
const polygonPreviewPoints = computed(() => {
  if (uiStore.activeTool !== 'polygon' || !isDrawing.value || drawPoints.value.length < 2) return null
  return [...drawPoints.value, cursorPos.value.x, cursorPos.value.y].map(v => v * PPM)
})

const polygonDots = computed(() => {
  if (uiStore.activeTool !== 'polygon' || !isDrawing.value) return []
  const res = []
  for (let i = 0; i < drawPoints.value.length; i += 2) {
    res.push({ x: drawPoints.value[i]*PPM, y: drawPoints.value[i+1]*PPM })
  }
  return res
})

// Délka právě kreslené úsečky (od posledního vrcholu ke kurzoru), popisek u jejího středu
const currentSegmentLabel = computed(() => {
  if (uiStore.activeTool !== 'polygon' || !isDrawing.value || drawPoints.value.length < 2) return null
  const n = drawPoints.value.length
  const lastX = drawPoints.value[n-2], lastY = drawPoints.value[n-1]
  const { x: cx, y: cy } = cursorPos.value
  const dist = Math.hypot(cx-lastX, cy-lastY)
  if (dist < 0.05) return null
  return {
    x:    ((lastX+cx)/2) * PPM,
    y:    ((lastY+cy)/2) * PPM - 14,
    text: `${dist.toFixed(2)} m`,
  }
})

// Preview pro obdélník (přerušovaný rect)
const rectPreviewConfig = computed(() => {
  if (uiStore.activeTool !== 'rect' || !isDrawing.value || !dragStart.value) return null
  const { x: sx, y: sy } = dragStart.value
  const { x: cx, y: cy } = cursorPos.value
  return {
    x:      Math.min(sx,cx) * PPM,
    y:      Math.min(sy,cy) * PPM,
    width:  Math.abs(cx-sx) * PPM,
    height: Math.abs(cy-sy) * PPM,
    fill:   uiStore.activeColor + '33',
    stroke: uiStore.activeColor,
    strokeWidth: 2,
    dash:        [6, 4],
    listening:   false,
  }
})

// Preview pro kruh/elipsu (přerušovaná elipsa)
const ellipsePreviewConfig = computed(() => {
  if (uiStore.activeTool !== 'circle' || !isDrawing.value || !dragStart.value) return null
  const { x: sx, y: sy } = dragStart.value
  const { x: cx, y: cy } = cursorPos.value
  const x0 = Math.min(sx,cx), y0 = Math.min(sy,cy)
  const x1 = Math.max(sx,cx), y1 = Math.max(sy,cy)
  return {
    x:       (x0+x1)/2 * PPM,
    y:       (y0+y1)/2 * PPM,
    radiusX: (x1-x0)/2 * PPM,
    radiusY: (y1-y0)/2 * PPM,
    fill:    uiStore.activeColor + '33',
    stroke:  uiStore.activeColor,
    strokeWidth: 2,
    dash:        [6, 4],
    listening:   false,
  }
})

// Kurzor CSS
const cursorStyle = computed(() => ({
  cursor: spacePressed.value
    ? 'grab'
    : uiStore.activeTool === 'select' ? 'default'
    : uiStore.activeTool === 'move'   ? 'move'
    : uiStore.activeTool === 'text'   ? 'text'
    : 'crosshair',
}))

// --- Zoom ---
const zoomScale = ref(1) // aktuální stage scale, sledováno pro měřítko dole

function onWheel(e) {
  e.evt.preventDefault()
  const stage   = stageRef.value.getStage()
  const oldScale = stage.scaleX()
  const pointer  = stage.getPointerPosition()
  const origin   = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale }
  const factor   = e.evt.deltaY < 0 ? 1.1 : 1/1.1
  const newScale = Math.min(Math.max(oldScale * factor, 0.08), 10)
  const newPos = { x: pointer.x - origin.x*newScale, y: pointer.y - origin.y*newScale }
  stage.scale({ x: newScale, y: newScale })
  stage.position(newPos)
  stage.batchDraw()
  zoomScale.value = newScale
  stagePos.value  = newPos
}

// Zoom tlačítky — přibližuje/oddaluje ke středu viditelné plochy
function zoomBy(factor) {
  const stage    = stageRef.value.getStage()
  const oldScale = stage.scaleX()
  const newScale = Math.min(Math.max(oldScale * factor, 0.08), 10)
  const center   = { x: containerW.value / 2, y: containerH.value / 2 }
  const origin   = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale }
  const newPos = { x: center.x - origin.x*newScale, y: center.y - origin.y*newScale }
  stage.scale({ x: newScale, y: newScale })
  stage.position(newPos)
  stage.batchDraw()
  zoomScale.value = newScale
  stagePos.value  = newPos
}
function zoomIn()  { zoomBy(1.25) }
function zoomOut() { zoomBy(1/1.25) }

// Měřítko dole — vybere "hezkou" hodnotu v metrech, jejíž pruh se vejde do max. šířky
const SCALE_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]
const SCALE_MAX_PX = 120
const scaleBar = computed(() => {
  const pxPerMeter = PPM * zoomScale.value
  let meters = SCALE_STEPS[0]
  for (const step of SCALE_STEPS) {
    if (step * pxPerMeter <= SCALE_MAX_PX) meters = step
    else break
  }
  return { meters, px: meters * pxPerMeter }
})

// --- Object drag ---
function onObjectDragend({ id, dx, dy }) {
  gardenStore.moveShape(id, dx, dy)
}

// --- Text resize (přes úchyt v TextHandles) ---
// Během tažení se velikost jen promítá do GardenObject (přes previewFontSize),
// do store se zapíše až při puštění — stejný vzor jako u tažení vrcholů.
const textResizePreview = ref(null) // { id, fontSize } | null
function onTextResize(payload)    { textResizePreview.value = payload }
function onTextResizeEnd({ id, fontSize }) {
  gardenStore.updateShape({ id, fontSize })
  textResizePreview.value = null
}

// --- Ellipse resize (přes úchyty v EllipseHandles) ---
// Stejný vzor jako u textu — během tažení jen živý náhled bodů, do store až na puštění.
const ellipseResizePreview = ref(null) // { id, points } | null
function onEllipseResize(payload)    { ellipseResizePreview.value = payload }
function onEllipseResizeEnd({ id, points }) {
  gardenStore.updateShape({ id, points })
  ellipseResizePreview.value = null
}

// --- Keyboard ---
function onKeydown(e) {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault(); gardenStore.undo(); uiStore.deselect()
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault(); gardenStore.redo(); uiStore.deselect()
  }
  if (e.key === 'Escape') {
    isDrawing.value = false; drawPoints.value = []; dragStart.value = null
    uiStore.setTool('select'); uiStore.clearPreset()
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && uiStore.selectedId) {
    gardenStore.removeShape(uiStore.selectedId); uiStore.deselect()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && uiStore.selectedId) {
    e.preventDefault(); uiStore.copyShape(gardenStore.getShape(uiStore.selectedId))
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v' && uiStore.clipboard) {
    e.preventDefault()
    const id = gardenStore.pasteShape(uiStore.clipboard)
    uiStore.selectObject(id)
    uiStore.setTool('select')
  }
  if (e.key === 'Enter' && uiStore.activeTool === 'polygon' && isDrawing.value && drawPoints.value.length >= 6) {
    e.preventDefault(); _commitPolygon()
  }
  // Podržený mezerník = dočasný posun plátna, i uprostřed kreslení polygonu/obdélníku/kruhu
  if (e.code === 'Space' && !spacePressed.value) {
    e.preventDefault(); spacePressed.value = true
  }
}

function onKeyup(e) {
  if (e.code === 'Space') spacePressed.value = false
}

// --- Mount ---
let ro = null
onMounted(() => {
  const el = containerRef.value
  containerW.value = el.clientWidth
  containerH.value = el.clientHeight
  ro = new ResizeObserver(([entry]) => {
    containerW.value = entry.contentRect.width
    containerH.value = entry.contentRect.height
  })
  ro.observe(el)
  nextTick(() => {
    const stage = stageRef.value?.getStage()
    if (!stage) return
    // Počátek (0,0) doprostřed viditelné plochy — bez pevného pozemku
    // není důvod upřednostňovat jiný výchozí bod.
    const center = { x: containerW.value / 2, y: containerH.value / 2 }
    stage.position(center)
    stage.batchDraw()
    stagePos.value = center
  })
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full bg-garden-50 select-none" :style="cursorStyle">
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @wheel="onWheel"
      @click="onStageClick"
      @tap="onStageClick"
      @mousedown="onMousedown"
      @mouseup="onMouseup"
      @mousemove="onMousemove"
      @dblclick="onDblclick"
      @dragmove="onStageDragMove"
    >
      <!-- Grid (non-interactive) -->
      <v-layer :config="{ listening: false }">
        <template v-if="uiStore.showGrid">
          <v-line  v-for="(l,i) in gridLines"    :key="i"   :config="l" />
        </template>
        <v-text    v-for="(l,i) in rulerLabels"  :key="'r'+i" :config="l" />
      </v-layer>

      <!-- Shapes layer -->
      <v-layer>
        <template v-for="s in gardenStore.shapes" :key="s.id">
          <GardenObject
            :shape="s"
            :ppm="PPM"
            :selected="s.id === uiStore.selectedId"
            :draggable="uiStore.activeTool === 'move'"
            :preview-font-size="textResizePreview && textResizePreview.id === s.id ? textResizePreview.fontSize : null"
            :preview-points="ellipseResizePreview && ellipseResizePreview.id === s.id ? ellipseResizePreview.points : null"
            @select="(uiStore.activeTool === 'select' || uiStore.activeTool === 'move') && uiStore.selectObject(s.id)"
            @dragend="onObjectDragend"
          />
          <!-- Vertex handles pro obecné polygony/obdélníky (ne text, ne elipsu/kruh) v select módu -->
          <VertexHandles
            v-if="s.kind !== 'text' && s.kind !== 'ellipse' && s.id === uiStore.selectedId && uiStore.activeTool === 'select'"
            :shape="s"
            :ppm="PPM"
          />
          <!-- Úchyt pro změnu velikosti textu -->
          <TextHandles
            v-if="s.kind === 'text' && s.id === uiStore.selectedId && uiStore.activeTool === 'select'"
            :shape="s"
            :ppm="PPM"
            @resize="onTextResize"
            @resizeend="onTextResizeEnd"
          />
          <!-- Úchyty pro protažení kruhu/elipsy do šířky/výšky (tvar zůstane elipsou) -->
          <EllipseHandles
            v-if="s.kind === 'ellipse' && s.id === uiStore.selectedId && uiStore.activeTool === 'select'"
            :shape="s"
            :ppm="PPM"
            @resize="onEllipseResize"
            @resizeend="onEllipseResizeEnd"
          />
        </template>
      </v-layer>

      <!-- Drawing preview layer -->
      <v-layer :config="{ listening: false }">
        <!-- Rect preview -->
        <v-rect v-if="rectPreviewConfig" :config="rectPreviewConfig" />

        <!-- Kruh/elipsa preview -->
        <v-ellipse v-if="ellipsePreviewConfig" :config="ellipsePreviewConfig" />

        <!-- Polygon preview line -->
        <v-line
          v-if="polygonPreviewPoints"
          :config="{
            points:      polygonPreviewPoints,
            stroke:      uiStore.activeColor,
            strokeWidth: 2,
            dash:        [6,4],
            listening:   false,
          }"
        />

        <!-- Polygon vertex dots -->
        <v-circle
          v-for="(dot, i) in polygonDots"
          :key="i"
          :config="{
            x: dot.x, y: dot.y,
            radius:      4,
            fill:        uiStore.activeColor,
            stroke:      '#fff',
            strokeWidth: 1.5,
            listening:   false,
          }"
        />

        <!-- Délka právě kreslené úsečky -->
        <v-text
          v-if="currentSegmentLabel"
          :config="{
            x: currentSegmentLabel.x,
            y: currentSegmentLabel.y,
            text: currentSegmentLabel.text,
            fontSize: 12,
            fontStyle: 'bold',
            fill: uiStore.activeColor,
            stroke: '#fff',
            strokeWidth: 3,
            fillAfterStrokeEnabled: true,
            listening: false,
          }"
        />
      </v-layer>
    </v-stage>

    <!-- Nápověda pro aktivní nástroj -->
    <div class="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none select-none">
      <div v-if="uiStore.activeTool === 'rect' && !isDrawing" class="hint-bubble">
        {{ uiStore.pendingLabel ? `${uiStore.pendingLabel}: klikni a táhni pro nakreslení` : 'Klikni a táhni pro nakreslení obdélníku' }}
      </div>
      <div v-else-if="(uiStore.activeTool === 'rect' || uiStore.activeTool === 'circle') && isDrawing" class="hint-bubble">
        Pusť myš pro dokončení · Podrž mezerník pro posun plátna
      </div>
      <div v-else-if="uiStore.activeTool === 'polygon' && !isDrawing" class="hint-bubble">
        {{ uiStore.pendingLabel ? `${uiStore.pendingLabel}: ` : '' }}Klikej pro přidání vrcholů · Enter nebo 2× klik pro uzavření
      </div>
      <div v-else-if="uiStore.activeTool === 'polygon' && isDrawing" class="hint-bubble">
        {{ drawPoints.length / 2 }} vrcholů · Enter nebo 2× klik pro uzavření · Esc pro zrušení · Mezerník = posun
      </div>
      <div v-else-if="uiStore.activeTool === 'circle' && !isDrawing" class="hint-bubble">
        {{ uiStore.pendingLabel ? `${uiStore.pendingLabel}: klikni a táhni pro nakreslení` : 'Klikni a táhni pro nakreslení kruhu/elipsy' }}
      </div>
      <div v-else-if="uiStore.activeTool === 'text'" class="hint-bubble">
        Klikni na plán pro umístění textu
      </div>
      <div v-else-if="uiStore.activeTool === 'move'" class="hint-bubble">
        Táhni objekt pro přesun · v nástroji Výběr se objekty nepřesouvají omylem
      </div>
      <div v-else-if="uiStore.activeTool === 'select' && selectedShape && selectedShape.kind === 'ellipse'" class="hint-bubble">
        Táhni bílé úchyty pro protažení do šířky/výšky · tvar zůstane kruh/elipsa · přesné rozměry uprav vpravo
      </div>
      <div v-else-if="uiStore.activeTool === 'select' && selectedShape" class="hint-bubble">
        Táhni bílá kolečka pro úpravu tvaru · dvojklik na kolečko = smazat vrchol · tečkovaná kolečka uprostřed hrany = přidat vrchol
      </div>
      <div v-else-if="gardenStore.shapes.length === 0" class="hint-bubble">
        Vyber nástroj nebo typ objektu vlevo a nakresli první objekt
      </div>
    </div>

    <!-- Měřítko + zoom -->
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full shadow px-2.5 py-1.5 select-none">
      <button
        class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-garden-100 text-garden-700 font-bold leading-none transition-colors"
        title="Oddálit"
        @click="zoomOut"
      >−</button>
      <div class="flex items-center gap-1.5">
        <div class="h-1 bg-garden-600 rounded" :style="{ width: scaleBar.px + 'px' }" />
        <span class="text-[11px] text-garden-600 font-medium whitespace-nowrap">{{ scaleBar.meters }} m</span>
      </div>
      <button
        class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-garden-100 text-garden-700 font-bold leading-none transition-colors"
        title="Přiblížit"
        @click="zoomIn"
      >+</button>
    </div>
  </div>
</template>

<style scoped>
.hint-bubble {
  @apply bg-garden-700/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm;
}
</style>
