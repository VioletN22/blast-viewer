import { useEffect, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { DoubleSide, MeshStandardMaterial } from 'three'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { firstFireMs, hasFired } from '../sim/fire'
import { addLinework, addPitLinework } from './linework'
import { buildTerrainGeometry } from './terrainGeometry'

function surfaceMaterial(pit: boolean) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  m.onBeforeCompile = pit ? addPitLinework : addLinework
  // Different shader source per variant, so three does not reuse one program for both.
  m.customProgramCacheKey = () => (pit ? 'pit-linework' : 'linework')
  return m
}

/** On the pit, a click (not a drag) on the ground moves the blast there. */
export function onPitClick(e: ThreeEvent<MouseEvent>) {
  if (e.delta > 4) return
  e.stopPropagation()
  useBlast.getState().placeSite(e.point.x, e.point.z)
}

/**
 * The bench. Before the first hole fires the pre-blast bench is the solid
 * surface; from then on the solid surface is the post-blast ground, so the
 * muck pile never clips through the old bench. With showBefore the pre-blast
 * bench over the blasted footprint is drawn as a translucent shell. On the
 * pit this is the patch of real ground under the blast, in the model's frame.
 */
export function TerrainMesh({ scenario }: { scenario: Scenario }) {
  const { terrain, holes } = scenario
  const pre = useMemo(() => buildTerrainGeometry(terrain, null), [terrain])
  const post = useMemo(() => buildTerrainGeometry(terrain, holes), [terrain, holes])
  const ghostGeom = useMemo(() => buildTerrainGeometry(terrain, holes, 'ghost'), [terrain, holes])
  const pit = terrain.source === 'dem'
  const solid = useMemo(() => surfaceMaterial(pit), [pit])
  const ghost = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: '#8fb6dc',
      emissive: '#24384d',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: DoubleSide,
      // The one-cell skirt lies on the solid rim: pull the shell forward so it does not z-fight there.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      roughness: 1,
      metalness: 0,
    })
    // Same survey grid and contours as the ground, so the removed volume reads as surveyed bench.
    m.onBeforeCompile = pit ? addPitLinework : addLinework
    m.customProgramCacheKey = () => (pit ? 'pit-linework-ghost' : 'linework-ghost')
    return m
  }, [pit])
  useEffect(() => () => pre.dispose(), [pre])
  useEffect(() => () => post.dispose(), [post])
  useEffect(() => () => ghostGeom.dispose(), [ghostGeom])
  useEffect(
    () => () => {
      solid.dispose()
      ghost.dispose()
    },
    [solid, ghost],
  )

  const firstFire = firstFireMs(holes)
  const fired = useBlast((s) => hasFired(firstFire, s.timeMs))
  const showBefore = useBlast((s) => s.showBefore)

  return (
    <group>
      <mesh geometry={fired ? post : pre} material={solid} receiveShadow castShadow onClick={pit ? onPitClick : undefined} />
      {fired && showBefore && <mesh geometry={ghostGeom} material={ghost} renderOrder={2} />}
    </group>
  )
}
