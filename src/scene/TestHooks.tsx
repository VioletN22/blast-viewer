import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Scenario } from '../sim/scenario'
import type { DrillHole } from '../sim/types'
import { useBlast } from '../state/store'

/** True in dev and in the e2e build (VITE_E2E=1); false, and tree-shaken, in the deployed build. */
export const TEST_HOOKS = import.meta.env.DEV || import.meta.env.VITE_E2E === '1'

export interface BlastTestHooks {
  /** Client pixel position of a hole collar, or null if it is behind the camera. */
  holeScreen(id: string): { x: number; y: number } | null
  /** The not-yet-fired hole nearest the canvas centre whose collar is not under a UI panel. */
  holeOnScreen(): { id: string; x: number; y: number } | null
  /** Horizontal span of the hole collars on screen as a fraction of the canvas width, or null if any is behind the camera. */
  blockSpan(): number | null
  /** Turns the camera about the vertical axis through the orbit target by `rad` (positive is anticlockwise from above), as an orbit drag would. */
  orbitBy(rad: number): void
}

/** Dev/e2e-only: projects hole positions to screen pixels so tests can click holes in WebGL. */
export function TestHooks({ scenario }: { scenario: Scenario }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const v = new Vector3()
    const project = (h: DrillHole) => {
      camera.updateMatrixWorld()
      v.set(h.x, h.collarY + 0.25, h.z).project(camera)
      if (v.z > 1) return null
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
    const hooks: BlastTestHooks = {
      holeScreen(id) {
        const h = scenario.holes.find((x) => x.id === id)
        return h ? project(h) : null
      },
      holeOnScreen() {
        const t = useBlast.getState().timeMs
        const r = gl.domElement.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        let best: { id: string; x: number; y: number } | null = null
        let bestD = Infinity
        for (const h of scenario.holes) {
          if (t > 0 && t >= h.delayMs) continue
          const p = project(h)
          if (!p || document.elementFromPoint(p.x, p.y) !== gl.domElement) continue
          const d = Math.hypot(p.x - cx, p.y - cy)
          if (d < bestD) {
            bestD = d
            best = { id: h.id, ...p }
          }
        }
        return best
      },
      blockSpan() {
        let lo = Infinity
        let hi = -Infinity
        for (const h of scenario.holes) {
          const p = project(h)
          if (!p) return null
          lo = Math.min(lo, p.x)
          hi = Math.max(hi, p.x)
        }
        const w = gl.domElement.getBoundingClientRect().width
        return w > 0 && hi > lo ? (hi - lo) / w : null
      },
      orbitBy(rad) {
        if (!controls) return
        const t = controls.target
        const dx = camera.position.x - t.x
        const dz = camera.position.z - t.z
        const c = Math.cos(rad)
        const sn = Math.sin(rad)
        camera.position.x = t.x + dx * c + dz * sn
        camera.position.z = t.z - dx * sn + dz * c
        camera.lookAt(t)
        controls.update()
        invalidate()
      },
    }
    const w = window as unknown as { __blastTest?: BlastTestHooks }
    w.__blastTest = hooks
    return () => {
      if (w.__blastTest === hooks) delete w.__blastTest
    }
  }, [scenario, camera, gl, controls, invalidate])
  return null
}
