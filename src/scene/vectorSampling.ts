export const MAX_VECTOR_SEGMENTS = 1500

/** Every step-th fragment gives n segments, n <= MAX_VECTOR_SEGMENTS, covering the whole range. */
export function vectorSampling(count: number): { step: number; n: number } {
  const step = Math.max(1, Math.ceil(count / MAX_VECTOR_SEGMENTS))
  return { step, n: count > 0 ? Math.ceil(count / step) : 0 }
}
