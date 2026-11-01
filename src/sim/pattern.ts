import { DEFAULT_PATTERN, type DrillHole, type PatternOptions, type Terrain } from './types'

/** Drill pattern on the bench top. Row 0 is the front row, one burden behind the crest. */
export function generatePattern(t: Terrain, opts: Partial<PatternOptions> = {}): DrillHole[] {
  const o: PatternOptions = { ...DEFAULT_PATTERN, ...opts }
  const { benchHeight, crestZ } = t.options
  const depth = benchHeight + o.subdrill
  const chargeKg = o.powderFactor * o.burden * o.spacing * benchHeight
  const holes: DrillHole[] = []

  for (let row = 0; row < o.rows; row++) {
    const z = crestZ - o.burden * (row + 1)
    const offset = o.staggered && row % 2 === 1 ? o.spacing / 2 : 0
    for (let col = 0; col < o.cols; col++) {
      const x = (col - (o.cols - 1) / 2) * o.spacing + offset
      holes.push({
        id: `H${row}-${col}`,
        row,
        col,
        x,
        z,
        collarY: t.heightAt(x, z),
        depth,
        chargeKg,
        delayMs: Math.abs(col - o.initiationCol) * o.holeDelayMs + row * o.rowDelayMs,
      })
    }
  }
  return holes
}
