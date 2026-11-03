import { useEffect, useState } from 'react'
import { loadScenario } from './sim/loadScenario'
import { buildScenario, NoBenchError, type Ground } from './sim/scenario'
import { CloudStage } from './scene/CloudStage'
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
import { PointsLegend } from './ui/PointsLegend'
import { ScaleBar } from './ui/ScaleBar'
import { Timeline } from './ui/Timeline'
import { useAutoplay } from './ui/useAutoplay'

if (TEST_HOOKS) {
  // Dev and e2e only, for screenshots and tests: window.__blast.getState().setTime(ms)
  ;(window as unknown as { __blast: typeof useBlast }).__blast = useBlast
}

// ?t=<ms> opens at a given time (clamped); "end" opens at the end. A linked time is never overridden by autoplay.
const query = new URLSearchParams(window.location.search)
const linkedTime = query.get('t')
// ?terrain=bench or ?terrain=pit picks the ground; the default is the pit.
const DEFAULT_GROUND: Ground = 'pit'
const linkedGround: Ground = query.get('terrain') === 'bench' ? 'bench' : query.get('terrain') === 'pit' ? 'pit' : DEFAULT_GROUND

export default function App() {
  const scenario = useBlast((s) => s.scenario)
  const cloud = useBlast((s) => s.cloud)
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
    // The pit DEM loads alongside the params; if it fails the viewer opens on the synthetic bench.
    const dem = linkedGround === 'pit' ? useBlast.getState().ensureDem().catch(() => null) : Promise.resolve(null)
    Promise.all([loadScenario(`${import.meta.env.BASE_URL}scenarios/default.json`), dem])
      .then(([params, d]) => {
        if (cancelled) return
        let s
        try {
          s = buildScenario({ ...params, ground: d ? 'pit' : 'bench' }, d)
        } catch (e) {
          // No bench found on the pit: open on the synthetic bench instead.
          if (!(e instanceof NoBenchError)) throw e
          s = buildScenario({ ...params, ground: 'bench' })
        }
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
      <section
        className="viewport"
        aria-label="3D bench view"
        onDragOver={(e) => {
          if (webgl && e.dataTransfer.types.includes('Files')) e.preventDefault()
        }}
        onDrop={(e) => {
          const f = e.dataTransfer.files[0]
          if (!webgl || !f) return
          e.preventDefault()
          void useBlast.getState().openPoints(f)
        }}
      >
        {!webgl && <Fallback reason="no-webgl" />}
        {webgl && scenario && cloud && (
          <>
            <Controls />
            <StageBoundary resetKey={cloud} fallback={<Fallback reason="stopped" />}>
              <CloudStage cloud={cloud} />
              <PerfOverlay />
              <div className="dock">
                <ScaleBar />
                <div className="dock-row">
                  <PointsLegend />
                </div>
              </div>
            </StageBoundary>
          </>
        )}
        {webgl && scenario && !cloud && (
          <>
            {/* Outside the boundary, so it stays over the fallback: another stress scale is a new scenario, which retries the live view. */}
            <Controls />
            {/* The overlay and the dock sit inside the boundary, so they go in the same render as the canvas, with no frame of dock over the fallback. */}
            <StageBoundary resetKey={scenario} fallback={<Fallback reason="stopped" />}>
              <Stage scenario={scenario} />
              <PerfOverlay />
              <div className="dock">
                <ScaleBar />
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
