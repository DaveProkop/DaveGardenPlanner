// Jednoduché procedurální textury pro vyplnění tvarů (Konva fillPatternImage).
// Každý generátor vykreslí malou dlaždici (tile) vycházející z barvy objektu,
// takže textura respektuje zvolenou barvu a jen ji "rozbije" jemnou kresbou.

const TILE = 32
const cache = new Map()

function clamp(v) { return Math.min(255, Math.max(0, v)) }

// posune barvu (#rrggbb) do světlejšího/tmavšího odstínu; percent -1..1
function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = clamp(((num >> 16) & 0xff) + Math.round(255 * percent))
  const g = clamp(((num >> 8)  & 0xff) + Math.round(255 * percent))
  const b = clamp(((num)       & 0xff) + Math.round(255 * percent))
  return `rgb(${r},${g},${b})`
}

function rand(seed) {
  // jednoduchý deterministický PRNG (mulberry32), aby stejná barva+textura
  // dávala vždy stejný vzor (hezčí pro cache i reprodukovatelnost)
  let t = seed
  return () => {
    t |= 0; t = (t + 0x6D2B79F5) | 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const GENERATORS = {
  grass(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    for (let i = 0; i < 16; i++) {
      const x = rnd() * TILE, y = rnd() * TILE
      ctx.strokeStyle = rnd() > 0.5 ? shade(color, 0.16) : shade(color, -0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rnd() * 2 - 1), y - 3 - rnd() * 3)
      ctx.stroke()
    }
  },
  water(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    ctx.strokeStyle = shade(color, 0.2)
    ctx.lineWidth = 1.2
    for (let y = 5; y < TILE; y += 9) {
      const o = rnd() * 3
      ctx.beginPath()
      ctx.moveTo(0, y + o)
      ctx.quadraticCurveTo(TILE * 0.25, y + o - 3, TILE * 0.5, y + o)
      ctx.quadraticCurveTo(TILE * 0.75, y + o + 3, TILE, y + o)
      ctx.stroke()
    }
  },
  wood(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    ctx.strokeStyle = shade(color, -0.16)
    ctx.lineWidth = 1
    for (let y = 3; y < TILE; y += 5) {
      const wobble = rnd() * 2 - 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(TILE * 0.3, y + wobble, TILE * 0.6, y - wobble, TILE, y)
      ctx.stroke()
    }
  },
  brick(ctx, color, rnd) {
    ctx.fillStyle = shade(color, -0.08); ctx.fillRect(0, 0, TILE, TILE)
    const bw = TILE / 2, bh = TILE / 4
    ctx.strokeStyle = shade(color, -0.35)
    ctx.lineWidth = 1
    let row = 0
    for (let y = 0; y < TILE; y += bh, row++) {
      const offset = row % 2 === 0 ? 0 : bw / 2
      for (let x = -bw; x < TILE; x += bw) {
        ctx.fillStyle = color
        ctx.fillRect(x + offset + 1, y + 1, bw - 2, bh - 2)
        ctx.strokeRect(x + offset + 1, y + 1, bw - 2, bh - 2)
      }
    }
  },
  stone(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    for (let i = 0; i < 26; i++) {
      const x = rnd() * TILE, y = rnd() * TILE, r = 0.6 + rnd() * 1.1
      ctx.fillStyle = rnd() > 0.5 ? shade(color, 0.16) : shade(color, -0.16)
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
  },
  foliage(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    for (let i = 0; i < 11; i++) {
      const x = rnd() * TILE, y = rnd() * TILE, r = 2 + rnd() * 2.5
      ctx.fillStyle = rnd() > 0.5 ? shade(color, 0.2) : shade(color, -0.2)
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
  },
  sand(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    for (let i = 0; i < 46; i++) {
      const x = rnd() * TILE, y = rnd() * TILE
      ctx.fillStyle = rnd() > 0.5 ? shade(color, 0.22) : shade(color, -0.12)
      ctx.fillRect(x, y, 1, 1)
    }
  },
  glass(ctx, color, rnd) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, TILE, TILE)
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 2
    for (let i = -TILE; i < TILE * 2; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, TILE); ctx.lineTo(i + TILE, 0); ctx.stroke()
    }
  },
}

export const TEXTURE_KEYS = Object.keys(GENERATORS)

// Vrátí (a cachuje) canvas dlaždici pro danou barvu + typ textury.
export function getTexture(color, key) {
  if (!key || !GENERATORS[key]) return null
  const cacheKey = `${key}|${color}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const canvas = document.createElement('canvas')
  canvas.width = TILE
  canvas.height = TILE
  const ctx = canvas.getContext('2d')
  // seed odvozený z barvy, aby vzor byl pro danou barvu stále stejný
  let seed = 0
  for (let i = 0; i < color.length; i++) seed = (seed * 31 + color.charCodeAt(i)) | 0
  GENERATORS[key](ctx, color, rand(seed))

  cache.set(cacheKey, canvas)
  return canvas
}
