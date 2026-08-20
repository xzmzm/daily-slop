/**
 * Procedural Web Audio Synthesizer for 1888 Burroughs Mechanical Calculator.
 * Synthesizes cast-iron keys, gear ratchets, hammer strikes, hydraulic dashpot flow, and brass bell.
 */

export class MechanicalAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.dashpotSource = null;
    this.dashpotGain = null;
    this.dashpotFilter = null;
  }

  _initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);
        this._setupDashpotLoop();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _setupDashpotLoop() {
    if (!this.ctx) return;
    // Generate white noise buffer for continuous fluid whoosh
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.dashpotFilter = this.ctx.createBiquadFilter();
    this.dashpotFilter.type = 'bandpass';
    this.dashpotFilter.frequency.value = 320;
    this.dashpotFilter.Q.value = 2.5;

    this.dashpotGain = this.ctx.createGain();
    this.dashpotGain.gain.value = 0.0;

    noise.connect(this.dashpotFilter);
    this.dashpotFilter.connect(this.dashpotGain);
    this.dashpotGain.connect(this.masterGain);
    noise.start(0);
  }

  playKeyPress(col, digit) {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Frequency varies slightly by column and digit (heavier key feeling)
    const baseFreq = 180 + col * 25 + digit * 15;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.04);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.05);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);

    // Add brief noise snap for the metal key bottoming out
    this._playMicroClick(t, 2200, 0.2, 0.015);
  }

  playKeyRelease() {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._playMicroClick(t, 1600, 0.15, 0.02);
  }

  playRatchetClick() {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._playMicroClick(t, 3200 + Math.random() * 600, 0.25, 0.012);
  }

  playHammerStrike() {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Heavy metal hammer thwack
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);

    // 2. Paper tape and platen resonance
    this._playMicroClick(t, 1100, 0.6, 0.04);
  }

  playCarryTrip() {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._playMicroClick(t, 4200, 0.3, 0.018);
  }

  playCarryNudge(col) {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 1200 + (8 - col) * 120;
    this._playMicroClick(t, freq, 0.4, 0.025);
  }

  playBellChime() {
    if (!this.enabled) return;
    this._initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Vintage brass bell overtone synthesis
    const freqs = [1760, 3120, 5280];
    const gains = [0.45, 0.25, 0.15];
    const decays = [1.4, 0.8, 0.5];

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(gains[i], t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decays[i]);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + decays[i] + 0.05);
    });
  }

  setDashpotAudio(velocity, viscosity) {
    if (!this.enabled || !this.dashpotGain || !this.dashpotFilter || !this.ctx) return;
    const t = this.ctx.currentTime;
    const targetGain = Math.min(0.35, velocity * 0.08 * Math.max(0.1, viscosity));
    this.dashpotGain.gain.cancelScheduledValues(t);
    this.dashpotGain.gain.setTargetAtTime(targetGain, t, 0.04);
    this.dashpotFilter.frequency.setTargetAtTime(250 + velocity * 80, t, 0.05);
  }

  _playMicroClick(time, freq, gainVal, dur) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }
}
