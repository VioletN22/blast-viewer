import type { Scenario } from '../sim/scenario'

/** Plan extents that matter for framing: the holes (real min/max x, not symmetric) and the muck-pile reach. */
export function sceneExtents(s: Scenario) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  for (const h of s.holes) {
    if (h.x < minX) minX = h.x
    if (h.x > maxX) maxX = h.x
    if (h.z < minZ) minZ = h.z
  }
  const half = s.terrain.options.width / 2
  if (!Number.isFinite(minX)) {
    minX = -half / 2
    maxX = half / 2
    minZ = -20
  }
  const crest = s.terrain.options.crestZ
  return {
    minX: Math.max(-half, minX),
    maxX: Math.min(half, maxX),
    minZ,
    // The pile runs out about 34 m past the crest.
    maxZ: crest + 34,
    cx: (minX + maxX) / 2,
  }
}
