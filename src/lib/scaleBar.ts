/**
 * The longest round length (1, 2 or 5 times a power of ten metres) whose bar
 * fits in maxPx at mpp metres per pixel, with its width in pixels and a label.
 */
export function scaleBar(mpp: number, maxPx: number): { metres: number; px: number; label: string } | null {
  if (!(mpp > 0) || !(maxPx > 0)) return null
  let best: number | null = null
  for (let k = -2; k <= 6; k++) {
    for (const m of [1, 2, 5]) {
      const metres = m * 10 ** k
      if (metres / mpp <= maxPx) best = metres
    }
  }
  if (best === null) return null
  const metres = Number(best.toPrecision(1))
  const label = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`
  return { metres, px: metres / mpp, label }
}
