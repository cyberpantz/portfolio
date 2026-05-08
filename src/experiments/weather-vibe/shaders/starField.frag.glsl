uniform float uTime;
varying vec3 vPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vPosition);
  vec2 uv = vec2(atan(dir.z, dir.x) / 6.2832 + 0.5, asin(dir.y) / 3.1416 + 0.5);

  vec3 color = vec3(0.01, 0.01, 0.05);

  for (float scale = 150.0; scale <= 300.0; scale += 150.0) {
    vec2 grid = floor(uv * scale);
    vec2 f = fract(uv * scale);
    float seed = hash(grid);
    if (seed > 0.65) {
      vec2 starPos = vec2(hash(grid + 0.3), hash(grid + 0.7));
      float dist = length(f - starPos);
      float size = 0.02 + seed * 0.03;
      float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + seed * 4.0) + seed * 20.0);
      float brightness = smoothstep(size, 0.0, dist) * twinkle;
      vec3 starColor = mix(vec3(1.0, 0.85, 0.6), vec3(0.7, 0.85, 1.0), seed);
      color += starColor * brightness * (scale == 150.0 ? 1.0 : 0.4);
    }
  }

  float nebula = smoothstep(-0.1, 0.6, dir.y) * 0.04;
  color += vec3(0.2, 0.1, 0.4) * nebula;

  gl_FragColor = vec4(color, 1.0);
}
