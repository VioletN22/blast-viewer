/** Shared easing curves; u is clamped by the caller to [0, 1]. */

/** Quadratic ease-out: fast start, slowing toward the end. */
export const easeOut = (u: number) => 1 - (1 - u) * (1 - u)

/** Cubic smoothstep from 0 to 1. */
export const smoothstep = (u: number) => u * u * (3 - 2 * u)
