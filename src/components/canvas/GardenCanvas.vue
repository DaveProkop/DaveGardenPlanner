<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore }     from '@/stores/uiStore'
import GardenObject  from './GardenObject.vue'
import VertexHandles from './VertexHandles.vue'

const PPM = 50

const gardenStore = useGardenStore()
const uiStore     = useUiStore()

const containerRef = ref(null)
const stageRef     = ref(null)
const containerW   = ref(800)
const containerH   = ref(600)

// --- Stage config ---
const stageConfig = computed(() => ({
  width:     containerW.value,
  height:    containerH.value,
  draggable: uiStore.activeTool === 'select', // pan jen ve výběrovém nástroji
}))

// --- Plot + grid ---
const plotConfig = computed(() => ({
  x: 0, y: 0,
  width:       gardenStore.plot.width  * PPM,
  height:      gardenStore.plot.height * PPM,
  fill:        '#E8F5E9',
  stroke:      '#4A7C3F',
  strokeWidth: 3,
  listening:   false,
}))

const gridLines = computed(() => {
  const lines = []
  const pw = gardenStore.plot.width, ph = gardenStore.plot.height
  for (let x = 0; x <= pw; x++) lines.push({ points: [x*PPM,0, x*PPM,ph*PPM], stroke: x%5===0?'#A8C8A0':'#C8E0C0', strokeWidth: x%5===0?1:0.5 })
  for (let y = 0; y <= ph; y++) lines.push({ points: [0,y*PPM, pw*PPM,y*PPM], stroke: y%5===0?'#A8C8A0':'#C8E0C0', strokeWidth: y%5===0?1:0.5 })
  return lines
})

const rulerLabels = computed(() => {
  const labels = []
  const pw = gardenStore.plot.width, ph = gardenStore.plot.height
  for (let x = 0; x <= pw; x += 5) labels.push({ x: x*PPM-8, y: -18, text:`${x}m`, fontSize:11, fill:'#4A7C3F' })
  for (let y = 5; y <= ph; y += 5) labels.push({ x: -28,    y: y*PPM-6, text:`${y}m`, fontSize:11, fill:'#4A7C3F' })
  return labels
})

// --- Drawing state ---
const isDrawing      = ref(false)
const drawPoints     = ref([])          // flat [x1,y1,...] v metrech (polygon)
const rectStart      = ref(null)        // { x, y } v metrech (obdélník)
const cursorPos      = ref({ x:0, y:0 }) // v metrech, pro preview

// Pozice v metrech ze Konva stage eventu
function getMeterPos() {
  const stage = stageRef.value.getStage()
  const p     = stage.getPointerPosition()
  const sc    = stage.scaleX()
  return {
    x: (p.x - stage.x()) / sc / PPM,
    y: (p.y - stage.y()) / sc / PPM,
  }
}

// Je cíl kliknutí prázdný canvas (pozadí)?
function isBackground(target) {
  const stage = stageRef.value?.getStage()
  return !target || target === stage
}

// --- Mouse handlers ---
function onMousedown(e) {
  const tool = uiStore.activeTool
  if (tool === 'select') return

  // Klik na objekt v draw módu → ignoruj
  if (!isBackground(e.target)) return

  const { x, y } = getMeterPos()

  if (tool === 'rect') {
    rectStart.value  = { x, y }
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
  if (uiStore.activeTool !== 'rect' || !isDrawing.value) return
  if (!isBackground(e.target)) { isDrawing.value = false; rectStart.value = null; return }

  const { x, y } = getMeterPos()
  const { x: sx, y: sy } = rectStart.value
  const x0 = Math.min(sx,x), y0 = Math.min(sy,y)
  const x1 = Math.max(sx,x), y1 = Math.max(sy,y)

  if (x1-x0 > 0.2 && y1-y0 > 0.2) {
    const id = gardenStore.addShape(
      [x0,y0, x1,y0, x1,y1, x0,y1],
      _nextName(), uiStore.activeColor
    )
    uiStore.selectObject(id)
    uiStore.setTool('select') // přepnout na výběr po nakreslení
  }

  isDrawing.value = false
  rectStart.value = null
}

function onDblclick() {
  if (uiStore.activeTool !== 'polygon' || !isDrawing.value) return
  if (drawPoints.value.length >= 6) _commitPolygon()
}

function onStageClick(e) {
  if (uiStore.activeTool === 'select' && isBackground(e.target)) {
    uiStore.deselect()
  }
}

function _commitPolygon() {
  const id = gardenStore.addShape([...drawPoints.value], _nextName(), uiStore.activeColor)
  uiStore.selectObject(id)
  uiStore.setTool('select')
  drawPoints.value = []
  isDrawing.value  = false
}

function _nextName() {
  return `Objekt ${gardenStore.shapes.length + 1}`
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

// Preview pro obdélník (přerušovaný rect)
const rectPreviewConfig = computed(() => {
  if (uiStore.activeTool !== 'rect' || !isDrawing.value || !rectStart.value) return null
  const { x: sx, y: sy } = rectStart.value
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

// Kurzor CSS
const cursorStyle = computed(() => ({
  cursor: uiStore.activeTool === 'select' ? 'default' : 'crosshair',
}))

// --- Zoom ---
function onWheel(e) {
  e.evt.preventDefault()
  const stage   = stageRef.value.getStage()
  const oldScale = stage.scaleX()
  const pointer  = stage.getPointerPosition()
  const origin   = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale }
  const factor   = e.evt.deltaY < 0 ? 1.1 : 1/1.1
  const newScale = Math.min(Math.max(oldScale * factor, 0.08), 10)
  stage.scale({ x: newScale, y: newScale })
  stage.position({ x: pointer.x - origin.x*newScale, y: pointer.y - origin.y*newScale })
  stage.batchDraw()
}

// --- Object drag ---
function onObjectDragend({ id, dx, dy }) {
  gardenStore.moveShape(id, dx, dy)
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
    isDrawing.value = false; drawPoints.value = []; rectStart.value = null
    uiStore.setTool('select')
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && uiStore.selectedId) {
    gardenStore.removeShape(uiStore.selectedId); uiStore.deselect()
  }
  if (e.key === 'Enter' && uiStore.activeTool === 'polygon' && isDrawing.value && drawPoints.value.length >= 6) {
    e.preventDefault(); _commitPolygon()
  }
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
    stage.position({
      x: Math.max(20, (containerW.value  - gardenStore.plot.width  * PPM) / 2),
      y: Math.max(20, (containerH.value - gardenStore.plot.height * PPM) / 2),
    })
    stage.batchDraw()
  })
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => { ro?.disconnect(); window.removeEventListener('keydown', onKeydown) })
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
    >
      <!-- Grid (non-interactive) -->
      <v-layer :config="{ listening: false }">
        <v-line    v-for="(l,i) in gridLines"    :key="i"   :config="l" />
        <v-text    v-for="(l,i) in rulerLabels"  :key="'r'+i" :config="l" />
        <v-rect    :config="plotConfig" />
      </v-layer>

      <!-- Shapes layer -->
      <v-layer>
        <template v-for="s in gardenStore.shapes" :key="s.id">
          <GardenObject
            :shape="s"
            :ppm="PPM"
            :selected="s.id === uiStore.selectedId"
            @select="uiStore.selectObject(s.id)"
            @dragend="onObjectDragend"
          />
          <!-- Vertex handles pouze pro vybraný tvar v select módu -->
          <VertexHandles
            v-if="s.id === uiStore.selectedId && uiStore.activeTool === 'select'"
            :shape="s"
            :ppm="PPM"
          />
        </template>
      </v-layer>

      <!-- Drawing preview layer -->
      <v-layer :config="{ listening: false }">
        <!-- Rect preview -->
        <v-rect v-if="rectPreviewConfig" :config="rectPreviewConfig" />

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
      </v-layer>
    </v-stage>

    <!-- Nápověda pro aktivní nástroj -->
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none select-none">
      <div v-if="uiStore.activeTool === 'rect' && !isDrawing" class="hint-bubble">
        Klikni a táhni pro nakreslení obdélníku
      </div>
      <div v-else-if="uiStore.activeTool === 'rect' && isDrawing" class="hint-bubble">
        Pusť myš pro dokončení
      </div>
      <div v-else-if="uiStore.activeTool === 'polygon' && !isDrawing" class="hint-bubble">
        Klikej pro přidání vrcholů · Enter nebo 2× klik pro uzavření
      </div>
      <div v-else-if="uiStore.activeTool === 'polygon' && isDrawing" class="hint-bubble">
        {{ drawPoints.length / 2 }} vrcholů · Enter nebo 2× klik pro uzavření · Esc pro zrušení
      </div>
      <div v-else-if="gardenStore.shapes.length === 0" class="hint-bubble">
        Vyber nástroj vlevo a nakresli první objekt
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint-bubble {
  @apply bg-garden-700/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm;
}
</style>
