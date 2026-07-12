<script setup>
import { computed } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'

const props = defineProps({
  shape: { type: Object, required: true },
  ppm:   { type: Number, required: true },
})

const gardenStore = useGardenStore()

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
    hitStrokeWidth: 12,
  }
}

function onDragEnd(e, idx) {
  const node = e.target
  gardenStore.updateVertex(
    props.shape.id,
    idx,
    node.x() / props.ppm,
    node.y() / props.ppm,
  )
}
</script>

<template>
  <v-circle
    v-for="h in handles"
    :key="h.idx"
    :config="handleConfig(h)"
    @dragend="(e) => onDragEnd(e, h.idx)"
  />
</template>
