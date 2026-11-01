import type { Scale } from '../sim/scenario'

/** A screen whose shorter side is below this is a phone, in either orientation. */
export const PHONE_SHORT_SIDE = 768
/** A touch screen this short or shorter is a phone held in landscape. The phone CSS uses the same height. */
export const LANDSCAPE_PHONE_MAX_HEIGHT = 500

/**
 * True for a phone: the shorter side is under 768 px (so a phone held in
 * landscape still counts), or a coarse pointer on a screen 500 px tall or less.
 */
export function isPhone(width: number, height: number, coarsePointer = false): boolean {
  return Math.min(width, height) < PHONE_SHORT_SIDE || (coarsePointer && height <= LANDSCAPE_PHONE_MAX_HEIGHT)
}

/** Phones start light: scale 1 and no vectors. Larger screens keep the store defaults. */
export function deviceDefaults(width: number, height: number, coarsePointer = false): { scale?: Scale; showVectors?: boolean } {
  return isPhone(width, height, coarsePointer) ? { scale: 1, showVectors: false } : {}
}

/** The current window's defaults. */
export function windowDefaults(): ReturnType<typeof deviceDefaults> {
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return deviceDefaults(window.innerWidth, window.innerHeight, coarse)
}
