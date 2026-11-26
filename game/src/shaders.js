// The three shader programs the game runs: one lit pass for every solid in the world, one sky
// drawn as a single full-screen triangle with the sun in it, and one water surface with a swell.
// They share the palette's golden-hour light so land, sea and sky read as one evening.

const HEADER = '#version 300 es\nprecision highp float;\n';

export const LIT_VERT = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColour;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;

out vec3 vNormal;
out vec3 vColour;
out vec3 vWorld;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(uNormalMatrix * aNormal);
  vColour = aColour;
  gl_Position = uProjection * uView * world;
}
`;

export const LIT_FRAG = `${HEADER}
in vec3 vNormal;
in vec3 vColour;
in vec3 vWorld;

uniform vec3 uEye;
uniform vec3 uLightDirection;
uniform vec3 uLightColour;
uniform vec3 uSkyColour;
uniform vec3 uGroundColour;
uniform vec3 uFogColour;
uniform float uFogDensity;
uniform vec3 uTint;
uniform float uTintMix;
uniform float uAlpha;

out vec4 outColour;

void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(uEye - vWorld);
  // Facets are hand-built and some are seen from behind: light the side that faces the pilot.
  if (dot(n, view) < 0.0) n = -n;
  float lambert = max(dot(n, uLightDirection), 0.0);
  // Hemisphere ambient: warm from the sky above, cool bounce from the ground below.
  float hemi = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 ambient = mix(uGroundColour, uSkyColour, hemi);
  vec3 colour = vColour * (ambient + uLightColour * lambert);

  // A thin rim where the surface turns away, so facets keep their edges against the light.
  float rim = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.0);
  colour += uLightColour * rim * 0.10 * (0.35 + lambert);

  colour = mix(colour, uTint, uTintMix);

  float distance = length(uEye - vWorld);
  float fog = 1.0 - exp(-distance * uFogDensity);
  colour = mix(colour, uFogColour, clamp(fog, 0.0, 0.985));
  outColour = vec4(colour, uAlpha);
}
`;

/** A full-screen triangle carried in clip space; the fragment shader turns it into a view ray. */
export const SKY_VERT = `${HEADER}
out vec2 vClip;
void main() {
  vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  vClip = positions[gl_VertexID];
  gl_Position = vec4(vClip, 1.0, 1.0);
}
`;

export const SKY_FRAG = `${HEADER}
in vec2 vClip;

uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBeneath;
uniform vec3 uSunColour;
uniform vec3 uSunDirection;
uniform vec3 uCloudDir;

out vec4 outColour;

void main() {
  vec3 dir = normalize(uForward + uRight * (vClip.x * uTanHalfFov * uAspect) + uUp * (vClip.y * uTanHalfFov));
  float height = dir.y;

  vec3 colour = mix(uHorizon, uZenith, pow(clamp(height, 0.0, 1.0), 0.32));
  colour = mix(colour, uBeneath, pow(clamp(-height, 0.0, 1.0), 0.55));

  // Sun-side warmth: the sky is deeper blue away from the sun and apricot toward it.
  vec2 flatDir = normalize(dir.xz + vec2(0.0001));
  vec2 flatSun = normalize(uSunDirection.xz + vec2(0.0001));
  float toward = clamp(dot(flatDir, flatSun) * 0.5 + 0.5, 0.0, 1.0);
  colour = mix(colour, uHorizon * 0.92, toward * toward * 0.42 * pow(clamp(1.0 - height, 0.0, 1.0), 1.4));

  float sun = max(dot(dir, uSunDirection), 0.0);
  colour += uSunColour * pow(sun, 22000.0) * 7.0;
  colour += uSunColour * 0.20 * pow(sun, 90.0);
  colour += vec3(0.98, 0.50, 0.20) * 0.30 * pow(sun, 6.0) * pow(clamp(1.0 - height, 0.0, 1.0), 3.0);

  // A warm band hugging the horizon, the way the sea throws the last of the light back up.
  colour += vec3(0.30, 0.14, 0.05) * exp(-abs(height) * 16.0) * 0.7;

  // High, thin cloud: a soft banded shimmer high up, no texture needed.
  float band = sin(dir.x * 3.1 + dir.z * 2.2 + sin(dir.z * 5.0) * 0.8);
  float high = smoothstep(0.55, 1.0, band) * smoothstep(0.16, 0.55, height);
  colour = mix(colour, uHorizon * 1.06 + vec3(0.10, 0.06, 0.04), high * 0.22);

  outColour = vec4(colour, 1.0);
}
`;

export const WATER_VERT = `${HEADER}
layout(location = 0) in vec3 aPosition;

uniform mat4 uProjection;
uniform mat4 uView;
uniform float uTime;
uniform vec3 uEye;

out vec3 vWorld;
out vec3 vNormal;

void main() {
  vec3 p = aPosition;
  float t = uTime;
  p.y += sin(p.x * 0.013 + t * 0.9) * 0.42 + sin(p.z * 0.017 - t * 1.15) * 0.34
       + sin((p.x + p.z) * 0.028 + t * 1.7) * 0.16;
  // A long swell that lifts the whole surface near the camera, for a sense of scale.
  p.y += sin(length(p.xz - uEye.xz) * 0.006 - t * 0.7) * 0.55;

  float dx = cos(p.x * 0.013 + t * 0.9) * 0.013 * 0.42
           + cos((p.x + p.z) * 0.028 + t * 1.7) * 0.028 * 0.16;
  float dz = cos(p.z * 0.017 - t * 1.15) * 0.017 * 0.34
           + cos((p.x + p.z) * 0.028 + t * 1.7) * 0.028 * 0.16;

  vNormal = normalize(vec3(-dx, 1.0, -dz));
  vWorld = p;
  gl_Position = uProjection * uView * vec4(p, 1.0);
}
`;

export const WATER_FRAG = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;

uniform vec3 uEye;
uniform vec3 uLightDirection;
uniform vec3 uSunColour;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uFogColour;
uniform float uFogDensity;
uniform float uTime;

out vec4 outColour;

void main() {
  vec3 view = normalize(uEye - vWorld);

  // Ripples at two scales, carried in the fragment shader so the sea is cheap and still alive.
  float t = uTime;
  float dist = length(uEye - vWorld);
  // Ripple detail fades with range: near water is textured, far water is a smooth sheet of sky.
  float detail = 1.0 / (1.0 + dist * 0.022);
  float w1 = sin(vWorld.x * 0.024 + vWorld.z * 0.014 + t * 0.7);
  float w2 = sin(vWorld.x * -0.018 + vWorld.z * 0.029 - t * 0.55);
  float w3 = sin((vWorld.x + vWorld.z) * 0.047 - t * 1.2);
  // At grazing angles a planar ripple projects into converging beams, so the tilt is dropped
  // there and the far sea reads as one sheet of reflected sky.
  float grazing = smoothstep(0.015, 0.20, abs(view.y));
  vec3 n = normalize(vec3(
    (w1 * 0.050 + w3 * 0.020) * detail * grazing,
    1.0,
    (w2 * 0.050 + w3 * 0.016) * detail * grazing));

  float fresnel = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 4.0);

  // What the sea sees: the sky above the horizon, reflected.
  vec3 r = reflect(-view, n);
  float rh = clamp(r.y, 0.0, 1.0);
  vec3 skyAbove = mix(uHorizon, uZenith, pow(rh, 0.42));
  vec2 flatR = normalize(r.xz + vec2(0.0001));
  vec2 flatSun = normalize(uLightDirection.xz + vec2(0.0001));
  float toward = clamp(dot(flatR, flatSun) * 0.5 + 0.5, 0.0, 1.0);
  skyAbove = mix(skyAbove, uHorizon * 1.04, toward * 0.18 * (1.0 - rh));

  vec3 base = mix(uDeep, uShallow, clamp(0.35 + 0.5 * (1.0 - fresnel), 0.0, 1.0));
  vec3 colour = mix(base, skyAbove, 0.22 + 0.72 * fresnel);

  // Sun glitter: a tight sparkle close in, a broader path of light all the way out. The tight
  // term is faded with distance: per-pixel wave normals alias long before the horizon.
  float distance = length(uEye - vWorld);
  float glitter = 1.0 - clamp(distance / 750.0, 0.0, 1.0);
  vec3 halfway = normalize(uLightDirection + view);
  float spec = max(dot(n, halfway), 0.0);
  colour += uSunColour * pow(spec, 380.0) * 3.4 * glitter;
  colour += uSunColour * pow(spec, 46.0) * 0.20 * mix(0.55, 1.0, glitter);

  // Crests catch a little more light than the troughs.
  colour += uShallow * clamp(w3 * 0.10, 0.0, 0.10);

  float fog = 1.0 - exp(-distance * uFogDensity);
  colour = mix(colour, uFogColour, clamp(fog, 0.0, 0.99));
  outColour = vec4(colour, 1.0);
}
`;

export const FULLSCREEN_VERT = SKY_VERT;
