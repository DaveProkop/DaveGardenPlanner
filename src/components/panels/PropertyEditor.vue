<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore }     from '@/stores/uiStore'
import { COLOR_PRESETS }  from '@/constants/colorPresets'
import { getTexture, TEXTURE_KEYS } from '@/utils/textures'
import { bboxOf }         from '@/utils/shapes'
import { OBJECT_TYPES, CATEGORIES, PLOT_DISTANCE_TYPES } from '@/constants/objectTypes'
import { usePlotDistance } from '@/composables/usePlotDistance'

const TEXTURE_LABELS = {
  grass:   'Tráva',
  water:   'Voda',
  wood:    'Dřevo',
  brick:   'Cihla',
  stone:   'Kámen',
  foliage: 'Listoví',
  sand:    'Písek',
  glass:   'Sklo',
}

const gardenStore = useGardenStore()
const uiStore     = useUiStore()

const shape  = computed(() => gardenStore.getShape(uiStore.selectedId))
const nameEl = ref(null)

// Lokální kopie pro editaci
const local = ref({ name: '', color: '', notes: '', width: 0, height: 0, fontSize: 1, age: '', posX: 0, posY: 0 })

watch(shape, (s) => {
  if (s) local.value = { ...local.value, name: s.name, color: s.color, notes: s.notes, age: s.age ?? '' }
}, { immediate: true })

// Zvlášť sledovaná (fontSize se mění zvenčí, přes tažení úchytu v TextHandles —
// samotné `shape` je stále tentýž objekt, jen mutovaný, takže by výše uvedený
// watch na jeho referenci nezachytil; čtení `.fontSize` uvnitř computed ale
// založí jemnozrnnou reaktivní závislost přímo na této vlastnosti).
const fontSize = computed(() => shape.value?.fontSize ?? 1)
watch(fontSize, (fs) => { local.value.fontSize = fs }, { immediate: true })

// Auto-focus na název při novém objektu (ne při pouhém výběru existujícího —
// jinak by focus z canvasu ukradl i obyčejný klik a klávesové zkratky jako
// Ctrl+C/Ctrl+V by přestaly fungovat, protože by "psaní do pole" mělo přednost).
watch(() => uiStore.focusNameTick, () => {
  nextTick(() => nameEl.value?.focus())
})

function commit(field) {
  if (!shape.value) return
  gardenStore.updateShape({ id: shape.value.id, [field]: local.value[field] })
}

function commitColor(color) {
  local.value.color = color
  commit('color')
  uiStore.setColor(color)
}

function deleteShape() {
  if (!shape.value) return
  gardenStore.removeShape(shape.value.id)
  uiStore.deselect()
}

// Náhledy textur v aktuální barvě tvaru — přegenerují se při změně barvy
const texturePreviews = computed(() => {
  if (!shape.value) return []
  return TEXTURE_KEYS.map(key => ({
    key,
    label: TEXTURE_LABELS[key] || key,
    dataUrl: getTexture(local.value.color, key).toDataURL(),
  }))
})

function commitTexture(key) {
  if (!shape.value) return
  gardenStore.updateShape({ id: shape.value.id, texture: key })
}

// Ohraničující obdélník (bounding box) tvaru — pro editaci rozměrů i polohy
const bbox = computed(() => shape.value ? bboxOf(shape.value.points) : { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 })

watch(bbox, (b) => {
  local.value.width  = Math.round(b.width  * 100) / 100
  local.value.height = Math.round(b.height * 100) / 100
  local.value.posX   = Math.round(b.minX * 100) / 100
  local.value.posY   = Math.round(b.minY * 100) / 100
}, { immediate: true })

function commitAge() {
  if (!shape.value) return
  const age = local.value.age === '' || local.value.age == null ? null : Math.max(0, parseInt(local.value.age) || 0)
  local.value.age = age ?? ''
  gardenStore.updateShape({ id: shape.value.id, age })
}

// Ruční "otypování" — jediný způsob, jak dodatečně zpřístupnit pole Stáří a
// vzdálenost od hranice pozemku u tvarů nakreslených před touto funkcí (ty
// typeId nemají). Mění záměrně jen typeId, nikdy barvu/texturu/název.
function commitTypeId(typeId) {
  if (!shape.value) return
  gardenStore.updateShape({ id: shape.value.id, typeId: typeId || null })
}

function commitPosition() {
  if (!shape.value) return
  const b = bbox.value
  const newX = parseFloat(local.value.posX)
  const newY = parseFloat(local.value.posY)
  const dx = Number.isFinite(newX) ? newX - b.minX : 0
  const dy = Number.isFinite(newY) ? newY - b.minY : 0
  // Malý práh proti zaokrouhlovacímu šumu (local.posX/Y jsou zobrazené na 2
  // desetinná místa) — ať editace jen jednoho pole nezapíše nepatrný posun i do druhé osy.
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return
  gardenStore.moveShape(shape.value.id, dx, dy)
}

// --- Vzdálenost od hranice pozemku (jen tree/shrub/bed, jen když pozemek existuje) ---
const plotDistance = usePlotDistance(shape, computed(() => gardenStore.plot), computed(() => uiStore.dragDelta))
const showsPlotDistance = computed(() => shape.value && PLOT_DISTANCE_TYPES.includes(shape.value.typeId))

function commitSize() {
  if (!shape.value) return
  const b = bbox.value
  const newW = Math.max(0.1, parseFloat(local.value.width)  || 0.1)
  const newH = Math.max(0.1, parseFloat(local.value.height) || 0.1)
  const sx = b.width  > 0.001 ? newW / b.width  : 1
  const sy = b.height > 0.001 ? newH / b.height : 1
  const points = shape.value.points.map((v, i) =>
    i % 2 === 0 ? b.minX + (v - b.minX) * sx : b.minY + (v - b.minY) * sy
  )
  gardenStore.updateShape({ id: shape.value.id, points })
}

function commitFontSize() {
  if (!shape.value) return
  const fontSize = Math.max(0.1, parseFloat(local.value.fontSize) || 0.1)
  gardenStore.updateShape({ id: shape.value.id, fontSize })
}

// Počet vrcholů a plocha
const vertexCount = computed(() => shape.value ? shape.value.points.length / 2 : 0)

function polygonArea(points) {
  // Shoelace formula
  const n = points.length / 2
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i*2]   * points[j*2+1]
    area -= points[j*2]   * points[i*2+1]
  }
  return Math.abs(area / 2)
}

const area = computed(() => shape.value ? polygonArea(shape.value.points).toFixed(1) : '0')

// --- Seznam objektů (prázdný stav, když nic není vybráno) ---
// Tvary bez typeId (volně nakreslené, bez zvoleného presetu) padnou do vlastní
// skupiny "Vlastní tvary" — ne do skutečné katalogové kategorie "Ostatní", ať
// se to nepřehazuje s reálnými objekty typu kompostér/skleník/pískoviště.
const UNTYPED_GROUP = { id: '__untyped__', label: 'Vlastní tvary' }
const shapesByCategory = computed(() => {
  const byCategory = {}
  for (const s of gardenStore.shapes) {
    const type = s.typeId && OBJECT_TYPES[s.typeId]
    const catId = type ? type.category : UNTYPED_GROUP.id
    if (!byCategory[catId]) byCategory[catId] = []
    byCategory[catId].push(s)
  }
  const groups = []
  for (const catDef of Object.values(CATEGORIES)) {
    if (byCategory[catDef.id]?.length) groups.push({ def: catDef, items: byCategory[catDef.id] })
  }
  if (byCategory[UNTYPED_GROUP.id]?.length) groups.push({ def: UNTYPED_GROUP, items: byCategory[UNTYPED_GROUP.id] })
  return groups
})

function shapeIcon(s) {
  if (s.kind === 'text') return '✎'
  return OBJECT_TYPES[s.typeId]?.icon || '◆'
}
</script>

<template>
  <!-- Objekt vybrán -->
  <aside
    v-if="shape"
    class="fixed md:static inset-y-0 right-0 z-40 w-72 max-w-[85vw] md:w-56 md:max-w-none flex-shrink-0 bg-white border-l border-garden-100 flex flex-col overflow-hidden text-xs transform transition-transform duration-200 md:translate-x-0 shadow-xl md:shadow-none"
    :class="uiStore.mobilePanel === 'properties' ? 'translate-x-0' : 'translate-x-full'"
  >
    <div class="px-3 py-2 bg-garden-700 text-white font-semibold flex items-center gap-2">
      <span class="w-3 h-3 rounded-sm flex-shrink-0" :style="{ backgroundColor: shape.color }" />
      <span class="truncate flex-1 min-w-0">{{ shape.name || 'Bez názvu' }}</span>
      <button class="md:hidden px-2 py-0.5 rounded hover:bg-garden-600 flex-shrink-0" @click="uiStore.closeMobilePanel()">✕</button>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">

      <!-- Název (u textu zároveň zobrazovaný obsah) -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-1">{{ shape.kind === 'text' ? 'Text' : 'Název objektu' }}</span>
        <input
          ref="nameEl"
          v-model="local.name"
          type="text"
          :placeholder="shape.kind === 'text' ? 'Napiš text...' : 'Pojmenuj objekt...'"
          class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
          @blur="commit('name')"
          @keydown.enter="commit('name'); $event.target.blur()"
        />
      </label>

      <!-- Poznámky (hned pod názvem) -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-1">Poznámky</span>
        <textarea
          v-model="local.notes"
          rows="3"
          placeholder="Volitelné poznámky..."
          class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500 resize-none"
          @blur="commit('notes')"
        />
      </label>

      <!-- Typ objektu (dodatečně "otypuje" i tvary nakreslené bez presetu — odemkne Stáří a vzdálenost od pozemku) -->
      <label v-if="shape.kind !== 'text'" class="block">
        <span class="text-garden-700 font-medium block mb-1">Typ objektu</span>
        <select
          :value="shape.typeId || ''"
          class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500 bg-white"
          @change="commitTypeId($event.target.value)"
        >
          <option value="">— bez typu —</option>
          <option v-for="type in Object.values(OBJECT_TYPES)" :key="type.id" :value="type.id">{{ type.icon }} {{ type.label }}</option>
        </select>
      </label>

      <!-- Barva -->
      <div>
        <span class="text-garden-700 font-medium block mb-1">Barva</span>
        <div class="grid grid-cols-4 gap-1 mb-2">
          <button
            v-for="p in COLOR_PRESETS"
            :key="p.color"
            :title="p.label"
            class="w-7 h-7 rounded border-2 transition-all hover:scale-110"
            :style="{ backgroundColor: p.color }"
            :class="local.color === p.color ? 'border-garden-700' : 'border-transparent'"
            @click="commitColor(p.color)"
          />
        </div>
        <label class="flex items-center gap-2">
          <input
            :value="local.color"
            type="color"
            class="w-7 h-7 rounded border border-garden-200 p-0.5 cursor-pointer flex-shrink-0"
            @change="commitColor($event.target.value)"
          />
          <span class="text-garden-500 font-mono">{{ local.color }}</span>
        </label>
      </div>

      <!-- Textura (netýká se volného textu) -->
      <div v-if="shape.kind !== 'text'">
        <span class="text-garden-700 font-medium block mb-1">Textura</span>
        <div class="grid grid-cols-5 gap-1">
          <button
            title="Bez textury"
            class="w-8 h-8 rounded border-2 transition-all hover:scale-110"
            :style="{ backgroundColor: local.color }"
            :class="!shape.texture ? 'border-garden-700 ring-1 ring-garden-400' : 'border-transparent'"
            @click="commitTexture(null)"
          />
          <button
            v-for="t in texturePreviews"
            :key="t.key"
            :title="t.label"
            class="w-8 h-8 rounded border-2 bg-cover transition-all hover:scale-110"
            :style="{ backgroundImage: `url(${t.dataUrl})` }"
            :class="shape.texture === t.key ? 'border-garden-700 ring-1 ring-garden-400' : 'border-transparent'"
            @click="commitTexture(t.key)"
          />
        </div>
      </div>

      <!-- Rozměry (obdélníkové/polygonové tvary) -->
      <div v-if="shape.kind !== 'text'">
        <span class="text-garden-700 font-medium block mb-1">Rozměry (m)</span>
        <div class="flex items-center gap-2">
          <label class="flex-1">
            <span class="text-garden-500 block mb-0.5">Šířka</span>
            <input
              v-model="local.width"
              type="number"
              min="0.1"
              step="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
              @blur="commitSize"
              @keydown.enter="commitSize(); $event.target.blur()"
            />
          </label>
          <span class="text-garden-400 mt-4">×</span>
          <label class="flex-1">
            <span class="text-garden-500 block mb-0.5">Výška</span>
            <input
              v-model="local.height"
              type="number"
              min="0.1"
              step="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
              @blur="commitSize"
              @keydown.enter="commitSize(); $event.target.blur()"
            />
          </label>
        </div>
      </div>

      <!-- Velikost textu (jen volný text) -->
      <label v-else class="block">
        <span class="text-garden-700 font-medium block mb-1">Velikost textu (m)</span>
        <input
          v-model="local.fontSize"
          type="number"
          min="0.1"
          step="0.1"
          class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
          @blur="commitFontSize"
          @keydown.enter="commitFontSize(); $event.target.blur()"
        />
        <span class="text-garden-400 block mt-1">Nebo táhni oranžový úchyt vedle textu na plátně.</span>
      </label>

      <!-- Stáří (jen strom/keř) -->
      <label v-if="shape.typeId === 'tree' || shape.typeId === 'shrub'" class="block">
        <span class="text-garden-700 font-medium block mb-1">Stáří (roky)</span>
        <input
          v-model="local.age"
          type="number"
          min="0"
          step="1"
          placeholder="Nezadáno"
          class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
          @blur="commitAge"
          @keydown.enter="commitAge(); $event.target.blur()"
        />
      </label>

      <!-- Poloha (bod ukotvení / levý horní roh bounding boxu) -->
      <div>
        <span class="text-garden-700 font-medium block mb-1">Poloha (m)</span>
        <div class="flex items-center gap-2">
          <label class="flex-1">
            <span class="text-garden-500 block mb-0.5">X</span>
            <input
              v-model="local.posX"
              type="number"
              step="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
              @blur="commitPosition"
              @keydown.enter="commitPosition(); $event.target.blur()"
            />
          </label>
          <label class="flex-1">
            <span class="text-garden-500 block mb-0.5">Y</span>
            <input
              v-model="local.posY"
              type="number"
              step="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1.5 focus:outline-none focus:border-garden-500"
              @blur="commitPosition"
              @keydown.enter="commitPosition(); $event.target.blur()"
            />
          </label>
        </div>
        <span class="text-garden-400 block mt-1">Nebo táhni (nástroj Přesun) · šipky = jemný posun vybraného objektu</span>
      </div>

      <!-- Vzdálenost od hranice pozemku (jen strom/keř/záhon) -->
      <div v-if="showsPlotDistance" class="bg-garden-50 rounded p-2 space-y-0.5 text-garden-600">
        <div class="font-medium text-garden-700 mb-1">Vzdálenost od hranice pozemku</div>
        <template v-if="plotDistance.nearest.value">
          <div :class="plotDistance.nearest.value.x.dist < 0 ? 'text-red-600 font-medium' : ''">
            Osa X: {{ plotDistance.nearest.value.x.dist.toFixed(2) }} m od {{ plotDistance.nearest.value.x.side }} hrany
          </div>
          <div :class="plotDistance.nearest.value.y.dist < 0 ? 'text-red-600 font-medium' : ''">
            Osa Y: {{ plotDistance.nearest.value.y.dist.toFixed(2) }} m od {{ plotDistance.nearest.value.y.side }} hrany
          </div>
        </template>
        <div v-else class="text-garden-400">Nastav hranici pozemku (vlevo) pro zobrazení vzdálenosti k okraji.</div>
      </div>

      <!-- Geometrie (read-only info, netýká se volného textu) -->
      <div v-if="shape.kind !== 'text'" class="bg-garden-50 rounded p-2 space-y-0.5 text-garden-600">
        <div class="font-medium text-garden-700 mb-1">Geometrie</div>
        <div>Vrcholů: {{ vertexCount }}</div>
        <div>Plocha: ~{{ area }} m²</div>
        <div class="text-garden-400 mt-1">
          <template v-if="shape.kind === 'ellipse'">Táhni bílé úchyty pro protažení do šířky/výšky</template>
          <template v-else>Táhni vrcholy · dvojklik na vrchol = smazat · tečkovaný úchyt uprostřed hrany = přidat vrchol</template>
        </div>
      </div>
    </div>

    <div class="px-3 py-2 border-t border-garden-100">
      <button
        class="w-full py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors"
        @click="deleteShape"
      >
        Smazat objekt
      </button>
    </div>
  </aside>

  <!-- Nic nevybráno: seznam umístěných objektů, nebo prázdný stav -->
  <aside
    v-else
    class="fixed md:static inset-y-0 right-0 z-40 w-72 max-w-[85vw] md:w-56 md:max-w-none flex-shrink-0 bg-white border-l border-garden-100 flex flex-col overflow-hidden text-xs transform transition-transform duration-200 md:translate-x-0 shadow-xl md:shadow-none"
    :class="uiStore.mobilePanel === 'properties' ? 'translate-x-0' : 'translate-x-full'"
  >
    <template v-if="gardenStore.shapes.length">
      <div class="px-3 py-2 bg-garden-700 text-white font-semibold uppercase tracking-wide flex items-center justify-between">
        Objekty na plánu
        <button class="md:hidden px-2 py-0.5 rounded hover:bg-garden-600" @click="uiStore.closeMobilePanel()">✕</button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <template v-for="group in shapesByCategory" :key="group.def.id">
          <div class="px-3 py-1.5 bg-garden-50 text-garden-700 font-semibold border-b border-garden-100">{{ group.def.label }}</div>
          <button
            v-for="s in group.items"
            :key="s.id"
            class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-garden-50 active:bg-garden-100 transition-colors border-b border-garden-50"
            @click="uiStore.selectObject(s.id)"
          >
            <span class="text-sm leading-none flex-shrink-0">{{ shapeIcon(s) }}</span>
            <span class="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" :style="{ backgroundColor: s.color }" />
            <span class="flex-1 min-w-0">
              <span class="block truncate text-garden-800">{{ s.name || 'Bez názvu' }}</span>
              <span v-if="s.age" class="block text-[10px] text-garden-400">{{ s.age }} let</span>
            </span>
          </button>
        </template>
      </div>
    </template>
    <div v-else class="flex-1 flex flex-col">
      <div class="md:hidden flex items-center justify-end px-3 py-2 border-b border-garden-100">
        <button class="px-2 py-0.5 rounded hover:bg-garden-50 text-garden-500" @click="uiStore.closeMobilePanel()">✕ Zavřít</button>
      </div>
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center text-garden-400 text-xs px-4">
          <div class="text-2xl mb-2">👆</div>
          Zatím žádné objekty<br/>nakresli první vlevo
        </div>
      </div>
    </div>
  </aside>
</template>
