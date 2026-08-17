<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore }     from '@/stores/uiStore'
import { COLOR_PRESETS }  from '@/constants/colorPresets'
import { getTexture, TEXTURE_KEYS } from '@/utils/textures'

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
const local = ref({ name: '', color: '', notes: '', width: 0, height: 0, fontSize: 1 })

watch(shape, (s) => {
  if (s) local.value = { ...local.value, name: s.name, color: s.color, notes: s.notes }
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

// Ohraničující obdélník (bounding box) tvaru — pro editaci rozměrů
const bbox = computed(() => {
  if (!shape.value) return { minX: 0, minY: 0, width: 0, height: 0 }
  const pts = shape.value.points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]);   maxX = Math.max(maxX, pts[i])
    minY = Math.min(minY, pts[i+1]); maxY = Math.max(maxY, pts[i+1])
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
})

watch(bbox, (b) => {
  local.value.width  = Math.round(b.width  * 100) / 100
  local.value.height = Math.round(b.height * 100) / 100
}, { immediate: true })

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
</script>

<template>
  <!-- Objekt vybrán -->
  <aside v-if="shape" class="w-56 flex-shrink-0 bg-white border-l border-garden-100 flex flex-col overflow-hidden text-xs">
    <div class="px-3 py-2 bg-garden-700 text-white font-semibold flex items-center gap-2">
      <span class="w-3 h-3 rounded-sm flex-shrink-0" :style="{ backgroundColor: shape.color }" />
      <span class="truncate">{{ shape.name || 'Bez názvu' }}</span>
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

      <!-- Poznámky -->
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

  <!-- Nic nevybráno -->
  <aside v-else class="w-56 flex-shrink-0 bg-white border-l border-garden-100 flex items-center justify-center">
    <div class="text-center text-garden-400 text-xs px-4">
      <div class="text-2xl mb-2">👆</div>
      Vyber objekt<br/>pro úpravu
    </div>
  </aside>
</template>
