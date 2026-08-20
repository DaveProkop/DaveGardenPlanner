<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore, GRID_SIZES } from '@/stores/uiStore'
import { useFileSourceStore } from '@/stores/fileSourceStore'
import { isGoogleConfigured } from '@/config/google'

const gardenStore  = useGardenStore()
const uiStore      = useUiStore()
const fileSourceStore = useFileSourceStore()
const appVersion   = __APP_VERSION__
const driveConfigured = isGoogleConfigured()

const openMenu   = ref(null) // null | 'open' | 'more'
const fileSuccess = ref('')
let successTimer = null

function toggleMenu(name) { openMenu.value = openMenu.value === name ? null : name }
function closeMenu() { openMenu.value = null }

function onWindowClick(e) {
  if (!e.target.closest('[data-menu]')) closeMenu()
}
onMounted(() => window.addEventListener('click', onWindowClick))
onUnmounted(() => window.removeEventListener('click', onWindowClick))

function flashSuccess(text) {
  fileSuccess.value = text
  clearTimeout(successTimer)
  successTimer = setTimeout(() => { fileSuccess.value = '' }, 2500)
}

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

const saveTooltip = computed(() => {
  if (fileSourceStore.sourceType === 'local') return `Uloží do souboru „${fileSourceStore.fileName}“ na tomto počítači`
  if (fileSourceStore.sourceType === 'drive') return `Uloží na Google Disk („${fileSourceStore.fileName}“)`
  return 'Stáhne nový JSON soubor'
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

async function handleOpenLocal() {
  closeMenu()
  await fileSourceStore.openLocal()
  if (!fileSourceStore.fileError) { uiStore.deselect(); flashSuccess('Načteno z počítače') }
}

async function handleOpenDrive() {
  closeMenu()
  await fileSourceStore.openDrivePicker()
  if (!fileSourceStore.fileError && fileSourceStore.sourceType === 'drive') { uiStore.deselect(); flashSuccess('Načteno z Google Disku') }
}

async function handleSave() {
  const result = await fileSourceStore.save()
  if (result.target === 'local') flashSuccess(`Uloženo do „${result.name}“`)
  else if (result.target === 'drive') flashSuccess(`Uloženo na Google Disk`)
  else if (result.target === 'download') flashSuccess('Staženo')
}

function handleDownloadCopy() {
  closeMenu()
  fileSourceStore.downloadCopy()
  flashSuccess('Staženo')
}

async function handleSaveAsNewDrive() {
  closeMenu()
  await fileSourceStore.saveAsNewDriveFile()
  if (!fileSourceStore.fileError) flashSuccess('Uloženo na Google Disk jako nový soubor')
}
</script>

<template>
  <header class="h-11 flex items-center px-3 bg-garden-700 text-white shadow-md flex-shrink-0 select-none overflow-x-auto no-scrollbar">
   <div class="flex items-center gap-1 w-full min-w-max">
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

    <!-- Aktuálně otevřený soubor -->
    <span
      v-if="fileSourceStore.fileName"
      class="text-garden-300 text-xs truncate max-w-[10rem]"
      :title="fileSourceStore.fileName"
    >
      {{ fileSourceStore.sourceType === 'drive' ? '☁️' : '📄' }} {{ fileSourceStore.fileName }}
    </span>

    <!-- Feedback messages -->
    <span v-if="fileSuccess" class="text-green-300 text-xs animate-pulse">✓ {{ fileSuccess }}</span>
    <span v-if="fileSourceStore.fileError" class="text-red-300 text-xs">⚠ {{ fileSourceStore.fileError }}</span>

    <!-- Stav automatického ukládání do prohlížeče -->
    <span class="flex items-center gap-1.5 text-garden-300 text-xs" :title="savedTooltip">
      <span
        class="w-1.5 h-1.5 rounded-full transition-colors duration-300"
        :class="justSaved ? 'bg-green-400' : 'bg-garden-400'"
      />
      Automatické ukládání
    </span>

    <!-- Otevřít (dropdown: počítač / Google Disk) -->
    <div class="relative" data-menu>
      <button
        class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-garden-600 transition-colors"
        title="Otevřít soubor"
        @click="toggleMenu('open')"
      >
        📂 Otevřít <span class="text-[10px]">▾</span>
      </button>
      <div
        v-if="openMenu === 'open'"
        class="absolute right-0 mt-1 w-52 bg-white text-gray-800 rounded shadow-lg border border-gray-200 py-1 z-30 text-xs"
      >
        <button class="w-full text-left px-3 py-1.5 hover:bg-garden-50" @click="handleOpenLocal">
          💻 Z počítače
        </button>
        <button
          class="w-full text-left px-3 py-1.5 hover:bg-garden-50 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!driveConfigured"
          :title="driveConfigured ? '' : 'Google Disk není v této appce nakonfigurovaný — viz PROJECT.md'"
          @click="handleOpenDrive"
        >
          ☁️ Z Google Disku
        </button>
      </div>
    </div>

    <!-- Uložit (chytré: zapíše do naposledy otevřeného zdroje, jinak stáhne) -->
    <button
      class="px-2 py-1 rounded text-xs bg-garden-500 hover:bg-garden-400 transition-colors font-medium"
      :title="saveTooltip"
      @click="handleSave"
    >
      💾 Uložit
    </button>

    <!-- Další možnosti uložení -->
    <div class="relative" data-menu>
      <button
        class="px-1.5 py-1 rounded text-xs hover:bg-garden-600 transition-colors"
        title="Další možnosti uložení"
        @click="toggleMenu('more')"
      >
        ⋯
      </button>
      <div
        v-if="openMenu === 'more'"
        class="absolute right-0 mt-1 w-60 bg-white text-gray-800 rounded shadow-lg border border-gray-200 py-1 z-30 text-xs"
      >
        <button class="w-full text-left px-3 py-1.5 hover:bg-garden-50" @click="handleDownloadCopy">
          ⇩ Stáhnout kopii (JSON)
        </button>
        <button
          class="w-full text-left px-3 py-1.5 hover:bg-garden-50 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!driveConfigured"
          :title="driveConfigured ? '' : 'Google Disk není v této appce nakonfigurovaný — viz PROJECT.md'"
          @click="handleSaveAsNewDrive"
        >
          ☁️ Uložit na Disk jako nový soubor
        </button>
      </div>
    </div>
   </div>
  </header>
</template>
