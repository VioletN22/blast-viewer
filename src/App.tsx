import { useEffect, useState } from 'react'
import { loadScenario } from './sim/loadScenario'
import { buildScenario } from './sim/scenario'
import { Stage } from './scene/Stage'
import { StageBoundary } from './scene/StageBoundary'
import { TEST_HOOKS } from './scene/TestHooks'
import { useBlast } from './state/store'
import { windowDefaults } from './lib/device'
import { hasWebGL } from './lib/webgl'
import { Controls } from './ui/Controls'
import { Fallback } from './ui/Fallback'
import { Header } from './ui/Header'
import { HoleCard } from './ui/HoleCard'
import { Legend } from './ui/Legend'
import { PerfOverlay } from './ui/PerfOverlay'
import { Timeline } from './ui/Timeline'
import { useAutoplay } from './ui/useAutoplay'

if (TEST_HOOKS) {
  // Dev and e2e only, for screenshots and tests: window.__blast.getState().setTime(ms)
  ;(window as unknown as { __blast: typeof useBlast }).__blast = useBlast
}

// ?t=<ms> opens at a given time (clamped); "end" opens at the end. A linked time is never overridden by autoplay.
const linkedTime = new URLSearchParams(window.location.search).get('t')

export default function App() {
  const scenario = useBlast((s) => s.scenario)
  const [error, setError] = useState<string | null>(null)
  // Probed once: without WebGL the page is the header plus a recording of the live viewer.
  const [webgl] = useState(hasWebGL)
  useAutoplay(linkedTime === null && webgl)

  useEffect(() => {
    // Without WebGL nothing reads the scenario, so it is never fetched or built.
    if (!webgl) return
    // Phones start light (scale 1, no vectors); applied once, before the scenario loads.
    const d = windowDefaults()
    if (d.scale) useBlast.getState().setScale(d.scale)
    if (d.showVectors === false) useBlast.getState().setShowVectors(false)
    let cancelled = false
    loadScenario(`${import.meta.env.BASE_URL}scenarios/default.json`)
      .then((params) => {
        if (cancelled) return
        const s = buildScenario(params)
        useBlast.getState().setScenario(s)
        if (linkedTime !== null) useBlast.getState().setTime(linkedTime === 'end' ? s.durationMs : Number(linkedTime))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [webgl])

  return (
    <main data-testid="app-root" className="app">
      <Header />
      <section className="viewport" aria-label="3D bench view">
        {!webgl && <Fallback reason="no-webgl" />}
        {webgl && scenario && (
          <>
            {/* Outside the boundary, so it stays over the fallback: another stress scale is a new scenario, which retries the live view. */}
            <Controls />
            {/* The overlay and the dock sit inside the boundary, so they go in the same render as the canvas, with no frame of dock over the fallback. */}
            <StageBoundary resetKey={scenario} fallback={<Fallback reason="stopped" />}>
              <Stage scenario={scenario} />
              <PerfOverlay />
              <div className="dock">
                <div className="dock-row">
                  <Legend />
                  <HoleCard />
                </div>
                <Timeline />
              </div>
            </StageBoundary>
          </>
        )}
        {webgl && !scenario && !error && <p className="status">Building scenario…</p>}
        {webgl && error && (
          <div className="status status-error" role="alert">
            <strong>Could not load the scenario.</strong>
            <span>{error}</span>
          </div>
        )}
      </section>
    </main>
  )
}
