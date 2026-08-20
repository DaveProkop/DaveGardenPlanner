<script setup>
import { computed } from 'vue'
import { ellipsePoints } from '@/utils/shapes'

const props = defineProps({
  shape: { type: Object, required: true },
  ppm:   { type: Number, required: true },
})

const emit = defineEmits(['resize', 'resizeend'])

const MIN_RADIUS = 0.1

// Střed a poloosy odvozené z bounding boxu bodů — ellipsePoints je generuje
// rovnoměrně po obvodu, takže min/max x,y dají přesně střed i rx/ry.
const geo = computed(() => {
  const pts = props.shape.points
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]);   maxX = Math.max(maxX, pts[i])
    minY = Math.min(minY, pts[i+1]); maxY = Math.max(maxY, pts[i+1])
  }
  return { cx: (minX+maxX)/2, cy: (minY+maxY)/2, rx: (maxX-minX)/2, ry: (maxY-minY)/2 }
})

const pointCount = computed(() => props.shape.points.length / 2)

// Čtyři úchyty na krajích poloos — tažením vodorovných se mění jen šířka
// (rx), svislých jen výška (ry), takže tvar zůstane vždy elipsou/kruhem.
const handleDefs = computed(() => {
  const { cx, cy, rx, ry } = geo.value
  return [
    { axis: 'x', x: (cx + rx) * props.ppm, y: cy * props.ppm },
    { axis: 'x', x: (cx - rx) * props.ppm, y: cy * props.ppm },
    { axis: 'y', x: cx * props.ppm, y: (cy + ry) * props.ppm },
    { axis: 'y', x: cx * props.ppm, y: (cy - ry) * props.ppm },
  ]
})

// Úchyt smí jet jen po své ose (vodorovné jen doleva/doprava, svislé jen
// nahoru/dolů) — druhá souřadnice zůstává zamčená na středu elipsy po celou
// dobu tažení (geo se nemění, dokud se výsledek nezapíše do store).
function makeDragBoundFunc(h) {
  const { cx, cy } = geo.value
  return function (pos) {
    const stage = this.getStage()
    const scale = stage.scaleX()
    if (h.axis === 'x') return { x: pos.x, y: stage.y() + cy * props.ppm * scale }
    return { x: stage.x() + cx * props.ppm * scale, y: pos.y }
  }
}

function handleConfig(h) {
  return {
    x: h.x, y: h.y,
    radius:      6,
    fill:        '#FFFFFF',
    stroke:      '#FF6B35',
    strokeWidth: 2,
    draggable:   true,
    hitStrokeWidth: 16,
    dragBoundFunc: makeDragBoundFunc(h),
  }
}

function computeResizedPoints(h, e) {
  const { cx, cy, rx, ry } = geo.value
  const px = e.target.x() / props.ppm
  const py = e.target.y() / props.ppm
  const newRx = h.axis === 'x' ? Math.max(MIN_RADIUS, Math.abs(px - cx)) : rx
  const newRy = h.axis === 'y' ? Math.max(MIN_RADIUS, Math.abs(py - cy)) : ry
  return ellipsePoints(cx, cy, newRx, newRy, pointCount.value)
}

function onDragMove(h, e) { emit('resize',    { id: props.shape.id, points: computeResizedPoints(h, e) }) }
function onDragEnd(h, e)  { emit('resizeend', { id: props.shape.id, points: computeResizedPoints(h, e) }) }
</script>

<template>
  <v-circle
    v-for="(h, i) in handleDefs"
    :key="i"
    :config="handleConfig(h)"
    @dragmove="(e) => onDragMove(h, e)"
    @dragend="(e) => onDragEnd(h, e)"
  />
</template>
