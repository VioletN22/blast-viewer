import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Line, LineBasicMaterial, LineDashedMaterial, Mesh, MeshBasicMaterial } from 'three'
import { digLine, holeIndex, nearestHole } from '../sim/field'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'

/** Time a point takes to travel once its nearest hole has fired, ms. */
const FLIGHT_MS = 1000
/** Half height of the translucent curtain hung on each line, metres: a one-pixel line alone is lost in the muck. */
const CURTAIN_M = 3
const BEFORE = '#ffffff'
const AFTER = '#ffb020'

function fillRibbon(r: Float32Array, line: Float32Array, n: number) {
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 2; k++) {
      const o = i * 6 + k * 3
      r[o] = line[i * 3]
      r[o + 1] = line[i * 3 + 1] + (k === 0 ? -CURTAIN_M : CURTAIN_M)
      r[o + 2] = line[i * 3 + 2]
    }
  }
}

const ease = (u: number) => 1 - (1 - u) * (1 - u)

/**
 * The ore/waste contact at mid-bench. The "before" line is static and dashed
 * white; the "after" line is solid amber and each point eases from its
 * unmoved to its moved position over its nearest hole's fire time plus a
 * flight time, so after the blast it equals digLine(..., true). Both are
 * drawn through the rock (depthTest off) because the line sits inside it.
 */
export function DigLine({ scenario }: { scenario: Scenario }) {
  const { terrain, holes } = scenario
  const show = useBlast((s) => s.showDigLine)
  const d = useMemo(() => {
    const from = digLine(terrain, holes, false)
    const to = digLine(terrain, holes, true)
    const n = from.length / 3
    const fire = new Float32Array(n)
    if (holes.length > 0) {
      const idx = holeIndex(holes, terrain)
      for (let i = 0; i < n; i++) fire[i] = holes[nearestHole(idx, from[i * 3], from[i * 3 + 2])].delayMs
    }
    const mk = (arr: Float32Array) => {
      const g = new BufferGeometry()
      g.setAttribute('position', new BufferAttribute(arr, 3))
      return g
    }
    /** Vertical ribbon along a polyline: two vertices per point, CURTAIN_M above and below it. */
    const ribbon = (src: Float32Array, color: string, opacity: number) => {
      const r = new Float32Array(n * 6)
      const g = new BufferGeometry()
      g.setAttribute('position', new BufferAttribute(r, 3))
      const index: number[] = []
      for (let i = 0; i < n - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
      g.setIndex(index)
      const m = new Mesh(g, new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: DoubleSide }))
      m.renderOrder = 29
      m.frustumCulled = false
      m.visible = false
      fillRibbon(r, src, n)
      return m
    }
    const before = new Line(mk(from), new LineDashedMaterial({ color: BEFORE, dashSize: 2, gapSize: 1.4, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 }))
    before.computeLineDistances()
    const live = new Float32Array(from)
    const after = new Line(mk(live), new LineBasicMaterial({ color: AFTER, depthTest: false, depthWrite: false, transparent: true }))
    const beforeBand = ribbon(from, BEFORE, 0.1)
    const afterBand = ribbon(from, AFTER, 0.22)
    for (const l of [before, after]) {
      l.renderOrder = 30
      l.frustumCulled = false
      l.visible = false
    }
    return { from, to, fire, live, before, after, beforeBand, afterBand, last: -1 }
  }, [terrain, holes])
  useEffect(
    () => () => {
      for (const l of [d.before, d.after, d.beforeBand, d.afterBand]) {
        l.geometry.dispose()
        ;(l.material as LineBasicMaterial).dispose()
      }
    },
    [d],
  )

  useFrame(() => {
    const { timeMs, showDigLine } = useBlast.getState()
    d.before.visible = d.after.visible = d.beforeBand.visible = d.afterBand.visible = showDigLine
    if (!showDigLine || d.last === timeMs) return
    d.last = timeMs
    const { from, to, fire, live } = d
    for (let i = 0; i < fire.length; i++) {
      const u = ease(Math.min(1, Math.max(0, (timeMs - fire[i]) / FLIGHT_MS)))
      const o = i * 3
      live[o] = from[o] + (to[o] - from[o]) * u
      live[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * u
      live[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * u
    }
    ;(d.after.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true
    const band = d.afterBand.geometry.getAttribute('position') as BufferAttribute
    fillRibbon(band.array as Float32Array, live, fire.length)
    band.needsUpdate = true
  })

  if (holes.length === 0 || !show) return null
  return (
    <>
      <primitive object={d.beforeBand} />
      <primitive object={d.afterBand} />
      <primitive object={d.before} />
      <primitive object={d.after} />
    </>
  )
}
