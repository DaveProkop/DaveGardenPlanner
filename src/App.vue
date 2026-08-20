<script setup>
import { onMounted } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useUiStore } from '@/stores/uiStore'
import { useFileSourceStore } from '@/stores/fileSourceStore'
import AppToolbar    from '@/components/toolbar/AppToolbar.vue'
import ToolPanel     from '@/components/panels/ToolPanel.vue'
import GardenCanvas  from '@/components/canvas/GardenCanvas.vue'
import PropertyEditor from '@/components/panels/PropertyEditor.vue'
import UpdateBanner  from '@/components/UpdateBanner.vue'
import ResumeSourceBanner from '@/components/ResumeSourceBanner.vue'

const gardenStore = useGardenStore()
const uiStore = useUiStore()
const fileSourceStore = useFileSourceStore()
onMounted(() => {
  gardenStore.init()
  fileSourceStore.initResume()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <AppToolbar />
    <div class="flex flex-1 min-h-0 relative">
      <!-- Mobilní zástěna za vysunutým panelem — klik zavře -->
      <div
        v-if="uiStore.mobilePanel"
        class="fixed inset-0 bg-black/30 z-30 md:hidden"
        @click="uiStore.closeMobilePanel()"
      />
      <ToolPanel />
      <main class="flex-1 relative min-w-0">
        <ResumeSourceBanner />
        <GardenCanvas />
        <!-- Mobilní přepínače bočních panelů (na desktopu jsou panely vždy vidět, netřeba) -->
        <button
          class="md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-garden-700 text-white text-xs px-1.5 py-3 rounded-r-lg shadow-lg"
          title="Nástroje"
          @click="uiStore.openMobilePanel('tools')"
        >🧰</button>
        <button
          class="md:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-garden-700 text-white text-xs px-1.5 py-3 rounded-l-lg shadow-lg"
          title="Vlastnosti / Objekty"
          @click="uiStore.openMobilePanel('properties')"
        >▤</button>
      </main>
      <PropertyEditor />
    </div>
  </div>
  <UpdateBanner />
</template>
