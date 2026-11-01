import { usePerf } from '../state/perf'
import { useBlast } from '../state/store'
import { formatPerf } from './perfFormat'

/** Small monospace stats panel, top right of the viewport. */
export function PerfOverlay() {
  const show = useBlast((s) => s.showPerf)
  const fps = usePerf((s) => s.fps)
  const calls = usePerf((s) => s.calls)
  const triangles = usePerf((s) => s.triangles)
  const instances = usePerf((s) => s.instances)
  if (!show) return null
  return (
    <div className="perf-overlay" aria-label="Performance">
      {formatPerf({ fps, calls, triangles, instances }).map((l) => (
        <div key={l.split(' ').slice(1).join(' ')}>{l}</div>
      ))}
    </div>
  )
}
