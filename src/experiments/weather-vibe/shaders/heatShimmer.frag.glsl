uniform float uTime;
uniform sampler2D uScene;
varying vec2 vUv;

void main() {
  float shimmer = sin(vUv.x * 40.0 + uTime * 2.0) * 0.003
                + sin(vUv.y * 30.0 + uTime * 1.5) * 0.002;
  float mask = smoothstep(0.15, 0.0, vUv.y);
  vec2 uv = vUv + vec2(shimmer * mask, 0.0);
  gl_FragColor = texture2D(uScene, uv);
}
