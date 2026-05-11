// SF bay fog at night: warm amber-grey clouds rolling in, city glow from below
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
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;

  // Fog rolls in from the left (bay side), slight upward curl
  vec2 drift1 = vec2(uTime * 0.055,  uTime * 0.007);
  vec2 drift2 = vec2(uTime * 0.032, -uTime * 0.005);

  // Two FBM layers at different scales — large billowing shapes + fine wispy detail
  float layer1 = fbm(vec3((uv + drift1) * 1.2,        uTime * 0.012));
  float layer2 = fbm(vec3((uv + drift2) * 2.8 + 5.3,  uTime * 0.008));

  float density = layer1 * 0.65 + layer2 * 0.35;
  density = smoothstep(0.30, 0.70, density);

  // Thicker fog at the bottom of the frame (ground-level fog bank)
  float heightFade = smoothstep(0.75, 0.15, uv.y);
  density = mix(density * 0.35, density, heightFade + 0.25);
  density = clamp(density, 0.0, 1.0);

  // Color: dark sky where thin, warm amber-grey where dense (city light trapped in fog)
  vec3 clear      = vec3(0.04, 0.05, 0.09);   // dark blue-black sky
  vec3 fogMid     = vec3(0.32, 0.26, 0.18);   // warm grey, lit from below
  vec3 fogBright  = vec3(0.50, 0.40, 0.26);   // brighter amber patch where fog is thickest

  vec3 col = mix(clear, fogMid, density);
  col = mix(col, fogBright, density * density * 0.7);

  // Vignette — edges fade to dark
  vec2 c = uv - 0.5;
  col *= 1.0 - length(c) * 0.45;

  float alpha = density * 0.88 + 0.04;
  gl_FragColor = vec4(col, alpha);
}
