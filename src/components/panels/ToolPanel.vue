<script setup>
import { useUiStore } from '@/stores/uiStore'
import { useGardenStore } from '@/stores/gardenStore'
import { COLOR_PRESETS } from '@/constants/colorPresets'

const uiStore     = useUiStore()
const gardenStore = useGardenStore()

const tools = [
  { id: 'select',  label: 'Výběr',       icon: '↖',  title: 'Vybrat a přesunout objekt (V)' },
  { id: 'rect',    label: 'Obdélník',    icon: '⬜',  title: 'Nakreslit obdélník tažením (R)' },
  { id: 'polygon', label: 'Polygon',     icon: '⬡',  title: 'Kreslit tvar po vrcholech (P)' },
]
</script>

<template>
  <aside class="w-44 flex-shrink-0 bg-white border-r border-garden-100 flex flex-col overflow-hidden text-xs">

    <!-- Nástroje -->
    <div class="px-3 py-2 bg-garden-700 text-white font-semibold uppercase tracking-wide">Nástroje</div>
    <div class="p-2 space-y-1 border-b border-garden-100">
      <button
        v-for="tool in tools"
        :key="tool.id"
        :title="tool.title"
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors"
        :class="uiStore.activeTool === tool.id
          ? 'bg-garden-600 text-white font-semibold'
          : 'hover:bg-garden-50 text-garden-700'"
        @click="uiStore.setTool(tool.id)"
      >
        <span class="text-base leading-none">{{ tool.icon }}</span>
        {{ tool.label }}
      </button>
    </div>

    <!-- Barva -->
    <div class="px-3 py-2 bg-garden-50 text-garden-700 font-semibold uppercase tracking-wide border-b border-garden-100">
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

    <!-- Stats -->
    <div class="flex-1" />
    <div class="px-3 py-2 text-garden-500 border-t border-garden-100 bg-garden-50">
      {{ gardenStore.shapes.length }} {{ gardenStore.shapes.length === 1 ? 'objekt' : gardenStore.shapes.length < 5 ? 'objekty' : 'objektů' }}
    </div>
  </aside>
</template>
