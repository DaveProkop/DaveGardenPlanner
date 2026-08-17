<script setup>
import { computed, ref } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore } from '@/stores/uiStore'
import { snapStagePos } from '@/utils/grid'

const props = defineProps({
  shape: { type: Object, required: true },
  ppm:   { type: Number, required: true },
})

const gardenStore = useGardenStore()
const uiStore     = useUiStore()

// Přichytí tažený vrchol/mid-úchyt k mřížce — `this` uvnitř je Konva uzel,
// viz jeho volání přes .call().
function dragBoundFunc(pos) {
  return uiStore.snapToGrid ? snapStagePos(pos, this.getStage(), props.ppm, uiStore.gridSize) : pos
}

const handles = computed(() => {
  const pts = props.shape.points
  return Array.from({ length: pts.length / 2 }, (_, i) => ({
    idx: i,
    x:   pts[i * 2]     * props.ppm,
    y:   pts[i * 2 + 1] * props.ppm,
  }))
})

function handleConfig(h) {
  return {
    x:           h.x,
    y:           h.y,
    radius:      6,
    fill:        '#FFFFFF',
    stroke:      '#FF6B35',
    strokeWidth: 2,
    draggable:   true,
    dragBoundFunc,
    hitStrokeWidth: 12,
  }
}

// Živé info o právě taženém bodu (hlavní vrchol nebo mid-úchyt), v metrech.
// Nikdy se nezapisuje zpátky do configu taženého Konva uzlu (o tu pozici se
// stará čistě Konva samo — externí reaktivní setAttrs na aktivně tažený uzel
// by kolidoval s jeho vlastní drag logikou a drag by se přerušil). Používá se
// jen pro vykreslení náhledových čar/popisků k sousedním (netaženým) vrcholům.
const dragInfo = ref(null) // { kind: 'vertex', idx, x, y } | { kind: 'mid', afterIdx, x, y }

function onVertexDrag(e, idx) {
  dragInfo.value = { kind: 'vertex', idx, x: e.target.x() / props.ppm, y: e.target.y() / props.ppm }
}

function onVertexDragEnd(e, idx) {
  gardenStore.updateVertex(props.shape.id, idx, e.target.x() / props.ppm, e.target.y() / props.ppm)
  dragInfo.value = null
}

// Dvojklik na vrchol jej smaže (tvar musí mít min. 3 vrcholy)
function onVertexDblClick(idx) {
  gardenStore.removeVertex(props.shape.id, idx)
}

// Malé úchyty uprostřed každé hrany — tažením (i pouhým kliknutím na místě)
// se do tvaru vloží nový vrchol na dané hraně. Kruh/elipsa sem vůbec
// nedorazí (má vlastní EllipseHandles), takže žádná výjimka není potřeba.
const midHandles = computed(() => {
  const pts = props.shape.points
  const n = pts.length / 2
  return Array.from({ length: n }, (_, i) => {
    const j = (i + 1) % n
    const x = (pts[i*2] + pts[j*2]) / 2
    const y = (pts[i*2+1] + pts[j*2+1]) / 2
    return { afterIdx: i, x: x * props.ppm, y: y * props.ppm }
  })
})

function midHandleConfig(m) {
  return {
    x:           m.x,
    y:           m.y,
    radius:      4,
    fill:        '#FFFFFF',
    stroke:      '#FF6B35',
    strokeWidth: 1.5,
    opacity:     0.6,
    dash:        [2, 2],
    draggable:   true,
    dragBoundFunc,
    hitStrokeWidth: 12,
  }
}

function onMidDrag(e, afterIdx) {
  dragInfo.value = { kind: 'mid', afterIdx, x: e.target.x() / props.ppm, y: e.target.y() / props.ppm }
}

function onMidDragEnd(e, afterIdx) {
  gardenStore.insertVertex(props.shape.id, afterIdx, e.target.x() / props.ppm, e.target.y() / props.ppm)
  dragInfo.value = null
}

// Náhled obou hran sousedících s právě taženým bodem — přerušovaná čára
// od jeho živé pozice ke dvěma sousedním (skutečným, netaženým) vrcholům,
// s popiskem délky u každé z nich.
const dragPreview = computed(() => {
  const info = dragInfo.value
  if (!info) return { lines: [], labels: [] }
  const pts = props.shape.points
  const n = pts.length / 2
  const prevIdx = info.kind === 'vertex' ? (info.idx - 1 + n) % n : info.afterIdx
  const nextIdx = info.kind === 'vertex' ? (info.idx + 1) % n     : (info.afterIdx + 1) % n
  const prevX = pts[prevIdx*2], prevY = pts[prevIdx*2+1]
  const nextX = pts[nextIdx*2], nextY = pts[nextIdx*2+1]
  const d1 = Math.hypot(info.x-prevX, info.y-prevY)
  const d2 = Math.hypot(info.x-nextX, info.y-nextY)
  const curPx = info.x * props.ppm, curPy = info.y * props.ppm
  const prevPx = prevX * props.ppm, prevPy = prevY * props.ppm
  const nextPx = nextX * props.ppm, nextPy = nextY * props.ppm
  return {
    lines: [
      { key: 'a', points: [prevPx, prevPy, curPx, curPy] },
      { key: 'b', points: [curPx, curPy, nextPx, nextPy] },
    ],
    labels: [
      { key: 'a', x: (prevPx+curPx)/2, y: (prevPy+curPy)/2 - 12, text: `${d1.toFixed(2)} m` },
      { key: 'b', x: (nextPx+curPx)/2, y: (nextPy+curPy)/2 - 12, text: `${d2.toFixed(2)} m` },
    ],
  }
})
</script>

<template>
  <!-- Náhledové hrany k sousedním vrcholům při tažení -->
  <v-line
    v-for="l in dragPreview.lines"
    :key="l.key"
    :config="{ points: l.points, stroke: '#FF6B35', strokeWidth: 2, dash: [6,4], listening: false }"
  />

  <v-circle
    v-for="m in midHandles"
    :key="'mid-'+m.afterIdx"
    :config="midHandleConfig(m)"
    @dragstart="(e) => onMidDrag(e, m.afterIdx)"
    @dragmove="(e) => onMidDrag(e, m.afterIdx)"
    @dragend="(e) => onMidDragEnd(e, m.afterIdx)"
  />
  <v-circle
    v-for="h in handles"
    :key="h.idx"
    :config="handleConfig(h)"
    @dragstart="(e) => onVertexDrag(e, h.idx)"
    @dragmove="(e) => onVertexDrag(e, h.idx)"
    @dragend="(e) => onVertexDragEnd(e, h.idx)"
    @dblclick="onVertexDblClick(h.idx)"
    @dbltap="onVertexDblClick(h.idx)"
  />

  <v-text
    v-for="l in dragPreview.labels"
    :key="l.key"
    :config="{
      x: l.x, y: l.y,
      text: l.text,
      fontSize: 12,
      fontStyle: 'bold',
      fill: '#FF6B35',
      stroke: '#fff',
      strokeWidth: 3,
      fillAfterStrokeEnabled: true,
      listening: false,
    }"
  />
</template>
