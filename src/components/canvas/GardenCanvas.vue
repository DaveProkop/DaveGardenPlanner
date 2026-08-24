<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore }     from '@/stores/uiStore'
import { ellipsePoints, bboxOf } from '@/utils/shapes'
import { snapValue }      from '@/utils/grid'
import { pickNiceStep, pickFittingStep } from '@/utils/scale'
import { usePlotDistance } from '@/composables/usePlotDistance'
import GardenObject    from './GardenObject.vue'
import VertexHandles   from './VertexHandles.vue'
import TextHandles     from './TextHandles.vue'
import EllipseHandles  from './EllipseHandles.vue'
import RulerBar         from './RulerBar.vue'

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
const stageDragging = ref(false) // aktivní tažení SAMOTNÉ stage (pan) — pro kurzor "grabbing"

// Prostřední tlačítko myši smí posouvat plátno VŽDY, bez ohledu na aktivní
// nástroj (řeší, že v kreslicích nástrojích/při definici hranice pozemku
// není prázdné plátno jinak tažením dostupné k posunu) — levé tlačítko jen
// ve Výběru/Přesunu, nebo kdekoliv při podrženém mezerníku. `Konva.dragButtons`
// je globální nastavení knihovny přesně pro tenhle účel (které tlačítko smí
// zahájit tažení draggable uzlu). Musí se sahat na `window.Konva` (ne na
// vlastní `import Konva from 'konva'`) — v tomto Vite dev prostředí je ES
// import samostatná kopie modulu, jejíž mutace se nikam nepropíše; `window.Konva`
// je prokazatelně ten samý singleton, který interně používá běžící Stage
// (ověřeno přes `window.Konva.stages[0]`, viz i testovací poznámky v PROJECT.md).
watch(
  () => uiStore.activeTool === 'select' || uiStore.activeTool === 'move' || spacePressed.value,
  (leftCanPan) => { window.Konva.dragButtons = leftCanPan ? [0, 1] : [1] },
  { immediate: true },
)

// --- Stage config ---
const stageConfig = computed(() => ({
  width:     containerW.value,
  height:    containerH.value,
  // Vždy draggable — které tlačítko tažení skutečně smí zahájit, řídí
  // Konva.dragButtons výše (jinak by prostřední tlačítko nemělo co posouvat).
  draggable: true,
}))

function onStageDragMove(e) {
  // Konva "dragmove" bublá i z vnořených tažených uzlů (vrchol, celý objekt) —
  // zajímá nás jen tažení samotné stage (pan plátna), jinak by se stagePos
  // přepsal lokálními souřadnicemi taženého tvaru/vrcholu a mřížka by "uletěla".
  const stage = stageRef.value?.getStage()
  if (!stage || e.target !== stage) return
  stagePos.value = { x: stage.x(), y: stage.y() }
}

// Kurzor "grabbing" jen během skutečného tažení SAMOTNÉ stage (pan) — stejná
// bublavá past jako u onStageDragMove výše (e.target může být vnořený uzel).
function onStageDragStart(e) {
  const stage = stageRef.value?.getStage()
  if (stage && e.target === stage) stageDragging.value = true
}
function onStageDragEnd(e) {
  const stage = stageRef.value?.getStage()
  if (stage && e.target === stage) stageDragging.value = false
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

// --- Hranice pozemku (vykreslení) ---
const plotLineConfig = computed(() => {
  if (!gardenStore.plot) return null
  return {
    points:      gardenStore.plot.points.map(v => v * PPM),
    stroke:      '#2B4A22',
    strokeWidth: 3,
    dash:        [10, 6],
    closed:      true,
    listening:   false,
  }
})

const plotLabelConfig = computed(() => {
  if (!gardenStore.plot) return null
  const b = bboxOf(gardenStore.plot.points)
  return {
    x: b.minX * PPM + 4,
    y: b.minY * PPM - 18,
    text: 'Hranice pozemku',
    fontSize: 12,
    fontStyle: 'bold',
    fill: '#2B4A22',
    listening: false,
  }
})

// --- Pravítka nahoře/vlevo (pinnutá k okraji viewportu, mimo Konva stage) ---
// Krok se vybírá stejnou "hezkou" řadou hodnot jako spodní měřítko (scaleBar),
// jen s opačnou podmínkou — nejjemnější dělení, které je ještě čitelné (>=50px).
function _rulerTicks(v0, v1, pxPerMeter, offset) {
  const step = pickNiceStep(pxPerMeter, 50)
  const start = Math.floor(v0/step)*step, end = Math.ceil(v1/step)*step
  const eps = step/1000
  const ticks = []
  for (let v = start; v <= end + eps; v += step) {
    ticks.push({ pos: v*pxPerMeter + offset, label: `${Math.round(v*100)/100}m` })
  }
  return ticks
}
const rulerTicksX = computed(() => {
  const { x0, x1 } = viewBounds.value
  return _rulerTicks(x0, x1, PPM * zoomScale.value, stagePos.value.x)
})
const rulerTicksY = computed(() => {
  const { y0, y1 } = viewBounds.value
  return _rulerTicks(y0, y1, PPM * zoomScale.value, stagePos.value.y)
})

// --- Drawing state ---
const isDrawing      = ref(false)
const drawPoints     = ref([])          // flat [x1,y1,...] v metrech (polygon)
const dragStart      = ref(null)        // { x, y } v metrech (obdélník i kruh/elipsa — tažením bbox)
const cursorPos      = ref({ x:0, y:0 }) // v metrech, pro preview

// --- Marquee (rámečkový) výběr víc objektů — vlastní nástroj 'marquee'.
const isMarqueeSelecting = ref(false)
const marqueeStart        = ref(null)   // { x, y } v metrech

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
  // Jen levé tlačítko kreslí/vybírá/vytváří rámeček — prostřední řeší posun
  // plátna nativně přes Konva.dragButtons (viz výše), pravé necháno prohlížeči.
  // `button` u dotykových/syntetických eventů bývá `undefined` — to musí projít.
  if (e.evt.button != null && e.evt.button !== 0) return
  if (spacePressed.value) return // posun plátna má přednost před kreslením
  const tool = uiStore.activeTool

  // Nástroj Výběr rámečkem: tažení KDEKOLI (i nad objektem) kreslí výběrový
  // rámeček — klik bez tažení projde dál na GardenObject/@select díky
  // malému prahu v onMouseup, viz tam.
  if (tool === 'marquee') {
    marqueeStart.value    = getMeterPos()
    isMarqueeSelecting.value = true
    return
  }

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
  if (isMarqueeSelecting.value) {
    const { x, y } = getMeterPos()
    const { x: sx, y: sy } = marqueeStart.value
    const x0 = Math.min(sx,x), y0 = Math.min(sy,y)
    const x1 = Math.max(sx,x), y1 = Math.max(sy,y)
    isMarqueeSelecting.value = false
    marqueeStart.value       = null
    // Malý práh proti tomu, aby obyčejný klik (bez tažení) omylem vybral
    // objekt, jehož bbox náhodou leží přesně pod kurzorem.
    if (x1-x0 > 0.15 || y1-y0 > 0.15) {
      const ids = gardenStore.shapes
        .filter(s => {
          const b = bboxOf(s.points)
          return b.minX <= x1 && b.maxX >= x0 && b.minY <= y1 && b.maxY >= y0
        })
        .map(s => s.id)
      uiStore.selectMultiple(ids)
      // Konva po pointerup na stejném cíli sám vystřelí "click" — bez tohle
      // by onStageClick nově vybraný rámeček hned zase odselectoval.
      suppressNextClick = true
    }
    return
  }

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
    // Pozn.: hranice pozemku se dnes kreslí jen nástrojem Polygon (viz uiStore.startPlotDrawing),
    // takže drawTarget==='plot' tady nikdy nenastane — rect/circle větev je vždy běžný addShape.
    const id = gardenStore.addShape(points, _nextName(), uiStore.activeColor, uiStore.activeTexture, tool === 'circle' ? 'ellipse' : null, uiStore.activePresetId)
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
  const tool = uiStore.activeTool
  if ((tool === 'select' || tool === 'move' || tool === 'marquee') && isBackground(e.target)) {
    uiStore.deselect()
  }
}

// Klik na objekt v nástroji Výběr/Přesun/Výběr rámečkem — shift/ctrl+klik
// přidá/odebere objekt z výběru místo jeho nahrazení (multi-select), viz
// uiStore.selectObject.
function onObjectSelect(id, e) {
  const additive = !!(e?.evt?.shiftKey || e?.evt?.ctrlKey || e?.evt?.metaKey)
  uiStore.selectObject(id, { additive })
}

function _commitPolygon() {
  if (uiStore.drawTarget === 'plot') {
    gardenStore.setPlot([...drawPoints.value])
    uiStore.setTool('select')
  } else {
    const id = gardenStore.addShape([...drawPoints.value], _nextName(), uiStore.activeColor, uiStore.activeTexture, null, uiStore.activePresetId)
    uiStore.selectObject(id, { focusName: true })
    if (!uiStore.activePresetId) uiStore.setTool('select')
  }
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

// Preview pro rámeček multi-výběru (nástroj Přesun, tažení po prázdném plátně)
const marqueePreviewConfig = computed(() => {
  if (!isMarqueeSelecting.value || !marqueeStart.value) return null
  const { x: sx, y: sy } = marqueeStart.value
  const { x: cx, y: cy } = cursorPos.value
  return {
    x:      Math.min(sx,cx) * PPM,
    y:      Math.min(sy,cy) * PPM,
    width:  Math.abs(cx-sx) * PPM,
    height: Math.abs(cy-sy) * PPM,
    fill:   'rgba(59,130,246,0.12)',
    stroke: '#3B82F6',
    strokeWidth: 1,
    dash:        [4, 3],
    listening:   false,
  }
})

// Kurzor CSS
const cursorStyle = computed(() => ({
  cursor: stageDragging.value
    ? 'grabbing'
    : spacePressed.value
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

// --- Pinch-to-zoom / dvouprstý pan (mobil) ---
// Pointer eventy (výše) dávají vždy jen jeden pointer, pro víceprsté gesto
// potřebujeme raw touch eventy s přístupem k e.evt.touches (standardní Konva
// multi-touch recept). Souřadnice doteků jsou vůči viewportu (clientX/Y), ale
// stage.x()/y() jsou vůči kontejneru plátna — musí se přepočítat přes
// getBoundingClientRect(), jinak by pinch mimo canvas v (0,0) viewportu driftoval.
let pinchLastDist   = 0
let pinchLastCenter = null

function _touchStagePos(touch, stage) {
  const rect = stage.container().getBoundingClientRect()
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
}
function _touchDistance(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y) }
function _touchCenter(p1, p2)   { return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } }

function onTouchStart(e) {
  if (e.evt.touches.length < 2) return
  const stage = stageRef.value.getStage()
  if (stage.isDragging()) stage.stopDrag()
  // Rozkreslený obdélník/kruh druhým prstem zrušit — polygon nechat být
  // (jeho vrcholy se přidávají jednotlivě přes pointerdown, ne tažením).
  if (isDrawing.value && (uiStore.activeTool === 'rect' || uiStore.activeTool === 'circle')) {
    isDrawing.value = false
    dragStart.value = null
  }
}

function onTouchMove(e) {
  const touches = e.evt.touches
  if (touches.length !== 2) return
  e.evt.preventDefault()
  const stage = stageRef.value.getStage()
  const p1 = _touchStagePos(touches[0], stage)
  const p2 = _touchStagePos(touches[1], stage)
  const center = _touchCenter(p1, p2)
  const dist   = _touchDistance(p1, p2)

  if (!pinchLastCenter) { pinchLastCenter = center; pinchLastDist = dist; return }

  const oldScale = stage.scaleX()
  const pointTo  = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale }
  const newScale = Math.min(Math.max(oldScale * (dist / pinchLastDist), 0.08), 10)

  const dx = center.x - pinchLastCenter.x
  const dy = center.y - pinchLastCenter.y
  const newPos = {
    x: center.x - pointTo.x * newScale + dx,
    y: center.y - pointTo.y * newScale + dy,
  }

  stage.scale({ x: newScale, y: newScale })
  stage.position(newPos)
  stage.batchDraw()
  zoomScale.value = newScale
  stagePos.value  = newPos

  pinchLastDist   = dist
  pinchLastCenter = center
}

function onTouchEnd(e) {
  if (e.evt.touches.length < 2) { pinchLastDist = 0; pinchLastCenter = null }
}

// Měřítko dole — vybere "hezkou" hodnotu v metrech, jejíž pruh se vejde do max. šířky
// (stejná řada kroků SCALE_STEPS jako pravítko nahoře/vlevo, ať oboje ladí)
const SCALE_MAX_PX = 120
const scaleBar = computed(() => {
  const pxPerMeter = PPM * zoomScale.value
  const meters = pickFittingStep(pxPerMeter, SCALE_MAX_PX)
  return { meters, px: meters * pxPerMeter }
})

// --- Vzdálenost vybraného tvaru od hranice pozemku ---
// Pro libovolný vybraný objekt (dřív jen strom/keř/záhon) — zapíná/vypíná se
// přepínačem uiStore.showPlotDistance (AppToolbar). Zobrazuje se jak na
// plátně (tady), tak v pravém panelu (PropertyEditor), obojí čte stejný
// composable, aby čísla vždy seděla.
const selectedPlotDistance = usePlotDistance(
  selectedShape,
  computed(() => gardenStore.plot),
  computed(() => uiStore.dragDelta),
)

// Čtyři vodicí úsečky (nahoru/dolů/doleva/doprava) od bounding boxu vybraného
// tvaru ke KAŽDÉ hraně pozemku, + popisky. Živé i během tažení, protože
// selectedPlotDistance čte uiStore.dragDelta.
function _plotGuide(value, x1, y1, x2, y2, vertical) {
  const color = value < 0 ? '#DC2626' : '#FF6B35'
  const midX  = (x1 + x2) / 2, midY = (y1 + y2) / 2
  return {
    line: { points: [x1*PPM, y1*PPM, x2*PPM, y2*PPM], stroke: color, strokeWidth: 1.5, dash: [5, 4], listening: false },
    label: {
      x: midX*PPM + (vertical ? 6 : 0), y: midY*PPM - (vertical ? 0 : 14),
      text: `${value.toFixed(2)} m`, fontSize: 11, fontStyle: 'bold',
      fill: color, stroke: '#fff', strokeWidth: 3, fillAfterStrokeEnabled: true, listening: false,
    },
  }
}

const plotDistanceOverlay = computed(() => {
  if (!uiStore.showPlotDistance) return null
  const shape = selectedShape.value
  if (!shape || !gardenStore.plot) return null
  const b = selectedPlotDistance.liveBbox.value
  const dist = selectedPlotDistance.distance.value
  if (!b || !dist) return null
  const plotB = bboxOf(gardenStore.plot.points)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2

  return {
    top:    _plotGuide(dist.top,    cx, b.minY, cx, plotB.minY, true),
    bottom: _plotGuide(dist.bottom, cx, b.maxY, cx, plotB.maxY, true),
    left:   _plotGuide(dist.left,   b.minX, cy, plotB.minX, cy, false),
    right:  _plotGuide(dist.right,  b.maxX, cy, plotB.maxX, cy, false),
  }
})

// --- Object drag ---
// Live delta jen čteme z Konva a ukládáme do uiStore (pro vodicí čáry k
// hranici pozemku), nikdy nezapisujeme zpět do store shapes — to se stane
// až v onObjectDragend, stejně jako dřív.
//
// Táhne-li se objekt, který je součástí aktuálního multi-výběru, musí se
// OSTATNÍ vybrané objekty vizuálně hýbat se stejným delta hned během tažení
// (groupDragPreview) — jinak to na plátně vypadá, že se hýbe jen jeden.
// Bezpečné jen proto, že se zapisuje do configu JINÝCH uzlů, ne toho, co
// Konva zrovna aktivně táhne (viz previewOffset v GardenObject.vue a starší
// poučení v PROJECT.md o rozbití Konva DnD echem vlastní pozice).
const groupDragPreview = ref(null) // { leaderId, dx, dy } | null

function onObjectDragMove(payload) {
  uiStore.setDragDelta(payload)
  if (uiStore.selectedIds.length > 1 && uiStore.selectedIds.includes(payload.id)) {
    groupDragPreview.value = { leaderId: payload.id, dx: payload.dx, dy: payload.dy }
  }
}
function onObjectDragend({ id, dx, dy }) {
  // Táhne-li se objekt, který je součástí aktuálního multi-výběru, posunout
  // o stejné delta všechny vybrané (skupinový přesun) — jinak jen tento jeden.
  const ids = uiStore.selectedIds.includes(id) ? uiStore.selectedIds : [id]
  if (ids.length > 1) gardenStore.moveShapes(ids, dx, dy)
  else gardenStore.moveShape(id, dx, dy)
  uiStore.clearDragDelta()
  groupDragPreview.value = null
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
  if ((e.key === 'Delete' || e.key === 'Backspace') && uiStore.selectedIds.length) {
    gardenStore.removeShapes(uiStore.selectedIds); uiStore.deselect()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && uiStore.selectedIds.length) {
    e.preventDefault()
    uiStore.copySelection(uiStore.selectedIds.map(id => gardenStore.getShape(id)).filter(Boolean))
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v' && uiStore.clipboard) {
    e.preventDefault()
    const ids = gardenStore.pasteShapes(uiStore.clipboard)
    uiStore.selectMultiple(ids)
    // Nástroj Přesun musí po vložení zůstat aktivní (ať jde rovnou vložený
    // objekt přetáhnout) — na Výběr se přepne jen když bylo aktivní kreslení.
    if (uiStore.activeTool !== 'move') uiStore.setTool('select')
  }
  if (e.key === 'Enter' && uiStore.activeTool === 'polygon' && isDrawing.value && drawPoints.value.length >= 6) {
    e.preventDefault(); _commitPolygon()
  }
  // Podržený mezerník = dočasný posun plátna, i uprostřed kreslení polygonu/obdélníku/kruhu
  if (e.code === 'Space' && !spacePressed.value) {
    e.preventDefault(); spacePressed.value = true
  }
  // Jemný posun vybraného tvaru šipkami. e.repeat se ignoruje záměrně — moveShape()
  // volá plný _snapshot() (JSON kopie + zápis do undo historie) při KAŽDÉM volání,
  // takže držení klávesy s OS auto-repeatem (~30-50ms) by historii během pár vteřin
  // zaplavilo. Efekt: jeden posun na jeden fyzický stisk (stejně jako Figma/Illustrator).
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && uiStore.selectedIds.length) {
    if (e.repeat) return
    e.preventDefault()
    const base = uiStore.snapToGrid ? uiStore.gridSize : 0.05
    const step = e.shiftKey ? base * 5 : base
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0
    gardenStore.moveShapes(uiStore.selectedIds, dx, dy)
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
  <div ref="containerRef" class="w-full h-full bg-garden-50 select-none touch-none" :style="cursorStyle">
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @wheel="onWheel"
      @pointerclick="onStageClick"
      @pointerdown="onMousedown"
      @pointerup="onMouseup"
      @pointermove="onMousemove"
      @pointerdblclick="onDblclick"
      @dragstart="onStageDragStart"
      @dragmove="onStageDragMove"
      @dragend="onStageDragEnd"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <!-- Grid (non-interactive) -->
      <v-layer :config="{ listening: false }">
        <template v-if="uiStore.showGrid">
          <v-line  v-for="(l,i) in gridLines"    :key="i"   :config="l" />
        </template>
      </v-layer>

      <!-- Hranice pozemku (non-interactive, jen zobrazení — úprava = smazat + překreslit) -->
      <v-layer :config="{ listening: false }">
        <v-line v-if="plotLineConfig" :config="plotLineConfig" />
        <v-text v-if="plotLabelConfig" :config="plotLabelConfig" />
      </v-layer>

      <!-- Shapes layer -->
      <v-layer>
        <template v-for="s in gardenStore.shapes" :key="s.id">
          <GardenObject
            :shape="s"
            :ppm="PPM"
            :selected="uiStore.selectedIds.includes(s.id)"
            :draggable="uiStore.activeTool === 'move'"
            :preview-font-size="textResizePreview && textResizePreview.id === s.id ? textResizePreview.fontSize : null"
            :preview-points="ellipseResizePreview && ellipseResizePreview.id === s.id ? ellipseResizePreview.points : null"
            :preview-offset="groupDragPreview && s.id !== groupDragPreview.leaderId && uiStore.selectedIds.includes(s.id) ? { dx: groupDragPreview.dx, dy: groupDragPreview.dy } : null"
            @select="(uiStore.activeTool === 'select' || uiStore.activeTool === 'move' || uiStore.activeTool === 'marquee') && onObjectSelect(s.id, $event)"
            @dragmove="onObjectDragMove"
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
        <!-- Vodicí čáry vzdálenosti vybraného objektu od hranice pozemku (nahoru/dolů/doleva/doprava) -->
        <template v-if="plotDistanceOverlay">
          <v-line :config="plotDistanceOverlay.top.line" />
          <v-text :config="plotDistanceOverlay.top.label" />
          <v-line :config="plotDistanceOverlay.bottom.line" />
          <v-text :config="plotDistanceOverlay.bottom.label" />
          <v-line :config="plotDistanceOverlay.left.line" />
          <v-text :config="plotDistanceOverlay.left.label" />
          <v-line :config="plotDistanceOverlay.right.line" />
          <v-text :config="plotDistanceOverlay.right.label" />
        </template>

        <!-- Rámeček multi-výběru -->
        <v-rect v-if="marqueePreviewConfig" :config="marqueePreviewConfig" />

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

    <!-- Pravítka pinnutá k okraji viewportu (nad obsahem plátna, jako ve Figmě) -->
    <template v-if="uiStore.showGrid">
      <RulerBar orientation="horizontal" :ticks="rulerTicksX" class="absolute top-0 left-0 right-0 h-6 z-10" />
      <RulerBar orientation="vertical"   :ticks="rulerTicksY" class="absolute top-0 left-0 bottom-0 w-6 z-10" />
      <div class="absolute top-0 left-0 w-6 h-6 bg-white/90 backdrop-blur-sm border-r border-b border-garden-200 z-20 pointer-events-none" />
    </template>

    <!-- Nápověda pro aktivní nástroj -->
    <div class="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none select-none">
      <div v-if="uiStore.activeTool === 'rect' && !isDrawing" class="hint-bubble">
        {{ uiStore.pendingLabel ? `${uiStore.pendingLabel}: klikni a táhni pro nakreslení` : 'Klikni a táhni pro nakreslení obdélníku' }}
      </div>
      <div v-else-if="(uiStore.activeTool === 'rect' || uiStore.activeTool === 'circle') && isDrawing" class="hint-bubble">
        Pusť myš pro dokončení · Mezerník nebo prostřední tlačítko myši = posun plátna
      </div>
      <div v-else-if="uiStore.drawTarget === 'plot' && !isDrawing" class="hint-bubble">
        Hranice pozemku: klikej pro přidání vrcholů · Enter nebo 2× klik pro uzavření · Mezerník nebo prostřední tlačítko myši = posun plátna
      </div>
      <div v-else-if="uiStore.drawTarget === 'plot' && isDrawing" class="hint-bubble">
        Hranice pozemku · {{ drawPoints.length / 2 }} vrcholů · Enter nebo 2× klik pro uzavření · Esc pro zrušení · Mezerník/prostřední tlačítko = posun
      </div>
      <div v-else-if="uiStore.activeTool === 'polygon' && !isDrawing" class="hint-bubble">
        {{ uiStore.pendingLabel ? `${uiStore.pendingLabel}: ` : '' }}Klikej pro přidání vrcholů · Enter nebo 2× klik pro uzavření
      </div>
      <div v-else-if="uiStore.activeTool === 'polygon' && isDrawing" class="hint-bubble">
        {{ drawPoints.length / 2 }} vrcholů · Enter nebo 2× klik pro uzavření · Esc pro zrušení · Mezerník/prostřední tlačítko = posun
      </div>
      <div v-else-if="uiStore.activeTool === 'circle' && !isDrawing" class="hint-bubble">
        {{ uiStore.pendingLabel ? `${uiStore.pendingLabel}: klikni a táhni pro nakreslení` : 'Klikni a táhni pro nakreslení kruhu/elipsy' }}
      </div>
      <div v-else-if="uiStore.activeTool === 'text'" class="hint-bubble">
        Klikni na plán pro umístění textu
      </div>
      <div v-else-if="uiStore.activeTool === 'marquee'" class="hint-bubble">
        Táhni pro výběr rámečkem · klik na objekt vybere jen jeho · Shift+klik = přidat/odebrat z výběru
      </div>
      <div v-else-if="uiStore.activeTool === 'move' && uiStore.selectedIds.length > 1" class="hint-bubble">
        {{ uiStore.selectedIds.length }} objektů vybráno · táhni kterýkoli pro společný přesun · Shift+klik = přidat/odebrat z výběru
      </div>
      <div v-else-if="uiStore.activeTool === 'move'" class="hint-bubble">
        Táhni objekt pro přesun · prázdné plátno = posun plátna · Shift+klik = přidat do výběru
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
