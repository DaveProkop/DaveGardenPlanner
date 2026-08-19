<script setup>
import { onMounted } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import { useFileSourceStore } from '@/stores/fileSourceStore'
import AppToolbar    from '@/components/toolbar/AppToolbar.vue'
import ToolPanel     from '@/components/panels/ToolPanel.vue'
import GardenCanvas  from '@/components/canvas/GardenCanvas.vue'
import PropertyEditor from '@/components/panels/PropertyEditor.vue'
import UpdateBanner  from '@/components/UpdateBanner.vue'
import ResumeSourceBanner from '@/components/ResumeSourceBanner.vue'

const gardenStore = useGardenStore()
const fileSourceStore = useFileSourceStore()
onMounted(() => {
  gardenStore.init()
  fileSourceStore.initResume()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <AppToolbar />
    <div class="flex flex-1 min-h-0">
      <ToolPanel />
      <main class="flex-1 relative min-w-0">
        <ResumeSourceBanner />
        <GardenCanvas />
      </main>
      <PropertyEditor />
    </div>
  </div>
  <UpdateBanner />
</template>
