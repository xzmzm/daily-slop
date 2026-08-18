/**
 * 1839 Daguerreotype Physics & Photochemical Simulation Engine
 * Models thin-film interference, exposure integration, mercury amalgam nucleation,
 * and specular-diffuse reflectance inversion (positive/negative flip).
 */

const DaguerreEngine = (() => {
  // Physical constants and historical calibration
  const REFRACTIVE_INDEX_AGI = 2.21; // Refractive index of Silver Iodide (AgI)
  const OPTIMAL_AGI_THICKNESS_NM = 72; // ~Steel lavender / blue interference peak
  const MERCURY_OPTIMAL_TEMP_C = 65.0; // 65°C / 149°F historical fuming temperature
  const MERCURY_FOG_TEMP_C = 80.0; // Overheating threshold causing chalky fog

  /**
   * Calculate thin-film interference color and sensitivity for a given AgI thickness.
   * @param {number} thicknessNm - Nanometers of AgI layer
   * @returns {{thicknessNm: number, label: string, color: string, sensitivity: number}}
   */
  function calculateSensitization(thicknessNm) {
    const t = Math.max(0, thicknessNm);
    
    // Sensitization stages according to Daguerre & Arago (1839):
    // 0-15 nm: Bare silver mirror (zero sensitivity)
    // 15-30 nm: Pale straw yellow
    // 30-50 nm: Golden orange
    // 50-60 nm: Rose / Magenta
    // 60-85 nm: Steel lavender / Blue (optimal photochemical speed)
    // 85-120 nm: Olive green (second order, solarization prone, lower speed)
    // >120 nm: Dull slate / over-iodized
    
    let label = "Bare Silver";
    let color = "#d8dce2"; // Silver mirror sheen
    let sensitivity = 0.02;
    
    if (t < 5) {
      label = "Bare Silver Mirror";
      color = "#e2e6eb";
      sensitivity = 0.02;
    } else if (t < 25) {
      const p = (t - 5) / 20;
      label = "Pale Straw Yellow";
      color = interpolateColor("#e2e6eb", "#f4e094", p);
      sensitivity = 0.15 + 0.25 * p;
    } else if (t < 45) {
      const p = (t - 25) / 20;
      label = "Golden Orange";
      color = interpolateColor("#f4e094", "#e8a052", p);
      sensitivity = 0.4 + 0.35 * p;
    } else if (t < 60) {
      const p = (t - 45) / 15;
      label = "Rose Magenta";
      color = interpolateColor("#e8a052", "#d86b8c", p);
      sensitivity = 0.75 + 0.2 * p;
    } else if (t <= 85) {
      const p = (t - 60) / 25;
      label = "Steel Lavender / Blue (Optimal)";
      color = interpolateColor("#d86b8c", "#6e8cb8", p);
      // Peak sensitivity centered at 72nm
      const peakDist = Math.abs(t - 72) / 15;
      sensitivity = Math.max(0.7, 1.0 - 0.2 * peakDist * peakDist);
    } else if (t <= 120) {
      const p = (t - 85) / 35;
      label = "Olive Green (Over-sensitized)";
      color = interpolateColor("#6e8cb8", "#788c60", p);
      sensitivity = Math.max(0.2, 0.75 - 0.5 * p);
    } else {
      label = "Dull Slate (Over-iodized)";
      color = "#62666a";
      sensitivity = 0.15;
    }

    return {
      thicknessNm: t,
      label,
      color,
      sensitivity: Math.max(0.01, Math.min(1.0, sensitivity))
    };
  }

  /**
   * Helper to interpolate two hex colors
   */
  function interpolateColor(hex1, hex2, factor) {
    const f = Math.max(0, Math.min(1, factor));
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * f);
    const g = Math.round(g1 + (g2 - g1) * f);
    const b = Math.round(b1 + (b2 - b1) * f);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  /**
   * Calculate effective exposure energy (lux-seconds) received by the plate.
   * E = (Illuminance * Sensitivity * ExposureTimeSec) / (4 * N^2)
   * where N is lens f-number.
   */
  function calculateExposureEnergy(illuminanceLux, fNumber, exposureTimeSec, plateSensitivity) {
    const lux = Math.max(0, illuminanceLux);
    const f = Math.max(1.0, fNumber);
    const t = Math.max(0, exposureTimeSec);
    const sens = Math.max(0.01, plateSensitivity);
    
    // Lens transmission / optical flux factor: 1 / (4 * f^2)
    const focalFactor = 1 / (4 * f * f);
    const totalEnergy = lux * t * focalFactor * sens;
    return totalEnergy;
  }

  /**
   * Evaluates exposure rating & dynamic range state.
   * Target optimal energy for 1839 daguerreotype: ~300 to 800 arbitrary exposure units.
   */
  function evaluateExposure(energy) {
    if (energy < 40) {
      return { status: "Severely Underexposed", ratio: energy / 400, solarized: false };
    } else if (energy < 180) {
      return { status: "Underexposed (Thin shadows)", ratio: energy / 400, solarized: false };
    } else if (energy <= 750) {
      return { status: "Optimal Exposure (Full tonal range)", ratio: energy / 400, solarized: false };
    } else if (energy <= 1800) {
      return { status: "Overexposed (Blown highlights)", ratio: energy / 400, solarized: false };
    } else {
      return { status: "Solarized / Sabattier Inversion", ratio: energy / 400, solarized: true };
    }
  }

  /**
   * Time-integration model for moving objects:
   * A moving object is present at position (x,y) for duration t_stay out of total exposure T.
   * Moving visibility = t_stay / T.
   * If t_stay / T < 0.08, the object is completely invisible on the plate (Boulevard du Temple effect).
   * If t_stay / T >= 0.85, the object is crisp and solid.
   * In between, it produces a translucent "ghost" impression.
   */
  function calculateMovementIntegration(stayDurationSec, totalExposureSec) {
    if (totalExposureSec <= 0) return 0;
    const fraction = Math.min(1, Math.max(0, stayDurationSec / totalExposureSec));
    if (fraction < 0.08) return 0.0; // Completely washed out into background
    if (fraction < 0.25) return fraction * 0.5; // Very faint trace
    return Math.pow(fraction, 0.85); // Non-linear perceived density
  }

  /**
   * Simulates Mercury Vapor Development kinetics.
   * Nucleation of Ag3Hg4 amalgam microcrystals over latent silver nuclei.
   * @param {number} tempC - Mercury temperature in Celsius
   * @param {number} timeSec - Fuming time in seconds
   * @param {number} latentImageStrength - Exposure value (0.0 to 1.0)
   * @returns {{effectiveDose: number, amalgamDensity: number, backgroundFog: number, contrast: number, isOptimal: boolean, isUnderDeveloped: boolean, isOverFogged: boolean}}
   */
  function calculateDevelopment(tempC, timeSec, latentImageStrength) {
    const t = Math.max(0, timeSec);
    const temp = Math.max(20, tempC);
    
    // Vapor pressure of mercury rises exponentially with temperature
    // Clausius-Clapeyron approx for Hg around 65°C
    const rateFactor = Math.exp((temp - 65) / 12);
    const effectiveDose = t * rateFactor;
    
    // Target development dose is ~60 dose units (e.g. 60s at 65°C)
    const devProgress = 1 - Math.exp(-effectiveDose / 35);
    
    // Highlight amalgam density
    const amalgamDensity = Math.min(1.0, latentImageStrength * devProgress * 1.25);
    
    // Background fogging occurs if fumed too long or temperature > 75°C
    let backgroundFog = 0.0;
    if (temp > 70) {
      const excessTemp = (temp - 70) / 15;
      backgroundFog += Math.min(0.5, excessTemp * (t / 40));
    }
    if (effectiveDose > 120) {
      backgroundFog += Math.min(0.4, (effectiveDose - 120) / 150);
    }
    
    const contrast = Math.max(0, amalgamDensity - backgroundFog);
    
    return {
      effectiveDose,
      amalgamDensity,
      backgroundFog,
      contrast,
      isOptimal: effectiveDose >= 45 && effectiveDose <= 85 && backgroundFog < 0.08,
      isUnderDeveloped: effectiveDose < 45,
      isOverFogged: backgroundFog >= 0.12
    };
  }

  /**
   * Positive / Negative Reflection Inversion Physics.
   *
   * Physical Model:
   * A daguerreotype has two optical constituents:
   * 1. Polished Silver Mirror (Shadows): Specular reflectance R_spec ~ 0.95.
   *    Reflects the environment luminance L_env(theta) directly into the viewer's eye.
   * 2. Mercury Amalgam Ag3Hg4 crystals (Highlights): Diffuse Lambertian reflectance R_diff ~ 0.65.
   *    Scatters ambient illuminance E_amb isotropically.
   *
   * Total apparent luminance of a point:
   * L_pixel = (1 - amalgam) * R_spec * L_env(tilt) + amalgam * R_diff * (E_amb / PI)
   *
   * When tilting toward dark environment (L_env ~ 0):
   * Shadows (amalgam = 0) -> L_pixel = 0 (Deep velvety black)
   * Highlights (amalgam = 1) -> L_pixel = 0.65 * E_amb (Brilliant frosty white)
   * -> POSITIVE IMAGE!
   *
   * When tilting toward light source / bright reflection (L_env >> E_amb):
   * Shadows (amalgam = 0) -> L_pixel = 0.95 * L_env (Blazing specular glare)
   * Highlights (amalgam = 1) -> L_pixel = 0.65 * E_amb (Matte gray, much darker than the mirror!)
   * -> NEGATIVE INVERSION!
   *
   * @param {number} amalgamDensity - 0.0 (shadow) to 1.0 (highlight)
   * @param {number} tiltAngleDeg - -45° to +45° plate tilt angle relative to dark axis
   * @param {number} ambientLightLux - Ambient room light
   * @param {boolean} goldToned - If Fizeau gold toning was applied (deepens blacks, boosts contrast)
   * @returns {{apparentBrightness: number, isNegativeMode: boolean, glareAmount: number, specularComp: number, diffuseComp: number}}
   */
  function calculateReflection(amalgamDensity, tiltAngleDeg, ambientLightLux = 300, goldToned = false) {
    const a = Math.max(0, Math.min(1, amalgamDensity));
    const tilt = Math.abs(tiltAngleDeg); // 0 = facing dark velvet coat, 30+ = catching light source glare
    
    // Environment reflection intensity based on tilt angle:
    // Near 0°: reflects dark velvet (L_env = 0.02)
    // As tilt approaches 25°-40°, it catches the bright window/lamp reflection
    const glareFactor = Math.pow(Math.sin((tilt / 45) * (Math.PI / 2)), 2.5);
    const envLuminance = 0.03 + 2.2 * glareFactor;
    
    const rSpec = goldToned ? 0.92 : 0.96;
    const rDiff = goldToned ? 0.72 : 0.62;
    
    const specularComp = (1 - a) * rSpec * envLuminance;
    const diffuseComp = a * rDiff * 0.8;
    
    const totalBrightness = specularComp + diffuseComp;
    const isNegativeMode = specularComp > diffuseComp && glareFactor > 0.35;
    
    return {
      apparentBrightness: Math.min(1.0, totalBrightness),
      isNegativeMode,
      glareAmount: glareFactor,
      specularComp,
      diffuseComp
    };
  }

  /**
   * Scene Definitions with full optical and dynamic details
   */
  const SCENES = {
    boulevard: {
      id: "boulevard",
      title: "Boulevard du Temple, Paris (1838)",
      subtitle: "The famous historic view: vanishing traffic & the first captured humans",
      description: "Looking from Daguerre's studio window at 5 Boulevard Saint-Martin across the Boulevard du Temple. Crowded with horse hackneys, omnibus carriages, and bustling Parisians in motion, but with an 8-minute exposure, only the stationary shoe-shiner and his client will survive on silver.",
      defaultIlluminanceLux: 75000, // Bright morning sunlight
      fNumber: 14.0, // Chevalier landscape achromatic doublet
      recommendedTimeSec: 240, // 4 minutes
      elements: [
        { name: "Haussmann Ancestor Buildings", static: true, baseLuminance: 0.65 },
        { name: "Boulevard Cobblestones & Trees", static: true, baseLuminance: 0.35 },
        { name: "The Shoe-Shiner (Stationary)", stayDurationSec: 300, baseLuminance: 0.55, isHistoricalHero: true },
        { name: "The Client Standing for Polish", stayDurationSec: 260, baseLuminance: 0.60, isHistoricalHero: true },
        { name: "Horse-Drawn Omnibus (Passing)", stayDurationSec: 8, baseLuminance: 0.45 },
        { name: "Cabriolet Carriage (Trotting)", stayDurationSec: 5, baseLuminance: 0.50 },
        { name: "Walking Flâneurs (Pedestrians)", stayDurationSec: 12, baseLuminance: 0.40 },
        { name: "Sunny Parisian Sky", static: true, baseLuminance: 0.95 }
      ]
    },
    portrait: {
      id: "portrait",
      title: "The Sitter & Neck-Clamp (L'Appui-Tête)",
      subtitle: "1839 Studio Portraiture: battling involuntary human motion blur",
      description: "A seated gentleman in a velvet frock coat. Before petzval fast lenses, portraits required 2 to 5 minutes of absolute stillness. The heavy cast-iron neck-clamp (Appui-Tête) was hidden behind the head to prevent postural wobble and breathing blur.",
      defaultIlluminanceLux: 25000, // Studio skylight
      fNumber: 11.0,
      recommendedTimeSec: 180, // 3 minutes
      elements: [
        { name: "Sitter's Face & Eyes", static: false, stayDurationSec: 180, baseLuminance: 0.70, headClampSensitive: true },
        { name: "Velvet Frock Coat & Cravat", static: true, baseLuminance: 0.20 },
        { name: "Carved Walnut Chair", static: true, baseLuminance: 0.35 },
        { name: "Studio Backdrop & Drapes", static: true, baseLuminance: 0.40 },
        { name: "Iron Neck-Clamp (Appui-Tête)", static: true, baseLuminance: 0.15 }
      ]
    },
    notredame: {
      id: "notredame",
      title: "Notre-Dame & Quai de la Tournelle",
      subtitle: "Gothic stone, sparkling water & dynamic range solarization",
      description: "Direct sunlight striking the western facade of Notre-Dame Cathedral across the river Seine. Moving river barges blur into glassy streaks, while the intensely reflective sun-glint on water tests the physical threshold of Daguerreotype solarization.",
      defaultIlluminanceLux: 95000, // Blazing direct noon sunlight
      fNumber: 16.0,
      recommendedTimeSec: 360, // 6 minutes
      elements: [
        { name: "Notre-Dame Stone Towers", static: true, baseLuminance: 0.75 },
        { name: "Seine River Water Surface", static: false, stayDurationSec: 2, baseLuminance: 0.50 },
        { name: "Passing Coal Barge", stayDurationSec: 25, baseLuminance: 0.30 },
        { name: "Bridge Arches & Quai", static: true, baseLuminance: 0.45 },
        { name: "Sun Glint Highlight", static: true, baseLuminance: 1.0, solarizesEasily: true }
      ]
    }
  };

  return {
    REFRACTIVE_INDEX_AGI,
    OPTIMAL_AGI_THICKNESS_NM,
    MERCURY_OPTIMAL_TEMP_C,
    MERCURY_FOG_TEMP_C,
    SCENES,
    calculateSensitization,
    calculateExposureEnergy,
    evaluateExposure,
    calculateMovementIntegration,
    calculateDevelopment,
    calculateReflection
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = DaguerreEngine;
}
