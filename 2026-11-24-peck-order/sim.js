// Pure simulation core: no DOM, so it runs in the browser and under `node sim.test.js`.
(function (root) {
  const FLOCK = 40;
  const MEALS = FLOCK / 2;
  const BARK = { lichen: 0.8, soot: 0.14 };
  const INHERITANCE_NOISE = 0.11;

  function makeRng(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  // The founders span the middle of the range, so neither bark starts out solved.
  function founders(rng, size = FLOCK) {
    return Array.from({ length: size }, () => 0.25 + rng() * 0.5);
  }

  // Each child sits between two random parents, plus a little inherited noise.
  function breed(survivors, rng, size = FLOCK) {
    return Array.from({ length: size }, () => {
      const a = survivors[Math.floor(rng() * survivors.length)];
      const b = survivors[Math.floor(rng() * survivors.length)];
      return clamp((a + b) / 2 + gaussian(rng) * INHERITANCE_NOISE);
    });
  }

  // How likely a bird is to notice this moth, relative to the others.
  function visibility(tone, barkTone, hunter) {
    if (hunter === 'blind') return 1;
    const contrast = Math.abs(tone - barkTone);
    return 0.004 + contrast * contrast;
  }

  // Pick one living moth, weighted by visibility. Returns its index in `tones`.
  function chooseMeal(tones, alive, barkTone, hunter, rng) {
    const living = [];
    for (let i = 0; i < tones.length; i += 1) if (alive[i]) living.push(i);
    const weights = living.map((i) => visibility(tones[i], barkTone, hunter));
    let pick = rng() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let k = 0; k < living.length; k += 1) {
      pick -= weights[k];
      if (pick <= 0) return living[k];
    }
    return living[living.length - 1];
  }

  // One full generation without a player: eat half, breed the rest.
  function generation(tones, barkTone, hunter, rng) {
    const alive = tones.map(() => true);
    for (let meal = 0; meal < Math.floor(tones.length / 2); meal += 1) {
      alive[chooseMeal(tones, alive, barkTone, hunter, rng)] = false;
    }
    return breed(tones.filter((_, i) => alive[i]), rng, tones.length);
  }

  const api = { FLOCK, MEALS, BARK, makeRng, mean, founders, breed, visibility, chooseMeal, generation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PeckSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
