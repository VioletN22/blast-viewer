import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, LineBasicMaterial } from 'three'
import { holeIndex } from '../sim/field'
import type { Scenario } from '../sim/scenario'

/** An amber outline round the blast block, drawn over everything, so the blast can be found from the whole-pit view. */
export function SiteMarker({ scenario }: { scenario: Scenario }) {
  const geom = useMemo(() => {
    const idx = holeIndex(scenario.holes, scenario.terrain)
    const y = scenario.terrain.options.benchHeight + 1
    const m = 6
    const pts = [idx.minX - m, idx.minZ - m, idx.maxX + m, idx.minZ - m, idx.maxX + m, idx.toeZ + m, idx.minX - m, idx.toeZ + m]
    const pos = new Float32Array(12)
    for (let i = 0; i < 4; i++) {
      pos[i * 3] = pts[i * 2]
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = pts[i * 2 + 1]
    }
    return new BufferGeometry().setAttribute('position', new BufferAttribute(pos, 3))
  }, [scenario])
  const mat = useMemo(() => new LineBasicMaterial({ color: '#ffb020', depthTest: false, depthWrite: false, transparent: true, toneMapped: false }), [])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mat.dispose(), [mat])
  return <lineLoop geometry={geom} material={mat} renderOrder={50} raycast={() => null} />
}
