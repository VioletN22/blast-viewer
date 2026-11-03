import { demFromSamples, type Dem, type DemMeta } from '../sim/dem'
import { decodeGray16 } from './png16'

/** Loads a baked DEM: the 16-bit PNG grid and its JSON metadata, from the same base path. */
export async function loadDem(base: string): Promise<Dem> {
  const [metaRes, pngRes] = await Promise.all([fetch(`${base}.json`), fetch(`${base}.png`)])
  if (!metaRes.ok || !pngRes.ok) throw new Error(`could not load ${base} (${metaRes.ok ? pngRes.status : metaRes.status})`)
  const meta = (await metaRes.json()) as DemMeta
  const png = await decodeGray16(new Uint8Array(await pngRes.arrayBuffer()))
  if (png.width !== meta.cols || png.height !== meta.rows) throw new Error(`${base}: the grid is ${png.width} x ${png.height}, the metadata says ${meta.cols} x ${meta.rows}`)
  return demFromSamples(png.data, meta)
}
