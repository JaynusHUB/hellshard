import { clamp } from './RNG.js';

const SFX = {
  jump: { type: 'sweep', from: 170, to: 330, duration: 0.12, gain: 0.12, wave: 'square' },
  dash: { type: 'noise', duration: 0.18, gain: 0.18, band: 900, q: 0.8, slide: 500 },
  swing: { type: 'noise', duration: 0.1, gain: 0.12, band: 1800, q: 1.2, slide: 900 },
  swingHeavy: { type: 'noise', duration: 0.22, gain: 0.18, band: 700, q: 1.4, slide: 300 },
  hit: { type: 'both', duration: 0.09, gain: 0.24, wave: 'square', from: 120, to: 50, noiseGain: 0.12, band: 800 },
  crit: { type: 'both', duration: 0.16, gain: 0.28, wave: 'sawtooth', from: 500, to: 180, noiseGain: 0.14, band: 2400 },
  death: { type: 'sweep', from: 190, to: 42, duration: 0.38, gain: 0.2, wave: 'sawtooth' },
  playerHurt: { type: 'both', duration: 0.26, gain: 0.24, wave: 'square', from: 90, to: 38, noiseGain: 0.1, band: 300 },
  xp: { type: 'sweep', from: 620, to: 880, duration: 0.08, gain: 0.05, wave: 'sine' },
  levelUp: { type: 'arp', notes: [261, 329, 392, 523], duration: 0.12, gain: 0.12, wave: 'triangle' },
  boss: { type: 'both', duration: 0.9, gain: 0.24, wave: 'sawtooth', from: 54, to: 34, noiseGain: 0.08, band: 120 },
  chest: { type: 'arp', notes: [392, 494, 587, 784], duration: 0.1, gain: 0.1, wave: 'sine' },
  shard: { type: 'arp', notes: [523, 659, 784, 1046, 1318], duration: 0.14, gain: 0.14, wave: 'triangle' },
  interact: { type: 'sweep', from: 280, to: 340, duration: 0.06, gain: 0.06, wave: 'triangle' },
  projectile: { type: 'sweep', from: 420, to: 220, duration: 0.07, gain: 0.045, wave: 'triangle' },
  ability: { type: 'both', duration: 0.3, gain: 0.16, wave: 'sine', from: 300, to: 700, noiseGain: 0.06, band: 1500 },
  blink: { type: 'both', duration: 0.18, gain: 0.13, wave: 'sine', from: 900, to: 200, noiseGain: 0.05, band: 2400 },
  empty: { type: 'sweep', from: 120, to: 90, duration: 0.08, gain: 0.05, wave: 'square' },
  elite: { type: 'both', duration: 0.45, gain: 0.15, wave: 'sawtooth', from: 70, to: 100, noiseGain: 0.05, band: 200 },
  gate: { type: 'sweep', from: 90, to: 50, duration: 0.5, gain: 0.16, wave: 'triangle' },
  ui: { type: 'sweep', from: 420, to: 460, duration: 0.04, gain: 0.04, wave: 'triangle' },
};

export class AudioManager {
  constructor(settings, hooks = {}) {
    this.settings = settings;
    this.context = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.musicNodes = [];
    this.musicStarted = false;
    this.throttle = new Map();
    this.hooks = hooks;
    this.enabled = true;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return this.context;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.context = new AC();
    } catch {
      return null;
    }
    this.masterGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.applyVolumes();
    this.noiseBuffer = this.createNoiseBuffer(1.5);
    return this.context;
  }

  createNoiseBuffer(seconds) {
    const ctx = this.context;
    const frames = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let value = 0;
    for (let i = 0; i < frames; i++) {
      value = value * 0.75 + (Math.random() * 2 - 1) * 0.25;
      data[i] = value;
    }
    return buffer;
  }

  applyVolumes() {
    if (!this.context) return;
    const s = this.settings;
    const master = clamp(Number(s.master ?? 0.8), 0, 1);
    this.masterGain.gain.setTargetAtTime(master, this.context.currentTime, 0.03);
    this.sfxGain.gain.setTargetAtTime(clamp(Number(s.sfx ?? 0.8), 0, 1), this.context.currentTime, 0.03);
    const music = s.musicEnabled === false ? 0 : clamp(Number(s.music ?? 0.3), 0, 1);
    this.musicGain.gain.setTargetAtTime(music, this.context.currentTime, 0.05);
  }

  setSettings(settings) {
    this.settings = settings;
    this.applyVolumes();
    if (settings.musicEnabled === false) this.stopAmbient();
  }

  isThrottled(name, ms) {
    const now = performance.now();
    const last = this.throttle.get(name) ?? 0;
    if (now - last < ms) return true;
    this.throttle.set(name, now);
    return false;
  }

  play(name, options = {}) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const def = SFX[name] ?? SFX.ui;
    if (this.isThrottled(name, options.throttle ?? 24)) return;
    const volume = clamp(options.volume ?? 1, 0, 2);
    const pitch = clamp(options.pitch ?? 1, 0.4, 2.4);
    const time = ctx.currentTime;
    if (def.type === 'arp') {
      def.notes.forEach((note, i) => {
        this.playTone({
          frequency: note * pitch,
          duration: def.duration,
          gain: def.gain * volume,
          wave: def.wave,
          start: time + i * def.duration * 0.8,
        });
      });
      return;
    }
    if (def.type === 'noise' || def.type === 'both') {
      this.playNoise(def, pitch, volume, time);
    }
    if (def.type === 'sweep' || def.type === 'both') {
      this.playTone({
        frequency: def.from * pitch,
        endFrequency: def.to * pitch,
        duration: def.duration,
        gain: def.gain * volume,
        wave: def.wave,
        start: time,
      });
    }
  }

  playTone({ frequency, endFrequency, duration, gain, wave = 'sine', start }) {
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (endFrequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  playNoise(def, pitch, volume, time) {
    const ctx = this.context;
    if (!this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const band = Math.max(80, (def.band ?? 900) * pitch);
    filter.frequency.setValueAtTime(band, time);
    if (def.slide) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, band + def.slide * pitch), time + def.duration);
    }
    filter.Q.value = def.q ?? 1;
    const env = ctx.createGain();
    const gain = (def.noiseGain ?? def.gain) * volume;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + def.duration);
    source.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);
    source.start(time);
    source.stop(time + def.duration + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  startAmbient(zone = 'cemetery') {
    if (!this.settings.musicEnabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.musicStarted) {
      this.setAmbientZone(zone);
      return;
    }
    this.musicStarted = true;
    const base = { cemetery: 55, church: 49, swamp: 46, dungeon: 41, forest: 52 }[zone] ?? 50;
    const seconds = 6;
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0.0001, ctx.currentTime);
    fade.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 3);
    fade.connect(this.musicGain);

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = base * (i + 1) * 0.5;
      osc.detune.value = (i - 1) * 6;
      filter.type = 'lowpass';
      filter.frequency.value = 240 + i * 60;
      oscGain.gain.value = 0.22 / (i + 1);
      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(fade);
      osc.start();
      this.musicNodes.push({ osc, oscGain, filter });
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(fade.gain);
    lfo.start();
    this.musicNodes.push({ lfo, lfoGain, extra: true });
    this.ambientZone = zone;
  }

  setAmbientZone(zone) {
    if (!this.context || !this.musicStarted) return;
    const base = { cemetery: 55, church: 49, swamp: 46, dungeon: 41, forest: 52 }[zone] ?? 50;
    const now = this.context.currentTime;
    let toneIndex = 0;
    for (const node of this.musicNodes) {
      if (node.osc) {
        const ratio = (toneIndex + 1) * 0.5;
        node.osc.frequency.setTargetAtTime(base * ratio, now, 1.5);
        toneIndex++;
      }
    }
    this.ambientZone = zone;
  }

  stopAmbient() {
    if (!this.context || !this.musicStarted) return;
    const now = this.context.currentTime;
    for (const node of this.musicNodes) {
      try {
        if (node.osc) node.osc.stop(now + 1.2);
        if (node.lfo) node.lfo.stop(now + 1.2);
      } catch {
        // Node was already stopped.
      }
    }
    this.musicNodes = [];
    this.musicStarted = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stopAmbient();
  }

  destroy() {
    this.stopAmbient();
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
  }
}
