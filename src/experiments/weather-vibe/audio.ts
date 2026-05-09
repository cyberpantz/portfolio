import type { WeatherData, WeatherState } from './conditions';

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
  city_ambience: '/audio/weather-vibe/city_ambience.wav',
  ocean_surf:    '/audio/weather-vibe/ocean_surf.wav',
  storm_wind:    '/audio/weather-vibe/storm_wind.wav',
  forest_wind:   '/audio/weather-vibe/forest_wind.wav',
  snow_ambience: '/audio/weather-vibe/snow_ambience.wav',
  fog_ambience:  '/audio/weather-vibe/fog_ambience.wav',
} as const;

// ─── Engine ───────────────────────────────────────────────────────────────────

class WeatherAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: AudioNode[] = [];
  private recordings: AudioBufferSourceNode[] = [];
  private currentState: WeatherState | null = null;
  private muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.master.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 4);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
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
    const target = dest ?? this.master!;
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
    const { state, windspeed } = weatherData;
    if (state === this.currentState) return;
    this.currentState = state;
    this.stopAll();
    this.getCtx();

    const dest = this.master!;

    switch (state) {
      case 'clear-night':
        await this.loadRecording(AUDIO_ASSETS.crickets, 0.6, dest);
        this.wind(Math.min(windspeed, 15), dest);
        break;

      case 'clear-day':
        await this.loadRecording(AUDIO_ASSETS.birds, 0.4, dest);
        this.wind(windspeed, dest);
        await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.15, dest);
        break;

      case 'partly-cloudy':
        this.wind(windspeed, dest);
        await this.loadRecording(AUDIO_ASSETS.forest_wind, 0.30, dest);
        await this.loadRecording(AUDIO_ASSETS.ocean_surf,  0.12, dest);
        break;

      case 'partly-cloudy-night':
        await this.loadRecording(AUDIO_ASSETS.crickets, 0.50, dest);
        this.wind(windspeed, dest);
        break;

      case 'overcast':
        this.wind(windspeed, dest);
        await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.28, dest);
        await this.loadRecording(AUDIO_ASSETS.forest_wind,   0.20, dest);
        break;

      case 'fog':
        this.fogDrone(dest);
        this.wind(Math.min(windspeed, 8), dest);
        await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.35, dest);
        break;

      case 'fog-night':
        this.fogDrone(dest);
        this.wind(Math.min(windspeed, 8), dest);
        await this.loadRecording(AUDIO_ASSETS.crickets,    0.40, dest); // muffled by fog
        await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.30, dest);
        break;

      case 'rain':
        this.layeredRain(false, dest);
        this.wind(Math.min(windspeed, 20), dest);
        await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.45, dest);
        await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.10, dest);
        break;

      case 'snow':
        this.wind(Math.min(windspeed, 10), dest);
        await this.loadRecording(AUDIO_ASSETS.snow_ambience, 0.40, dest);
        break;

      case 'storm':
        this.layeredRain(true, dest);
        this.wind(windspeed, dest);
        await this.loadRecording(AUDIO_ASSETS.storm_wind,    0.40, dest);
        await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.35, dest);
        break;
    }
  }

  get isMuted() { return this.muted; }

  mute()   { this.muted = true;  if (this.master) this.master.gain.value = 0;   }
  unmute() { this.muted = false; if (this.master) this.master.gain.value = 0.7; }
  toggle() { if (this.muted) this.unmute(); else this.mute(); }
}

export const weatherAudio = new WeatherAudio();
