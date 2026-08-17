<script setup>
import { computed } from 'vue'

const props = defineProps({
  shape: { type: Object, required: true },
  ppm:   { type: Number, required: true },
})

const emit = defineEmits(['resize', 'resizeend'])

const MIN_SIZE = 0.2
const MAX_SIZE = 8

// Směr úchytu od ukotvujícího bodu — orientační odhad "obdélníku" textu podle
// délky řetězce, aby úchyt seděl zhruba k pravému dolnímu rohu popisku. Není
// to přesná šířka vykresleného textu, jen dost dobrý odhad pro účel tažení.
const dir = computed(() => {
  const len = Math.max(1, (props.shape.name || '').length)
  return { dx: len * 0.55, dy: 1.3 }
})

const handlePos = computed(() => {
  const [ax, ay] = props.shape.points
  const fs = props.shape.fontSize || 1
  return {
    x: (ax + fs * dir.value.dx) * props.ppm,
    y: (ay + fs * dir.value.dy) * props.ppm,
  }
})

// Promítne aktuální pozici úchytu na směr (dx,dy) a z toho odvodí fontSize —
// viz derivace: handlePos = anchor + fontSize*(dx,dy), tedy fontSize =
// (v·(dx,dy)) / (dx²+dy²) pro obecný vektor v = pozice úchytu − anchor.
function computeFontSize(e) {
  const [ax, ay] = props.shape.points
  const { dx, dy } = dir.value
  const px = e.target.x() / props.ppm - ax
  const py = e.target.y() / props.ppm - ay
  const t = (px * dx + py * dy) / (dx * dx + dy * dy)
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, t))
}

function onDragMove(e) { emit('resize', { id: props.shape.id, fontSize: computeFontSize(e) }) }
function onDragEnd(e)  { emit('resizeend', { id: props.shape.id, fontSize: computeFontSize(e) }) }
</script>

<template>
  <v-circle
    :config="{
      x: handlePos.x, y: handlePos.y,
      radius: 6,
      fill: '#FFFFFF',
      stroke: '#FF6B35',
      strokeWidth: 2,
      draggable: true,
      hitStrokeWidth: 12,
    }"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
  />
</template>
