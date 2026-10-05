(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WobbleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // 51 Pegasi: the star every preset orbits in this lab.
  const STAR_MASS = 1.06;              // solar masses
  const MJ_PER_SUN = 9.5458e-4;        // Jupiter masses per solar mass
  const AU_KM = 1.495978707e8;
  const DAYS_PER_YEAR = 365.25;
  // K = 28.4329 m/s * (m_p sin i / M_J) * (P / yr)^(-1/3) * (M / M_sun)^(-2/3), e = 0
  const K_CONST = 28.4329;
  const MASS_MIN = 0.0003, MASS_MAX = 6;      // Jupiter masses
  const DIST_MIN = 0.015, DIST_MAX = 6;       // AU
  const INCL_MIN = 0, INCL_MAX = 90;          // degrees
  const SLIDER_MAX = 1000;

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }
  function totalMass(massMJ) {
    return STAR_MASS + massMJ * MJ_PER_SUN;
  }
  function periodDays(distAU, massMJ) {
    const a = clamp(distAU, DIST_MIN, DIST_MAX);
    const m = clamp(massMJ, MASS_MIN, MASS_MAX);
    return DAYS_PER_YEAR * Math.sqrt(a * a * a / totalMass(m));
  }
  // Velocity semi-amplitude for an edge-on orbit (sin i = 1), metres / second.
  function semiAmplitude(massMJ, distAU) {
    const m = clamp(massMJ, MASS_MIN, MASS_MAX);
    const a = clamp(distAU, DIST_MIN, DIST_MAX);
    const years = periodDays(a, m) / DAYS_PER_YEAR;
    return K_CONST * m * Math.pow(years, -1 / 3) * Math.pow(totalMass(m), -2 / 3);
  }
  function observedAmplitude(kEdge, inclDeg) {
    return kEdge * Math.sin(clamp(inclDeg, INCL_MIN, INCL_MAX) * Math.PI / 180);
  }
  function massSinI(massMJ, inclDeg) {
    return clamp(massMJ, MASS_MIN, MASS_MAX) *
      Math.sin(clamp(inclDeg, INCL_MIN, INCL_MAX) * Math.PI / 180);
  }
  // Radius of the circle the star itself traces around the barycentre, km.
  function wobbleRadiusKm(massMJ, distAU) {
    const m = clamp(massMJ, MASS_MIN, MASS_MAX);
    const a = clamp(distAU, DIST_MIN, DIST_MAX);
    return a * (m * MJ_PER_SUN) / totalMass(m) * AU_KM;
  }
  // The star's line-of-sight velocity: +K cos(2 pi t / P). Receding is positive.
  function radialVelocity(kObs, timeDays, periodDaysValue) {
    return kObs * Math.cos(2 * Math.PI * timeDays / periodDaysValue);
  }
  // Star centre on the projected sky: opposite the planet in x, in phase in y.
  function starOffset(timeDays, periodDaysValue) {
    const angle = 2 * Math.PI * timeDays / periodDaysValue;
    return {x: -Math.cos(angle), y: Math.sin(angle)};
  }
  // Log-scale slider mappings (0 .. 1000).
  function massToSlider(massMJ) {
    const logMin = Math.log(MASS_MIN), logMax = Math.log(MASS_MAX);
    return clamp((Math.log(clamp(massMJ, MASS_MIN, MASS_MAX)) - logMin) /
      (logMax - logMin), 0, 1) * SLIDER_MAX;
  }
  function sliderToMass(value) {
    const logMin = Math.log(MASS_MIN), logMax = Math.log(MASS_MAX);
    return Math.exp(logMin + clamp(value, 0, SLIDER_MAX) / SLIDER_MAX * (logMax - logMin));
  }
  function distToSlider(distAU) {
    const logMin = Math.log(DIST_MIN), logMax = Math.log(DIST_MAX);
    return clamp((Math.log(clamp(distAU, DIST_MIN, DIST_MAX)) - logMin) /
      (logMax - logMin), 0, 1) * SLIDER_MAX;
  }
  function sliderToDist(value) {
    const logMin = Math.log(DIST_MIN), logMax = Math.log(DIST_MAX);
    return Math.exp(logMin + clamp(value, 0, SLIDER_MAX) / SLIDER_MAX * (logMax - logMin));
  }
  function inclToSlider(inclDeg) {
    return clamp(inclDeg, INCL_MIN, INCL_MAX) / INCL_MAX * SLIDER_MAX;
  }
  function sliderToIncl(value) {
    return clamp(value, 0, SLIDER_MAX) / SLIDER_MAX * INCL_MAX;
  }
  const PRESETS = {
    discovery: {massMJ: 0.46, distAU: 0.0522},   // 51 Peg b, m sin i
    jupiter: {massMJ: 1, distAU: 5.2},
    earth: {massMJ: 1 / 317.83, distAU: 1}
  };
  return {
    STAR_MASS, MJ_PER_SUN, AU_KM, DAYS_PER_YEAR, SLIDER_MAX,
    MASS_MIN, MASS_MAX, DIST_MIN, DIST_MAX, INCL_MIN, INCL_MAX,
    PRESETS, clamp, periodDays, semiAmplitude, observedAmplitude,
    massSinI, wobbleRadiusKm, radialVelocity, starOffset,
    massToSlider, sliderToMass, distToSlider, sliderToDist,
    inclToSlider, sliderToIncl
  };
});
