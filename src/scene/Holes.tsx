import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, CylinderGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { delayColor } from './colors'
import { lastFireMs } from './terrainGeometry'

const FLASH_MS = 320
const HOT = new Color('#fff4d6')
const WHITE = new Color('#ffffff')

/**
 * Collar markers, one InstancedMesh, coloured by firing delay. A hole flashes
 * when it fires (t >= delayMs), then settles to a small dim "spent" marker.
 */
export function Holes({ scenario }: { scenario: Scenario }) {
  const { holes } = scenario
  const ref = useRef<InstancedMesh>(null)
  const geom = useMemo(() => new CylinderGeometry(0.75, 0.75, 0.5, 14).translate(0, 0.25, 0), [])
  const mat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(
    () => () => {
      geom.dispose()
      mat.dispose()
    },
    [geom, mat],
  )
  const base = useMemo(() => {
    const maxDelay = lastFireMs(holes)
    const c = new Color()
    const out = new Float32Array(holes.length * 3)
    holes.forEach((h, i) => delayColor(h.delayMs, maxDelay, c).toArray(out, i * 3))
    return out
  }, [holes])
  const tmp = useMemo(() => ({ o: new Object3D(), c: new Color(), last: { t: -1, sel: '' as string | null, holes } }), [holes])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const { timeMs, selectedHoleId } = useBlast.getState()
    const last = tmp.last
    if (last.t === timeMs && last.sel === selectedHoleId && mesh.instanceColor) return
    last.t = timeMs
    last.sel = selectedHoleId
    const { o, c } = tmp
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i]
      const local = timeMs - h.delayMs
      c.setRGB(base[i * 3], base[i * 3 + 1], base[i * 3 + 2])
      let s = 1
      if (local >= 0 && timeMs > 0) {
        const u = Math.min(1, local / FLASH_MS)
        // Flash hot and wide, then cool to a dim, smaller spent marker.
        s = 1.9 - 1.3 * u
        c.lerp(HOT, 1 - u).multiplyScalar(1 - 0.75 * u)
      }
      if (h.id === selectedHoleId) {
        c.copy(WHITE)
        s = Math.max(s, 1.5)
      }
      o.position.set(h.x, h.collarY, h.z)
      o.scale.set(s, 1, s)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Collars do not move, so the bounds (for picking and culling) are computed once.
    if (!mesh.boundingSphere) mesh.computeBoundingSphere()
  })

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId === undefined) return
    e.stopPropagation()
    useBlast.getState().selectHole(holes[e.instanceId]?.id ?? null)
  }

  return <instancedMesh key={holes.length} ref={ref} args={[geom, mat, holes.length]} onPointerDown={onPointerDown} renderOrder={1} />
}
