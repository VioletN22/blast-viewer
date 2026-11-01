export interface PerfStats {
  fps: number
  calls: number
  triangles: number
  instances: number
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

function compact(n: number): string {
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toString()}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return n.toLocaleString('en-US')
}

/** Overlay lines: fps, draw calls, triangles (k/M past 10,000) and instances. */
export function formatPerf(p: PerfStats): string[] {
  const calls = Math.round(p.calls)
  const inst = Math.round(p.instances)
  return [
    `${Math.round(p.fps)} fps`,
    plural(calls, 'draw call', 'draw calls'),
    `${compact(Math.round(p.triangles))} triangles`,
    plural(inst, 'instance', 'instances'),
  ]
}
