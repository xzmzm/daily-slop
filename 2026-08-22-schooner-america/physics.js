/**
 * 1851 Schooner America Aero-Hydrodynamic Simulation Engine
 *
 * Implements:
 * 1. True Wind vs Apparent Wind Vector Kinematics (v_a = v_t - v_b)
 * 2. Aerodynamic Sail Lift & Drag (C_L, C_D, angle of attack, stall, flat cotton vs baggy flax)
 * 3. Hydrodynamic Wave-Line Hull Resistance (George Steers hollow bow vs Cod's Head)
 * 4. Keel Lift & Leeway Equilibrium (balancing aerodynamic side force)
 * 5. Dynamic Heeling Moment & Hydrostatic Righting Moment (lead ballast GM)
 * 6. Closed-form & iterative Polar Velocity (VMG) Envelope Solver
 */

export const RHO_AIR = 1.225;     // kg/m^3
export const RHO_WATER = 1025.0;   // kg/m^3
export const GRAVITY = 9.80665;   // m/s^2
export const KNOTS_TO_MS = 0.514444;
export const MS_TO_KNOTS = 1.0 / KNOTS_TO_MS;
export const DEG_TO_RAD = Math.PI / 180.0;
export const RAD_TO_DEG = 180.0 / Math.PI;

export function normalizeAngle(rad) {
  while (rad > Math.PI) rad -= 2 * Math.PI;
  while (rad < -Math.PI) rad += 2 * Math.PI;
  return rad;
}

export function normalizeAngleDeg(deg) {
  while (deg > 180) deg -= 360;
  while (deg < -180) deg += 360;
  return deg;
}

export const HULL_PRESETS = {
  america: {
    name: "Schooner America (1851)",
    tag: "George Steers Hollow-Bow Wave Line + Flat Cotton Canvas",
    origin: "New York, USA",
    rig: "Two-Masted Schooner",
    loa: 30.8,         // Length Overall (m) ~ 101 ft
    lwl: 28.5,         // Waterline Length (m) ~ 93.5 ft
    beam: 6.9,         // Max Beam (m) ~ 22.5 ft, located at 55% aft
    draft: 3.35,       // Max Draft (m) ~ 11.0 ft
    displacement: 170000, // kg (~170 metric tons)
    sailArea: 488,     // m^2 (~5,250 sq ft)
    wettedSurface: 175, // m^2
    keelArea: 24.0,    // m^2 lateral profile
    gm: 1.45,          // Metacentric height (m) - stiff lead ballast
    ceHeight: 8.5,     // Center of effort height above CLR (m)
    bowType: "wave_line", // Sharp concave entrance (14 deg half-angle)
    bowCw: 0.0024,     // Low wave-making coefficient
    frCritical: 0.38,  // Higher hull speed onset
    sailType: "flat_cotton",
    clMax: 1.52,       // Flat cotton sail maximum lift coefficient
    cd0: 0.042,        // Parasitic drag of flat canvas
    stallAngleDeg: 19.5,
    minTwaDeg: 38.0,   // Pointing ability: 38 deg off true wind
    color: "#e2b855",
    deckColor: "#38291a",
    hullColor: "#171a22",
  },
  aurora: {
    name: "Cutter Aurora (1851)",
    tag: "British Traditional Cod's Head + Baggy Flax Canvas",
    origin: "Cowes, Great Britain",
    rig: "Gaff Cutter",
    loa: 18.5,
    lwl: 16.8,
    beam: 4.8,         // Max Beam at 35% forward (blunt shoulders)
    draft: 2.8,
    displacement: 47000,
    sailArea: 195,
    wettedSurface: 78,
    keelArea: 11.5,
    gm: 1.15,
    ceHeight: 6.2,
    bowType: "cods_head", // Blunt convex entrance (32 deg half-angle)
    bowCw: 0.0068,     // High wave-making resistance
    frCritical: 0.31,  // Early wave resistance wall
    sailType: "baggy_flax",
    clMax: 1.18,       // Lower peak lift, excessive drag
    cd0: 0.095,        // Loose baggy flax parasitic drag
    stallAngleDeg: 14.5,
    minTwaDeg: 48.0,   // Can only point ~48-50 deg off true wind
    color: "#60a5fa",
    deckColor: "#2b261f",
    hullColor: "#111827",
  },
  volante: {
    name: "Cutter Volante (1851)",
    tag: "British 48-Ton Fast Cutter (Cod's Head Entry)",
    origin: "Royal Yacht Squadron",
    rig: "Cutter",
    loa: 19.2,
    lwl: 17.5,
    beam: 4.9,
    draft: 2.9,
    displacement: 48500,
    sailArea: 210,
    wettedSurface: 82,
    keelArea: 12.0,
    gm: 1.20,
    ceHeight: 6.5,
    bowType: "cods_head",
    bowCw: 0.0060,
    frCritical: 0.32,
    sailType: "baggy_flax",
    clMax: 1.22,
    cd0: 0.088,
    stallAngleDeg: 15.0,
    minTwaDeg: 46.5,
    color: "#34d399",
    deckColor: "#2b261f",
    hullColor: "#064e3b",
  }
};

export class SailPhysics {
  /**
   * Calculate apparent wind vector given true wind and boat velocity.
   * Wind directions are standard meteorological angles in radians (0 = wind blowing from North).
   */
  static calculateApparentWind(tws_ms, twd_rad, bspeed_ms, hdg_rad) {
    // True wind velocity vector (pointing in the direction the wind blows toward)
    const twFlowDir = twd_rad + Math.PI;
    const twx = tws_ms * Math.sin(twFlowDir);
    const twy = tws_ms * Math.cos(twFlowDir);

    // Boat velocity vector
    const bx = bspeed_ms * Math.sin(hdg_rad);
    const by = bspeed_ms * Math.cos(hdg_rad);

    // Apparent wind flow vector (relative velocity = wind - boat)
    const awFlowX = twx - bx;
    const awFlowY = twy - by;
    const aws_ms = Math.hypot(awFlowX, awFlowY);

    // Direction the apparent wind blows FROM
    const awd_rad = normalizeAngle(Math.atan2(-awFlowX, -awFlowY));

    // Apparent Wind Angle relative to boat heading:
    // 0 = dead ahead, +PI/2 = starboard beam, -PI/2 = port beam, +/-PI = dead astern
    const awa_rad = normalizeAngle(awd_rad - hdg_rad);

    return {
      aws_ms,
      aws_knots: aws_ms * MS_TO_KNOTS,
      awd_rad,
      awa_rad,
      awa_deg: awa_rad * RAD_TO_DEG,
      twa_rad: normalizeAngle(twd_rad - hdg_rad),
      twa_deg: normalizeAngle(twd_rad - hdg_rad) * RAD_TO_DEG,
    };
  }

  /**
   * Aerodynamic coefficients for sail given angle of attack alpha.
   */
  static calculateAeroCoefficients(hull, alpha_rad, isLuffing) {
    const alpha_deg = Math.abs(alpha_rad) * RAD_TO_DEG;
    const stall_deg = hull.stallAngleDeg;

    let cl = 0;
    let cd = hull.cd0;

    if (isLuffing) {
      // Sail is flapping / backwinded
      cl = 0.08 * (alpha_deg / 5.0);
      cd = hull.cd0 * 1.8 + 0.05 * Math.sin(alpha_rad);
      return { cl, cd, stalled: false, luffing: true };
    }

    if (alpha_deg <= stall_deg) {
      // Attached flow regime (linear lift curve + induced drag)
      const liftSlope = hull.clMax / (stall_deg * DEG_TO_RAD);
      cl = liftSlope * Math.abs(alpha_rad);
      const aspect_ratio = 3.5;
      const oswald_eff = hull.sailType === "flat_cotton" ? 0.85 : 0.60;
      const cd_ind = (cl * cl) / (Math.PI * aspect_ratio * oswald_eff);
      cd = hull.cd0 + cd_ind;
      return { cl, cd, stalled: false, luffing: false };
    } else {
      // Stalled regime (turbulent separation)
      const excess = (alpha_deg - stall_deg);
      const drop = Math.exp(-excess / 12.0);
      cl = hull.clMax * drop * Math.cos(excess * DEG_TO_RAD * 0.5);
      cd = hull.cd0 + 1.25 * Math.pow(Math.sin(alpha_rad), 1.6);
      return { cl: Math.max(0.1, cl), cd, stalled: true, luffing: false };
    }
  }

  /**
   * Compute total aerodynamic driving thrust F_T and lateral heeling force F_H.
   */
  static calculateSailForces(hull, aws_ms, awa_rad, sheetAngle_rad) {
    const absAwa = Math.abs(awa_rad);
    const tackSign = awa_rad >= 0 ? 1 : -1; // 1 = starboard wind, -1 = port wind

    // Optimal sheet angle for given AWA if not manually overridden
    const maxSheet = Math.PI * 0.48; // 86 deg max out
    const actualSheet = Math.min(Math.max(sheetAngle_rad, 0.02), maxSheet);

    // Angle of attack alpha = AWA - sheet angle
    let alpha = absAwa - actualSheet;
    const isLuffing = alpha < -0.01;

    const aero = this.calculateAeroCoefficients(hull, alpha, isLuffing);
    const dynamicPressure = 0.5 * RHO_AIR * aws_ms * aws_ms;
    const totalArea = hull.sailArea;

    const lift = dynamicPressure * totalArea * aero.cl;
    const drag = dynamicPressure * totalArea * aero.cd;

    // Resolve aerodynamic lift and drag into Boat Coordinates:
    // Thrust F_T along boat centerline (+ forward)
    // Side Force F_H perpendicular to centerline (+ to leeward)
    const sinAwa = Math.sin(absAwa);
    const cosAwa = Math.cos(absAwa);

    const thrust = lift * sinAwa - drag * cosAwa;
    const sideForce = lift * cosAwa + drag * sinAwa;

    return {
      thrust,
      sideForce: sideForce * tackSign, // Force pushing boat sideways
      lift,
      drag,
      alpha_deg: alpha * RAD_TO_DEG,
      aero,
      isLuffing,
      stalled: aero.stalled,
      tackSign,
    };
  }

  /**
   * Hydrodynamic hull resistance:
   * 1. Skin friction (ITTC 1957 line)
   * 2. Wave-making resistance (Scott Russell Wave-Line vs Cod's Head)
   * 3. Keel leeway induced drag
   */
  static calculateHullResistance(hull, bspeed_ms, sideForce, heel_rad) {
    const v = Math.max(bspeed_ms, 0.0);

    // 1. Skin Friction Resistance R_f
    // Reynolds number based on LWL: Re = v * L / nu_water (nu ~ 1.15e-6 m^2/s)
    const nu = 1.15e-6;
    const re = Math.max((Math.max(v, 0.2) * hull.lwl) / nu, 1e5);
    const cf = 0.075 / Math.pow(Math.log10(re) - 2.0, 2);
    // Wetted surface increases slightly with heel angle
    const s_wetted = hull.wettedSurface * (1.0 + 0.15 * Math.sin(Math.abs(heel_rad)));
    const rf = 0.5 * RHO_WATER * v * v * s_wetted * cf;

    // 2. Wave-Making Resistance R_w
    // Froude number Fr = v / sqrt(g * L_wl)
    const fr = v / Math.sqrt(GRAVITY * hull.lwl);
    // Hollow bow wave line has higher critical Froude number and much lower Cw
    const waveExp = Math.pow(fr / hull.frCritical, 4.2);
    const waveHump = 1.0 / (1.0 + Math.exp(-15.0 * (fr - hull.frCritical)));
    const rw = hull.displacement * GRAVITY * hull.bowCw * (waveExp * 0.6 + waveHump * 2.8);

    // 3. Keel Hydrodynamic Lift & Leeway Angle
    // Keel acts as a low aspect-ratio hydrofoil generating lateral lift = sideForce
    const keelSlope = 2.4; // 1/rad
    const qWater = 0.5 * RHO_WATER * Math.max(v * v, 0.04) * hull.keelArea;
    let leeway_rad = 0;
    if (qWater > 2.0) {
      leeway_rad = Math.abs(sideForce) / (qWater * keelSlope);
      leeway_rad = Math.min(leeway_rad, 0.22); // Max ~12 deg leeway before keel stall
    }

    // Keel induced drag R_i = (F_side)^2 / (pi * rho * v^2 * draft^2)
    const effDraft = hull.draft * 1.1;
    const vEff = Math.max(v, 0.8);
    const speedRatio = 1.0 - Math.exp(-v / 0.6);
    const r_ind = speedRatio * ((sideForce * sideForce) / (Math.PI * RHO_WATER * vEff * vEff * effDraft * effDraft));

    const totalResistance = rf + rw + r_ind;

    return {
      rf,
      rw,
      r_ind,
      totalResistance,
      leeway_rad,
      leeway_deg: leeway_rad * RAD_TO_DEG,
      froudeNumber: fr,
      hullSpeedKnots: 1.34 * Math.sqrt(hull.lwl * 3.28084),
    };
  }

  /**
   * Solve steady-state equilibrium boat speed and heeling angle for given wind and heading.
   */
  static solveEquilibrium(hull, tws_ms, twa_rad, customSheet_rad = null) {
    const absTwa = Math.abs(twa_rad);
    const twa_deg = absTwa * RAD_TO_DEG;

    // If wind is too close to dead ahead, boat cannot sail (in irons)
    if (twa_deg < hull.minTwaDeg) {
      return {
        speed_ms: 0,
        speed_knots: 0,
        heel_deg: 0,
        leeway_deg: 0,
        vmg_knots: 0,
        inIrons: true,
        thrust: 0,
        resistance: 0,
        aws_knots: tws_ms * MS_TO_KNOTS,
        awa_deg: twa_deg,
      };
    }

    let vLow = 0.05;
    let vHigh = 22.0 * KNOTS_TO_MS;
    let bestSpeed = 0;
    let bestHeel = 0;
    let bestLeeway = 0;
    let bestAws = 0;
    let bestAwa = 0;
    let bestThrust = 0;
    let bestRes = 0;

    for (let iter = 0; iter < 28; iter++) {
      const vMid = (vLow + vHigh) * 0.5;

      const aw = this.calculateApparentWind(tws_ms, twa_rad, vMid, 0);

      let sheet = customSheet_rad;
      if (sheet === null) {
        const optAlpha = (hull.stallAngleDeg * 0.72) * DEG_TO_RAD;
        sheet = Math.max(0.04, Math.abs(aw.awa_rad) - optAlpha);
      }

      const sail = this.calculateSailForces(hull, aw.aws_ms, aw.awa_rad, sheet);

      const heelingMoment = Math.abs(sail.sideForce) * hull.ceHeight;
      const maxRM = hull.displacement * GRAVITY * hull.gm;
      const sinHeel = Math.min(heelingMoment / maxRM, 0.75);
      const heel_rad = Math.asin(sinHeel);

      const hydro = this.calculateHullResistance(hull, vMid, sail.sideForce, heel_rad);

      const netForce = sail.thrust - hydro.totalResistance;

      bestSpeed = vMid;
      bestHeel = heel_rad * RAD_TO_DEG;
      bestLeeway = hydro.leeway_deg;
      bestAws = aw.aws_knots;
      bestAwa = Math.abs(aw.awa_deg);
      bestThrust = sail.thrust;
      bestRes = hydro.totalResistance;

      if (netForce > 0) {
        vLow = vMid;
      } else {
        vHigh = vMid;
      }
    }

    const vKnots = bestSpeed * MS_TO_KNOTS;
    const vmgKnots = vKnots * Math.cos(absTwa);

    return {
      speed_ms: bestSpeed,
      speed_knots: vKnots,
      heel_deg: bestHeel,
      leeway_deg: bestLeeway,
      vmg_knots: vmgKnots,
      inIrons: false,
      thrust: bestThrust,
      resistance: bestRes,
      aws_knots: bestAws,
      awa_deg: bestAwa,
    };
  }

  /**
   * Compute complete polar velocity diagram envelope for 0 to 180 degrees TWA.
   */
  static generatePolarDiagram(hull, tws_knots, stepDeg = 2) {
    const tws_ms = tws_knots * KNOTS_TO_MS;
    const polarPoints = [];
    let maxVmgUpwind = { vmg: -999, twa_deg: 0, bspeed: 0 };
    let maxVmgDownwind = { vmg: 999, twa_deg: 0, bspeed: 0 };

    for (let deg = 0; deg <= 180; deg += stepDeg) {
      const twa_rad = deg * DEG_TO_RAD;
      const eq = this.solveEquilibrium(hull, tws_ms, twa_rad);

      polarPoints.push({
        twa_deg: deg,
        twa_rad,
        speed_knots: eq.speed_knots,
        vmg_knots: eq.vmg_knots,
        heel_deg: eq.heel_deg,
        leeway_deg: eq.leeway_deg,
        inIrons: eq.inIrons,
      });

      if (!eq.inIrons) {
        if (deg < 90 && eq.vmg_knots > maxVmgUpwind.vmg) {
          maxVmgUpwind = { vmg: eq.vmg_knots, twa_deg: deg, bspeed: eq.speed_knots };
        }
        if (deg >= 90 && eq.vmg_knots < maxVmgDownwind.vmg) {
          maxVmgDownwind = { vmg: eq.vmg_knots, twa_deg: deg, bspeed: eq.speed_knots };
        }
      }
    }

    return {
      hullKey: hull.name,
      tws_knots,
      points: polarPoints,
      optimalUpwind: maxVmgUpwind,
      optimalDownwind: maxVmgDownwind,
    };
  }
}

/**
 * 6-DOF / 2D Dynamic State Integrator for Real-Time Physics Interaction.
 */
export class SailingSimulation {
  constructor(hullKey = "america") {
    this.setHull(hullKey);

    // Environment
    this.tws_knots = 14.0;       // 14-knot breeze (typical Solent regatta wind)
    this.twd_deg = 45.0;         // North-Easterly (from 45 deg)
    this.timeScale = 1.0;

    // Boat Dynamic State
    this.x = 0;                  // m
    this.y = 0;                  // m
    this.heading_rad = 0.0;      // 0 = North
    this.bspeed_ms = 0.0;        // m/s
    this.rudder_rad = 0.0;       // rad
    this.sheet_rad = 0.35;       // rad
    this.autoTrim = true;
    this.heel_deg = 0.0;
    this.leeway_deg = 0.0;

    // Telemetry cache
    this.telemetry = {
      tws_knots: 14.0,
      twd_deg: 45.0,
      twa_deg: 45.0,
      aws_knots: 14.0,
      awd_deg: 45.0,
      awa_deg: 45.0,
      speed_knots: 0.0,
      vmg_knots: 0.0,
      heel_deg: 0.0,
      leeway_deg: 0.0,
      thrust: 0.0,
      resistance: 0.0,
      froudeNumber: 0.0,
      isLuffing: false,
      stalled: false,
      inIrons: false,
    };
  }

  setHull(hullKey) {
    this.hullKey = hullKey;
    this.hull = HULL_PRESETS[hullKey] || HULL_PRESETS.america;
  }

  update(dt_sec) {
    const dt = Math.min(dt_sec * this.timeScale, 0.1);
    const tws_ms = this.tws_knots * KNOTS_TO_MS;
    const twd_rad = this.twd_deg * DEG_TO_RAD;

    // 1. Apparent Wind Vector
    const aw = SailPhysics.calculateApparentWind(
      tws_ms,
      twd_rad,
      this.bspeed_ms,
      this.heading_rad
    );

    // 2. Sheet Angle / Auto Trim
    if (this.autoTrim) {
      const optAlpha = (this.hull.stallAngleDeg * 0.75) * DEG_TO_RAD;
      this.sheet_rad = Math.max(0.05, Math.min(Math.abs(aw.awa_rad) - optAlpha, Math.PI * 0.48));
    }

    // 3. Sail Forces
    const sail = SailPhysics.calculateSailForces(
      this.hull,
      aw.aws_ms,
      aw.awa_rad,
      this.sheet_rad
    );

    // 4. Heel Dynamics
    const heelingMoment = Math.abs(sail.sideForce) * this.hull.ceHeight;
    const maxRM = this.hull.displacement * GRAVITY * this.hull.gm;
    const targetSinHeel = Math.min(heelingMoment / maxRM, 0.75);
    const targetHeel = Math.asin(targetSinHeel) * RAD_TO_DEG * sail.tackSign;
    this.heel_deg += (targetHeel - this.heel_deg) * Math.min(1.0, dt * 3.5);

    // 5. Hull Hydrodynamics & Resistance
    const hydro = SailPhysics.calculateHullResistance(
      this.hull,
      this.bspeed_ms,
      sail.sideForce,
      this.heel_deg * DEG_TO_RAD
    );
    this.leeway_deg = hydro.leeway_deg * sail.tackSign;

    // 6. Longitudinal Acceleration
    const inIrons = Math.abs(aw.twa_deg) < this.hull.minTwaDeg;
    let netThrust = sail.thrust;
    if (inIrons) {
      netThrust = -hydro.rf * 0.5; // Dragged back in irons
    }

    const netForce = netThrust - hydro.totalResistance;
    // Real ship inertia acceleration: 
    // In physics interaction, we use virtual mass for responsive feel
    const effectiveMass = this.hull.displacement * 0.35;
    const accel = netForce / effectiveMass;

    this.bspeed_ms = Math.max(0.0, this.bspeed_ms + accel * dt);
    const bspeed_knots = this.bspeed_ms * MS_TO_KNOTS;

    // 7. Steering & Yaw Rate (rudder hydrodynamic moment)
    const rudderForce = Math.max(this.bspeed_ms, 1.2) * Math.sin(this.rudder_rad) * 0.75;
    this.heading_rad = normalizeAngle(this.heading_rad + rudderForce * dt);

    // 8. Position Integration (including leeway drift)
    const courseOverGround_rad = this.heading_rad + (this.leeway_deg * DEG_TO_RAD);
    this.x += this.bspeed_ms * Math.sin(courseOverGround_rad) * dt;
    this.y += this.bspeed_ms * Math.cos(courseOverGround_rad) * dt;

    // 9. Update Telemetry
    const vmg_knots = bspeed_knots * Math.cos(aw.twa_rad);
    this.telemetry = {
      tws_knots: this.tws_knots,
      twd_deg: this.twd_deg,
      twa_deg: aw.twa_deg,
      aws_knots: aw.aws_knots,
      awd_deg: aw.awd_rad * RAD_TO_DEG,
      awa_deg: aw.awa_deg,
      speed_knots: bspeed_knots,
      vmg_knots,
      heel_deg: this.heel_deg,
      leeway_deg: this.leeway_deg,
      thrust: sail.thrust,
      resistance: hydro.totalResistance,
      froudeNumber: hydro.froudeNumber,
      isLuffing: sail.isLuffing,
      stalled: sail.stalled,
      inIrons,
      alpha_deg: sail.alpha_deg,
      lift: sail.lift,
      drag: sail.drag,
      sideForce: sail.sideForce,
      sheet_deg: this.sheet_rad * RAD_TO_DEG,
    };
  }
}
