(function (root) {
  'use strict';
  // Single-body atmospheric entry: exponential atmosphere, flat ground, and a
  // flight-path angle that stays constant from 100 km down to the ground.
  const RHO0 = 1.225;              // sea-level air density, kg/m^3
  const SCALE_HEIGHT = 7200;       // atmosphere scale height, m
  const GRAVITY = 9.81;            // m/s^2
  const START_ALTITUDE = 1e5;      // entry interface, m
  const DRAG_COEFF = 0.7;          // Γ, dimensionless drag coefficient
  const HEAT_TRANSFER = 0.02;      // Λ, fraction of stagnation heat that ablates
  const LUMINOUS_EFFICIENCY = 0.005; // τ, fraction of ablated kinetic energy that glows
  const STRENGTH_EXPONENT = 0.25;  // Weibull-ish size effect: small bodies are stronger
  const REFERENCE_RADIUS = 1;      // material strengths are quoted for a 1 m radius body
  const TNT_JOULES = 4.184e12;     // 1 kiloton of TNT
  const ZERO_MAG_FLUX = 2.54e-8;   // irradiance of a magnitude-0 star, W/m^2
  const VIEW_DISTANCE = 1e5;       // brightness is quoted for an observer 100 km away
  const FLARE_BOOST = 4;           // burst flash peak, relative to pre-burst luminosity
  const FLARE_DECAY = 0.4;         // s, exponential decay of the flash
  const FLARE_DRAG = 4;            // 1/s, fragment cloud deceleration v/(1 + FLARE_DRAG·t)
  const DARK_SPEED = 300;          // m/s, below this the rock glows only by cooling
  const DARK_COMPRESSION = 2;      // s of animation used to cover the whole dark flight

  // Strengths are dynamic strengths of a 1 m radius body, in pascals. The
  // Weibull size effect (STRENGTH_EXPONENT) weakens bigger bodies, which is
  // why a 20 m stone shatters near 30 km while a 60 cm stone rides 11 MPa of
  // dynamic pressure all the way down.
  const MATERIALS = {
    dust: {label: 'Dust & ice', density: 600, strength: 1.5e4, heatOfAblation: 3e6},
    stony: {label: 'Stone', density: 3300, strength: 1.5e7, heatOfAblation: 8e6},
    iron: {label: 'Iron', density: 7800, strength: 8e7, heatOfAblation: 1e7},
  };

  function validate(params) {
    if (!params || !MATERIALS[params.material]) throw new RangeError('Unknown material');
    for (const [key, low, high] of [['massKg', 1e-6, 1e12], ['speedKms', 1, 100], ['angleDeg', 1, 90]]) {
      const value = params[key];
      if (!Number.isFinite(value) || value < low || value > high) {
        throw new RangeError(`${key} must lie between ${low} and ${high}`);
      }
    }
  }

  function airDensity(altitudeM) {
    return RHO0 * Math.exp(-altitudeM / SCALE_HEIGHT);
  }

  function radius(massKg, densityKgM3) {
    return Math.cbrt(3 * massKg / (4 * Math.PI * densityKgM3));
  }

  // Strength scales with radius because big rocks are weakened by their flaws.
  function strengthAt(massKg, material) {
    const mat = MATERIALS[material];
    return mat.strength * Math.pow(REFERENCE_RADIUS / radius(massKg, mat.density), STRENGTH_EXPONENT);
  }

  function dynamicPressure(rho, speedMs) {
    return rho * speedMs * speedMs;
  }

  // Apparent magnitude for `luminosityW` seen from VIEW_DISTANCE.
  function magnitude(luminosityW) {
    if (!Number.isFinite(luminosityW) || luminosityW <= 0) return 12;
    const flux = luminosityW / (4 * Math.PI * VIEW_DISTANCE * VIEW_DISTANCE);
    return Math.max(-30, Math.min(12, -2.5 * Math.log10(flux / ZERO_MAG_FLUX)));
  }

  function tntKt(energyJ) {
    return energyJ / TNT_JOULES;
  }

  function ablationRate(rho, speedMs, areaM2, material) {
    const mat = MATERIALS[material];
    return (HEAT_TRANSFER / (2 * mat.heatOfAblation)) * rho * speedMs ** 3 * areaM2;
  }

  function formatMass(kg) {
    if (!Number.isFinite(kg) || kg <= 0) return '0 g';
    if (kg < 0.001) return (kg * 1e6).toFixed(kg < 1e-5 ? 0 : 1) + ' mg';
    if (kg < 1) return (kg * 1000).toFixed(kg < 0.01 ? 1 : 0) + ' g';
    if (kg < 1000) return Math.round(kg) + ' kg';
    if (kg < 1e6) return Math.round(kg / 1000).toLocaleString('en-US') + ' t';
    return (kg / 1e6).toPrecision(3).replace(/\.?0+$/, '') + ' kt';
  }

  // Burst energy in kilotons of TNT, or tonnes when it is smaller than one kiloton.
  function formatTnt(energyJ) {
    const kt = tntKt(energyJ);
    return kt >= 1 ? (kt >= 100 ? Math.round(kt) : Math.round(kt * 10) / 10) + ' kt' : Math.max(1, Math.round(energyJ / 4.184e9)) + ' t';
  }

  // Speed a still-intact rock of this mass would retain at sea level.
  function terminalSpeed(massKg, material) {
    const mat = MATERIALS[material];
    return Math.sqrt(massKg * GRAVITY / (DRAG_COEFF * RHO0 * Math.PI * radius(massKg, mat.density) ** 2));
  }

  // Integrate one fireball from the entry interface down. Returns the samples
  // used for drawing plus a verdict: 'landed', 'shattered' or 'burned'.
  function simulate(params) {
    validate(params);
    const mat = MATERIALS[params.material];
    const mass0 = params.massKg;
    const sinTheta = Math.sin(params.angleDeg * Math.PI / 180);
    const cosTheta = Math.cos(params.angleDeg * Math.PI / 180);
    const massFloor = Math.max(1e-4, mass0 * 1e-9);

    let mass = mass0, speed = params.speedKms * 1000, altitude = START_ALTITUDE, downrange = 0, time = 0;
    const samples = [];
    let peakPressure = 0, peakLuminosity = 0, peakMagnitude = 12, lastSample = -1;
    let burst = null, impact = null, darkFlight = null, outcome = null;

    function record(luminosity) {
      const pressure = dynamicPressure(airDensity(altitude), speed);
      const mag = magnitude(luminosity);
      samples.push({t: time, h: altitude, x: downrange, v: speed, m: mass, L: luminosity, mag});
      if (mag < peakMagnitude) peakMagnitude = mag;
      return pressure;
    }

    function step(dt) {
      const rho = airDensity(altitude);
      const area = Math.PI * radius(mass, mat.density) ** 2;
      const dragDecel = DRAG_COEFF * rho * speed * speed * area / mass;
      const loss = ablationRate(rho, speed, area, params.material) * dt;
      const decel = dragDecel + GRAVITY * sinTheta;
      const dh = -speed * sinTheta * dt, dx = speed * cosTheta * dt;
      if (altitude + dh <= 0) {
        const fraction = altitude / -dh;
        time += dt * fraction; downrange += dx * fraction; speed = Math.max(0, speed - decel * dt * fraction);
        altitude = 0; impact = {v: speed, m: mass, x: downrange, t: time};
        outcome = 'landed';
        return true;
      }
      time += dt; altitude += dh; downrange += dx;
      speed = Math.max(0, speed - decel * dt);
      mass = Math.max(0, mass - loss);
      return false;
    }

    while (outcome === null) {
      const rho = airDensity(altitude);
      const area = Math.PI * radius(mass, mat.density) ** 2;
      const luminosity = LUMINOUS_EFFICIENCY * ablationRate(rho, speed, area, params.material) * speed * speed / 2;
      const pressure = record(luminosity);
      peakPressure = Math.max(peakPressure, pressure);
      peakLuminosity = Math.max(peakLuminosity, luminosity);
      if (pressure > strengthAt(mass, params.material)) {
        burst = {t: time, h: altitude, x: downrange, v: speed, m: mass, q: pressure, energyJ: 0.5 * mass * speed * speed};
        outcome = 'shattered';
        break;
      }
      if (mass <= massFloor) { outcome = 'burned'; break; }
      if (speed <= DARK_SPEED && luminosity < peakLuminosity * 0.01 && altitude > 0) {
        darkFlight = {t: time, h: altitude, x: downrange, v: speed, m: mass};
        break;
      }
      const dt = speed > 1500 ? 0.01 : 0.2;
      if (step(dt)) break;                       // crossed the ground mid-step
      if (mass <= massFloor) { outcome = 'burned'; break; }
      if (time > 4000) { outcome = 'burned'; break; } // safety net; unreachable in practice
    }

    if (burst) {
      // Fragment cloud: a flash, then the glow dies as the cloud stalls.
      const speedBurst = burst.v, luminosityBurst = peakLuminosity;
      for (let i = 1; i <= 30; i++) {
        time += 0.05;
        speed = speedBurst / (1 + FLARE_DRAG * (time - burst.t));
        altitude = Math.max(0, burst.h - (speedBurst * sinTheta / FLARE_DRAG) * (1 - 1 / (1 + FLARE_DRAG * (time - burst.t))));
        downrange = burst.x + (speedBurst * cosTheta / FLARE_DRAG) * Math.log1p(FLARE_DRAG * (time - burst.t));
        const glow = FLARE_BOOST * luminosityBurst * Math.exp(-(time - burst.t) / FLARE_DECAY);
        record(Math.max(0, glow));
      }
    } else if (darkFlight) {
      // Compress the ballistic fall to the ground into a couple of seconds.
      const fall = {v: darkFlight.v, m: darkFlight.m};
      const realFallSeconds = darkFlight.h / Math.max(30, darkFlight.v * sinTheta);
      const compressed = Math.min(DARK_COMPRESSION, realFallSeconds);
      for (let i = 1; i <= 8; i++) {
        const fraction = i / 8;
        time = darkFlight.t + compressed * fraction;
        altitude = darkFlight.h * (1 - fraction);
        downrange = darkFlight.x + darkFlight.v * cosTheta * realFallSeconds * fraction;
        speed = i === 8 ? terminalSpeed(fall.m, params.material) : darkFlight.v;
        mass = fall.m;
        record(0);
        if (i === 8) impact = {v: speed, m: fall.m, x: downrange, t: time + Math.max(0, realFallSeconds - compressed)};
      }
      outcome = 'landed';
    } else if (impact) {
      // Landed mid-step at speed: pin the ground crossing onto the samples.
      time = impact.t; altitude = 0; downrange = impact.x; speed = impact.v; mass = impact.m;
      record(0);
    }

    return {
      outcome, samples, burst, impact,
      peakPressure, peakLuminosity, peakMagnitude,
      mass0, material: params.material, angleDeg: params.angleDeg,
      duration: time, maxDownrange: samples.reduce((max, s) => Math.max(max, s.x), 0),
    };
  }

  const api = {
    RHO0, SCALE_HEIGHT, START_ALTITUDE, DRAG_COEFF, LUMINOUS_EFFICIENCY, TNT_JOULES,
    MATERIALS, airDensity, radius, strengthAt, dynamicPressure, magnitude, tntKt,
    formatMass, formatTnt, terminalSpeed, simulate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EntryModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
