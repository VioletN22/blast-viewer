import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InterleavedBufferAttribute, Mesh, MeshBasicMaterial } from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { ACCENT } from '../theme'
import { buildDigZone, digZoneAt } from './digZone'

const BEFORE = '#ffffff'
const AFTER = ACCENT
const LINE_PX = 3

/** Writes a closed polyline (xyz triplets) into a Line2 geometry's segment buffer in place. */
function writeSegments(g: LineGeometry, pts: Float32Array) {
  const start = g.getAttribute('instanceStart') as InterleavedBufferAttribute
  const arr = start.data.array as Float32Array
  const n = pts.length / 3
  for (let i = 0; i < n - 1; i++) {
    const a = i * 3
    const o = i * 6
    for (let k = 0; k < 6; k++) arr[o + k] = pts[a + k]
  }
  start.data.needsUpdate = true
}

/**
 * The ore zone at mid-bench as a closed outline. Before: static dashed white.
 * After: solid, in the accent, with a faint fill, each point easing from its unmoved to
 * its moved position on the fragments' fire and flight times, so at the end it
 * equals digLine(..., true). Drawn through the rock (depthTest off), with fat
 * lines (Line2) because WebGL ignores linewidth.
 */
export function DigLine({ scenario }: { scenario: Scenario }) {
  const size = useThree((s) => s.size)
  const zone = useMemo(() => buildDigZone(scenario), [scenario])
  const d = useMemo(() => {
    const n = zone.from.length / 3
    const mkLine = (color: string, dashed: boolean) => {
      const g = new LineGeometry()
      g.setPositions(zone.from)
      const m = new LineMaterial({ color: new Color(color).getHex(), linewidth: LINE_PX, worldUnits: false, dashed, dashSize: 2.2, gapSize: 1.6, transparent: true, depthTest: false, depthWrite: false })
      const l = new Line2(g, m)
      if (dashed) l.computeLineDistances()
      l.renderOrder = 31
      l.frustumCulled = false
      l.visible = false
      return l
    }
    const before = mkLine(BEFORE, true)
    const after = mkLine(AFTER, false)
    // Fill: a triangle fan from the centroid (the zone is a convex-ish lens), rewritten each change.
    const fillPos = new Float32Array((n + 1) * 3)
    const fg = new BufferGeometry()
    fg.setAttribute('position', new BufferAttribute(fillPos, 3))
    const idx: number[] = []
    for (let i = 0; i < n - 1; i++) idx.push(n, i, i + 1)
    fg.setIndex(idx)
    const fill = new Mesh(fg, new MeshBasicMaterial({ color: AFTER, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false, side: DoubleSide }))
    fill.renderOrder = 30
    fill.frustumCulled = false
    fill.visible = false
    return { before, after, fill, fillPos, live: new Float32Array(zone.from), last: -1 }
  }, [zone])
  useEffect(
    () => () => {
      for (const o of [d.before, d.after]) {
        o.geometry.dispose()
        o.material.dispose()
      }
      d.fill.geometry.dispose()
      ;(d.fill.material as MeshBasicMaterial).dispose()
    },
    [d],
  )
  useEffect(() => {
    d.before.material.resolution.set(size.width, size.height)
    d.after.material.resolution.set(size.width, size.height)
  }, [d, size])

  useFrame(() => {
    // The only visibility gate: the objects stay mounted so toggling does not rebuild buffers.
    const { timeMs, showDigLine } = useBlast.getState()
    d.before.visible = d.after.visible = d.fill.visible = showDigLine
    if (!showDigLine || d.last === timeMs) return
    d.last = timeMs
    const { live, fillPos } = d
    digZoneAt(zone, timeMs, live)
    writeSegments(d.after.geometry, live)
    const n = live.length / 3
    let cx = 0
    let cy = 0
    let cz = 0
    for (let i = 0; i < n - 1; i++) {
      cx += live[i * 3]
      cy += live[i * 3 + 1]
      cz += live[i * 3 + 2]
      fillPos[i * 3] = live[i * 3]
      fillPos[i * 3 + 1] = live[i * 3 + 1]
      fillPos[i * 3 + 2] = live[i * 3 + 2]
    }
    fillPos[(n - 1) * 3] = live[(n - 1) * 3]
    fillPos[(n - 1) * 3 + 1] = live[(n - 1) * 3 + 1]
    fillPos[(n - 1) * 3 + 2] = live[(n - 1) * 3 + 2]
    fillPos[n * 3] = cx / (n - 1)
    fillPos[n * 3 + 1] = cy / (n - 1)
    fillPos[n * 3 + 2] = cz / (n - 1)
    ;(d.fill.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true
  })

  if (zone.from.length === 0) return null
  return (
    <>
      <primitive object={d.fill} />
      <primitive object={d.before} />
      <primitive object={d.after} />
    </>
  )
}
