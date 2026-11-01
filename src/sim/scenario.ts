import { simulateBlast, type Fragments } from './blast'
import { validateScenarioParams } from './loadScenario'
import { generatePattern } from './pattern'
import { generateTerrain } from './terrain'
import { DEFAULT_PATTERN, DEFAULT_TERRAIN, type DrillHole, type PatternOptions, type Terrain, type TerrainOptions } from './types'

export interface ScenarioParams {
  seed: number
  scale: 1 | 2 | 3 | 4
  terrain?: Partial<TerrainOptions>
  pattern?: Partial<PatternOptions>
}

export interface Scenario {
  terrain: Terrain
  holes: DrillHole[]
  fragments: Fragments
  durationMs: number
  params: ScenarioParams
}

const COLS_BY_SCALE = [20, 30, 40, 50] as const
const FRAGMENTS_BY_SCALE = [24, 40, 64, 96] as const
/** Ground kept either side of the pattern so the muck pile stays on the terrain. */
const TERRAIN_MARGIN_M = 40

/**
 * Builds a deterministic scenario. Scale sets the hole columns (20/30/40/50)
 * and fragments per hole (24/40/64/96); it overrides pattern.cols. The
 * initiation hole defaults to the middle column, and the terrain is widened
 * when the pattern would not fit with a margin.
 */
export function buildScenario(p: ScenarioParams): Scenario {
  // Runtime guard for untyped callers: throws a readable "Scenario params:" error on a bad shape.
  validateScenarioParams(p)
  const s = p.scale - 1
  const cols = COLS_BY_SCALE[s]
  const pattern: Partial<PatternOptions> = {
    ...p.pattern,
    // Scale always sets the column count, overriding any pattern.cols in the params.
    cols,
    // Fire from the middle column unless the params name one.
    initiationCol: p.pattern?.initiationCol ?? Math.floor(cols / 2),
  }
  const spacing = pattern.spacing ?? DEFAULT_PATTERN.spacing
  const span = (cols - 1) * spacing + spacing / 2
  const baseWidth = p.terrain?.width ?? DEFAULT_TERRAIN.width
  const terrain = generateTerrain({
    ...p.terrain,
    // The terrain noise follows the scenario seed unless terrain.seed is given.
    seed: p.terrain?.seed ?? p.seed,
    // Widen the terrain to the pattern span + 40 m so the muck pile stays on the ground (scale 4: 298 m).
    width: Math.max(baseWidth, Math.ceil(span + TERRAIN_MARGIN_M)),
  })
  const holes = generatePattern(terrain, pattern)
  const fragments = simulateBlast(terrain, holes, { fragmentsPerHole: FRAGMENTS_BY_SCALE[s], seed: p.seed })
  let lastFire = 0
  for (const h of holes) if (h.delayMs > lastFire) lastFire = h.delayMs
  let maxFlight = 0
  for (let i = 0; i < fragments.count; i++) if (fragments.flightMs[i] > maxFlight) maxFlight = fragments.flightMs[i]
  return { terrain, holes, fragments, durationMs: lastFire + maxFlight + 500, params: p }
}
