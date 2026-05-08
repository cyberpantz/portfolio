uniform float uTime;
varying vec3 vWorldPos;

void main() {
  vec3 dir = normalize(vWorldPos);
  float elevation = dir.y;

  vec3 zenith = vec3(0.18, 0.42, 0.82);
  vec3 horizon = vec3(0.95, 0.85, 0.65);
  vec3 ground = vec3(0.55, 0.50, 0.40);

  vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.6, elevation));
  sky = mix(ground, sky, smoothstep(-0.05, 0.05, elevation));

  vec3 sunDir = normalize(vec3(0.3, 0.6, -0.8));
  float sun = dot(dir, sunDir);
  float sunDisc = smoothstep(0.998, 1.0, sun);
  float sunGlow = smoothstep(0.97, 0.998, sun) * 0.3;

  sky += vec3(1.0, 0.98, 0.8) * sunDisc;
  sky += vec3(1.0, 0.7, 0.3) * sunGlow;

  float flare = 0.0;
  for (float i = 1.0; i <= 4.0; i++) {
    float streak = smoothstep(0.9992, 0.9995, abs(dot(dir, sunDir + vec3(i * 0.001, 0.0, 0.0))));
    flare += streak * (0.1 / i);
  }
  sky += vec3(1.0, 0.9, 0.6) * flare;

  gl_FragColor = vec4(sky, 1.0);
}
