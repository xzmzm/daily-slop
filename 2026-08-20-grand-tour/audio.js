/**
 * audio.js - Web Audio API Synthesizer for Voyager 2 Grand Tour
 * 
 * Provides procedural sound effects:
 * - NASA Deep Space Network (DSN) telemetry sync blips
 * - Gravitational slingshot hyperbolic well resonance / whoosh
 * - Attitude thruster hydrazine pulse (TCM)
 * - Voyager Golden Record phonograph synthesizer snippet (Bach Brandenburg prelude)
 * - Deep interstellar ambient carrier tone
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.GrandTourAudio = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let audioCtx = null;
  let isMuted = false;
  let ambientGain = null;
  let ambientOsc = null;

  function getAudioContext() {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function init() {
    getAudioContext();
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (ambientGain) {
      ambientGain.gain.value = isMuted ? 0 : 0.02;
    }
    return isMuted;
  }

  function getMuted() {
    return isMuted;
  }

  /**
   * NASA DSN telemetry sync pulse
   */
  function playTelemetryBlip(freq = 1760, duration = 0.04) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + duration);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Gravitational well resonant slingshot whoosh
   */
  function playFlybyWhoosh(duration = 1.2) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      
      // Pitch-dropping oscillator (Doppler + gravity well potential acceleration)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + duration * 0.4);
      osc.frequency.exponentialRampToValueAtTime(60, now + duration);

      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.linearRampToValueAtTime(0.12, now + duration * 0.4);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);

      // Noise texture whoosh
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-Math.abs(i / bufferSize - 0.4) * 5);
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + duration * 0.4);
      filter.frequency.exponentialRampToValueAtTime(150, now + duration);
      filter.Q.value = 3.0;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.linearRampToValueAtTime(0.08, now + duration * 0.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + duration);
    } catch (e) {}
  }

  /**
   * Hydrazine thruster pulse for trajectory correction maneuvers (TCM)
   */
  function playThrusterPulse() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.15;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (e) {}
  }

  /**
   * Synthesizes Bach Gavotte en Rondeau / Brandenburg snippet as etched on Golden Record
   */
  function playGoldenRecordMelody() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Notes in Hz: E5, B4, G#4, E4, G#4, B4, E5, F#5, G#5, E5, B4...
      const notes = [
        { f: 659.25, d: 0.16 }, // E5
        { f: 493.88, d: 0.16 }, // B4
        { f: 415.30, d: 0.16 }, // G#4
        { f: 329.63, d: 0.24 }, // E4
        { f: 415.30, d: 0.16 }, // G#4
        { f: 493.88, d: 0.16 }, // B4
        { f: 659.25, d: 0.32 }, // E5
        { f: 739.99, d: 0.16 }, // F#5
        { f: 830.61, d: 0.32 }, // G#5
        { f: 659.25, d: 0.24 }, // E5
        { f: 493.88, d: 0.40 }  // B4
      ];

      let t = now + 0.05;
      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Warm phonograph tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + note.d);

        t += note.d + 0.04;
      });
    } catch (e) {}
  }

  return {
    init,
    toggleMute,
    getMuted,
    playTelemetryBlip,
    playFlybyWhoosh,
    playThrusterPulse,
    playGoldenRecordMelody
  };
});
