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

// Vybere pro danou osu bližší ze dvou protilehlých hran + její stranu (pro popisek).
export function nearestEdge(distance) {
  const x = distance.left <= distance.right ? { side: 'levé',  dist: distance.left  } : { side: 'pravé', dist: distance.right }
  const y = distance.top  <= distance.bottom ? { side: 'horní', dist: distance.top } : { side: 'dolní', dist: distance.bottom }
  return { x, y }
}
