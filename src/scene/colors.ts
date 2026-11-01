import { SRGBColorSpace, type Color } from 'three'

/** Viridis sampled at nine even stops (sRGB 0..255). Perceptually uniform, monotonic luminance. */
const VIRIDIS = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 73, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [110, 206, 88],
  [253, 231, 37],
] as const

/** Viridis-like ramp: 0 is dark purple, 1 is yellow. Writes into out (linear working space) and returns it. */
export function rampColor(v01: number, out: Color): Color {
  const v = Number.isFinite(v01) ? Math.min(1, Math.max(0, v01)) : 0
  const f = v * (VIRIDIS.length - 1)
  const i = Math.min(VIRIDIS.length - 2, Math.floor(f))
  const t = f - i
  const a = VIRIDIS[i]
  const b = VIRIDIS[i + 1]
  return out.setRGB(
    (a[0] + (b[0] - a[0]) * t) / 255,
    (a[1] + (b[1] - a[1]) * t) / 255,
    (a[2] + (b[2] - a[2]) * t) / 255,
    SRGBColorSpace,
  )
}

/** Colour for a firing time on the same ramp: 0 ms is the first hole, maxMs the last. */
export function delayColor(ms: number, maxMs: number, out: Color): Color {
  return rampColor(maxMs > 0 ? ms / maxMs : 0, out)
}

/** CSS gradient of the ramp, for legends. */
export const RAMP_CSS = `linear-gradient(90deg, ${VIRIDIS.map((c) => `rgb(${c.join(',')})`).join(', ')})`
