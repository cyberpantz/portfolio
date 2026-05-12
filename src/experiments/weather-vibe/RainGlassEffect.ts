import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';
// @ts-ignore
import rainGlassFrag from './shaders/rainGlass.frag.glsl?raw';

export class RainGlassEffect extends Effect {
  constructor({ rainAmount = 0.7 }: { rainAmount?: number } = {}) {
    super('RainGlassEffect', rainGlassFrag, {
      uniforms: new Map<string, Uniform>([
        ['uTime',       new Uniform(0)],
        ['uRainAmount', new Uniform(rainAmount)],
        ['uResolution', new Uniform(new Vector2(window.innerWidth, window.innerHeight))],
      ]),
    });
  }

  update(_renderer: unknown, _inputBuffer: unknown, deltaTime: number) {
    const uTime = this.uniforms.get('uTime')!;
    uTime.value += deltaTime;

    const uRes = this.uniforms.get('uResolution')!;
    uRes.value.set(window.innerWidth, window.innerHeight);
  }
}
