import { simulateBlast, type Fragments } from './blast'
import { lastFireMs } from './fire'
import { generatePattern } from './pattern'
import type { Dem } from './dem'
import { autoBench, nearestBench, siteFromBench, type BenchFit, type Site } from './site'
import { generateTerrain, terrainFromDem } from './terrain'
import { validateScenarioParams } from './validate'
import { DEFAULT_PATTERN, DEFAULT_TERRAIN, type DrillHole, type PatternOptions, type Terrain, type TerrainOptions } from './types'

/** Stress scale: 1 is the default scenario, 4 the heaviest. */
export type Scale = 1 | 2 | 3 | 4

/** 'bench' is the generated bench; 'pit' is the real surface, which needs the DEM. */
export type Ground = 'bench' | 'pit'

export interface ScenarioParams {
  seed: number
  scale: Scale
  terrain?: Partial<TerrainOptions>
  pattern?: Partial<PatternOptions>
  /** Defaults to 'bench'. */
  ground?: Ground
  /** On the pit: the point the bench is laid from. Without it a bench is picked automatically. */
  site?: { x: number; z: number }
}

export interface Scenario {
  terrain: Terrain
  holes: DrillHole[]
  /** The pattern options the holes were built with: params.pattern resolved over the defaults, with the scale's columns. */
  pattern: PatternOptions
  fragments: Fragments
  durationMs: number
  params: ScenarioParams
  /** On the pit: the frame the model runs in, and the DEM it sits on. Null on the generated bench. */
  site: Site | null
  dem: Dem | null
  /** On the pit, from an asked-for point: how far the crest is from it, metres. Null otherwise. */
  movedM: number | null
}

/** Why a pit scenario could not be built at the asked-for point. */
export class NoBenchError extends Error {}

const autoCache = new WeakMap<Dem, BenchFit | null>()
/** Keeps a bench far enough inside the DEM for the blast patch and the pile. */
const EDGE_M = 100

/** The bench for a pit scenario: picked automatically, or the one nearest the asked-for point. */
function benchFor(dem: Dem, pick: { x: number; z: number } | undefined): { bench: BenchFit; moved: number | null } {
  if (!pick) {
    if (!autoCache.has(dem)) autoCache.set(dem, autoBench(dem))
    const b = autoCache.get(dem)
    if (!b) throw new NoBenchError('No bench found on this surface.')
    return { bench: b, moved: null }
  }
  // A point near the edge is pulled in, then the search runs from there.
  const px = Math.max(-dem.halfX + EDGE_M, Math.min(dem.halfX - EDGE_M, pick.x))
  const pz = Math.max(-dem.halfZ + EDGE_M, Math.min(dem.halfZ - EDGE_M, pick.z))
  const near = nearestBench(dem.heightAt, px, pz, (b) => dem.inside(b.x, b.z, EDGE_M), dem)
  if (!near) throw new NoBenchError('No bench found on this surface.')
  return { bench: near.bench, moved: Math.hypot(near.bench.x - pick.x, near.bench.z - pick.z) }
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
export function buildScenario(p: ScenarioParams, dem: Dem | null = null): Scenario {
  // Runtime guard for untyped callers: throws a readable "Scenario params:" error on a bad shape.
  validateScenarioParams(p)
  const s = p.scale - 1
  const cols = COLS_BY_SCALE[s]
  const pattern: PatternOptions = {
    ...DEFAULT_PATTERN,
    ...p.pattern,
    // Scale always sets the column count, overriding any pattern.cols in the params.
    cols,
    // Fire from the middle column unless the params name one.
    initiationCol: p.pattern?.initiationCol ?? Math.floor(cols / 2),
  }
  const { spacing } = pattern
  const span = (cols - 1) * spacing + spacing / 2
  const baseWidth = p.terrain?.width ?? DEFAULT_TERRAIN.width
  const terrainOpts = {
    ...p.terrain,
    // The terrain noise follows the scenario seed unless terrain.seed is given.
    seed: p.terrain?.seed ?? p.seed,
    // Widen the terrain to the pattern span + 40 m so the muck pile stays on the ground (scale 4: 298 m).
    width: Math.max(baseWidth, Math.ceil(span + TERRAIN_MARGIN_M)),
  }
  let site: Site | null = null
  let movedM: number | null = null
  let terrain
  if (p.ground === 'pit') {
    if (!dem) throw new Error('Scenario params: the pit needs its terrain loaded first')
    const found = benchFor(dem, p.site)
    site = siteFromBench(found.bench)
    movedM = found.moved
    terrain = terrainFromDem(dem, site, terrainOpts)
  } else terrain = generateTerrain(terrainOpts)
  const holes = generatePattern(terrain, pattern)
  const fragments = simulateBlast(terrain, holes, { fragmentsPerHole: FRAGMENTS_BY_SCALE[s], seed: p.seed })
  let maxFlight = 0
  for (let i = 0; i < fragments.count; i++) if (fragments.flightMs[i] > maxFlight) maxFlight = fragments.flightMs[i]
  return { terrain, holes, fragments, pattern, durationMs: lastFireMs(holes) + maxFlight + 500, params: p, site, dem: site ? dem : null, movedM }
}
