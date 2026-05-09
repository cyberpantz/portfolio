// Night fog march: dark base with warm amber glow where density is high —
// simulates city light pollution diffusing and concentrating in the fog.
uniform float uTime;
varying vec2 vUv;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv - 0.5;
  float density = fbm(vec3(uv * 2.0, uTime * 0.025));
  density = smoothstep(0.28, 0.72, density);
  density *= 1.0 + 0.08 * sin(uTime * 0.19);

  // Thin fog: cold dark blue. Dense fog: warm amber from city glow below.
  vec3 thin  = vec3(0.03, 0.04, 0.07);
  vec3 dense = vec3(0.14, 0.10, 0.05);
  vec3 fogColor = mix(thin, dense, density * density);

  // Vignette pushes edges darker
  fogColor *= 1.0 - length(uv) * 0.55;

  gl_FragColor = vec4(fogColor, 0.80 * density + 0.22);
}
