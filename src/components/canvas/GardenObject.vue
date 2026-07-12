<script setup>
import { computed } from 'vue'

const props = defineProps({
  shape:    { type: Object,  required: true },
  ppm:      { type: Number,  required: true },
  selected: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'dragend'])

// Konva body polygonu v pixelech
const lineConfig = computed(() => ({
  id:          props.shape.id,
  points:      props.shape.points.map(v => v * props.ppm),
  fill:        props.shape.color,
  stroke:      props.selected ? '#FF6B35' : 'rgba(0,0,0,0.22)',
  strokeWidth: props.selected ? 2.5 : 1,
  closed:      true,
  opacity:     0.88,
  draggable:   true,
  shadowColor:   props.selected ? '#FF6B35' : 'transparent',
  shadowBlur:    props.selected ? 8 : 0,
  shadowOpacity: 0.35,
}))

// Centroid pro popisek
const centroid = computed(() => {
  const pts = props.shape.points
  let cx = 0, cy = 0
  const n = pts.length / 2
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1] }
  return { x: (cx / n) * props.ppm, y: (cy / n) * props.ppm }
})

const textConfig = computed(() => ({
  x:           centroid.value.x - 60,
  y:           centroid.value.y - 9,
  width:       120,
  text:        props.shape.name,
  fontSize:    12,
  fontFamily:  'system-ui, sans-serif',
  fontStyle:   'bold',
  fill:        '#111',
  align:       'center',
  listening:   false,
}))

// Po přetažení: reset pozice a deleguj delta do store
function onDragEnd(e) {
  const node = e.target
  const dx = node.x() / props.ppm
  const dy = node.y() / props.ppm
  node.position({ x: 0, y: 0 })
  emit('dragend', { id: props.shape.id, dx, dy })
}
</script>

<template>
  <v-line
    :config="lineConfig"
    @click="$emit('select')"
    @tap="$emit('select')"
    @dragend="onDragEnd"
  />
  <v-text :config="textConfig" />
</template>
