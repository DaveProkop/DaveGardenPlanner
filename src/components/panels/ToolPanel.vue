<script setup>
import { ref } from 'vue'
import { useUiStore } from '@/stores/uiStore'
import { useGardenStore } from '@/stores/gardenStore'
import { COLOR_PRESETS } from '@/constants/colorPresets'
import { CATEGORIES, OBJECTS_BY_CATEGORY } from '@/constants/objectTypes'

const uiStore     = useUiStore()
const gardenStore = useGardenStore()

const tools = [
  { id: 'select',  label: 'Výběr',       icon: '↖',  title: 'Vybrat objekt a upravit jeho vrcholy' },
  { id: 'move',    label: 'Přesun',      icon: '✥',  title: 'Přesunout objekt tažením' },
  { id: 'rect',    label: 'Obdélník',    icon: '⬜',  title: 'Nakreslit obdélník tažením' },
  { id: 'circle',  label: 'Kruh/Elipsa', icon: '⬭',  title: 'Nakreslit kruh nebo elipsu tažením' },
  { id: 'polygon', label: 'Polygon',     icon: '⬡',  title: 'Kreslit tvar po vrcholech' },
  { id: 'text',    label: 'Text',        icon: 'A',  title: 'Přidat text klikem na plán' },
]

// Ruční přepnutí na obecný nástroj zruší vybraný typ objektu (barvu/texturu/název).
function chooseTool(toolId) {
  uiStore.setTool(toolId)
  uiStore.clearPreset()
}

const openCategories = ref({ terrain: true, structures: false, hardscape: false, water: false, plants: true, other: false })

// Vybere typ objektu — nezakresluje nic hned, jen "nabije" barvu/texturu/název
// a přepne na odpovídající nástroj (obdélník/kruh/polygon), kterým pak uživatel nakreslí tvar sám.
function pickType(type) {
  uiStore.selectObjectType(type)
}
</script>

<template>
  <aside class="w-48 flex-shrink-0 bg-white border-r border-garden-100 flex flex-col overflow-hidden text-xs">

    <div class="flex-1 overflow-y-auto">
      <!-- Nástroje -->
      <div class="px-3 py-2 bg-garden-700 text-white font-semibold uppercase tracking-wide">Nástroje</div>
      <div class="p-2 space-y-1 border-b border-garden-100">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :title="tool.title"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors"
          :class="uiStore.activeTool === tool.id && !uiStore.activePresetId
            ? 'bg-garden-600 text-white font-semibold'
            : 'hover:bg-garden-50 text-garden-700'"
          @click="chooseTool(tool.id)"
        >
          <span class="text-base leading-none">{{ tool.icon }}</span>
          {{ tool.label }}
        </button>
      </div>

      <!-- Objekty (typy podle postupu: terén → stavby → zpevněné plochy → voda → rostliny → ostatní) -->
      <div class="px-3 py-2 bg-garden-700 text-white font-semibold uppercase tracking-wide">Objekty</div>
      <div class="px-3 py-1.5 text-[11px] text-garden-500 border-b border-garden-50 leading-snug">
        Vyber typ, pak ho nakresli na plán (tažením nebo klikáním u polygonu).
      </div>
      <template v-for="(catDef, catKey) in CATEGORIES" :key="catKey">
        <template v-if="OBJECTS_BY_CATEGORY[catDef.id]">
          <button
            class="w-full flex items-center justify-between px-3 py-1.5 bg-garden-50 hover:bg-garden-100 text-garden-700 font-semibold transition-colors"
            @click="openCategories[catDef.id] = !openCategories[catDef.id]"
          >
            {{ catDef.label }}
            <span>{{ openCategories[catDef.id] ? '▾' : '▸' }}</span>
          </button>

          <template v-if="openCategories[catDef.id]">
            <button
              v-for="type in OBJECTS_BY_CATEGORY[catDef.id]"
              :key="type.id"
              :title="`${type.label} — obvykle ~${type.defaultW}×${type.defaultH} m`"
              class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors border-b border-garden-50"
              :class="uiStore.activePresetId === type.id ? 'bg-garden-100 font-semibold text-garden-800' : 'hover:bg-garden-50 active:bg-garden-100'"
              @click="pickType(type)"
            >
              <span class="text-sm leading-none flex-shrink-0">{{ type.icon }}</span>
              <span
                class="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
                :style="{ backgroundColor: type.color }"
              />
              <span class="truncate">{{ type.label }}</span>
            </button>
          </template>
        </template>
      </template>

      <!-- Barva -->
      <div class="px-3 py-2 bg-garden-50 text-garden-700 font-semibold uppercase tracking-wide border-y border-garden-100 mt-1">
        Barva
      </div>
      <div class="p-2 border-b border-garden-100">
        <!-- Grid barevných políček -->
        <div class="grid grid-cols-4 gap-1 mb-2">
          <button
            v-for="preset in COLOR_PRESETS"
            :key="preset.color"
            :title="preset.label"
            class="w-7 h-7 rounded border-2 transition-all hover:scale-110"
            :style="{ backgroundColor: preset.color }"
            :class="uiStore.activeColor === preset.color ? 'border-garden-700 ring-1 ring-garden-400' : 'border-transparent'"
            @click="uiStore.setColor(preset.color)"
          />
        </div>
        <!-- Vlastní barva -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            :value="uiStore.activeColor"
            type="color"
            class="w-7 h-7 rounded border border-garden-200 cursor-pointer p-0.5 flex-shrink-0"
            @input="uiStore.setColor($event.target.value)"
          />
          <span class="text-garden-500 font-mono">{{ uiStore.activeColor }}</span>
        </label>
      </div>
    </div>

    <!-- Stats -->
    <div class="px-3 py-2 text-garden-500 border-t border-garden-100 bg-garden-50">
      {{ gardenStore.shapes.length }} {{ gardenStore.shapes.length === 1 ? 'objekt' : gardenStore.shapes.length < 5 ? 'objekty' : 'objektů' }}
    </div>
  </aside>
</template>
