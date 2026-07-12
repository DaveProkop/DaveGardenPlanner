<script setup>
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegistered(r) {
    // Check for updates every hour
    r && setInterval(() => r.update(), 60 * 60 * 1000)
  }
})

function update() {
  updateServiceWorker(true)
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="needRefresh"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-garden-700 text-white text-sm px-4 py-2.5 rounded-full shadow-lg"
    >
      <span>🔄 Nová verze je k dispozici</span>
      <button
        class="bg-white text-garden-700 font-semibold px-3 py-0.5 rounded-full text-xs hover:bg-garden-50 transition-colors"
        @click="update"
      >
        Aktualizovat
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateX(-50%) translateY(1rem); }
</style>
