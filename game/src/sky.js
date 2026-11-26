// The sky pass and the light direction the whole scene is lit by: one low sun to the west, a warm
// horizon under a deep zenith, and aerial fog that takes the far islands the same colour.
import { PALETTE } from './config.js';
import { normalize } from './mathx.js';
import { createFullscreenTriangle } from './gl.js';

/** The evening sun: 11 degrees up, west-north-west, so terrain facets throw long shadows. */
export const SUN_ELEVATION = 15 * (Math.PI / 180);
export const SUN_AZIMUTH = -64 * (Math.PI / 180);

export function createSky(gl) {
  const vao = createFullscreenTriangle(gl);
  const sunDirection = normalize(
    [0, 0, 0],
    [Math.sin(SUN_AZIMUTH) * Math.cos(SUN_ELEVATION), Math.sin(SUN_ELEVATION), -Math.cos(SUN_AZIMUTH) * Math.cos(SUN_ELEVATION)],
  );

  return {
    sunDirection,
    /** Draw the sky behind everything, from the same camera the scene uses. */
    draw(program, camera) {
      const gl2 = gl;
      gl2.depthMask(false);
      gl2.disable(gl2.DEPTH_TEST);
      program.use();
      program.vec3('uForward', camera.forward);
      program.vec3('uRight', camera.right);
      program.vec3('uUp', camera.up);
      program.float('uTanHalfFov', Math.tan(camera.fov * 0.5 * Math.PI / 180));
      program.float('uAspect', camera.aspect);
      program.vec3('uZenith', PALETTE.skyZenith);
      program.vec3('uHorizon', PALETTE.skyHorizon);
      program.vec3('uBeneath', PALETTE.skyLow);
      program.vec3('uSunColour', PALETTE.sunGlow);
      program.vec3('uSunDirection', sunDirection);
      program.vec3('uCloudDir', PALETTE.skyHorizon);
      gl2.bindVertexArray(vao);
      gl2.drawArrays(gl2.TRIANGLES, 0, 3);
      gl2.bindVertexArray(null);
      gl2.enable(gl2.DEPTH_TEST);
      gl2.depthMask(true);
    },
  };
}
