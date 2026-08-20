import { computed } from 'vue'
import { bboxOf } from '@/utils/shapes'
import { distanceToPlotEdge, nearestEdge } from '@/utils/plot'

// Sdílený výpočet vzdálenosti vybraného tvaru od hranice pozemku, použitý jak
// v PropertyEditor.vue (číselný readout), tak v GardenCanvas.vue (vodicí čáry
// na plátně) — jedna implementace bbox+delta matematiky.
//
// shapeRef/plotRef/dragDeltaRef = computed/ref, ne přímé hodnoty (composable
// se vyhodnocuje reaktivně). dragDeltaRef = uiStore.dragDelta ({id,dx,dy}|null),
// živý posun taženého tvaru ještě nezapsaný do store (viz GardenObject.vue @dragmove).
export function usePlotDistance(shapeRef, plotRef, dragDeltaRef) {
  const liveBbox = computed(() => {
    const shape = shapeRef.value
    if (!shape) return null
    const b = bboxOf(shape.points)
    const delta = dragDeltaRef.value
    if (delta && delta.id === shape.id) {
      return {
        minX: b.minX + delta.dx, minY: b.minY + delta.dy,
        maxX: b.maxX + delta.dx, maxY: b.maxY + delta.dy,
        width: b.width, height: b.height,
      }
    }
    return b
  })

  const distance = computed(() => {
    const plot = plotRef.value
    if (!plot || !liveBbox.value) return null
    return distanceToPlotEdge(liveBbox.value, bboxOf(plot.points))
  })

  const nearest = computed(() => distance.value ? nearestEdge(distance.value) : null)

  return { liveBbox, distance, nearest }
}
