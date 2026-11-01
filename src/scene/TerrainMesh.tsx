import { useEffect, useMemo } from 'react'
import { DoubleSide, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three'
import type { Scenario } from '../sim/scenario'
import { useBlast } from '../state/store'
import { buildTerrainGeometry, firstFireMs } from './terrainGeometry'

/**
 * Adds survey linework in the fragment shader: a faint 10 m plan grid and
 * 2 m elevation contours (at odd metres), anti-aliased with screen-space derivatives.
 */
function addLinework(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vWorldPos;
float bvLine(float v, float period) {
  float w = fwidth(v / period);
  float d = abs(fract(v / period - 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, w * 1.2, d);
}`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float grid = max(bvLine(vWorldPos.x, 10.0), bvLine(vWorldPos.z, 10.0));
// Contours at odd metres so the flat bench top (12 m) and floor (0 m) never sit on a line.
float contour = bvLine(vWorldPos.y - 1.0, 2.0);
diffuseColor.rgb *= 1.0 - 0.18 * grid - 0.22 * contour;`,
    )
}

function surfaceMaterial() {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  m.onBeforeCompile = addLinework
  return m
}

/**
 * The bench. Before the first hole fires the pre-blast bench is the solid
 * surface; from then on the solid surface is the post-blast ground, so the
 * muck pile never clips through the old bench. With showBefore the pre-blast
 * bench over the blasted footprint is drawn as a translucent shell.
 */
export function TerrainMesh({ scenario }: { scenario: Scenario }) {
  const { terrain, holes } = scenario
  const pre = useMemo(() => buildTerrainGeometry(terrain, null), [terrain])
  const post = useMemo(() => buildTerrainGeometry(terrain, holes), [terrain, holes])
  const ghostGeom = useMemo(() => buildTerrainGeometry(terrain, holes, 'ghost'), [terrain, holes])
  const solid = useMemo(surfaceMaterial, [])
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
    m.onBeforeCompile = addLinework
    return m
  }, [])
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
  const fired = useBlast((s) => s.timeMs >= firstFire && s.timeMs > 0)
  const showBefore = useBlast((s) => s.showBefore)

  return (
    <group>
      <mesh geometry={fired ? post : pre} material={solid} receiveShadow castShadow />
      {fired && showBefore && <mesh geometry={ghostGeom} material={ghost} renderOrder={2} />}
    </group>
  )
}
