// Fetches the elevation tiles over the Super Pit once and bakes them into the repo.
//
//   node scripts/fetch-terrain.mjs
//
// Source: AWS Terrain Tiles, terrarium PNG encoding, public and keyless:
// https://registry.opendata.aws/terrain-tiles/ . Over Kalgoorlie the tiles are
// built from SRTM (the tile header says srtm/S31E121.tif).
//
// Writes:
//   public/terrain/super-pit.png   16-bit greyscale grid, height = offset + value * step
//   public/terrain/super-pit.json  grid size, cell size, bounds, offset, step, date fetched
//   public/samples/super-pit-points.csv  a few thousand points sampled from the grid (MGA zone 51)
//
// The app reads the baked files and never fetches tiles at runtime.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'
import { terrariumHeight } from '../src/sim/terrarium.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Parameters. Zoom 14 is about 8.2 m per pixel at this latitude.
const ZOOM = 14
const CENTRE = { lat: -30.7737, lon: 121.506 }
const COLS = 416
const ROWS = 480
const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
/** A sample that differs from the median of its 3x3 neighbours by more than this is an SRTM void and takes the median. */
const SPIKE_M = 40
const HEIGHT_STEP_M = 0.05
const SAMPLE_POINTS = 5000
const SAMPLE_SEED = 20261103

const WORLD_PX = 256 * 2 ** ZOOM
const lonToPx = (lon) => ((lon + 180) / 360) * WORLD_PX
const latToPx = (lat) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * WORLD_PX
const pxToLon = (px) => (px / WORLD_PX) * 360 - 180
const pxToLat = (py) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / WORLD_PX))) * 180) / Math.PI

// ---------- PNG ----------

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

function chunks(buf) {
  const out = []
  let o = 8
  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    out.push({ type: buf.toString('latin1', o + 4, o + 8), data: buf.subarray(o + 8, o + 8 + len) })
    o += 12 + len
  }
  return out
}

/** Decodes an 8-bit RGB or RGBA PNG (the terrarium tiles) to { width, height, channels, pixels }. */
function decodeRgb(buf) {
  const cs = chunks(buf)
  const ihdr = cs.find((c) => c.type === 'IHDR').data
  const width = ihdr.readUInt32BE(0)
  const height = ihdr.readUInt32BE(4)
  const depth = ihdr[8]
  const type = ihdr[9]
  if (depth !== 8 || (type !== 2 && type !== 6)) throw new Error(`unexpected PNG: depth ${depth}, colour type ${type}`)
  const channels = type === 2 ? 3 : 4
  const raw = inflateSync(Buffer.concat(cs.filter((c) => c.type === 'IDAT').map((c) => c.data)))
  const stride = width * channels
  const pixels = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? pixels[row + i - channels] : 0
      const b = y > 0 ? pixels[row - stride + i] : 0
      const c = y > 0 && i >= channels ? pixels[row - stride + i - channels] : 0
      const v = raw[src + i]
      pixels[row + i] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255
    }
  }
  return { width, height, channels, pixels }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** Encodes a Uint16Array grid as a 16-bit greyscale PNG, Paeth filter on every row. */
function encodeGray16(values, width, height) {
  const stride = width * 2
  const bytes = Buffer.alloc(height * stride)
  for (let i = 0; i < values.length; i++) bytes.writeUInt16BE(values[i], i * 2)
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 4
    for (let i = 0; i < stride; i++) {
      const a = i >= 2 ? bytes[y * stride + i - 2] : 0
      const b = y > 0 ? bytes[(y - 1) * stride + i] : 0
      const c = y > 0 && i >= 2 ? bytes[(y - 1) * stride + i - 2] : 0
      raw[y * (stride + 1) + 1 + i] = (bytes[y * stride + i] - paeth(a, b, c)) & 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 16
  ihdr[9] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- MGA zone 51 (transverse Mercator on GRS80, which GDA2020 uses) ----------

function toMga51(latDeg, lonDeg) {
  const a = 6378137
  const f = 1 / 298.257222101
  const k0 = 0.9996
  const e2 = f * (2 - f)
  const ep2 = e2 / (1 - e2)
  const phi = (latDeg * Math.PI) / 180
  const lam = ((lonDeg - 123) * Math.PI) / 180
  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  const N = a / Math.sqrt(1 - e2 * sin * sin)
  const T = Math.tan(phi) ** 2
  const C = ep2 * cos * cos
  const A = cos * lam
  const e4 = e2 * e2
  const e6 = e4 * e2
  const M =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  const easting = 500000 + k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120)
  const northing =
    10000000 +
    k0 * (M + N * Math.tan(phi) * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720))
  return { easting, northing }
}

// ---------- fetch, stitch, clean, crop ----------

const x0 = Math.round(lonToPx(CENTRE.lon) - COLS / 2)
const y0 = Math.round(latToPx(CENTRE.lat) - ROWS / 2)
const tx0 = Math.floor(x0 / 256)
const ty0 = Math.floor(y0 / 256)
const tx1 = Math.floor((x0 + COLS - 1) / 256)
const ty1 = Math.floor((y0 + ROWS - 1) / 256)

const heights = new Float64Array(COLS * ROWS)
const sources = new Set()
for (let ty = ty0; ty <= ty1; ty++) {
  for (let tx = tx0; tx <= tx1; tx++) {
    const url = TILE_URL(ZOOM, tx, ty)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    const src = res.headers.get('x-amz-meta-x-imagery-sources')
    if (src) for (const s of src.split(',')) sources.add(s.trim())
    const png = decodeRgb(Buffer.from(await res.arrayBuffer()))
    for (let py = 0; py < 256; py++) {
      const j = ty * 256 + py - y0
      if (j < 0 || j >= ROWS) continue
      for (let px = 0; px < 256; px++) {
        const i = tx * 256 + px - x0
        if (i < 0 || i >= COLS) continue
        const o = (py * 256 + px) * png.channels
        heights[j * COLS + i] = terrariumHeight(png.pixels[o], png.pixels[o + 1], png.pixels[o + 2])
      }
    }
    console.log(`fetched ${url}`)
  }
}

// SRTM voids come through as single samples far below their neighbours: replace them with the local median.
let despiked = 0
const fixed = heights.slice()
for (let j = 0; j < ROWS; j++) {
  for (let i = 0; i < COLS; i++) {
    const n = []
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) n.push(heights[Math.min(ROWS - 1, Math.max(0, j + dj)) * COLS + Math.min(COLS - 1, Math.max(0, i + di))])
    n.sort((p, q) => p - q)
    if (Math.abs(heights[j * COLS + i] - n[4]) > SPIKE_M) {
      fixed[j * COLS + i] = n[4]
      despiked++
    }
  }
}

let min = Infinity
let max = -Infinity
for (const h of fixed) {
  if (h < min) min = h
  if (h > max) max = h
}
const offset = Math.floor(min)
const values = new Uint16Array(COLS * ROWS)
for (let k = 0; k < values.length; k++) values[k] = Math.round((fixed[k] - offset) / HEIGHT_STEP_M)

const latC = pxToLat(y0 + ROWS / 2)
const cellM = (Math.cos((latC * Math.PI) / 180) * 2 * Math.PI * 6378137) / WORLD_PX
const centreMga = toMga51(latC, pxToLon(x0 + COLS / 2))
const fetched = new Date().toISOString().slice(0, 10)
const meta = {
  name: 'Super Pit (Fimiston Open Pit), Kalgoorlie, WA',
  source: 'AWS Terrain Tiles, terrarium encoding, https://registry.opendata.aws/terrain-tiles',
  imagerySources: [...sources],
  fetched,
  zoom: ZOOM,
  cols: COLS,
  rows: ROWS,
  cellM: Number(cellM.toFixed(4)),
  bounds: {
    west: Number(pxToLon(x0).toFixed(6)),
    east: Number(pxToLon(x0 + COLS).toFixed(6)),
    north: Number(pxToLat(y0).toFixed(6)),
    south: Number(pxToLat(y0 + ROWS).toFixed(6)),
  },
  centreMga51: { easting: Number(centreMga.easting.toFixed(1)), northing: Number(centreMga.northing.toFixed(1)) },
  heightOffsetM: offset,
  heightStepM: HEIGHT_STEP_M,
  minM: Number(min.toFixed(2)),
  maxM: Number(max.toFixed(2)),
  despikedSamples: despiked,
}

mkdirSync(join(ROOT, 'public/terrain'), { recursive: true })
mkdirSync(join(ROOT, 'public/samples'), { recursive: true })
const png = encodeGray16(values, COLS, ROWS)
writeFileSync(join(ROOT, 'public/terrain/super-pit.png'), png)
writeFileSync(join(ROOT, 'public/terrain/super-pit.json'), `${JSON.stringify(meta, null, 2)}\n`)

// Sample points: seeded positions over the grid, bilinear heights, MGA zone 51 coordinates.
let s = SAMPLE_SEED >>> 0
const rand = () => {
  s = (s + 0x6d2b79f5) >>> 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const lines = ['easting,northing,rl']
for (let k = 0; k < SAMPLE_POINTS; k++) {
  const fx = rand() * (COLS - 1)
  const fy = rand() * (ROWS - 1)
  const i = Math.min(COLS - 2, Math.floor(fx))
  const j = Math.min(ROWS - 2, Math.floor(fy))
  const u = fx - i
  const v = fy - j
  const h =
    (fixed[j * COLS + i] * (1 - u) + fixed[j * COLS + i + 1] * u) * (1 - v) + (fixed[(j + 1) * COLS + i] * (1 - u) + fixed[(j + 1) * COLS + i + 1] * u) * v
  const { easting, northing } = toMga51(pxToLat(y0 + fy + 0.5), pxToLon(x0 + fx + 0.5))
  lines.push(`${easting.toFixed(2)},${northing.toFixed(2)},${h.toFixed(2)}`)
}
writeFileSync(join(ROOT, 'public/samples/super-pit-points.csv'), `${lines.join('\n')}\n`)

console.log(`grid ${COLS} x ${ROWS}, ${cellM.toFixed(2)} m cells, ${min.toFixed(1)} to ${max.toFixed(1)} m, ${despiked} samples despiked`)
console.log(`super-pit.png ${png.length} bytes, sources: ${[...sources].join(', ')}`)
