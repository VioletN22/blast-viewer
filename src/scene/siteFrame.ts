import { Matrix4 } from 'three'
import type { Dem } from '../sim/dem'
import type { Scenario } from '../sim/scenario'
import type { Site } from '../sim/site'

/**
 * Model-to-surface matrix of a pit site: a turn about y, the crest offset in
 * plan, and the floor plane's height and tilt (a shear of y by x and z).
 * Identity on the generated bench.
 */
export function siteMatrix(site: Site | null, out = new Matrix4()): Matrix4 {
  if (!site) return out.identity()
  const c = Math.cos(site.angle)
  const n = Math.sin(site.angle)
  // Rows: world x, y, z from model x, y, z (see siteToWorld and siteHeight).
  return out.set(c, 0, n, site.x, site.tiltX, 1, site.tiltZ, site.floorY, -n, 0, c, site.z, 0, 0, 0, 1)
}

/** Heights on the pit are stretched by the exaggeration about the lowest point of the DEM. */
export const exaggerationBase = (dem: Dem) => dem.minY

/** Surface-to-world matrix for the vertical exaggeration k on the pit. */
export function exaggerationMatrix(dem: Dem | null, k: number, out = new Matrix4()): Matrix4 {
  if (!dem || k === 1) return out.identity()
  return out.makeScale(1, k, 1).setPosition(0, exaggerationBase(dem) * (1 - k), 0)
}

/** World height of a surface height on the pit with exaggeration k. */
export function worldY(dem: Dem | null, k: number, y: number): number {
  if (!dem) return y
  const b = exaggerationBase(dem)
  return b + (y - b) * k
}

/** Model-to-world matrix: the site frame, then the exaggeration. */
export function scenarioMatrix(s: Scenario, k: number, out = new Matrix4()): Matrix4 {
  return out.multiplyMatrices(exaggerationMatrix(s.dem, k), siteMatrix(s.site))
}
