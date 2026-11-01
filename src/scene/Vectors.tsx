import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineSegments } from 'three'
import { positionAt } from '../sim/blast'
import { firstFireMs, hasFired } from '../sim/fire'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { rampColor } from './colors'
import { vectorSampling } from './vectorSampling'

/**
 * Movement vectors: one LineSegments, every Nth fragment (at most ~1,500),
 * each drawn from its start to where it is now and coloured by distance moved
 * so far on the displacement ramp. Drawn through the rock and muck.
 */
export function Vectors({ scenario }: { scenario: Scenario }) {
  const { fragments: f, holes } = scenario
  const { step, n } = vectorSampling(f.count)
  const obj = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 6), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(n * 6), 3))
    const m = new LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.7 })
    const l = new LineSegments(g, m)
    l.renderOrder = 20
    l.frustumCulled = false
    l.visible = false
    return l
  }, [n])
  const firstFire = useMemo(() => firstFireMs(holes), [holes])
  const state = useMemo(() => ({ c: new Color(), p: new Float32Array(3), last: -1 }), [obj])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as LineBasicMaterial).dispose()
    },
    [obj],
  )

  useFrame(() => {
    // The only visibility gate: unmounting is not used, so the buffers survive toggling.
    const { timeMs, showVectors } = useBlast.getState()
    const visible = showVectors && hasFired(firstFire, timeMs)
    obj.visible = visible
    if (!visible) {
      state.last = -1
      return
    }
    if (state.last === timeMs) return
    state.last = timeMs
    const pos = obj.geometry.getAttribute('position') as BufferAttribute
    const col = obj.geometry.getAttribute('color') as BufferAttribute
    const pa = pos.array as Float32Array
    const ca = col.array as Float32Array
    const { c, p } = state
    const inv = f.maxMagnitude > 0 ? 1 / f.maxMagnitude : 0
    for (let k = 0; k < n; k++) {
      const i = k * step
      const o3 = i * 3
      positionAt(f, i, timeMs, p, 0)
      const dx = p[0] - f.start[o3]
      const dy = p[1] - f.start[o3 + 1]
      const dz = p[2] - f.start[o3 + 2]
      rampColor(Math.sqrt(dx * dx + dy * dy + dz * dz) * inv, c)
      const j = k * 6
      pa[j] = f.start[o3]
      pa[j + 1] = f.start[o3 + 1]
      pa[j + 2] = f.start[o3 + 2]
      pa[j + 3] = p[0]
      pa[j + 4] = p[1]
      pa[j + 5] = p[2]
      ca[j] = ca[j + 3] = c.r
      ca[j + 1] = ca[j + 4] = c.g
      ca[j + 2] = ca[j + 5] = c.b
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  if (f.count === 0) return null
  return <primitive object={obj} />
}
