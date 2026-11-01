import type { DrillHole } from './types'

/** Earliest firing time in the pattern, ms (0 for no holes). */
export function firstFireMs(holes: DrillHole[]): number {
  let m = Infinity
  for (const h of holes) if (h.delayMs < m) m = h.delayMs
  return Number.isFinite(m) ? m : 0
}

/** Latest firing time in the pattern, ms. */
export function lastFireMs(holes: DrillHole[]): number {
  let m = 0
  for (const h of holes) if (h.delayMs > m) m = h.delayMs
  return m
}
