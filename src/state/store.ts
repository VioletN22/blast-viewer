import { create } from 'zustand'
import { DEFAULT_SPEED } from '../lib/timelineFormat'
import { loadDem } from '../lib/loadDem'
import { loadPoints } from '../lib/loadPoints'
import type { PointCloud } from '../lib/xyz'
import type { Dem } from '../sim/dem'
import { buildScenario, NoBenchError, type Ground, type Scale, type Scenario } from '../sim/scenario'

export type { Ground, Scale }
export type ColorBy = 'movement' | 'delay'
/** What the camera frames: the whole pit, or the blast block. */
export type View = 'pit' | 'blast'
export type Exaggeration = 1 | 1.5 | 2

/** A crest further than this from the click gets a note saying where the blast went. */
const MOVED_NOTE_M = 40

/** The note after a click on the pit: where the blast went, when it is not under the click. */
export function movedNote(movedM: number | null): string | null {
  if (movedM === null || movedM <= MOVED_NOTE_M) return null
  return `Placed on the nearest face, ${Math.round(movedM / 10) * 10} m away.`
}

/** Base path of the baked Super Pit DEM (.png grid and .json metadata). */
export const PIT_DEM_PATH = `${import.meta.env.BASE_URL}terrain/super-pit`
export const SAMPLE_POINTS_URL = `${import.meta.env.BASE_URL}samples/super-pit-points.csv`

export interface BlastState {
  scenario: Scenario | null
  timeMs: number
  playing: boolean
  /** Playback rate: 1 is real time. */
  speed: number
  colorBy: ColorBy
  showBefore: boolean
  showVectors: boolean
  showDigLine: boolean
  showPerf: boolean
  scale: Scale
  /** A scale asked for before a scenario was loaded; setScenario applies it. */
  pendingScale: Scale | null
  selectedHoleId: string | null
  /** The ground the next scenario is built on. */
  ground: Ground
  dem: Dem | null
  demStatus: 'idle' | 'loading' | 'ready' | 'error'
  view: View
  /** Bumped whenever the camera should frame `view` again. */
  viewSeq: number
  /** Where the last click on the pit put the blast when it is not where the click was, or why nothing moved. */
  siteNote: string | null
  siteNoteError: boolean
  /** Vertical exaggeration on the pit. */
  exaggeration: Exaggeration
  /** Loaded survey points; while set, the view shows them instead of the terrain and the blast. */
  cloud: PointCloud | null
  /** Where the loaded points came from. */
  cloudSource: 'sample' | 'file' | null
  cloudBusy: boolean
  /** The last points file problem (too big, no points, unreadable), or null. */
  cloudNote: string | null

  /** Installs a scenario, rebuilding it first if setScale was called before it loaded. */
  setScenario(s: Scenario): void
  /** Clamps to [0, durationMs]. */
  setTime(ms: number): void
  /** Starts playback; from the end it restarts at 0. */
  play(): void
  pause(): void
  setSpeed(speed: number): void
  setColorBy(c: ColorBy): void
  setShowBefore(v: boolean): void
  setShowVectors(v: boolean): void
  setShowDigLine(v: boolean): void
  setShowPerf(v: boolean): void
  /** Rebuilds the scenario at the new scale and keeps timeMs as a fraction of the duration. */
  setScale(s: Scale): void
  selectHole(id: string | null): void
  /** Loads the pit DEM once; later calls reuse it. */
  ensureDem(): Promise<Dem>
  /** Rebuilds the scenario on the other ground (loading the DEM first if needed), at t = 0. */
  setGround(g: Ground): Promise<void>
  /** Lays the blast on the bench nearest (x, z) on the pit and frames it. */
  placeSite(x: number, z: number): void
  setView(v: View): void
  setExaggeration(k: Exaggeration): void
  /** Parses a points file, or the sample when no file is given, and shows it. */
  openPoints(file?: File): Promise<void>
  closePoints(): void
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const useBlast = create<BlastState>()((set, get) => ({
  scenario: null,
  timeMs: 0,
  playing: false,
  // About an 11 s playback of the default 2.7 s blast, so the firing sequence can be followed.
  speed: DEFAULT_SPEED,
  colorBy: 'movement',
  showBefore: false,
  showVectors: true,
  showDigLine: true,
  showPerf: false,
  scale: 1,
  pendingScale: null,
  selectedHoleId: null,
  ground: 'bench',
  dem: null,
  demStatus: 'idle',
  view: 'blast',
  viewSeq: 0,
  siteNote: null,
  siteNoteError: false,
  exaggeration: 1.5,
  cloud: null,
  cloudSource: null,
  cloudBusy: false,
  cloudNote: null,

  setScenario: (loaded) => {
    const pending = get().pendingScale
    // Synchronous rebuild: scale 4 builds in about 14 ms.
    const scenario = pending && pending !== loaded.params.scale ? buildScenario({ ...loaded.params, scale: pending }, loaded.dem) : loaded
    const ground = scenario.params.ground ?? 'bench'
    set({
      scenario,
      ground,
      view: ground === 'pit' ? 'pit' : 'blast',
      viewSeq: get().viewSeq + 1,
      scale: scenario.params.scale,
      pendingScale: null,
      timeMs: clamp(get().timeMs, 0, scenario.durationMs),
      selectedHoleId: null,
    })
  },
  setTime: (ms) => {
    const d = get().scenario?.durationMs ?? 0
    set({ timeMs: clamp(Number.isFinite(ms) ? ms : 0, 0, d) })
  },
  play: () => {
    const { scenario, timeMs } = get()
    if (!scenario) return
    set({ playing: true, timeMs: timeMs >= scenario.durationMs ? 0 : timeMs })
  },
  pause: () => set({ playing: false }),
  setSpeed: (speed) => set({ speed: clamp(speed, 0.05, 4) }),
  setColorBy: (colorBy) => set({ colorBy }),
  setShowBefore: (showBefore) => set({ showBefore }),
  setShowVectors: (showVectors) => set({ showVectors }),
  setShowDigLine: (showDigLine) => set({ showDigLine }),
  setShowPerf: (showPerf) => set({ showPerf }),
  setScale: (scale) => {
    const { scenario, timeMs } = get()
    if (!scenario) {
      set({ scale, pendingScale: scale })
      return
    }
    if (scenario.params.scale === scale) return
    const frac = scenario.durationMs > 0 ? timeMs / scenario.durationMs : 0
    const next = buildScenario({ ...scenario.params, scale }, scenario.dem)
    set({ scenario: next, scale, timeMs: frac * next.durationMs, selectedHoleId: null, viewSeq: get().viewSeq + 1 })
  },
  selectHole: (selectedHoleId) => set({ selectedHoleId }),
  ensureDem: async () => {
    const have = get().dem
    if (have) return have
    set({ demStatus: 'loading' })
    try {
      const dem = await loadDem(PIT_DEM_PATH)
      set({ dem, demStatus: 'ready' })
      return dem
    } catch (e) {
      set({ demStatus: 'error' })
      throw e
    }
  },
  setGround: async (ground) => {
    const { scenario } = get()
    set({ cloud: null, cloudSource: null, cloudNote: null, siteNote: null, siteNoteError: false })
    if (!scenario || (scenario.params.ground ?? 'bench') === ground) {
      set({ ground })
      return
    }
    let dem: Dem | null = null
    if (ground === 'pit') {
      try {
        dem = await get().ensureDem()
      } catch {
        return
      }
    }
    // A new ground starts from its default site.
    const params = { ...get().scenario!.params, ground }
    delete params.site
    let next: Scenario
    try {
      next = buildScenario(params, dem)
    } catch (e) {
      if (e instanceof NoBenchError) {
        set({ siteNote: e.message, siteNoteError: true })
        return
      }
      throw e
    }
    set({ scenario: next, ground, timeMs: 0, playing: false, selectedHoleId: null, view: ground === 'pit' ? 'pit' : 'blast', viewSeq: get().viewSeq + 1 })
  },
  placeSite: (x, z) => {
    const { scenario } = get()
    if (!scenario || !scenario.dem) return
    try {
      const next = buildScenario({ ...scenario.params, site: { x, z } }, scenario.dem)
      set({ scenario: next, timeMs: 0, playing: false, selectedHoleId: null, siteNote: movedNote(next.movedM), siteNoteError: false, view: 'blast', viewSeq: get().viewSeq + 1 })
    } catch (e) {
      if (e instanceof NoBenchError) set({ siteNote: e.message, siteNoteError: true })
      else throw e
    }
  },
  setView: (view) => set({ view, viewSeq: get().viewSeq + 1 }),
  setExaggeration: (exaggeration) => set({ exaggeration, viewSeq: get().viewSeq + 1 }),
  openPoints: async (file) => {
    set({ cloudBusy: true, cloudNote: null })
    try {
      const cloud = await loadPoints(file ? { file } : { url: SAMPLE_POINTS_URL })
      set({ cloud, cloudSource: file ? 'file' : 'sample', cloudBusy: false, playing: false, selectedHoleId: null })
    } catch (e) {
      set({ cloudBusy: false, cloudNote: e instanceof Error ? e.message : String(e) })
    }
  },
  closePoints: () => set({ cloud: null, cloudSource: null, cloudNote: null }),
}))
