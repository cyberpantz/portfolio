varying vec2 vUv;
void main() {
  vUv = uv;
  // Clip-space full-screen quad — bypasses MVP so the plane always covers
  // the entire viewport regardless of camera position or FOV.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
