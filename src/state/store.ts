import { create } from 'zustand'
import { buildScenario, type Scenario } from '../sim/scenario'
import { DEFAULT_SPEED } from '../ui/timelineFormat'

export type Scale = 1 | 2 | 3 | 4
export type ColorBy = 'movement' | 'delay'

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
  showDigLine: false,
  showPerf: false,
  scale: 1,
  pendingScale: null,
  selectedHoleId: null,

  setScenario: (loaded) => {
    const pending = get().pendingScale
    // Synchronous rebuild: scale 4 builds in about 14 ms.
    const scenario = pending && pending !== loaded.params.scale ? buildScenario({ ...loaded.params, scale: pending }) : loaded
    set({
      scenario,
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
    const next = buildScenario({ ...scenario.params, scale })
    set({ scenario: next, scale, timeMs: frac * next.durationMs, selectedHoleId: null })
  },
  selectHole: (selectedHoleId) => set({ selectedHoleId }),
}))
