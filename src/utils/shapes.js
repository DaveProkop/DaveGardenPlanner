// Bounding box plochého pole bodů [x1,y1,x2,y2,...] v metrech — sdílená
// logika pro rozměry/polohu v PropertyEditor.vue, EllipseHandles.vue i
// výpočet vzdálenosti od hranice pozemku (utils/plot.js).
export function bboxOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]);   maxX = Math.max(maxX, points[i])
    minY = Math.min(minY, points[i+1]); maxY = Math.max(maxY, points[i+1])
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

// Vygeneruje body pravidelného mnohoúhelníku aproximujícího elipsu/kruh
// (kruh = rx === ry). Vrací plochý seznam [x1,y1,x2,y2,...] v metrech.
export function ellipsePoints(cx, cy, rx, ry, n = 8) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a))
  }
  return pts
}
