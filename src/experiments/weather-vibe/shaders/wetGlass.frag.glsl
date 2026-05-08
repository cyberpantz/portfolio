uniform float uTime;
uniform sampler2D uWorld;
uniform sampler2D uMask;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  float streakGrid = floor(uv.x * 40.0);
  float streakSeed = hash(vec2(streakGrid, 0.0));
  float streakSpeed = 0.04 + streakSeed * 0.06;
  float streakY = fract(uv.y + uTime * streakSpeed + streakSeed);
  float streakX = streakGrid / 40.0 + streakSeed * 0.012;
  float streak = smoothstep(0.008, 0.0, abs(uv.x - streakX - 0.003));
  streak *= smoothstep(0.0, 0.05, streakY) * smoothstep(1.0, 0.85, streakY);
  streak *= step(0.5, streakSeed);

  float condensation = texture2D(uMask, uv).r;

  vec2 distort = vec2(
    sin(uv.y * 30.0 + uTime * 0.5) * 0.003,
    cos(uv.x * 25.0 + uTime * 0.4) * 0.002
  );
  vec3 world = texture2D(uWorld, uv + distort * (1.0 - condensation)).rgb;

  vec3 glassTint = vec3(0.05, 0.12, 0.18);
  vec3 fogColor = mix(glassTint, vec3(0.15, 0.22, 0.28), 0.5);

  vec3 color = mix(world, fogColor, condensation * 0.92);

  color += vec3(0.3, 0.5, 0.6) * streak * condensation * 0.5;
  color += vec3(0.6, 0.8, 1.0) * streak * (1.0 - condensation) * 0.3;
  color += glassTint * 0.05;

  gl_FragColor = vec4(color, 1.0);
}
