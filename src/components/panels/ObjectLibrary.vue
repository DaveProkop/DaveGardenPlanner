<script setup>
import { ref } from 'vue'
import { OBJECTS_BY_CATEGORY, CATEGORIES } from '@/constants/objectTypes'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore } from '@/stores/uiStore'

const gardenStore = useGardenStore()
const uiStore = useUiStore()

const openCategories = ref({ structures: true, plants: true, other: false })

function addObject(typeId) {
  const newId = gardenStore.addObject(typeId)
  if (newId) uiStore.selectObject(newId)
}
</script>

<template>
  <aside class="w-48 flex-shrink-0 bg-white border-r border-garden-100 flex flex-col overflow-hidden">
    <div class="px-3 py-2 bg-garden-700 text-white text-xs font-semibold uppercase tracking-wide">
      Objekty
    </div>

    <div class="flex-1 overflow-y-auto">
      <template v-for="(catDef, catKey) in CATEGORIES" :key="catKey">
        <template v-if="OBJECTS_BY_CATEGORY[catDef.id]">
          <!-- Category header -->
          <button
            class="w-full flex items-center justify-between px-3 py-1.5 bg-garden-50 hover:bg-garden-100 text-garden-700 text-xs font-semibold transition-colors"
            @click="openCategories[catDef.id] = !openCategories[catDef.id]"
          >
            {{ catDef.label }}
            <span>{{ openCategories[catDef.id] ? '▾' : '▸' }}</span>
          </button>

          <!-- Object buttons -->
          <template v-if="openCategories[catDef.id]">
            <button
              v-for="type in OBJECTS_BY_CATEGORY[catDef.id]"
              :key="type.id"
              class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-garden-50 active:bg-garden-100 transition-colors border-b border-garden-50"
              @click="addObject(type.id)"
            >
              <span
                class="w-4 h-4 rounded-sm flex-shrink-0 border border-black/10"
                :style="{ backgroundColor: type.color }"
              />
              <span class="truncate">{{ type.label }}</span>
            </button>
          </template>
        </template>
      </template>
    </div>

    <div class="px-3 py-2 text-xs text-garden-600 border-t border-garden-100 bg-garden-50">
      Klikni pro přidání
    </div>
  </aside>
</template>
