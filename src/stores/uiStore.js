import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_COLOR } from '@/constants/colorPresets'

export const useUiStore = defineStore('ui', () => {
  const selectedId      = ref(null)
  const activeTool      = ref('select')   // 'select' | 'rect' | 'polygon'
  const activeColor     = ref(DEFAULT_COLOR)
  const showPlotSettings = ref(false)

  function selectObject(id) { selectedId.value = id }
  function deselect()       { selectedId.value = null }
  function setTool(tool)    { activeTool.value = tool }
  function setColor(color)  { activeColor.value = color }

  return { selectedId, activeTool, activeColor, showPlotSettings, selectObject, deselect, setTool, setColor }
})
