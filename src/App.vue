<script setup>
import { onMounted } from 'vue'
import { useGardenStore } from '@/stores/gardenStore'
import AppToolbar    from '@/components/toolbar/AppToolbar.vue'
import ObjectLibrary from '@/components/panels/ObjectLibrary.vue'
import GardenCanvas  from '@/components/canvas/GardenCanvas.vue'
import PropertyEditor from '@/components/panels/PropertyEditor.vue'
import UpdateBanner  from '@/components/UpdateBanner.vue'

const gardenStore = useGardenStore()

onMounted(() => {
  gardenStore.init()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <AppToolbar />

    <div class="flex flex-1 min-h-0">
      <ObjectLibrary />
      <main class="flex-1 relative min-w-0">
        <GardenCanvas />
      </main>
      <PropertyEditor />
    </div>
  </div>

  <UpdateBanner />
</template>
