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
