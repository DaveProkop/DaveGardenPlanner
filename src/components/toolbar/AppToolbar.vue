<script setup>
import { ref } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore } from '@/stores/uiStore'
import { useStorage } from '@/composables/useStorage'

const gardenStore  = useGardenStore()
const uiStore      = useUiStore()
const { exportJSON, importJSON } = useStorage()
const appVersion   = __APP_VERSION__

const showPlotDialog = ref(false)
const plotForm = ref({ ...gardenStore.plot })
const importError = ref('')
const importSuccess = ref(false)

function openPlotDialog() {
  plotForm.value = { ...gardenStore.plot }
  showPlotDialog.value = true
}

function savePlot() {
  gardenStore.updatePlot({
    name:   plotForm.value.name,
    width:  Math.max(1, parseFloat(plotForm.value.width)  || 20),
    height: Math.max(1, parseFloat(plotForm.value.height) || 15),
  })
  showPlotDialog.value = false
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

    <!-- Plot settings -->
    <button
      class="flex items-center gap-1 px-2 py-1 rounded hover:bg-garden-600 text-xs transition-colors"
      @click="openPlotDialog"
    >
      📐 Pozemek
      <span class="text-garden-200">{{ gardenStore.plot.width }}×{{ gardenStore.plot.height }} m</span>
    </button>

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

    <!-- Aktivní nástroj (vizuální indikátor) -->
    <div class="w-px h-5 bg-garden-500 mx-1" />
    <span class="text-garden-200 text-xs">
      {{ uiStore.activeTool === 'select' ? '↖ Výběr' : uiStore.activeTool === 'rect' ? '⬜ Obdélník' : '⬡ Polygon' }}
    </span>

    <div class="flex-1" />

    <!-- Feedback messages -->
    <span v-if="importSuccess" class="text-green-300 text-xs animate-pulse">✓ Načteno</span>
    <span v-if="importError"   class="text-red-300   text-xs">⚠ {{ importError }}</span>

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

  <!-- Plot settings dialog -->
  <Teleport to="body">
    <div
      v-if="showPlotDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showPlotDialog = false"
    >
      <div class="bg-white rounded-xl shadow-2xl w-80 p-5">
        <h2 class="text-garden-700 font-semibold mb-4">Nastavení pozemku</h2>

        <label class="block mb-3 text-sm">
          <span class="text-gray-600 block mb-1">Název</span>
          <input
            v-model="plotForm.name"
            type="text"
            class="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-garden-500 text-sm"
          />
        </label>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <label class="text-sm">
            <span class="text-gray-600 block mb-1">Šířka (m)</span>
            <input
              v-model="plotForm.width"
              type="number" min="1" max="500" step="0.5"
              class="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-garden-500"
            />
          </label>
          <label class="text-sm">
            <span class="text-gray-600 block mb-1">Hloubka (m)</span>
            <input
              v-model="plotForm.height"
              type="number" min="1" max="500" step="0.5"
              class="w-full border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-garden-500"
            />
          </label>
        </div>

        <div class="text-xs text-gray-400 mb-4">
          Plocha: {{ (parseFloat(plotForm.width || 0) * parseFloat(plotForm.height || 0)).toFixed(0) }} m²
        </div>

        <div class="flex gap-2 justify-end">
          <button
            class="px-4 py-1.5 rounded text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
            @click="showPlotDialog = false"
          >
            Zrušit
          </button>
          <button
            class="px-4 py-1.5 rounded text-sm bg-garden-600 hover:bg-garden-500 text-white transition-colors"
            @click="savePlot"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
