import type { Scale } from '../sim/scenario'

/** A window narrower than this is a phone held in portrait. */
export const PHONE_MAX_WIDTH = 768
/** A window this short or shorter is a phone held in landscape. */
export const LANDSCAPE_PHONE_MAX_HEIGHT = 500

/**
 * True for a phone, matching the phone CSS media query
 * `(max-width: 767px), (max-height: 500px)`, so layout and defaults agree.
 * A short desktop window (e.g. 1366x650) is not a phone.
 */
export function isPhone(width: number, height: number): boolean {
  return width < PHONE_MAX_WIDTH || height <= LANDSCAPE_PHONE_MAX_HEIGHT
}

/** Phones start light: scale 1 and no vectors. Larger screens keep the store defaults. */
export function deviceDefaults(width: number, height: number): { scale?: Scale; showVectors?: boolean } {
  return isPhone(width, height) ? { scale: 1, showVectors: false } : {}
}

/** The current window's defaults. */
export function windowDefaults(): ReturnType<typeof deviceDefaults> {
  return deviceDefaults(window.innerWidth, window.innerHeight)
}
