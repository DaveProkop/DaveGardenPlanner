<script setup>
import { useFileSourceStore } from '@/stores/fileSourceStore'

const fileSourceStore = useFileSourceStore()
</script>

<template>
  <div
    v-if="fileSourceStore.pendingResume"
    class="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white shadow-lg rounded-lg border border-garden-200 px-3 py-2 text-sm"
  >
    <span>
      📄 Pokračovat v naposledy otevřeném souboru
      „<strong>{{ fileSourceStore.pendingResume.name }}</strong>“
      <span class="text-gray-400">({{ fileSourceStore.pendingResume.type === 'drive' ? 'Google Disk' : 'tento počítač' }})</span>?
    </span>
    <button
      :disabled="fileSourceStore.busy"
      class="px-2 py-1 bg-garden-600 hover:bg-garden-700 text-white rounded text-xs disabled:opacity-50"
      @click="fileSourceStore.resume()"
    >
      {{ fileSourceStore.busy ? 'Otevírám…' : 'Pokračovat' }}
    </button>
    <button
      :disabled="fileSourceStore.busy"
      class="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs disabled:opacity-50"
      @click="fileSourceStore.dismissResume()"
    >
      Ne, nový plán
    </button>
  </div>
</template>
