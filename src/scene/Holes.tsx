import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, CylinderGeometry, InstancedMesh, MeshBasicMaterial, Object3D, Sphere, Vector3 } from 'three'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { delayColor } from './colors'
import { hasFired, lastFireMs } from '../sim/fire'

const FLASH_MS = 320
const HOT = new Color('#fff4d6')
const WHITE = new Color('#ffffff')

/**
 * Collar markers, one InstancedMesh, coloured by firing delay. A hole flashes
 * when it fires (t >= delayMs), then shrinks away: once the flash is over the
 * collar is gone with the bench, so its marker is hidden (scale 0, which also
 * takes it out of picking). A selected hole is white until it fires.
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
  const tmp = useMemo(() => {
    const pts = holes.map((h) => new Vector3(h.x, h.collarY, h.z))
    const bounds = new Sphere().setFromPoints(pts)
    bounds.radius += 2
    return { o: new Object3D(), c: new Color(), bounds, last: { t: -1, sel: '' as string | null } }
  }, [holes])

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
      const fired = hasFired(h.delayMs, timeMs)
      if (fired) {
        const u = Math.min(1, local / FLASH_MS)
        // Flash hot and wide, then shrink to nothing as it cools.
        s = 1.9 * (1 - u)
        c.lerp(HOT, 1 - u)
      }
      // A selected hole is white while it waits; once fired it flashes and goes like the rest (SelectionRing marks the spot).
      if (h.id === selectedHoleId && !fired) {
        c.copy(WHITE)
        s = Math.max(s, 1.5)
      }
      o.position.set(h.x, h.collarY, h.z)
      o.scale.set(s, s > 0 ? 1 : 0, s)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Collars do not move: bounds for picking and culling come from the collar positions, whatever the marker sizes.
    if (mesh.boundingSphere !== tmp.bounds) mesh.boundingSphere = tmp.bounds
  })

  // onClick, not onPointerDown: R3F does not fire click after a drag, so orbiting never selects a hole.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined) return
    e.stopPropagation()
    useBlast.getState().selectHole(holes[e.instanceId]?.id ?? null)
  }

  return <instancedMesh key={holes.length} ref={ref} args={[geom, mat, holes.length]} onClick={onClick} renderOrder={1} />
}
