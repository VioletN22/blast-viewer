/**
 * True when the browser can create a WebGL context: tries webgl2, then webgl,
 * on a detached probe canvas, and releases the probe context straight away.
 * `make` is injectable for tests.
 */
export function hasWebGL(make: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  try {
    const c = make()
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
