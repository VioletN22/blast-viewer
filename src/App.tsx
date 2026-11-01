import { useEffect, useState } from 'react'
import { loadScenario } from './sim/loadScenario'
import { buildScenario } from './sim/scenario'
import { Stage } from './scene/Stage'
import { StageBoundary } from './scene/StageBoundary'
import { useBlast } from './state/store'
import { PerfOverlay } from './ui/PerfOverlay'

if (import.meta.env.DEV) {
  // Dev-only hook for screenshots and debugging: window.__blast.getState().setTime(ms)
  ;(window as unknown as { __blast: typeof useBlast }).__blast = useBlast
}

export default function App() {
  const scenario = useBlast((s) => s.scenario)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadScenario(`${import.meta.env.BASE_URL}scenarios/default.json`)
      .then((params) => {
        if (cancelled) return
        const s = buildScenario(params)
        useBlast.getState().setScenario(s)
        // ?t=<ms> opens at a given time (clamped); "end" opens at the end.
        const t = new URLSearchParams(window.location.search).get('t')
        if (t !== null) useBlast.getState().setTime(t === 'end' ? s.durationMs : Number(t))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main data-testid="app-root" className="app">
      <header className="app-header">
        <h1>Bench blast viewer</h1>
        <p>Synthetic data. Illustrative model, not a prediction.</p>
      </header>
      <section className="viewport" aria-label="3D bench view">
        {scenario && (
          <StageBoundary>
            <Stage scenario={scenario} />
          </StageBoundary>
        )}
        <PerfOverlay />
        {!scenario && !error && <p className="status">Building scenario…</p>}
        {error && (
          <div className="status status-error" role="alert">
            <strong>Could not load the scenario.</strong>
            <span>{error}</span>
          </div>
        )}
      </section>
    </main>
  )
}
