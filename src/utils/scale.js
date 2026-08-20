// Sdílená řada "hezkých" hodnot v metrech pro měřítko dole i pravítko nahoře/vlevo,
// ať oboje ladí na stejné zaokrouhlené hodnotě při daném přiblížení.
export const SCALE_STEPS = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]

// Největší krok, jehož pruh v pixelech se ještě vejde do maxPx (spodní měřítko).
export function pickFittingStep(pxPerMeter, maxPx, steps = SCALE_STEPS) {
  let step = steps[0]
  for (const s of steps) {
    if (s * pxPerMeter <= maxPx) step = s
    else break
  }
  return step
}

// Nejmenší krok, jehož rozestup v pixelech je pořád čitelný (>= minPx) — pro
// popisky pravítka: opačná podmínka než u měřítka (tam chceme "co nejvíc se
// vejde", tady "co nejjemnější dělení, které ještě nesplyne").
export function pickNiceStep(pxPerMeter, minPx, steps = SCALE_STEPS) {
  for (const s of steps) {
    if (s * pxPerMeter >= minPx) return s
  }
  return steps[steps.length - 1]
}
