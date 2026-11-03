import { usePerf } from '../state/perf'
import { useBlast } from '../state/store'
import { formatPerf } from '../lib/perfFormat'

/** Small monospace stats panel, top right of the viewport. */
export function PerfOverlay() {
  const show = useBlast((s) => s.showPerf)
  const fps = usePerf((s) => s.fps)
  const calls = usePerf((s) => s.calls)
  const triangles = usePerf((s) => s.triangles)
  const instances = usePerf((s) => s.instances)
  const points = usePerf((s) => s.points)
  if (!show) return null
  // Decorative stats that change four times a second: a polite live region would chatter, so it is a silent status.
  return (
    <div className="perf-overlay" role="status" aria-live="off" aria-label="Performance">
      {formatPerf({ fps, calls, triangles, instances, points }).map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  )
}
