import type { WebGLProgramParametersWithUniforms } from 'three'

const WORLD_POS_VERTEX = (shader: WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
}

/**
 * Adds survey linework in the fragment shader: a faint 10 m plan grid and
 * 2 m elevation contours (at odd metres), anti-aliased with screen-space derivatives.
 */
export function addLinework(shader: WebGLProgramParametersWithUniforms) {
  WORLD_POS_VERTEX(shader)
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

/**
 * Linework for the real pit, which is seen from a few metres to a few
 * kilometres away: a 10 m and a 100 m plan grid, and 2 m and 10 m contours.
 * Each set fades out where its lines would be closer than a few pixels.
 */
export function addPitLinework(shader: WebGLProgramParametersWithUniforms) {
  WORLD_POS_VERTEX(shader)
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vWorldPos;
float bvLine(float v, float period) {
  float w = fwidth(v / period);
  float d = abs(fract(v / period - 0.5) - 0.5);
  return (1.0 - smoothstep(0.0, w * 1.2, d)) * (1.0 - smoothstep(0.12, 0.3, w));
}`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float grid = max(max(bvLine(vWorldPos.x, 10.0), bvLine(vWorldPos.z, 10.0)) * 0.6, max(bvLine(vWorldPos.x, 100.0), bvLine(vWorldPos.z, 100.0)));
float contour = max(bvLine(vWorldPos.y, 2.0) * 0.6, bvLine(vWorldPos.y, 10.0));
diffuseColor.rgb *= 1.0 - 0.16 * grid - 0.2 * contour;`,
    )
}
