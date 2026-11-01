import type { Scale } from '../sim/scenario'

/** Below this width the page treats the device as a phone. */
export const PHONE_MAX_WIDTH = 768

/** Phones start light: scale 1 and no vectors. Wider screens keep the store defaults. */
export function deviceDefaults(width: number): { scale?: Scale; showVectors?: boolean } {
  return width < PHONE_MAX_WIDTH ? { scale: 1, showVectors: false } : {}
}
