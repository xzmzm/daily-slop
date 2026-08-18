/**
 * Procedural Audio Synthesizer for Daguerreotype Studio
 * Uses Web Audio API with zero external assets.
 */

const DaguerreAudio = (() => {
  let ctx = null;
  let isMuted = false;

  function getContext() {
    if (!ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function setMuted(muted) {
    isMuted = muted;
  }

  function toggleMute() {
    isMuted = !isMuted;
    return isMuted;
  }

  function playBuff() {
    if (isMuted) return;
    const c = getContext();
    if (!c) return;

    const bufferSize = c.sampleRate * 0.15;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, c.currentTime);
    filter.Q.setValueAtTime(2.0, c.currentTime);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start();
  }

  function playBoxSlide() {
    if (isMuted) return;
    const c = getContext();
    if (!c) return;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, c.currentTime);
    osc.frequency.linearRampToValueAtTime(280, c.currentTime + 0.25);

    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.3);
  }

  function playLensCap(isRemove = true) {
    if (isMuted) return;
    const c = getContext();
    if (!c) return;

    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(isRemove ? 320 : 220, now);
    osc.frequency.exponentialRampToValueAtTime(isRemove ? 480 : 120, now + 0.18);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(now + 0.22);
  }

  function playFlameHiss() {
    if (isMuted) return;
    const c = getContext();
    if (!c) return;

    const bufferSize = c.sampleRate * 0.4;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2500, c.currentTime);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    noise.start();
  }

  function playRinse() {
    if (isMuted) return;
    const c = getContext();
    if (!c) return;

    const now = c.currentTime;
    const bufferSize = c.sampleRate * 0.5;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / 100);
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(400, now + 0.5);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    noise.start();
  }

  function playCaseSnap() {
    if (isMuted) return;
    const c = getContext();
    if (!c) return;

    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(now + 0.1);
  }

  return {
    getContext,
    setMuted,
    toggleMute,
    playBuff,
    playBoxSlide,
    playLensCap,
    playFlameHiss,
    playRinse,
    playCaseSnap
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = DaguerreAudio;
}
