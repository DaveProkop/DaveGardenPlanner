<script setup>
import { computed } from 'vue'
import { getTexture } from '@/utils/textures'
import { useUiStore } from '@/stores/uiStore'
import { snapStagePos } from '@/utils/grid'

const props = defineProps({
  shape:            { type: Object,  required: true },
  ppm:              { type: Number,  required: true },
  selected:         { type: Boolean, default: false },
  draggable:        { type: Boolean, default: true },
  // Živá velikost fontu během tažení úchytu v TextHandles (viz GardenCanvas) —
  // dokud se netáhne, je null a použije se natrvalo uložená shape.fontSize.
  previewFontSize:  { type: Number,  default: null },
  // Živé body během tažení úchytu v EllipseHandles — dokud se netáhne, je
  // null a použijí se natrvalo uložené shape.points.
  previewPoints:    { type: Array,   default: null },
  // Živý posun { dx, dy } v metrech pro OSTATNÍ členy skupinového výběru,
  // zatímco jeden z nich (jiný uzel) právě táhne uživatel — viz GardenCanvas
  // groupDragPreview. Na rozdíl od previewPoints se nikdy neaplikuje na uzel,
  // který Konva zrovna sama táhne (ten by se rozbil, viz poučení v PROJECT.md).
  previewOffset:    { type: Object,   default: null },
})

const emit = defineEmits(['select', 'dragmove', 'dragend'])

const uiStore = useUiStore()

// Přichytí tažení celého objektu k mřížce (posun se zaokrouhlí na násobek
// rozestupu mřížky) — `this` uvnitř je Konva uzel, viz jeho volání přes .call().
function dragBoundFunc(pos) {
  return uiStore.snapToGrid ? snapStagePos(pos, this.getStage(), props.ppm, uiStore.gridSize) : pos
}

// Efektivní body tvaru — přednost má náhled tvarování (previewPoints, resize
// úchyty), jinak živý posun skupinového tažení (previewOffset), jinak reálná
// uložená data.
const effectivePoints = computed(() => {
  if (props.previewPoints) return props.previewPoints
  if (props.previewOffset) {
    const { dx, dy } = props.previewOffset
    return props.shape.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy)
  }
  return props.shape.points
})

// Konva body polygonu v pixelech
const lineConfig = computed(() => {
  const base = {
    id:          props.shape.id,
    points:      effectivePoints.value.map(v => v * props.ppm),
    stroke:      props.selected ? '#FF6B35' : 'rgba(0,0,0,0.22)',
    strokeWidth: props.selected ? 2.5 : 1,
    closed:      true,
    opacity:     0.92,
    draggable:   props.draggable,
    dragBoundFunc,
    shadowColor:   props.selected ? '#FF6B35' : 'transparent',
    shadowBlur:    props.selected ? 8 : 0,
    shadowOpacity: 0.35,
  }
  const pattern = props.shape.texture ? getTexture(props.shape.color, props.shape.texture) : null
  return pattern
    ? { ...base, fillPatternImage: pattern, fillPatternRepeat: 'repeat' }
    : { ...base, fill: props.shape.color }
})

// Volný text (nástroj Text) — jediný ukotvující bod, žádná plocha/výplň.
// Jméno objektu je zároveň zobrazovaný text (na rozdíl od ostatních tvarů,
// kde se název na plátně nezobrazuje).
const textConfig = computed(() => ({
  id:          props.shape.id,
  x:           effectivePoints.value[0] * props.ppm,
  y:           effectivePoints.value[1] * props.ppm,
  text:        props.shape.name || 'Text',
  fontSize:    (props.previewFontSize ?? props.shape.fontSize ?? 1) * props.ppm,
  fontFamily:  'system-ui, sans-serif',
  fontStyle:   'bold',
  fill:        props.shape.color || '#2B4A22',
  draggable:   props.draggable,
  dragBoundFunc,
  shadowColor:   props.selected ? '#FF6B35' : 'transparent',
  shadowBlur:    props.selected ? 8 : 0,
  shadowOpacity: 0.6,
}))

// Během tažení jen ČTEME živou pozici uzlu a posíláme ji ven (pro náhled
// vzdálenosti k hranici pozemku) — nikdy ji nezapisujeme zpět do configu
// tohoto stejného uzlu, dokud ho Konva aktivně táhne (viz poučení v
// PROJECT.md: echo vlastní pozice zpátky do taženého uzlu potichu shodí drag).
function onDragMove(e) {
  const node = e.target
  emit('dragmove', { id: props.shape.id, dx: node.x() / props.ppm, dy: node.y() / props.ppm })
}

// Po přetažení tvaru: reset pozice uzlu na 0 a deleguj delta do store —
// funguje, protože v-line má body zapečené v `points` a uzel sám je vždy na (0,0).
function onDragEnd(e) {
  const node = e.target
  const dx = node.x() / props.ppm
  const dy = node.y() / props.ppm
  node.position({ x: 0, y: 0 })
  emit('dragend', { id: props.shape.id, dx, dy })
}

// Po přetažení textu: na rozdíl od v-line je pozice uzlu přímo absolutní
// (x/y = ukotvující bod), takže se nic neresetuje — reaktivní config se
// po zápisu do store sám překreslí na stejné místo, kde tažení skončilo.
function onTextDragEnd(e) {
  const node = e.target
  const dx = node.x() / props.ppm - props.shape.points[0]
  const dy = node.y() / props.ppm - props.shape.points[1]
  emit('dragend', { id: props.shape.id, dx, dy })
}
</script>

<template>
  <v-text
    v-if="shape.kind === 'text'"
    :config="textConfig"
    @click="$emit('select', $event)"
    @tap="$emit('select', $event)"
    @dragend="onTextDragEnd"
  />
  <v-line
    v-else
    :config="lineConfig"
    @click="$emit('select', $event)"
    @tap="$emit('select', $event)"
    @dragmove="onDragMove"
    @dragend="onDragEnd"
  />
</template>
