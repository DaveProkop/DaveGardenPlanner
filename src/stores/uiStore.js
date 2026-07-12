import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectedObjectId = ref(null)
  const showPlotSettings = ref(false)

  function selectObject(id) {
    selectedObjectId.value = id
  }

  function deselect() {
    selectedObjectId.value = null
  }

  function togglePlotSettings() {
    showPlotSettings.value = !showPlotSettings.value
  }

  return { selectedObjectId, showPlotSettings, selectObject, deselect, togglePlotSettings }
})
