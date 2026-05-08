import type { WeatherData, WeatherState } from './conditions';

export const AUDIO_ASSETS = {
  crickets: '/audio/weather-vibe/frogs_and_crickets.wav',
  birds:    '/audio/weather-vibe/birds_in_forest.wav',
} as const;

class WeatherAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: AudioNode[] = [];
  private recording: AudioBufferSourceNode | null = null;
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
    if (this.recording) {
      try { this.recording.stop(); } catch {}
      this.recording = null;
    }
  }

  private noise(gain: number, lowHz: number, highHz: number, dest: AudioNode) {
    const ctx = this.getCtx();
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lo = ctx.createBiquadFilter();
    lo.type = 'highpass';
    lo.frequency.value = lowHz;

    const hi = ctx.createBiquadFilter();
    hi.type = 'lowpass';
    hi.frequency.value = highHz;

    const g = ctx.createGain();
    g.gain.value = gain;

    src.connect(lo);
    lo.connect(hi);
    hi.connect(g);
    g.connect(dest);
    src.start();

    this.active.push(src, lo, hi, g);
  }

  // Wind gain scales with real windspeed (km/h)
  private windGain(windspeed: number): number {
    if (windspeed < 10) return 0.02;
    if (windspeed < 30) return 0.06 + (windspeed - 10) / 20 * 0.06;
    if (windspeed < 60) return 0.12 + (windspeed - 30) / 30 * 0.10;
    return 0.22;
  }

  private wind(windspeed: number, dest: AudioNode) {
    const gain = this.windGain(windspeed);
    this.noise(gain, 200, 800, dest);
    this.noise(gain * 0.4, 50, 200, dest);
  }

  private rainOnGlass(dest: AudioNode) {
    const ctx = this.getCtx();
    this.noise(0.3, 1000, 8000, dest);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 3200;
    osc.type = 'sine';
    g.gain.value = 0.02;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    this.active.push(osc, g);
  }

  private fogDrone(dest: AudioNode) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 55;
    osc.type = 'sine';
    const g = ctx.createGain();
    g.gain.value = 0.04;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    this.active.push(osc, g);
  }

  thunder(dest?: AudioNode) {
    const ctx = this.getCtx();
    const target = dest ?? this.master!;
    const bufSize = ctx.sampleRate * 5;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lo = ctx.createBiquadFilter();
    lo.type = 'lowpass';
    lo.frequency.value = 80;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5);

    src.connect(lo);
    lo.connect(g);
    g.connect(target);
    src.start();
  }

  private async loadRecording(path: string, gain: number, dest: AudioNode) {
    const ctx = this.getCtx();
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const audioBuf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(dest);
      src.start();
      this.recording = src;
    } catch {
      // Asset not yet available — falls back to procedural only
    }
  }

  async crickets(dest: AudioNode) {
    await this.loadRecording(AUDIO_ASSETS.crickets, 0.6, dest);
  }

  async birds(dest: AudioNode) {
    await this.loadRecording(AUDIO_ASSETS.birds, 0.4, dest);
  }

  async setState(weatherData: WeatherData) {
    const { state, windspeed } = weatherData;
    if (state === this.currentState) return;
    this.currentState = state;
    this.stopAll();
    this.getCtx(); // ensure ctx + master are initialized before use

    const dest = this.master!;

    switch (state) {
      case 'clear-night':
        await this.crickets(dest);
        this.wind(Math.min(windspeed, 15), dest); // quiet wind under crickets
        break;
      case 'clear-day':
        await this.birds(dest);
        this.wind(windspeed, dest);
        break;
      case 'partly-cloudy':
        this.wind(windspeed, dest);
        break;
      case 'overcast':
        this.wind(windspeed, dest);
        break;
      case 'fog':
        this.fogDrone(dest);
        break;
      case 'rain':
        this.rainOnGlass(dest);
        this.wind(Math.min(windspeed, 20), dest); // muffled wind behind glass
        break;
      case 'snow':
        this.wind(Math.min(windspeed, 10), dest); // barely present
        break;
      case 'storm':
        this.rainOnGlass(dest);
        this.wind(windspeed, dest);
        break;
    }
  }

  get isMuted() { return this.muted; }

  mute() {
    this.muted = true;
    if (this.master) this.master.gain.value = 0;
  }

  unmute() {
    this.muted = false;
    if (this.master) this.master.gain.value = 0.7;
  }

  toggle() {
    if (this.muted) this.unmute();
    else this.mute();
  }
}

export const weatherAudio = new WeatherAudio();
