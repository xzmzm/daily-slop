// Field-sequential colour model: which field is lit, how the eye weighs it,
// and where each field's picture lands on a moving retina.
(function (root) {
  "use strict";

  const SEGMENTS = 6;            // the CBS disk: red, green, blue, twice round
  const CHANNELS = ["r", "g", "b"];
  const CBS = { fieldRate: 144, lines: 405, rpm: 1440, pictures: 24 };
  const NTSC_BW = { lineRate: 15750, fieldRate: 60 };

  const rpm = (fieldRate) => (fieldRate / SEGMENTS) * 60;
  const colorPictures = (fieldRate) => fieldRate / 3;
  const fieldIndex = (t, rate) => Math.floor(t * rate + 1e-9);
  const channelOf = (k) => ((k % 3) + 3) % 3;
  // CBS lines per second: 405 lines, two interlaced fields per frame.
  const lineRate = (fieldRate, lines = CBS.lines) => (lines * fieldRate) / 2;

  // When was the picture in field k captured?
  //  "field": a field-sequential camera shoots each colour at its own moment (CBS).
  //  "frame": one full-colour frame is split into three fields (a DLP projector).
  function sampleTime(k, rate, source) {
    return source === "frame" ? (Math.floor(k / 3) * 3) / rate : k / rate;
  }

  // Eye = gamma (Erlang) impulse response: ORDER cascaded low-pass stages of
  // time constant tau, a standard fit to human temporal sensitivity. A field
  // lit over [a, b) contributes the kernel's integral over that span. Scaled
  // by 3 so a steady white (one third of the light per channel) reads as white.
  const ORDER = 4;
  const EYE_TAU = 0.012;         // s per stage; mean response ≈ 48 ms
  function eyeCdf(s, tau) {
    if (s <= 0) return 0;
    const x = s / tau;
    let term = 1, sum = 1;
    for (let i = 1; i < ORDER; i++) { term *= x / i; sum += term; }
    return 1 - Math.exp(-x) * sum;
  }
  function fieldWeights(t, rate, tau, limit = 240, eps = 0.002) {
    const now = fieldIndex(t, rate);
    if (!(tau > 0)) return [{ k: now, w: 3, mid: (now / rate + t) / 2 }];
    const out = [];
    for (let k = now; k > now - limit; k--) {
      const a = k / rate;
      const b = Math.min((k + 1) / rate, t);
      if (b <= a) continue;
      const w = 3 * (eyeCdf(t - a, tau) - eyeCdf(t - b, tau));
      if (w < eps && t - b > ORDER * tau) break;
      out.push({ k, w, mid: (a + b) / 2 });
    }
    return out;
  }

  // The picture the eye builds: the latest full set of red, green and blue,
  // as a window of three field periods sliding with time. Each channel's
  // weights sum to exactly 1, so still colours mix perfectly at any rate and
  // a moving edge lands as three offset colour images.
  function triadWeights(t, rate) {
    const now = fieldIndex(t, rate), start = t - 3 / rate, out = [];
    for (let k = now; k >= now - 3; k--) {
      const a = Math.max(k / rate, start), b = Math.min((k + 1) / rate, t);
      if (b > a) out.push({ k, w: (b - a) * rate, mid: (a + b) / 2 });
    }
    return out;
  }

  // Perceived channel levels for a steady colour: proves the weights fuse to it.
  function perceivedSteady(color, t, rate, tau) {
    const sum = [0, 0, 0];
    for (const { k, w } of fieldWeights(t, rate, tau, 100000, 1e-12)) {
      const c = channelOf(k);
      sum[c] += w * color[c];
    }
    return sum;
  }

  // Bounce position: a triangle wave across [lo, hi] at speed v.
  function bounce(t, v, lo, hi) {
    const span = hi - lo;
    if (span <= 0 || v === 0) return (lo + hi) / 2;
    const p = ((t * v) % (2 * span) + 2 * span) % (2 * span);
    return p < span ? lo + p : hi - (p - span);
  }

  // Span from the first to the last colour fringe on an edge whose image
  // moves across the retina at relative speed vRel (px/s): R→G→B occupies two
  // field periods.
  const fringeWidth = (vRel, rate) => (2 * Math.abs(vRel)) / rate;

  const api = {
    SEGMENTS, CHANNELS, CBS, NTSC_BW, rpm, colorPictures, fieldIndex, channelOf,
    lineRate, sampleTime, EYE_TAU, eyeCdf, fieldWeights, triadWeights, perceivedSteady, bounce, fringeWidth,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Wheel = api;
})(typeof window !== "undefined" ? window : globalThis);
