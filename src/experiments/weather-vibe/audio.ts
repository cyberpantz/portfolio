import type { WeatherData, WeatherState } from './conditions';
import { getSettings, type AudioMultipliers } from './settings';

// ─── Asset manifest ───────────────────────────────────────────────────────────
// Files marked "optional" are tried at runtime; missing files fall back silently
// to procedural synthesis. See public/audio/weather-vibe/README.md for sourcing
// guidance and expected gain levels.
export const AUDIO_ASSETS = {
  // Active recordings
  crickets:      '/audio/weather-vibe/frogs_and_crickets.wav',
  birds:         '/audio/weather-vibe/birds_in_forest.wav',
  // Optional enhancement layers — drop a file here to activate it
  rain_on_glass: '/audio/weather-vibe/rain_on_glass.wav',
  city_ambience: '/audio/weather-vibe/city_ambience.mp3',
  ocean_surf:    '/audio/weather-vibe/ocean_surf.mp3',
  storm_wind:    '/audio/weather-vibe/storm_wind.mp3',
  forest_wind:   '/audio/weather-vibe/gentle-breeze.mp3',
  snow_ambience: '/audio/weather-vibe/snow_ambience.wav',
  fog_ambience:  '/audio/weather-vibe/fog_ambience.wav',
} as const;

// ─── Engine ───────────────────────────────────────────────────────────────────

class WeatherAudio {
  private ctx:            AudioContext | null = null;
  private master:         GainNode | null = null;
  private userMasterGain: GainNode | null = null;
  private ambientGain:    GainNode | null = null;
  private effectsGain:    GainNode | null = null;
  private cityHumGain:    GainNode | null = null;
  private active:         AudioNode[] = [];
  private recordings:     AudioBufferSourceNode[] = [];
  private currentStateKey: string | null = null;
  private muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const saved = getSettings().audio;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.master.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 4);

      this.userMasterGain = this.ctx.createGain();
      this.userMasterGain.gain.value = saved.master;
      this.userMasterGain.connect(this.master);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = saved.ambient;
      this.ambientGain.connect(this.userMasterGain);

      this.effectsGain = this.ctx.createGain();
      this.effectsGain.gain.value = saved.effects;
      this.effectsGain.connect(this.userMasterGain);

      this.cityHumGain = this.ctx.createGain();
      this.cityHumGain.gain.value = saved.cityHum;
      this.cityHumGain.connect(this.userMasterGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setAudioMultipliers(m: AudioMultipliers): void {
    // No-op until context is created on first user gesture; getCtx() applies settings on init.
    if (!this.ctx) return;
    const t  = this.ctx.currentTime;
    const tc = 0.05; // 50 ms ramp — prevents clicks on rapid slider movement
    this.userMasterGain!.gain.setTargetAtTime(m.master,  t, tc);
    this.ambientGain!.gain.setTargetAtTime(m.ambient,    t, tc);
    this.effectsGain!.gain.setTargetAtTime(m.effects,    t, tc);
    this.cityHumGain!.gain.setTargetAtTime(m.cityHum,    t, tc);
  }

  private stopAll() {
    this.active.forEach(n => {
      try { (n as OscillatorNode).stop?.(); } catch {}
      try { (n as AudioBufferSourceNode).stop?.(); } catch {}
    });
    this.active = [];
    this.recordings.forEach(n => { try { n.stop(); } catch {} });
    this.recordings = [];
  }

  // ─── Pink noise (Kellet's algorithm) ─────────────────────────────────────
  // Much more natural than white noise for wind, rain, and weather textures.
  private pinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufSize = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) / 5.5;
      b6 = w * 0.115926;
    }
    return buf;
  }

  // Returns the output GainNode so callers can attach LFO modulation
  private pinkNoise(gain: number, lowHz: number, highHz: number, dest: AudioNode): GainNode {
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer(ctx);
    src.loop = true;
    const lo = ctx.createBiquadFilter(); lo.type = 'highpass'; lo.frequency.value = lowHz;
    const hi = ctx.createBiquadFilter(); hi.type = 'lowpass';  hi.frequency.value = highHz;
    const g  = ctx.createGain(); g.gain.value = gain;
    src.connect(lo); lo.connect(hi); hi.connect(g); g.connect(dest);
    src.start();
    this.active.push(src, lo, hi, g);
    return g;
  }

  // ─── City hum ─────────────────────────────────────────────────────────────
  // Low traffic rumble + distant mid-texture, with a slow LFO simulating
  // traffic-light cycles (flow ebbs and flows every ~30–45 s).
  private cityHum(dest: AudioNode) {
    const ctx = this.getCtx();
    this.pinkNoise(0.040, 40, 180, dest);                       // bass traffic rumble
    const mid = this.pinkNoise(0.022, 500, 2200, dest);         // distant street texture
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.030 + Math.random() * 0.015;       // ~35–45 s cycle
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.010;
    lfo.connect(lfoGain); lfoGain.connect(mid.gain);
    lfo.start();
    this.active.push(lfo, lfoGain);
  }

  // ─── Wind ─────────────────────────────────────────────────────────────────
  // Three pink-noise layers (rumble / whoosh / whistle) with a slow gusting LFO
  // on the mid layer so the volume ebbs and flows like real wind.

  private windGain(windspeed: number): number {
    if (windspeed < 10) return 0.02;
    if (windspeed < 30) return 0.06 + (windspeed - 10) / 20 * 0.06;
    if (windspeed < 60) return 0.12 + (windspeed - 30) / 30 * 0.10;
    return 0.22;
  }

  private wind(windspeed: number, dest: AudioNode) {
    const ctx  = this.getCtx();
    const base = this.windGain(windspeed);

    this.pinkNoise(base * 0.5, 40, 220, dest);                   // low rumble
    const mid = this.pinkNoise(base * 0.8, 220, 900, dest);      // mid whoosh
    if (windspeed > 25) this.pinkNoise(base * 0.25, 1800, 4500, dest); // high whistle

    // Gusting LFO: slow sine (0.07–0.13 Hz) modulates mid-layer gain
    const lfo     = ctx.createOscillator();
    lfo.type      = 'sine';
    lfo.frequency.value = 0.07 + Math.random() * 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = base * 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(mid.gain);
    lfo.start();
    this.active.push(lfo, lfoGain);
  }

  // ─── Layered rain ─────────────────────────────────────────────────────────
  // Fine mist hiss + medium drop impact + low body resonance on glass.
  private layeredRain(heavy = false, dest: AudioNode) {
    const m = heavy ? 1.5 : 1.0;
    this.pinkNoise(0.07 * m, 2500, 14000, dest);  // fine mist / hiss
    this.pinkNoise(0.12 * m, 400,  2500,  dest);  // medium drops
    // Body resonance: bandpass gives the "rain on glass" character
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.pinkNoiseBuffer(ctx);
    src.loop = true;
    const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.7;
    const g   = ctx.createGain(); g.gain.value = 0.09 * m;
    src.connect(bp); bp.connect(g); g.connect(dest);
    src.start();
    this.active.push(src, bp, g);
  }

  // ─── Fog drone ────────────────────────────────────────────────────────────
  // Cluster of five detuned sine waves routed through a shared gain that a slow
  // LFO modulates, creating the impression of the fog "breathing".
  private fogDrone(dest: AudioNode) {
    const ctx = this.getCtx();
    const cluster = ctx.createGain();
    cluster.gain.value = 0.65;
    cluster.connect(dest);

    const freqs = [55, 55.4, 82.6, 110.0, 110.5];
    const gains = [0.07, 0.05, 0.04, 0.025, 0.018];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type  = 'sine';
      osc.frequency.value = freq;
      const g   = ctx.createGain(); g.gain.value = gains[i];
      osc.connect(g); g.connect(cluster);
      osc.start();
      this.active.push(osc, g);
    });

    // Breathing LFO: one full cycle every ~20 s
    const lfo     = ctx.createOscillator();
    lfo.type      = 'sine';
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.28; // cluster gain oscillates ±0.28 around 0.65
    lfo.connect(lfoGain);
    lfoGain.connect(cluster.gain);
    lfo.start();
    this.active.push(cluster, lfo, lfoGain);
  }

  // ─── Thunder ──────────────────────────────────────────────────────────────
  // Three phases: sharp high-freq crack → mid-freq bang → low rolling rumble.
  thunder(dest?: AudioNode) {
    const ctx    = this.getCtx();
    const target = dest ?? this.effectsGain ?? this.master!;
    const now    = ctx.currentTime;

    // Phase 1: crack
    const cBuf  = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const cData = cBuf.getChannelData(0);
    for (let i = 0; i < cData.length; i++) cData[i] = Math.random() * 2 - 1;
    const crackSrc = ctx.createBufferSource(); crackSrc.buffer = cBuf;
    const crackHp  = ctx.createBiquadFilter(); crackHp.type = 'highpass'; crackHp.frequency.value = 1200;
    const crackG   = ctx.createGain();
    crackG.gain.setValueAtTime(0, now);
    crackG.gain.linearRampToValueAtTime(0.5, now + 0.015);
    crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    crackSrc.connect(crackHp); crackHp.connect(crackG); crackG.connect(target);
    crackSrc.start(now);

    // Phase 2 + 3: bang fading into rolling rumble
    const rBuf  = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 7), ctx.sampleRate);
    const rData = rBuf.getChannelData(0);
    for (let i = 0; i < rData.length; i++) rData[i] = Math.random() * 2 - 1;
    const rumbleSrc = ctx.createBufferSource(); rumbleSrc.buffer = rBuf;
    const rumbleLp  = ctx.createBiquadFilter(); rumbleLp.type = 'lowpass'; rumbleLp.frequency.value = 140;
    const rumbleG   = ctx.createGain();
    const t1 = now + 0.06;
    rumbleG.gain.setValueAtTime(0, t1);
    rumbleG.gain.linearRampToValueAtTime(0.65, t1 + 0.25);
    rumbleG.gain.exponentialRampToValueAtTime(0.001, t1 + 6.5);
    rumbleSrc.connect(rumbleLp); rumbleLp.connect(rumbleG); rumbleG.connect(target);
    rumbleSrc.start(t1);
  }

  // ─── Recording loader ─────────────────────────────────────────────────────
  // Silently skips missing files — procedural synthesis is always running as base.
  private async loadRecording(path: string, gain: number, dest: AudioNode): Promise<void> {
    const ctx = this.getCtx();
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const audioBuf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.loop   = true;
      const g    = ctx.createGain(); g.gain.value = gain;
      src.connect(g); g.connect(dest);
      src.start();
      this.recordings.push(src);
    } catch {
      // File absent or decode failed — procedural fallback already running
    }
  }

  // ─── State machine ────────────────────────────────────────────────────────

  async setState(weatherData: WeatherData) {
    const { state, windspeed, urbanDensity } = weatherData;
    const key = `${state}:${urbanDensity ?? 'rural'}`;
    if (key === this.currentStateKey) return;
    this.currentStateKey = key;
    this.stopAll();
    this.getCtx();

    const amb  = this.ambientGain!;
    const efx  = this.effectsGain!;
    const city = this.cityHumGain!;

    const isUrban = urbanDensity === 'urban';
    const isTown  = urbanDensity === 'town';

    switch (state) {
      case 'clear-night':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.55, amb);
        } else if (isTown) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.20, amb);
          await this.loadRecording(AUDIO_ASSETS.crickets,      0.35, amb);
          this.wind(Math.min(windspeed, 15), efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.crickets, 0.60, amb);
          this.wind(Math.min(windspeed, 15), efx);
        }
        break;

      case 'clear-day':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.50, amb);
          this.wind(windspeed, efx);
        } else if (isTown) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.18, amb);
          await this.loadRecording(AUDIO_ASSETS.birds,         0.30, amb);
          this.wind(windspeed, efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.birds,      0.40, amb);
          this.wind(windspeed, efx);
          await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.15, amb);
        }
        break;

      case 'golden-hour':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.45, amb);
          this.wind(Math.min(windspeed, 12), efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.birds,      0.35, amb);
          await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.12, amb);
          this.wind(Math.min(windspeed, 12), efx);
        }
        break;

      case 'partly-cloudy':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.42, amb);
          this.wind(windspeed, efx);
        } else {
          this.wind(windspeed, efx);
          await this.loadRecording(AUDIO_ASSETS.forest_wind, 0.30, amb);
          await this.loadRecording(AUDIO_ASSETS.ocean_surf,  0.12, amb);
        }
        break;

      case 'partly-cloudy-night':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.48, amb);
        } else if (isTown) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.18, amb);
          await this.loadRecording(AUDIO_ASSETS.crickets,      0.32, amb);
          this.wind(windspeed, efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.crickets, 0.50, amb);
          this.wind(windspeed, efx);
        }
        break;

      case 'overcast':
        this.wind(windspeed, efx);
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.40, amb);
        } else {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.28, amb);
          await this.loadRecording(AUDIO_ASSETS.forest_wind,   0.20, amb);
        }
        break;

      case 'fog':
        this.fogDrone(efx);
        this.wind(Math.min(windspeed, 8), efx);
        if (isUrban) {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.22, amb);
        } else {
          await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.35, amb);
        }
        break;

      case 'fog-night':
        this.fogDrone(efx);
        this.wind(Math.min(windspeed, 8), efx);
        if (isUrban) {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.20, amb);
        } else {
          await this.loadRecording(AUDIO_ASSETS.crickets,     0.40, amb);
          await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.30, amb);
        }
        break;

      case 'rain':
        this.layeredRain(false, efx);
        this.wind(Math.min(windspeed, 20), efx);
        await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.45, efx);
        await this.loadRecording(AUDIO_ASSETS.city_ambience, isUrban ? 0.20 : 0.10, amb);
        if (isUrban) this.cityHum(city);
        break;

      case 'snow':
        this.wind(Math.min(windspeed, 10), efx);
        await this.loadRecording(AUDIO_ASSETS.snow_ambience, 0.40, amb);
        if (isUrban) {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.15, amb);
        }
        break;

      case 'storm':
        this.layeredRain(true, efx);
        this.wind(windspeed, efx);
        await this.loadRecording(AUDIO_ASSETS.storm_wind,    0.40, efx);
        await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.35, efx);
        break;
    }
  }

  get isMuted() { return this.muted; }

  mute()   { this.muted = true;  if (this.master) this.master.gain.value = 0;   }
  unmute() {
    this.muted = false;
    if (this.master) {
      const t = this.master.context.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0.7, t, 0.1);
    }
  }
  toggle() { if (this.muted) this.unmute(); else this.mute(); }
}

export function getActiveLayerLabels(weather: WeatherData): string {
  const { state, urbanDensity } = weather;
  const isUrban = urbanDensity === 'urban';
  const isTown  = urbanDensity === 'town';
  const L: string[] = [];

  switch (state) {
    case 'clear-night':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE');
      else if (isTown)  L.push('CITY HUM', 'CITY AMBIENCE', 'CRICKETS', 'WIND');
      else              L.push('CRICKETS', 'WIND');
      break;
    case 'clear-day':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE', 'WIND');
      else if (isTown)  L.push('CITY HUM', 'CITY AMBIENCE', 'BIRDS', 'WIND');
      else              L.push('BIRDS', 'WIND', 'OCEAN SURF');
      break;
    case 'golden-hour':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE', 'WIND');
      else              L.push('BIRDS', 'OCEAN SURF', 'WIND');
      break;
    case 'partly-cloudy':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE', 'WIND');
      else              L.push('WIND', 'FOREST WIND', 'OCEAN SURF');
      break;
    case 'partly-cloudy-night':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE');
      else if (isTown)  L.push('CITY HUM', 'CITY AMBIENCE', 'CRICKETS', 'WIND');
      else              L.push('CRICKETS', 'WIND');
      break;
    case 'overcast':
      L.push('WIND');
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE');
      else              L.push('CITY AMBIENCE', 'FOREST WIND');
      break;
    case 'fog':
      L.push('FOG DRONE', 'WIND');
      if (isUrban)      L.push('CITY AMBIENCE');
      else              L.push('FOG AMBIENCE');
      break;
    case 'fog-night':
      L.push('FOG DRONE', 'WIND');
      if (isUrban)      L.push('CITY AMBIENCE');
      else              L.push('CRICKETS', 'FOG AMBIENCE');
      break;
    case 'rain':
      L.push('RAIN', 'WIND', 'RAIN ON GLASS', 'CITY AMBIENCE');
      if (isUrban) L.push('CITY HUM');
      break;
    case 'snow':
      L.push('WIND', 'SNOW AMBIENCE');
      if (isUrban) L.push('CITY AMBIENCE');
      break;
    case 'storm':
      L.push('RAIN', 'WIND', 'STORM WIND', 'RAIN ON GLASS');
      break;
  }

  return L.join(' · ');
}

export const weatherAudio = new WeatherAudio();
