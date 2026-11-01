import { create } from 'zustand'
import type { PerfStats } from '../ui/perfFormat'

/** Renderer stats sampled by PerfProbe at most four times a second. */
export const usePerf = create<PerfStats>()(() => ({ fps: 0, calls: 0, triangles: 0, instances: 0 }))
