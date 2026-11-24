// Mercury's perihelion budget, in arcseconds per century.
(function (root) {
  const AU = 1.495978707e11;
  const GM_SUN = 1.32712440018e20;
  const C = 299792458;
  const MERCURY = { a: 0.387098, e: 0.205630, periodDays: 87.9691, massRatio: 1.6601e-7 };
  const ARCSEC_PER_RAD = 180 / Math.PI * 3600;
  const ORBITS_PER_CENTURY = 36525 / MERCURY.periodDays;

  // Observed advance against the stars, after removing the 5025" of precession of the equinoxes.
  const OBSERVED = 574.10;
  const OBSERVED_ERR = 0.65;

  // Clemence (1947) planetary contributions; solar oblateness from modern helioseismology.
  const SOURCES = [
    { id: 'venus', name: 'Venus', value: 277.86 },
    { id: 'jupiter', name: 'Jupiter', value: 153.58 },
    { id: 'earth', name: 'Earth + Moon', value: 90.04 },
    { id: 'saturn', name: 'Saturn', value: 7.30 },
    { id: 'mars', name: 'Mars', value: 2.54 },
    { id: 'outer', name: 'Uranus + Neptune', value: 0.18 },
    { id: 'sun', name: 'Sun’s flattening', value: 0.03 },
  ];

  // The candidate explanations for what is left over.
  const ENTWURF = 17.9; // Einstein & Besso, 1913 "Entwurf" theory

  function grAdvance() {
    const a = MERCURY.a * AU;
    const perOrbit = 6 * Math.PI * GM_SUN / (C * C * a * (1 - MERCURY.e ** 2));
    return perOrbit * ORBITS_PER_CENTURY * ARCSEC_PER_RAD;
  }

  // Laplace coefficient b^(1)_{3/2}(alpha), by numerical quadrature.
  function laplace(alpha) {
    const steps = 2000;
    let sum = 0;
    for (let i = 0; i < steps; i += 1) {
      const psi = (i + 0.5) / steps * 2 * Math.PI;
      sum += Math.cos(psi) / Math.pow(1 - 2 * alpha * Math.cos(psi) + alpha * alpha, 1.5);
    }
    return sum * (2 * Math.PI / steps) / Math.PI;
  }

  // First-order secular advance of Mercury's perihelion from one circular perturber.
  // massRatio is perturber mass / Sun mass, distance in AU.
  function secularAdvance(massRatio, distance) {
    const n = 2 * Math.PI * ORBITS_PER_CENTURY; // rad per century
    const inside = distance < MERCURY.a;
    const alpha = inside ? distance / MERCURY.a : MERCURY.a / distance;
    const alphaBar = inside ? 1 : alpha;
    return n / 4 * (massRatio / (1 + MERCURY.massRatio)) * alpha * alphaBar * laplace(alpha) * ARCSEC_PER_RAD;
  }

  // Vulcan mass, in Mercury masses, that supplies `target` arcsec/century at `distance` AU.
  function vulcanMassFor(target, distance) {
    const perMercury = secularAdvance(MERCURY.massRatio, distance);
    return target / perMercury;
  }

  function vulcanAdvance(mercuryMasses, distance) {
    return secularAdvance(mercuryMasses * MERCURY.massRatio, distance);
  }

  function budget(enabled, extra) {
    const newton = SOURCES.reduce((sum, s) => sum + (enabled[s.id] === false ? 0 : s.value), 0);
    const predicted = newton + extra;
    return { newton, predicted, gap: OBSERVED - predicted };
  }

  const api = {
    MERCURY, OBSERVED, OBSERVED_ERR, SOURCES, ENTWURF, ORBITS_PER_CENTURY,
    grAdvance, laplace, secularAdvance, vulcanMassFor, vulcanAdvance, budget,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Perihelion = api;
})(typeof window !== 'undefined' ? window : globalThis);
