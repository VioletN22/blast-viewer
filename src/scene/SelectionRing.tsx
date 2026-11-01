import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, type Mesh, MeshBasicMaterial, RingGeometry } from 'three'
import { groundAfterBlast } from '../sim/field'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'

/**
 * A flat white ring round the selected hole: at the collar while it waits,
 * and on the post-blast ground (groundAfterBlast) once it has fired and the
 * collar is gone. Drawn through the muck so a spent hole can still be found.
 */
export function SelectionRing({ scenario }: { scenario: Scenario }) {
  const ref = useRef<Mesh>(null)
  const selectedHoleId = useBlast((s) => s.selectedHoleId)
  const geom = useMemo(() => new RingGeometry(1.55, 1.95, 40).rotateX(-Math.PI / 2), [])
  const mat = useMemo(
    () => new MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: DoubleSide }),
    [],
  )
  useEffect(
    () => () => {
      geom.dispose()
      mat.dispose()
    },
    [geom, mat],
  )
  const target = useMemo(() => {
    const h = selectedHoleId ? scenario.holes.find((x) => x.id === selectedHoleId) : undefined
    if (!h) return null
    // Once per selection: groundAfterBlast builds a hole index on each call.
    return { x: h.x, z: h.z, delayMs: h.delayMs, collarY: h.collarY + 0.05, groundY: groundAfterBlast(h.x, h.z, scenario.holes, scenario.terrain) + 0.05 }
  }, [selectedHoleId, scenario])

  useFrame(() => {
    const m = ref.current
    if (!m || !target) return
    const { timeMs } = useBlast.getState()
    const fired = timeMs > 0 && timeMs >= target.delayMs
    m.position.set(target.x, fired ? target.groundY : target.collarY, target.z)
  })

  if (!target) return null
  return <mesh ref={ref} geometry={geom} material={mat} renderOrder={40} position={[target.x, target.collarY, target.z]} raycast={() => null} />
}
