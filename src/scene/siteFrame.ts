import { Matrix4, Vector3 } from 'three'
import type { Scenario } from '../sim/scenario'
import type { Site } from '../sim/site'

/** Model-to-world matrix of a pit site (a turn about y, then the crest and floor offset); identity on the generated bench. */
export function siteMatrix(site: Site | null, out = new Matrix4()): Matrix4 {
  if (!site) return out.identity()
  return out.makeRotationY(site.angle).setPosition(site.x, site.floorY, site.z)
}

export const scenarioMatrix = (s: Scenario, out?: Matrix4) => siteMatrix(s.site, out)

/** A model point in world coordinates. */
export function toWorld(s: Scenario, x: number, y: number, z: number, out = new Vector3()): Vector3 {
  return out.set(x, y, z).applyMatrix4(scenarioMatrix(s))
}
