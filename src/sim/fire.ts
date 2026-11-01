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

/**
 * True once a hole with this delay has fired at tMs. Nothing has fired at
 * t = 0, even a hole with a 0 ms delay: the opening frame is the intact bench.
 */
export function hasFired(holeDelayMs: number, tMs: number): boolean {
  return tMs > 0 && tMs >= holeDelayMs
}
