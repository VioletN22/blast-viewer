/** Inflates a zlib stream (the PNG image data). Uses DecompressionStream, which browsers and Node 18+ have. */
export async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * Decodes a 16-bit greyscale PNG (non-interlaced) into its samples. A canvas
 * would drop it to 8 bits, so the file is read here: the IHDR, the IDAT data,
 * inflate, and the five row filters.
 */
export async function decodeGray16(file: Uint8Array): Promise<{ width: number; height: number; data: Uint16Array }> {
  if (file.length < 8 || SIGNATURE.some((b, i) => file[i] !== b)) throw new Error('not a PNG file')
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  let width = 0
  let height = 0
  const parts: Uint8Array[] = []
  let o = 8
  while (o + 8 <= file.length) {
    const len = view.getUint32(o)
    const type = String.fromCharCode(file[o + 4], file[o + 5], file[o + 6], file[o + 7])
    const body = file.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      width = view.getUint32(o + 8)
      height = view.getUint32(o + 12)
      const depth = body[8]
      const colour = body[9]
      const interlace = body[12]
      if (depth !== 16 || colour !== 0 || interlace !== 0) throw new Error(`expected a 16-bit greyscale PNG (got depth ${depth}, colour type ${colour})`)
    } else if (type === 'IDAT') parts.push(body)
    else if (type === 'IEND') break
    o += 12 + len
  }
  if (!width || !height) throw new Error('PNG has no IHDR')
  let total = 0
  for (const p of parts) total += p.length
  const joined = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    joined.set(p, at)
    at += p.length
  }
  const raw = await inflate(joined)
  const stride = width * 2
  if (raw.length < height * (stride + 1)) throw new Error('PNG image data is short')
  const bytes = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const row = y * stride
    for (let i = 0; i < stride; i++) {
      const a = i >= 2 ? bytes[row + i - 2] : 0
      const b = y > 0 ? bytes[row - stride + i] : 0
      const c = y > 0 && i >= 2 ? bytes[row - stride + i - 2] : 0
      const v = raw[src + i]
      let out: number
      if (f === 0) out = v
      else if (f === 1) out = v + a
      else if (f === 2) out = v + b
      else if (f === 3) out = v + ((a + b) >> 1)
      else if (f === 4) out = v + paeth(a, b, c)
      else throw new Error(`PNG row ${y} has an unknown filter ${f}`)
      bytes[row + i] = out & 255
    }
  }
  const data = new Uint16Array(width * height)
  for (let k = 0; k < data.length; k++) data[k] = (bytes[2 * k] << 8) | bytes[2 * k + 1]
  return { width, height, data }
}
