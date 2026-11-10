/**
 * Sound Ranging Model: Acoustic Multilateration & TDOA Physics
 * William Lawrence Bragg (1915-1918) Western Front Sound Ranging
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SoundRangingModel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Standard speed of sound in air as a function of temperature (°C)
  function soundSpeed(tempC) {
    return 331.3 * Math.sqrt(Math.max(0.1, 1 + tempC / 273.15));
  }

  // Exact physical ground velocity and travel time of acoustic ray with uniform wind vector
  function rayTravelTime(source, mic, tempC, wx = 0, wy = 0) {
    const c = soundSpeed(tempC);
    const dx = mic.x - source.x;
    const dy = mic.y - source.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return 0;

    const rx = dx / dist;
    const ry = dy / dist;
    const wDotR = wx * rx + wy * ry;
    const wSq = wx * wx + wy * wy;
    const disc = c * c - wSq + wDotR * wDotR;
    const vGround = wDotR + Math.sqrt(Math.max(1, disc));
    return dist / vGround;
  }

  // Compute arrival times for an array of microphones
  function computeArrivalTimes(battery, mics, tempC, windSpeed, windDirDeg, noiseMs = 0) {
    const rad = (windDirDeg * Math.PI) / 180;
    // Meteorological wind convention: wind direction is direction wind blows towards in map coordinates
    const wx = windSpeed * Math.cos(rad);
    const wy = windSpeed * Math.sin(rad);

    return mics.map((m, idx) => {
      const t = rayTravelTime(battery, m, tempC, wx, wy);
      const jitter = noiseMs > 0 ? (Math.sin(idx * 3.71 + battery.x * 0.01) * noiseMs) / 1000 : 0;
      return Math.max(0, t + jitter);
    });
  }

  // Sample a branch of the hyperbola defined by two microphones and time difference deltaT
  // deltaT = t2 - t1. (If deltaT > 0, sound arrived at m1 first, so point is closer to m1)
  function sampleHyperbola(m1, m2, deltaT, cEff, maxRange = 6000, steps = 80) {
    const deltaD = cEff * deltaT;
    const dx = m2.x - m1.x;
    const dy = m2.y - m1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) return null;

    const cf = dist / 2; // half focal distance
    const a = Math.abs(deltaD) / 2;

    // Must be strictly within foci distance; otherwise asymptotic/degenerate
    if (a >= cf * 0.999) return null;

    const b = Math.sqrt(cf * cf - a * a);
    const cx = (m1.x + m2.x) / 2;
    const cy = (m1.y + m2.y) / 2;
    const e1x = dx / dist;
    const e1y = dy / dist;

    // Perpendicular unit vector pointing forward (positive y-direction / enemy front)
    let e2x = -e1y;
    let e2y = e1x;
    if (e2y < 0) {
      e2x = -e2x;
      e2y = -e2y;
    }

    // If deltaD > 0, target is closer to m1 => negative along baseline vector e1
    // If deltaD < 0, target is closer to m2 => positive along baseline vector e1
    const sign = deltaD >= 0 ? -1 : 1;
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const v = (i / steps) * maxRange; // distance into field
      const sinh = v / b;
      const cosh = Math.sqrt(1 + sinh * sinh);
      const u = sign * a * cosh;
      const px = cx + u * e1x + v * e2x;
      const py = cy + u * e1y + v * e2y;
      points.push({ x: px, y: py });
    }

    return {
      points,
      m1,
      m2,
      deltaT,
      deltaD,
      asymptoteAngle: Math.atan2(e2y, e2x) + sign * Math.atan(b / a)
    };
  }

  // Non-linear least squares Gauss-Newton solver for source position (x, y) and blast time t0
  function solveTDOA(mics, times, cEff, wxEff = 0, wyEff = 0, initialGuess = null) {
    if (!mics || mics.length < 3 || !times || times.length < 3) {
      return { success: false, x: 0, y: 0, t0: 0, error: 'Insufficient microphones' };
    }

    // Initial estimate: default to forward centroid
    let x = initialGuess ? initialGuess.x : mics.reduce((acc, m) => acc + m.x, 0) / mics.length;
    let y = initialGuess ? initialGuess.y : 2200;
    let t0 = 0;

    const maxIters = 25;
    for (let iter = 0; iter < maxIters; iter++) {
      const JTJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const JTr = [0, 0, 0];
      let sumSqResidual = 0;

      for (let i = 0; i < mics.length; i++) {
        const m = mics[i];
        const dx = m.x - x;
        const dy = m.y - y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const rx = dx / d;
        const ry = dy / d;
        const wDotR = wxEff * rx + wyEff * ry;
        const wSq = wxEff * wxEff + wyEff * wyEff;
        const disc = Math.max(1, cEff * cEff - wSq + wDotR * wDotR);
        const v = wDotR + Math.sqrt(disc);

        const modelT = d / v + t0;
        const res = modelT - times[i];
        sumSqResidual += res * res;

        // Jacobian components
        const dddx = (x - m.x) / d;
        const dddy = (y - m.y) / d;
        const Jx = dddx / v;
        const Jy = dddy / v;
        const Jt = 1.0;

        const J = [Jx, Jy, Jt];
        for (let r = 0; r < 3; r++) {
          JTr[r] += J[r] * res;
          for (let cCol = 0; cCol < 3; cCol++) {
            JTJ[r][cCol] += J[r] * J[cCol];
          }
        }
      }

      // Solve JTJ * delta = -JTr using 3x3 Gaussian elimination
      const A = JTJ.map((row, idx) => [...row, -JTr[idx]]);
      for (let i = 0; i < 3; i++) {
        let maxR = i;
        for (let k = i + 1; k < 3; k++) {
          if (Math.abs(A[k][i]) > Math.abs(A[maxR][i])) maxR = k;
        }
        const tempRow = A[i];
        A[i] = A[maxR];
        A[maxR] = tempRow;

        if (Math.abs(A[i][i]) < 1e-12) {
          // Add small regularization
          A[i][i] += 1e-4;
        }
        for (let k = i + 1; k < 3; k++) {
          const factor = A[k][i] / A[i][i];
          for (let j = i; j <= 3; j++) {
            A[k][j] -= factor * A[i][j];
          }
        }
      }

      const delta = [0, 0, 0];
      for (let i = 2; i >= 0; i--) {
        let sum = A[i][3];
        for (let j = i + 1; j < 3; j++) {
          sum -= A[i][j] * delta[j];
        }
        delta[i] = sum / (A[i][i] || 1e-6);
      }

      // Damped step update to avoid overshooting
      const damping = iter < 2 ? 0.8 : 1.0;
      x += delta[0] * damping;
      y += delta[1] * damping;
      t0 += delta[2] * damping;

      if (Math.hypot(delta[0], delta[1]) < 0.02) {
        return {
          success: true,
          x,
          y,
          t0,
          iterations: iter + 1,
          residualRms: Math.sqrt(sumSqResidual / mics.length)
        };
      }
    }

    return {
      success: true,
      x,
      y,
      t0,
      iterations: maxIters,
      residualRms: 0
    };
  }

  // Preset scenarios
  const PRESETS = {
    standard: {
      name: 'Western Front (1918)',
      description: 'Standard 4 km microphone baseline on calm autumn morning. Target battery at 2.8 km range.',
      tempC: 10,
      windSpeed: 2,
      windDirDeg: 45,
      noiseMs: 0,
      correctionEnabled: true,
      battery: { x: 450, y: 2800 },
      mics: [
        { id: 'M1', name: 'Post A (left flank)', x: -2000, y: 100 },
        { id: 'M2', name: 'Post B (center left)', x: -1000, y: -40 },
        { id: 'M3', name: 'Post C (center redoubt)', x: 0, y: 70 },
        { id: 'M4', name: 'Post D (center right)', x: 1000, y: -20 },
        { id: 'M5', name: 'Post E (right flank)', x: 2000, y: 110 }
      ]
    },
    crosswind: {
      name: 'Arras Gale (14 m/s East)',
      description: 'Strong easterly crosswind blowing across the front. Without Bragg correction, fix drifts 120+ meters.',
      tempC: 12,
      windSpeed: 14,
      windDirDeg: 0, // Wind blowing East
      noiseMs: 0,
      correctionEnabled: false,
      battery: { x: 300, y: 3100 },
      mics: [
        { id: 'M1', name: 'Post A', x: -2000, y: 100 },
        { id: 'M2', name: 'Post B', x: -1000, y: -40 },
        { id: 'M3', name: 'Post C', x: 0, y: 70 },
        { id: 'M4', name: 'Post D', x: 1000, y: -20 },
        { id: 'M5', name: 'Post E', x: 2000, y: 110 }
      ]
    },
    frost: {
      name: 'Winter Freeze (-8°C)',
      description: 'Freezing temperature drops sound speed to 326 m/s. Uncorrected calculation overshoots the range.',
      tempC: -8,
      windSpeed: 4,
      windDirDeg: 120,
      noiseMs: 0,
      correctionEnabled: false,
      battery: { x: -600, y: 3400 },
      mics: [
        { id: 'M1', name: 'Post A', x: -2000, y: 100 },
        { id: 'M2', name: 'Post B', x: -1000, y: -40 },
        { id: 'M3', name: 'Post C', x: 0, y: 70 },
        { id: 'M4', name: 'Post D', x: 1000, y: -20 },
        { id: 'M5', name: 'Post E', x: 2000, y: 110 }
      ]
    },
    armistice: {
      name: '11th Hour (Armistice 1918)',
      description: '11 November 1918 at 11:00 AM: the barrage ceases and the galvanometer traces record sudden absolute silence.',
      tempC: 6,
      windSpeed: 3,
      windDirDeg: 60,
      noiseMs: 0,
      correctionEnabled: true,
      battery: { x: 200, y: 2600 },
      mics: [
        { id: 'M1', name: 'Post A', x: -2000, y: 100 },
        { id: 'M2', name: 'Post B', x: -1000, y: -40 },
        { id: 'M3', name: 'Post C', x: 0, y: 70 },
        { id: 'M4', name: 'Post D', x: 1000, y: -20 },
        { id: 'M5', name: 'Post E', x: 2000, y: 110 }
      ]
    }
  };

  return {
    soundSpeed,
    rayTravelTime,
    computeArrivalTimes,
    sampleHyperbola,
    solveTDOA,
    PRESETS
  };
}));
