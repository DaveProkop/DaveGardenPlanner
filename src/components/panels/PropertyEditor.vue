<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore }     from '@/stores/uiStore'
import { COLOR_PRESETS }  from '@/constants/colorPresets'

const gardenStore = useGardenStore()
const uiStore     = useUiStore()

const shape  = computed(() => gardenStore.getShape(uiStore.selectedId))
const nameEl = ref(null)

// Lokální kopie pro editaci
const local = ref({ name: '', color: '', notes: '' })

watch(shape, (s) => {
  if (s) local.value = { name: s.name, color: s.color, notes: s.notes }
}, { immediate: true })

// Auto-focus na název při novém objektu
watch(() => uiStore.selectedId, () => {
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

      <!-- Název -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-1">Název objektu</span>
        <input
          ref="nameEl"
          v-model="local.name"
          type="text"
          placeholder="Pojmenuj objekt..."
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

      <!-- Geometrie (read-only info) -->
      <div class="bg-garden-50 rounded p-2 space-y-0.5 text-garden-600">
        <div class="font-medium text-garden-700 mb-1">Geometrie</div>
        <div>Vrcholů: {{ vertexCount }}</div>
        <div>Plocha: ~{{ area }} m²</div>
        <div class="text-garden-400 mt-1">Táhni vrcholy (kroužky) pro úpravu tvaru</div>
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
