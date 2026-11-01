import { create } from 'zustand'
import { buildScenario, type Scenario } from '../sim/scenario'

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
  selectedHoleId: string | null

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
  speed: 1,
  colorBy: 'movement',
  showBefore: false,
  showVectors: true,
  showDigLine: false,
  showPerf: false,
  scale: 1,
  selectedHoleId: null,

  setScenario: (scenario) =>
    set({ scenario, scale: scenario.params.scale, timeMs: clamp(get().timeMs, 0, scenario.durationMs), selectedHoleId: null }),
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
      set({ scale })
      return
    }
    if (scenario.params.scale === scale) return
    const frac = scenario.durationMs > 0 ? timeMs / scenario.durationMs : 0
    const next = buildScenario({ ...scenario.params, scale })
    set({ scenario: next, scale, timeMs: frac * next.durationMs, selectedHoleId: null })
  },
  selectHole: (selectedHoleId) => set({ selectedHoleId }),
}))
