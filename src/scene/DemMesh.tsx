import { useEffect, useLayoutEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import type { Scenario } from '../sim/scenario'
import { addPitLinework } from './linework'
import { buildDemGeometry, demIndex } from './demGeometry'
import { onPitClick } from './TerrainMesh'

/**
 * The real pit: the DEM as one mesh with the blast patch cut out of it. It sits
 * a little behind the patch in depth (polygon offset), so where they overlap at
 * the seam the patch wins. A click on it moves the blast.
 */
export function DemMesh({ scenario }: { scenario: Scenario }) {
  const dem = scenario.dem!
  const geom = useMemo(() => buildDemGeometry(dem), [dem])
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
    m.onBeforeCompile = addPitLinework
    m.customProgramCacheKey = () => 'pit-linework-dem'
    return m
  }, [])
  // Before the frame is drawn, so the full DEM never shows through the patch.
  useLayoutEffect(() => {
    geom.setIndex(demIndex(dem, scenario.site, scenario.terrain.options))
  }, [geom, dem, scenario])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={geom} material={mat} receiveShadow onClick={onPitClick} />
}
