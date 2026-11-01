import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { InstancedMesh, Object3D } from 'three'
import { usePerf } from '../state/perf'
import { useBlast } from '../state/store'

const PUSH_EVERY_MS = 250
/** A gap longer than this is idle time in demand mode, not a slow frame. */
const IDLE_GAP_MS = 250
const EMA = 0.12

/**
 * Samples gl.info once the frame is done (Scene.onAfterRender, so the
 * auto-reset counters are not yet cleared and no useFrame priority is taken,
 * which would switch off R3F's own render). Fps is an EMA of frame gaps;
 * the store is written at most four times a second, and only while the overlay is on.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    let prev = 0
    let ema = 0
    let lastPush = 0
    let instances = 0
    const add = (o: Object3D) => {
      const m = o as InstancedMesh
      if (m.isInstancedMesh && m.visible) instances += m.count
    }
    const prevHook = scene.onAfterRender
    scene.onAfterRender = (...args) => {
      prevHook.apply(scene, args)
      const now = performance.now()
      const gap = now - prev
      prev = now
      if (gap > 0 && gap < IDLE_GAP_MS) {
        const inst = 1000 / gap
        ema = ema === 0 ? inst : ema + (inst - ema) * EMA
      }
      if (!useBlast.getState().showPerf || now - lastPush < PUSH_EVERY_MS) return
      lastPush = now
      instances = 0
      scene.traverseVisible(add)
      const { calls, triangles } = gl.info.render
      usePerf.setState({ fps: ema, calls, triangles, instances })
    }
    return () => {
      scene.onAfterRender = prevHook
    }
  }, [gl, scene])
  return null
}
