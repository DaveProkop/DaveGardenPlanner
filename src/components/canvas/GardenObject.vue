<script setup>
import { computed } from 'vue'
import { OBJECT_TYPES } from '@/constants/objectTypes'

const props = defineProps({
  object: { type: Object, required: true },
  ppm:    { type: Number, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'dragend', 'transformend'])

const typeDef = computed(() => OBJECT_TYPES[props.object.type] ?? {})

const isCircular = computed(() =>
  typeDef.value.shape === 'circle' || typeDef.value.shape === 'ellipse'
)

const w = computed(() => props.object.width  * props.ppm)
const h = computed(() => props.object.height * props.ppm)

const groupConfig = computed(() => ({
  id: props.object.id,
  x: props.object.x * props.ppm,
  y: props.object.y * props.ppm,
  width:  w.value,
  height: h.value,
  rotation: props.object.rotation ?? 0,
  draggable: true,
  offsetX: 0,
  offsetY: 0,
}))

const shapeConfig = computed(() => ({
  x: 0,
  y: 0,
  width:  w.value,
  height: h.value,
  fill:   props.object.color,
  stroke: props.selected ? '#FF6B35' : 'rgba(0,0,0,0.25)',
  strokeWidth: props.selected ? 2.5 : 1,
  cornerRadius: isCircular.value ? Math.min(w.value, h.value) / 2 : 4,
  opacity: 0.88,
  shadowColor: props.selected ? '#FF6B35' : 'transparent',
  shadowBlur: props.selected ? 8 : 0,
  shadowOpacity: 0.4,
}))

const textConfig = computed(() => {
  const fontSize = Math.max(9, Math.min(13, h.value * 0.22))
  return {
    x: 2,
    y: 0,
    width:  Math.max(0, w.value - 4),
    height: h.value,
    text:   props.object.label,
    fontSize,
    fontFamily: 'system-ui, sans-serif',
    fill: '#1a1a1a',
    align: 'center',
    verticalAlign: 'middle',
    ellipsis: true,
    wrap: 'none',
    listening: false,
  }
})

function onDragEnd(e) {
  emit('dragend', {
    id: props.object.id,
    x: e.target.x() / props.ppm,
    y: e.target.y() / props.ppm,
  })
}

function onTransformEnd(e) {
  const node = e.target
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  node.scaleX(1)
  node.scaleY(1)
  emit('transformend', {
    id:       props.object.id,
    x:        node.x() / props.ppm,
    y:        node.y() / props.ppm,
    width:    Math.max(0.2, (node.width()  * scaleX) / props.ppm),
    height:   Math.max(0.2, (node.height() * scaleY) / props.ppm),
    rotation: node.rotation(),
  })
}
</script>

<template>
  <v-group
    :config="groupConfig"
    @click="$emit('select')"
    @tap="$emit('select')"
    @dragend="onDragEnd"
    @transformend="onTransformEnd"
  >
    <v-rect :config="shapeConfig" />
    <v-text :config="textConfig" />
  </v-group>
</template>
