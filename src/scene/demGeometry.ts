import { BufferAttribute, BufferGeometry, Color } from 'three'
import type { Dem } from '../sim/dem'
import { worldToSite, type Site } from '../sim/site'
import type { TerrainOptions } from '../sim/types'
import { groundColor } from './terrainGeometry'

/**
 * Grid mesh of a DEM: positions in metres (x east, y up, z south), normals
 * from central differences, and the same slope colours as the blast patch.
 * The index is set separately (demIndex), so moving the blast only rebuilds that.
 */
export function buildDemGeometry(dem: Dem): BufferGeometry {
  const { cols, rows, cell, heights, halfX, halfZ } = dem
  const n = cols * rows
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const c = new Color()
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i
      pos[k * 3] = -halfX + i * cell
      pos[k * 3 + 1] = heights[k]
      pos[k * 3 + 2] = -halfZ + j * cell
      const il = Math.max(0, i - 1)
      const ir = Math.min(cols - 1, i + 1)
      const jd = Math.max(0, j - 1)
      const ju = Math.min(rows - 1, j + 1)
      const dx = (heights[j * cols + ir] - heights[j * cols + il]) / ((ir - il) * cell)
      const dz = (heights[ju * cols + i] - heights[jd * cols + i]) / ((ju - jd) * cell)
      const len = Math.hypot(dx, 1, dz)
      nor[k * 3] = -dx / len
      nor[k * 3 + 1] = 1 / len
      nor[k * 3 + 2] = -dz / len
      groundColor(1 / len, c).toArray(col, k * 3)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  g.setIndex(demIndex(dem, null, null))
  g.computeBoundingSphere()
  return g
}

/**
 * Triangle index of the DEM grid, leaving out the cells that lie wholly inside
 * the blast patch (shrunk by one cell, so the patch and the DEM overlap a little
 * at the seam and no gap shows).
 */
export function demIndex(dem: Dem, site: Site | null, patch: Pick<TerrainOptions, 'width' | 'depth'> | null): BufferAttribute {
  const { cols, rows, cell, halfX, halfZ } = dem
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6)
  const hw = patch ? patch.width / 2 - cell : 0
  const hd = patch ? patch.depth / 2 - cell : 0
  const inPatch = (i: number, j: number) => {
    if (!site) return false
    const [x, z] = worldToSite(site, -halfX + i * cell, -halfZ + j * cell)
    return Math.abs(x) < hw && Math.abs(z) < hd
  }
  // Cheap reject: only cells near the site can be inside the patch.
  const reach = Math.hypot(hw, hd) + cell
  let m = 0
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      if (site) {
        const cx = -halfX + (i + 0.5) * cell - site.x
        const cz = -halfZ + (j + 0.5) * cell - site.z
        if (cx * cx + cz * cz < reach * reach && inPatch(i, j) && inPatch(i + 1, j) && inPatch(i, j + 1) && inPatch(i + 1, j + 1)) continue
      }
      const a = j * cols + i
      const b = a + 1
      const d = a + cols
      const e = d + 1
      idx[m++] = a
      idx[m++] = d
      idx[m++] = b
      idx[m++] = b
      idx[m++] = d
      idx[m++] = e
    }
  }
  return new BufferAttribute(m === idx.length ? idx : idx.slice(0, m), 1)
}
