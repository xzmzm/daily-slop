/**
 * Web Audio API Sound Synthesizer for 1851 Sailing Simulation
 * Pure algorithmic procedural audio: zero external audio assets.
 */

export class SailingAudio {
  constructor() {
    this.ctx = null;
    this.muted = true;

    // Audio Nodes
    this.masterGain = null;

    // Sea foam / bow wave rush (white noise filtered)
    this.seaGain = null;
    this.seaFilter = null;
    this.seaNoiseNode = null;

    // Rigging wind whistle
    this.windGain = null;
    this.windFilter = null;
    this.windOsc = null;

    // Sail flutter / luffing snap
    this.flutterGain = null;
    this.lastLuffSnap = 0;

    // Creak timer
    this.lastCreakTime = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0.0 : 0.45, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 1. Sea Noise Generator
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.seaNoiseNode = this.ctx.createBufferSource();
    this.seaNoiseNode.buffer = noiseBuffer;
    this.seaNoiseNode.loop = true;

    this.seaFilter = this.ctx.createBiquadFilter();
    this.seaFilter.type = "lowpass";
    this.seaFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
    this.seaFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.seaGain = this.ctx.createGain();
    this.seaGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.seaNoiseNode.connect(this.seaFilter);
    this.seaFilter.connect(this.seaGain);
    this.seaGain.connect(this.masterGain);
    this.seaNoiseNode.start(0);

    // 2. Wind Whistle Generator
    this.windOsc = this.ctx.createOscillator();
    this.windOsc.type = "sine";
    this.windOsc.frequency.setValueAtTime(180, this.ctx.currentTime);

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.windOsc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windOsc.start(0);

    // 3. Sail Flutter Node
    this.flutterGain = this.ctx.createGain();
    this.flutterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.seaNoiseNode.connect(this.flutterGain);
    this.flutterGain.connect(this.masterGain);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended" && !muted) {
      this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.45, this.ctx.currentTime, 0.05);
    }
  }

  update(telemetry) {
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const speed = telemetry.speed_knots;
    const aws = telemetry.aws_knots;

    // Sea foam rush tied to boat speed
    const speedNorm = Math.min(speed / 14.0, 1.2);
    const targetSeaGain = speedNorm * 0.35;
    const targetSeaFreq = 180 + speedNorm * 650;
    this.seaGain.gain.setTargetAtTime(targetSeaGain, now, 0.1);
    this.seaFilter.frequency.setTargetAtTime(targetSeaFreq, now, 0.1);

    // Wind whistle tied to apparent wind speed
    const awsNorm = Math.min(aws / 24.0, 1.2);
    const targetWindGain = awsNorm * 0.18;
    const targetWindFreq = 160 + awsNorm * 380;
    this.windGain.gain.setTargetAtTime(targetWindGain, now, 0.15);
    this.windOsc.frequency.setTargetAtTime(targetWindFreq, now, 0.15);

    // Sail Luffing / Fluttering snaps
    if (telemetry.isLuffing && now - this.lastLuffSnap > 0.12) {
      this.lastLuffSnap = now;
      this.triggerSailSnap();
    }

    // Wood hull creak on high heel
    if (Math.abs(telemetry.heel_deg) > 12.0 && now - this.lastCreakTime > 3.0) {
      if (Math.random() < 0.3) {
        this.lastCreakTime = now;
        this.triggerWoodCreak();
      }
    }
  }

  triggerSailSnap() {
    if (!this.ctx || this.muted) return;
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = "triangle";
    snapOsc.frequency.setValueAtTime(80 + Math.random() * 60, this.ctx.currentTime);
    snapGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    snapGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(this.ctx.currentTime);
    snapOsc.stop(this.ctx.currentTime + 0.08);
  }

  triggerWoodCreak() {
    if (!this.ctx || this.muted) return;
    const creakOsc = this.ctx.createOscillator();
    const creakGain = this.ctx.createGain();
    creakOsc.type = "sawtooth";
    creakOsc.frequency.setValueAtTime(110 + Math.random() * 40, this.ctx.currentTime);
    creakOsc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + 0.35);

    creakGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    creakGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(300, this.ctx.currentTime);

    creakOsc.connect(filter);
    filter.connect(creakGain);
    creakGain.connect(this.masterGain);
    creakOsc.start(this.ctx.currentTime);
    creakOsc.stop(this.ctx.currentTime + 0.35);
  }
}
