<script setup>
import { ref, computed, watch } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore, GRID_SIZES } from '@/stores/uiStore'
import { useStorage } from '@/composables/useStorage'

const gardenStore  = useGardenStore()
const uiStore      = useUiStore()
const { exportJSON, importJSON } = useStorage()
const appVersion   = __APP_VERSION__

const importError = ref('')
const importSuccess = ref(false)

// Tečka u "Automatické ukládání" krátce blikne zeleně při každém uložení,
// ať je vidět, že se opravdu něco děje (bez rušivého odpočtu vteřin v textu).
const justSaved = ref(false)
let pulseTimer = null
watch(() => gardenStore.lastSavedAt, (savedAt) => {
  if (!savedAt) return
  justSaved.value = true
  clearTimeout(pulseTimer)
  pulseTimer = setTimeout(() => { justSaved.value = false }, 700)
})

const savedTooltip = computed(() => {
  const t = gardenStore.lastSavedAt
  return t ? `Naposledy uloženo do prohlížeče: ${t.toLocaleString('cs-CZ')}` : 'Zatím nic neuloženo'
})

function copySelected() {
  const shape = gardenStore.getShape(uiStore.selectedId)
  if (shape) uiStore.copyShape(shape)
}

function pasteClipboard() {
  if (!uiStore.clipboard) return
  const id = gardenStore.pasteShape(uiStore.clipboard)
  uiStore.selectObject(id)
  uiStore.setTool('select')
}

async function handleImport() {
  importError.value = ''
  importSuccess.value = false
  try {
    await importJSON()
    uiStore.deselect()
    importSuccess.value = true
    setTimeout(() => { importSuccess.value = false }, 2000)
  } catch (e) {
    importError.value = e.message
    setTimeout(() => { importError.value = '' }, 4000)
  }
}
</script>

<template>
  <header class="h-11 flex items-center gap-1 px-3 bg-garden-700 text-white shadow-md flex-shrink-0 select-none">
    <!-- App name -->
    <div class="flex items-center gap-1.5 mr-3">
      <span class="text-base">🌿</span>
      <span class="font-semibold text-sm tracking-wide">GardenPlanner</span>
      <span class="text-garden-200 text-xs ml-1">v{{ appVersion }}</span>
    </div>

    <div class="w-px h-5 bg-garden-500 mx-1" />

    <!-- Grid toggle -->
    <button
      class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      :class="uiStore.showGrid ? 'bg-garden-500 hover:bg-garden-400' : 'hover:bg-garden-600 text-garden-200'"
      title="Zobrazit/skrýt mřížku"
      @click="uiStore.toggleGrid()"
    >
      ▦ Mřížka
    </button>

    <!-- Snap to grid toggle -->
    <button
      class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
      :class="uiStore.snapToGrid ? 'bg-garden-500 hover:bg-garden-400' : 'hover:bg-garden-600 text-garden-200'"
      title="Přichytávat kreslení a tažení k mřížce"
      @click="uiStore.toggleSnap()"
    >
      🧲 Přichytávání
    </button>

    <!-- Grid density -->
    <select
      class="bg-garden-600 hover:bg-garden-500 text-white text-xs rounded px-1.5 py-1 border border-garden-500 focus:outline-none cursor-pointer"
      title="Hustota mřížky"
      :value="uiStore.gridSize"
      @change="uiStore.setGridSize(Number($event.target.value))"
    >
      <option v-for="s in GRID_SIZES" :key="s" :value="s">{{ s }} m</option>
    </select>

    <div class="w-px h-5 bg-garden-500 mx-1" />

    <!-- Undo / Redo -->
    <button
      :disabled="!gardenStore.canUndo"
      class="px-2 py-1 rounded text-xs hover:bg-garden-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Zpět (Ctrl+Z)"
      @click="gardenStore.undo(); uiStore.deselect()"
    >
      ↩ Zpět
    </button>
    <button
      :disabled="!gardenStore.canRedo"
      class="px-2 py-1 rounded text-xs hover:bg-garden-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Vpřed (Ctrl+Y)"
      @click="gardenStore.redo(); uiStore.deselect()"
    >
      ↪ Vpřed
    </button>

    <div class="w-px h-5 bg-garden-500 mx-1" />

    <!-- Kopírovat / Vložit -->
    <button
      :disabled="!uiStore.selectedId"
      class="px-2 py-1 rounded text-xs hover:bg-garden-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Kopírovat vybraný objekt (Ctrl+C)"
      @click="copySelected"
    >
      📋 Kopírovat
    </button>
    <button
      :disabled="!uiStore.clipboard"
      class="px-2 py-1 rounded text-xs hover:bg-garden-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Vložit zkopírovaný objekt (Ctrl+V)"
      @click="pasteClipboard"
    >
      📄 Vložit
    </button>

    <!-- Aktivní nástroj (vizuální indikátor) -->
    <div class="w-px h-5 bg-garden-500 mx-1" />
    <span class="text-garden-200 text-xs">
      <template v-if="uiStore.activePresetId">✏️ {{ uiStore.pendingLabel }}</template>
      <template v-else-if="uiStore.activeTool === 'select'">↖ Výběr</template>
      <template v-else-if="uiStore.activeTool === 'move'">✥ Přesun</template>
      <template v-else-if="uiStore.activeTool === 'rect'">⬜ Obdélník</template>
      <template v-else-if="uiStore.activeTool === 'circle'">⬭ Kruh/Elipsa</template>
      <template v-else>⬡ Polygon</template>
    </span>

    <div class="flex-1" />

    <!-- Feedback messages -->
    <span v-if="importSuccess" class="text-green-300 text-xs animate-pulse">✓ Načteno</span>
    <span v-if="importError"   class="text-red-300   text-xs">⚠ {{ importError }}</span>

    <!-- Stav automatického ukládání do prohlížeče -->
    <span class="flex items-center gap-1.5 text-garden-300 text-xs" :title="savedTooltip">
      <span
        class="w-1.5 h-1.5 rounded-full transition-colors duration-300"
        :class="justSaved ? 'bg-green-400' : 'bg-garden-400'"
      />
      Automatické ukládání
    </span>

    <!-- Save / Load -->
    <button
      class="px-2 py-1 rounded text-xs hover:bg-garden-600 transition-colors"
      title="Načíst ze souboru JSON"
      @click="handleImport"
    >
      📂 Načíst
    </button>
    <button
      class="px-2 py-1 rounded text-xs bg-garden-500 hover:bg-garden-400 transition-colors font-medium"
      title="Uložit jako JSON soubor"
      @click="exportJSON"
    >
      💾 Uložit
    </button>
  </header>
</template>
