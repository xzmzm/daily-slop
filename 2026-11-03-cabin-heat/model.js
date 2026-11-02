// Lumped one-node heat balance for an imaginary Sputnik 2 cabin.
// All constants are invented teaching values, tuned so the flight-as-flown
// case crosses 40 °C a few hours in. Not a reconstruction of the real craft.
(function (root) {
  const SIGMA = 5.670e-8;      // Stefan–Boltzmann, W/m²K⁴
  const EMISSIVITY = 0.8;
  const SOLAR = 1361;          // W/m² above the air
  const SUN_AREA = 0.5;        // m² of sunlit skin
  const INTERNAL = 40;         // W: dog + instruments
  const HEAT_CAPACITY = 50e3;  // J/K for air, structure and dog together
  const PERIOD = 103.7;        // minutes per orbit
  const SUN_FRACTION = 0.64;   // share of each orbit in sunlight
  const START_C = 15;
  const LIMIT_C = 40;
  const HOURS = 9;

  function inSun(minute) {
    return (minute % PERIOD) / PERIOD < SUN_FRACTION;
  }

  function fluxes(config, minute, kelvin) {
    const sun = inSun(minute);
    const leak = config.torn ? 0.05 : 0.015;      // share of sunlight getting through the skin
    const solar = sun ? SOLAR * SUN_AREA * leak : 0;
    const stage = sun && config.stage ? 70 : 0;    // heat soaked from the attached core stage
    let area = config.fan ? 0.15 : 0.09;           // effective radiator area
    if (config.stage) area *= 0.7;                 // the stage blocks part of the radiator's view
    const out = EMISSIVITY * SIGMA * area * kelvin ** 4;
    return { sun, solar, stage, internal: INTERNAL, heatIn: INTERNAL + solar + stage, heatOut: out };
  }

  function simulate(config) {
    const dt = 0.25; // minutes
    const samples = [];
    let kelvin = START_C + 273.15;
    let crossed = null;
    let peak = START_C;
    for (let step = 0; step <= HOURS * 60 / dt; step++) {
      const minute = step * dt;
      const f = fluxes(config, minute, kelvin);
      const celsius = kelvin - 273.15;
      if (step % 4 === 0) samples.push({ minute, celsius, ...f });
      if (crossed === null && celsius >= LIMIT_C) crossed = minute;
      peak = Math.max(peak, celsius);
      kelvin += (f.heatIn - f.heatOut) * dt * 60 / HEAT_CAPACITY;
    }
    return { samples, crossed, peak };
  }

  // Temperature the cabin would settle at if heat in, averaged over an orbit,
  // equalled radiated heat out.
  function settle(config) {
    const sunIn = fluxes(config, 0, 300).heatIn;
    const shadeIn = fluxes(config, PERIOD * 0.9, 300).heatIn;
    const avg = sunIn * SUN_FRACTION + shadeIn * (1 - SUN_FRACTION);
    const perK4 = fluxes(config, 0, 1).heatOut;
    return Math.pow(avg / perK4, 0.25) - 273.15;
  }

  root.CabinModel = { simulate, settle, fluxes, inSun, PERIOD, SUN_FRACTION, LIMIT_C, HOURS, START_C };
})(typeof window !== 'undefined' ? window : globalThis);
