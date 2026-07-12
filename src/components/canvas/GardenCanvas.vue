<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore } from '@/stores/uiStore'
import GardenObject from './GardenObject.vue'

const PPM = 50 // pixels per meter at scale 1

const gardenStore = useGardenStore()
const uiStore = useUiStore()

const containerRef  = ref(null)
const stageRef      = ref(null)
const transformerRef = ref(null)
const containerW    = ref(800)
const containerH    = ref(600)

// Stage config — size only; position & scale managed directly on Konva node
const stageConfig = computed(() => ({
  width:     containerW.value,
  height:    containerH.value,
  draggable: true,
}))

// Plot background
const plotConfig = computed(() => ({
  x: 0, y: 0,
  width:  gardenStore.plot.width  * PPM,
  height: gardenStore.plot.height * PPM,
  fill:    '#E8F5E9',
  stroke:  '#4A7C3F',
  strokeWidth: 3,
  listening: false,
}))

// Grid lines
const gridLines = computed(() => {
  const lines = []
  const pw = gardenStore.plot.width
  const ph = gardenStore.plot.height
  for (let x = 0; x <= pw; x++) {
    lines.push({ points: [x * PPM, 0, x * PPM, ph * PPM], stroke: x % 5 === 0 ? '#A8C8A0' : '#C8E0C0', strokeWidth: x % 5 === 0 ? 1 : 0.5 })
  }
  for (let y = 0; y <= ph; y++) {
    lines.push({ points: [0, y * PPM, pw * PPM, y * PPM], stroke: y % 5 === 0 ? '#A8C8A0' : '#C8E0C0', strokeWidth: y % 5 === 0 ? 1 : 0.5 })
  }
  return lines
})

// Ruler labels every 5m
const rulerLabels = computed(() => {
  const labels = []
  const pw = gardenStore.plot.width
  const ph = gardenStore.plot.height
  for (let x = 0; x <= pw; x += 5) {
    labels.push({ x: x * PPM - 8, y: -18, text: `${x}m`, fontSize: 11, fill: '#4A7C3F' })
  }
  for (let y = 5; y <= ph; y += 5) {
    labels.push({ x: -28, y: y * PPM - 6, text: `${y}m`, fontSize: 11, fill: '#4A7C3F' })
  }
  return labels
})

// Zoom with mouse wheel (direct Konva manipulation for performance)
function onWheel(e) {
  e.evt.preventDefault()
  const stage = stageRef.value.getStage()
  const oldScale = stage.scaleX()
  const pointer = stage.getPointerPosition()

  const origin = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  }

  const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1
  const newScale = Math.min(Math.max(oldScale * factor, 0.1), 8)

  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - origin.x * newScale,
    y: pointer.y - origin.y * newScale,
  })
  stage.batchDraw()
}

// Click on empty stage area → deselect
function onStageClick(e) {
  if (e.target === stageRef.value.getStage()) {
    uiStore.deselect()
  }
}

// Sync Konva Transformer when selected object changes
watch(() => uiStore.selectedObjectId, (newId) => {
  nextTick(() => {
    const tr = transformerRef.value?.getNode()
    if (!tr) return
    if (!newId) {
      tr.nodes([])
    } else {
      const node = stageRef.value.getStage().findOne('#' + newId)
      tr.nodes(node ? [node] : [])
    }
    tr.getLayer()?.batchDraw()
  })
})

// Store update callbacks
function onObjectDragend(changes) {
  gardenStore.updateObject(changes)
}
function onObjectTransformend(changes) {
  gardenStore.updateObject(changes)
}

// Keyboard shortcuts
function onKeydown(e) {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    gardenStore.undo()
    uiStore.deselect()
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault()
    gardenStore.redo()
    uiStore.deselect()
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && uiStore.selectedObjectId) {
    gardenStore.removeObject(uiStore.selectedObjectId)
    uiStore.deselect()
  }
}

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

  // Center the stage on the plot
  nextTick(() => {
    const stage = stageRef.value?.getStage()
    if (!stage) return
    const pw = gardenStore.plot.width  * PPM
    const ph = gardenStore.plot.height * PPM
    stage.position({
      x: Math.max(20, (containerW.value  - pw) / 2),
      y: Math.max(20, (containerH.value - ph) / 2),
    })
    stage.batchDraw()
  })

  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="containerRef" class="w-full h-full bg-garden-50">
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @wheel="onWheel"
      @click="onStageClick"
      @tap="onStageClick"
    >
      <!-- Grid layer (non-interactive) -->
      <v-layer :config="{ listening: false }">
        <v-line
          v-for="(line, i) in gridLines"
          :key="i"
          :config="line"
        />
        <v-text
          v-for="(label, i) in rulerLabels"
          :key="'r' + i"
          :config="label"
        />
      </v-layer>

      <!-- Objects layer -->
      <v-layer>
        <v-rect :config="plotConfig" />

        <GardenObject
          v-for="obj in gardenStore.objects"
          :key="obj.id"
          :object="obj"
          :ppm="PPM"
          :selected="obj.id === uiStore.selectedObjectId"
          @select="uiStore.selectObject(obj.id)"
          @dragend="onObjectDragend"
          @transformend="onObjectTransformend"
        />
      </v-layer>

      <!-- Transformer layer -->
      <v-layer>
        <v-transformer
          ref="transformerRef"
          :config="{
            rotateEnabled: true,
            keepRatio: false,
            borderStroke: '#FF6B35',
            borderStrokeWidth: 1.5,
            anchorStroke: '#FF6B35',
            anchorFill: '#FFFFFF',
            anchorSize: 9,
            padding: 2,
          }"
        />
      </v-layer>
    </v-stage>

    <!-- Canvas hint -->
    <div
      v-if="gardenStore.objects.length === 0"
      class="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
    >
      <div class="text-center text-garden-600 opacity-60">
        <div class="text-4xl mb-2">🌱</div>
        <div class="text-sm">Přidej první objekt z levého panelu</div>
        <div class="text-xs mt-1">Scroll = zoom &nbsp;|&nbsp; Tažení = posun</div>
      </div>
    </div>
  </div>
</template>
