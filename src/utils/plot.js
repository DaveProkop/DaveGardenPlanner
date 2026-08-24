// Vzdálenost bounding boxu objektu od hran bounding boxu pozemku, v metrech.
// Záměrně počítáno z bounding boxů (ne skutečné nejbližší hrany polygonu) —
// odpovídá zadání "vzdálenost v ose X / v ose Y", což už samo předpokládá
// osově zarovnané měření. Záporná hodnota = objekt hranici přesahuje.
export function distanceToPlotEdge(objBbox, plotBbox) {
  return {
    left:   objBbox.minX - plotBbox.minX,
    right:  plotBbox.maxX - objBbox.maxX,
    top:    objBbox.minY - plotBbox.minY,
    bottom: plotBbox.maxY - objBbox.maxY,
  }
}
