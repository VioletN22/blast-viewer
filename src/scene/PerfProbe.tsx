import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { InstancedMesh, Object3D } from 'three'
import { usePerf } from '../state/perf'
import { useBlast } from '../state/store'
import { newSampler, pushFrame } from './perfSampler'

/**
 * Samples gl.info once the frame is done (Scene.onAfterRender, so the
 * auto-reset counters are not yet cleared and no useFrame priority is taken,
 * which would switch off R3F's own render). Fps comes from perfSampler; the
 * store is written at most four times a second, and only while the overlay is on.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const sampler = newSampler()
    let instances = 0
    const add = (o: Object3D) => {
      const m = o as InstancedMesh
      if (m.isInstancedMesh) instances += m.count
    }
    const prevHook = scene.onAfterRender
    scene.onAfterRender = (r, s, c, g, m, grp) => {
      prevHook.call(scene, r, s, c, g, m, grp)
      if (!useBlast.getState().showPerf) return
      if (!pushFrame(sampler, performance.now())) return
      instances = 0
      scene.traverseVisible(add)
      const { calls, triangles, points } = gl.info.render
      usePerf.setState({ fps: sampler.fps, calls, triangles, instances, points })
    }
    return () => {
      scene.onAfterRender = prevHook
    }
  }, [gl, scene])
  return null
}
