<script setup>
import { computed, ref, watch } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore } from '@/stores/uiStore'
import { OBJECT_TYPES } from '@/constants/objectTypes'

const gardenStore = useGardenStore()
const uiStore     = useUiStore()

const obj = computed(() => gardenStore.getObject(uiStore.selectedObjectId))
const typeDef = computed(() => obj.value ? OBJECT_TYPES[obj.value.type] : null)

// Local editable copy — committed on blur or enter
const local = ref({})
watch(obj, (newObj) => {
  if (newObj) local.value = { ...newObj }
}, { immediate: true })

function commit(field) {
  if (!obj.value) return
  let value = local.value[field]
  if (['x', 'y', 'width', 'height', 'rotation'].includes(field)) {
    value = parseFloat(value) || 0
    if (['width', 'height'].includes(field)) value = Math.max(0.1, value)
  }
  gardenStore.updateObject({ id: obj.value.id, [field]: value })
}

function deleteObject() {
  if (!obj.value) return
  gardenStore.removeObject(obj.value.id)
  uiStore.deselect()
}

function numberField(e, field) {
  if (e.key === 'Enter') {
    commit(field)
    e.target.blur()
  }
}
</script>

<template>
  <aside
    v-if="obj"
    class="w-56 flex-shrink-0 bg-white border-l border-garden-100 flex flex-col overflow-hidden"
  >
    <div class="px-3 py-2 bg-garden-700 text-white text-xs font-semibold flex items-center gap-2">
      <span
        class="w-3 h-3 rounded-sm"
        :style="{ backgroundColor: obj.color }"
      />
      <span class="truncate">{{ typeDef?.label ?? obj.type }}</span>
    </div>

    <div class="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
      <!-- Label -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-0.5">Popisek</span>
        <input
          v-model="local.label"
          type="text"
          class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500"
          @blur="commit('label')"
          @keydown.enter="commit('label'); $event.target.blur()"
        />
      </label>

      <!-- Barva -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-0.5">Barva</span>
        <div class="flex items-center gap-2">
          <input
            v-model="local.color"
            type="color"
            class="w-8 h-8 rounded border border-garden-200 cursor-pointer p-0.5"
            @change="commit('color')"
          />
          <span class="text-garden-500">{{ local.color }}</span>
        </div>
      </label>

      <!-- Rozměry -->
      <div>
        <span class="text-garden-700 font-medium block mb-1">Rozměry (metry)</span>
        <div class="grid grid-cols-2 gap-2">
          <label>
            <span class="text-garden-500 block mb-0.5">Šířka</span>
            <input
              v-model="local.width"
              type="number"
              step="0.1"
              min="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500"
              @blur="commit('width')"
              @keydown="numberField($event, 'width')"
            />
          </label>
          <label>
            <span class="text-garden-500 block mb-0.5">Výška</span>
            <input
              v-model="local.height"
              type="number"
              step="0.1"
              min="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500"
              @blur="commit('height')"
              @keydown="numberField($event, 'height')"
            />
          </label>
        </div>
      </div>

      <!-- Poloha -->
      <div>
        <span class="text-garden-700 font-medium block mb-1">Poloha (od okraje)</span>
        <div class="grid grid-cols-2 gap-2">
          <label>
            <span class="text-garden-500 block mb-0.5">X (m)</span>
            <input
              v-model="local.x"
              type="number"
              step="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500"
              @blur="commit('x')"
              @keydown="numberField($event, 'x')"
            />
          </label>
          <label>
            <span class="text-garden-500 block mb-0.5">Y (m)</span>
            <input
              v-model="local.y"
              type="number"
              step="0.1"
              class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500"
              @blur="commit('y')"
              @keydown="numberField($event, 'y')"
            />
          </label>
        </div>
      </div>

      <!-- Rotace -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-0.5">Rotace (°)</span>
        <input
          v-model="local.rotation"
          type="number"
          step="5"
          class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500"
          @blur="commit('rotation')"
          @keydown="numberField($event, 'rotation')"
        />
      </label>

      <!-- Poznámky -->
      <label class="block">
        <span class="text-garden-700 font-medium block mb-0.5">Poznámky</span>
        <textarea
          v-model="local.notes"
          rows="3"
          class="w-full border border-garden-200 rounded px-2 py-1 focus:outline-none focus:border-garden-500 resize-none"
          @blur="commit('notes')"
        />
      </label>
    </div>

    <!-- Delete -->
    <div class="px-3 py-2 border-t border-garden-100">
      <button
        class="w-full py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors"
        @click="deleteObject"
      >
        Smazat objekt
      </button>
    </div>
  </aside>

  <!-- Placeholder when nothing selected -->
  <aside
    v-else
    class="w-56 flex-shrink-0 bg-white border-l border-garden-100 flex items-center justify-center"
  >
    <div class="text-center text-garden-400 text-xs px-4">
      <div class="text-2xl mb-2">👆</div>
      Vyber objekt<br/>pro úpravu
    </div>
  </aside>
</template>
