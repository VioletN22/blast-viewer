/**
 * Height in metres of one terrarium-encoded pixel (AWS Terrain Tiles):
 * (R * 256 + G + B / 256) - 32768. No imports, so scripts/fetch-terrain.mjs can load it too.
 */
export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768
}
