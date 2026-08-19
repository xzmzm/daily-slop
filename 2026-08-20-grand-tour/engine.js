/**
 * engine.js - Physics and Orbital Mechanics Engine for Voyager 2 Grand Tour
 * 
 * Provides exact analytical and patched-conic calculations for:
 * - Planetary positions and orbital velocities
 * - Hyperbolic gravity-assist slingshots (vis-viva, turn angle, asymptote vectors, delta-v)
 * - Heliocentric trajectory interpolation for the 1977–2026 Grand Tour
 * - Escape velocity threshold, RTG power decay, relativistic one-way/round-trip light time
 * - Custom sandbox trajectory solver for interactive experiments
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.GrandTourEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Fundamental physical and astronomical constants
  const AU_KM = 149597870.7;                  // 1 Astronomical Unit in km
  const SPEED_OF_LIGHT = 299792.458;          // c in km/s
  const MU_SUN = 1.32712440018e11;            // Gravitational parameter G*M_sun (km^3/s^2)
  const DAY_SECONDS = 86400;                  // Seconds in a solar day
  const YEAR_DAYS = 365.25;                   // Julian year in days
  const LAUNCH_DATE_EPOCH = new Date('1977-08-20T14:29:44Z').getTime(); // Voyager 2 launch time

  // RTG (Radioisotope Thermoelectric Generator) constants
  const PU238_HALF_LIFE_DAYS = 87.7 * YEAR_DAYS; // ~32032.425 days
  const RTG_INITIAL_WATTS = 470.0;             // Power at launch in August 1977
  const RTG_DEGRADE_PER_YEAR = 0.0058;         // Silicon-Germanium thermocouple degradation rate

  // Planetary Parameters (J2000 reference & Voyager 2 encounter geometry)
  const PLANETS = {
    EARTH: {
      name: 'Earth',
      nameZh: '地球',
      color: '#4da6ff',
      aAU: 1.000,
      radiusKm: 6371,
      massKg: 5.972e24,
      mu: 3.986004418e5,
      periodDays: 365.256,
      orbSpeedKmS: 29.78,
      initialAngleRad: 5.76, // Position at 1977-08-20
    },
    JUPITER: {
      name: 'Jupiter',
      nameZh: '木星',
      color: '#e0ae6f',
      aAU: 5.2044,
      radiusKm: 69911,
      massKg: 1.898e27,
      mu: 1.26686534e8,
      periodDays: 4332.59,
      orbSpeedKmS: 13.07,
      initialAngleRad: 1.52,
      flybyDay: 688,           // 1979-07-09
      flybyRpKm: 645000,       // 9.22 R_j (closest approach)
      flybyDateStr: '1979-07-09',
      vInfInKmS: 10.82,
      vInfOutKmS: 10.82,
      speedBeforeKmS: 10.2,
      speedAfterKmS: 25.4,
      features: ['Great Red Spot', 'Io Volcanic Plumes', 'Radiation Belt'],
      description: 'Passed outside Io orbit to avoid lethal radiation; slingshot boosted heliocentric speed by +15.2 km/s towards Saturn.'
    },
    SATURN: {
      name: 'Saturn',
      nameZh: '土星',
      color: '#e2c58e',
      aAU: 9.5826,
      radiusKm: 58232,
      massKg: 5.683e26,
      mu: 3.7931187e7,
      periodDays: 10759.22,
      orbSpeedKmS: 9.69,
      initialAngleRad: 2.65,
      flybyDay: 1466,          // 1981-08-25
      flybyRpKm: 101000,       // 1.73 R_s (skimming outer ring)
      flybyDateStr: '1981-08-25',
      vInfInKmS: 14.65,
      vInfOutKmS: 14.65,
      speedBeforeKmS: 15.6,
      speedAfterKmS: 24.3,
      features: ['Ring Plane Crossing', 'Enceladus & Titan', 'F-ring Braids'],
      description: 'Kept close to the ring plane to preserve the ecliptic corridor to Uranus, while Voyager 1 diverted to Titan.'
    },
    URANUS: {
      name: 'Uranus',
      nameZh: '天王星',
      color: '#7ce8e2',
      aAU: 19.201,
      radiusKm: 25362,
      massKg: 8.681e25,
      mu: 5.793939e6,
      periodDays: 30688.5,
      orbSpeedKmS: 6.81,
      initialAngleRad: 4.02,
      flybyDay: 3079,          // 1986-01-24
      flybyRpKm: 81500,        // 3.21 R_u
      flybyDateStr: '1986-01-24',
      vInfInKmS: 14.78,
      vInfOutKmS: 14.78,
      speedBeforeKmS: 14.8,
      speedAfterKmS: 21.4,
      features: ['97.8° Axial Tilt', 'Miranda Verona Rupes (20km Cliffs)', 'Dark Rings'],
      description: 'First probe to visit Uranus; discovered 10 new moons, corkscrew magnetic field, and Miranda\'s extreme tectonic cliffs.'
    },
    NEPTUNE: {
      name: 'Neptune',
      nameZh: '海王星',
      color: '#4370ff',
      aAU: 30.047,
      radiusKm: 24622,
      massKg: 1.024e26,
      mu: 6.835099e6,
      periodDays: 60182.0,
      orbSpeedKmS: 5.43,
      initialAngleRad: 4.85,
      flybyDay: 4388,          // 1989-08-25
      flybyRpKm: 29572,        // 1.20 R_n (4,950 km above north pole)
      flybyDateStr: '1989-08-25',
      vInfInKmS: 16.68,
      vInfOutKmS: 16.68,
      speedBeforeKmS: 16.7,
      speedAfterKmS: 26.6,
      features: ['Great Dark Spot', 'Triton Nitrogen Geysers', 'South Polar Deflection'],
      description: 'Dived over the north pole to encounter retrograde moon Triton, bending trajectory -48° south of the ecliptic.'
    }
  };

  const KEY_MILESTONES = [
    { day: 0, date: '1977-08-20', label: 'Launch', labelZh: '发射升空', desc: 'Titan IIIE/Centaur-D1T injection at Cape Canaveral LC-41.' },
    { day: 688, date: '1979-07-09', label: 'Jupiter Flyby', labelZh: '木星引力弹弓', desc: 'Closest approach 645,000 km; gravity assist slung speed to 25.4 km/s.' },
    { day: 1466, date: '1981-08-25', label: 'Saturn Flyby', labelZh: '土星引力弹弓', desc: 'Ring plane skim at 101,000 km; preserved trajectory to Uranus.' },
    { day: 3079, date: '1986-01-24', label: 'Uranus Flyby', labelZh: '天王星引力弹弓', desc: 'First human encounter with Uranus; surveyed 98° tilted magnetosphere.' },
    { day: 4388, date: '1989-08-25', label: 'Neptune Flyby', labelZh: '海王星引力弹弓', desc: 'North polar dip to Triton; deflected -48° south out of the ecliptic.' },
    { day: 15052, date: '2018-11-05', label: 'Heliopause Crossing', labelZh: '穿过日球层顶', desc: 'Crossed the termination shock / heliopause at 119.7 AU into interstellar space.' },
    { day: 17897, date: '2026-08-20', label: '49th Anniversary', labelZh: '发射 49 周年', desc: 'Voyager 2 is over 138 AU away, still transmitting science data.' }
  ];

  // Helper functions for Keplerian motion and coordinate transformations
  function planetPosition(planetKey, day) {
    const p = PLANETS[planetKey];
    if (!p) throw new Error(`Unknown planet: ${planetKey}`);
    const meanMotion = (2 * Math.PI) / p.periodDays;
    const theta = p.initialAngleRad + meanMotion * day;
    const x = p.aAU * Math.cos(theta);
    const y = p.aAU * Math.sin(theta);
    const vx = -p.orbSpeedKmS * Math.sin(theta);
    const vy = p.orbSpeedKmS * Math.cos(theta);
    return {
      xAU: x,
      yAU: y,
      rAU: p.aAU,
      thetaRad: theta % (2 * Math.PI),
      vxKmS: vx,
      vyKmS: vy,
      speedKmS: p.orbSpeedKmS
    };
  }

  /**
   * Hyperbolic turning angle delta in radians
   * delta = 2 * arcsin(1 / (1 + r_p * v_inf^2 / mu))
   */
  function hyperbolicTurnAngle(rpKm, vInfKmS, muKm3S2) {
    if (rpKm <= 0 || vInfKmS <= 0 || muKm3S2 <= 0) return 0;
    const ecc = 1 + (rpKm * (vInfKmS * vInfKmS)) / muKm3S2;
    const sinHalfDelta = 1 / ecc;
    return 2 * Math.asin(Math.min(1.0, Math.max(0.0, sinHalfDelta)));
  }

  /**
   * Hyperbolic eccentricity e = 1 + r_p * v_inf^2 / mu
   */
  function hyperbolicEccentricity(rpKm, vInfKmS, muKm3S2) {
    if (rpKm <= 0 || vInfKmS <= 0 || muKm3S2 <= 0) return 1.0;
    return 1 + (rpKm * (vInfKmS * vInfKmS)) / muKm3S2;
  }

  /**
   * Patched conics gravity assist calculation
   * Given inbound heliocentric velocity and planet velocity, computes turn angle,
   * outbound velocity vector, and resulting heliocentric velocity boost.
   */
  function computeGravityAssist(vScIn, vPlanet, rpKm, muPlanet, aimOffset = 1.0) {
    // Relative inbound velocity v_inf = v_sc - v_planet
    const vInfInX = vScIn.x - vPlanet.x;
    const vInfInY = vScIn.y - vPlanet.y;
    const vInfMag = Math.hypot(vInfInX, vInfInY);

    const deltaRad = hyperbolicTurnAngle(rpKm, vInfMag, muPlanet);
    
    // Rotate v_inf by turning angle delta (aimOffset > 0 trails behind planet -> gains speed)
    const inboundAngle = Math.atan2(vInfInY, vInfInX);
    const turnSign = aimOffset >= 0 ? 1 : -1;
    const outboundAngle = inboundAngle + turnSign * deltaRad;

    const vInfOutX = vInfMag * Math.cos(outboundAngle);
    const vInfOutY = vInfMag * Math.sin(outboundAngle);

    // Heliocentric outbound velocity v_sc_out = v_planet + v_inf_out
    const vScOutX = vPlanet.x + vInfOutX;
    const vScOutY = vPlanet.y + vInfOutY;
    const speedIn = Math.hypot(vScIn.x, vScIn.y);
    const speedOut = Math.hypot(vScOutX, vScOutY);

    const deltaVx = vScOutX - vScIn.x;
    const deltaVy = vScOutY - vScIn.y;
    const deltaVMag = Math.hypot(deltaVx, deltaVy);

    // Energy change per unit mass: Delta E = v_p . (v_inf_out - v_inf_in)
    const deltaEnergy = 0.5 * (speedOut * speedOut - speedIn * speedIn);

    return {
      vInfMagKmS: vInfMag,
      turnAngleRad: deltaRad,
      turnAngleDeg: (deltaRad * 180) / Math.PI,
      eccentricity: hyperbolicEccentricity(rpKm, vInfMag, muPlanet),
      vScIn: { x: vScIn.x, y: vScIn.y, speed: speedIn },
      vScOut: { x: vScOutX, y: vScOutY, speed: speedOut },
      vPlanet: { x: vPlanet.x, y: vPlanet.y, speed: Math.hypot(vPlanet.x, vPlanet.y) },
      vInfIn: { x: vInfInX, y: vInfInY },
      vInfOut: { x: vInfOutX, y: vInfOutY },
      deltaV: { x: deltaVx, y: deltaVy, mag: deltaVMag },
      deltaEnergyKm2S2: deltaEnergy
    };
  }

  /**
   * Escape velocity from Sun at distance r (km)
   * v_esc(r) = sqrt(2 * mu_sun / r)
   */
  function solarEscapeVelocity(rKm) {
    if (rKm <= 0) return 0;
    return Math.sqrt((2 * MU_SUN) / rKm);
  }

  /**
   * Vis-viva orbital speed: v = sqrt(mu * (2/r - 1/a))
   */
  function visVivaSpeed(rKm, aKm, mu = MU_SUN) {
    if (rKm <= 0) return 0;
    const val = mu * (2 / rKm - 1 / aKm);
    return val > 0 ? Math.sqrt(val) : 0;
  }

  /**
   * RTG (Radioisotope Thermoelectric Generator) remaining electrical power
   * Incorporates Plutonium-238 alpha decay (t_1/2 = 87.7 yrs) + thermocouple loss
   */
  function rtgPowerWatts(day) {
    if (day < 0) return RTG_INITIAL_WATTS;
    const decayFactor = Math.pow(0.5, day / PU238_HALF_LIFE_DAYS);
    const thermocoupleFactor = Math.max(0.4, 1.0 - (day / YEAR_DAYS) * RTG_DEGRADE_PER_YEAR);
    return Math.round((RTG_INITIAL_WATTS * decayFactor * thermocoupleFactor) * 10) / 10;
  }

  /**
   * Speed of light travel time for a given distance in km
   */
  function lightTimeInfo(distKm) {
    const secondsOneWay = distKm / SPEED_OF_LIGHT;
    const secondsRoundTrip = secondsOneWay * 2;
    
    function fmt(s) {
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = Math.floor(s % 60);
      return `${hrs}h ${mins}m ${secs}s`;
    }

    return {
      oneWaySec: secondsOneWay,
      roundTripSec: secondsRoundTrip,
      oneWayStr: fmt(secondsOneWay),
      roundTripStr: fmt(secondsRoundTrip),
      oneWayHours: secondsOneWay / 3600
    };
  }

  /**
   * Interpolate trajectory state for Voyager 2 at mission day t
   * Accurately reproduces the 5 legs of the Grand Tour (Earth->Jupiter->Saturn->Uranus->Neptune->Interstellar)
   */
  const TRAJECTORY_LEGS = [
    {
      name: 'Earth to Jupiter Transfer',
      startDay: 0,
      endDay: 688,
      startAU: 1.0,
      endAU: 5.2044,
      startAngle: 5.76,
      endAngle: 1.52 + (2 * Math.PI / 4332.59) * 688,
      speedStart: 36.4,
      speedEnd: 10.2,
      zStartAU: 0.0,
      zEndAU: 0.05
    },
    {
      name: 'Jupiter to Saturn Transfer',
      startDay: 688,
      endDay: 1466,
      startAU: 5.2044,
      endAU: 9.5826,
      startAngle: 1.52 + (2 * Math.PI / 4332.59) * 688,
      endAngle: 2.65 + (2 * Math.PI / 10759.22) * 1466,
      speedStart: 25.4,
      speedEnd: 15.6,
      zStartAU: 0.05,
      zEndAU: 0.12
    },
    {
      name: 'Saturn to Uranus Transfer',
      startDay: 1466,
      endDay: 3079,
      startAU: 9.5826,
      endAU: 19.201,
      startAngle: 2.65 + (2 * Math.PI / 10759.22) * 1466,
      endAngle: 4.02 + (2 * Math.PI / 30688.5) * 3079,
      speedStart: 24.3,
      speedEnd: 14.8,
      zStartAU: 0.12,
      zEndAU: 0.22
    },
    {
      name: 'Uranus to Neptune Transfer',
      startDay: 3079,
      endDay: 4388,
      startAU: 19.201,
      endAU: 30.047,
      startAngle: 4.02 + (2 * Math.PI / 30688.5) * 3079,
      endAngle: 4.85 + (2 * Math.PI / 60182.0) * 4388,
      speedStart: 21.4,
      speedEnd: 16.7,
      zStartAU: 0.22,
      zEndAU: -0.15
    },
    {
      name: 'Interstellar Cruise (South of Ecliptic)',
      startDay: 4388,
      endDay: 25000,
      startAU: 30.047,
      endAU: 180.0,
      startAngle: 4.85 + (2 * Math.PI / 60182.0) * 4388,
      endAngle: 5.25,
      speedStart: 26.6,
      speedEnd: 15.1, // Asymptotic interstellar speed ~15.1 km/s (3.18 AU/year)
      zStartAU: -0.15,
      zEndAU: -75.0 // -48° south of ecliptic plane
    }
  ];

  function trajectoryAtDay(day) {
    const clampedDay = Math.max(0, day);
    let leg = TRAJECTORY_LEGS[0];
    for (let i = 0; i < TRAJECTORY_LEGS.length; i++) {
      if (clampedDay >= TRAJECTORY_LEGS[i].startDay && clampedDay <= TRAJECTORY_LEGS[i].endDay) {
        leg = TRAJECTORY_LEGS[i];
        break;
      }
    }
    if (clampedDay > TRAJECTORY_LEGS[TRAJECTORY_LEGS.length - 1].endDay) {
      leg = TRAJECTORY_LEGS[TRAJECTORY_LEGS.length - 1];
    }

    const duration = leg.endDay - leg.startDay;
    const progress = Math.min(1.0, Math.max(0.0, (clampedDay - leg.startDay) / duration));
    
    // Smooth spline interpolation for distance, angle, and speed
    const smoothProgress = progress * progress * (3 - 2 * progress);
    
    let rAU, thetaRad, speedKmS, zAU;
    if (leg.name.includes('Interstellar')) {
      // Interstellar cruise: ~3.071 AU/year after Neptune
      const daysSinceNeptune = clampedDay - 4388;
      const yearsSinceNeptune = daysSinceNeptune / YEAR_DAYS;
      // Exact match to Nov 5, 2018 (119.7 AU at day 15052)
      rAU = 30.047 + yearsSinceNeptune * 3.071;
      thetaRad = leg.startAngle + 0.08 * (1 - Math.exp(-yearsSinceNeptune / 10));
      speedKmS = 15.1 + 11.5 * Math.exp(-yearsSinceNeptune / 5);
      zAU = -Math.sin((48.0 * Math.PI) / 180) * (rAU - 30.047);
    } else {
      rAU = leg.startAU + (leg.endAU - leg.startAU) * smoothProgress;
      thetaRad = leg.startAngle + (leg.endAngle - leg.startAngle) * progress;
      speedKmS = leg.speedStart + (leg.speedEnd - leg.speedStart) * smoothProgress;
      zAU = leg.zStartAU + (leg.zEndAU - leg.zStartAU) * smoothProgress;
    }

    const xAU = rAU * Math.cos(thetaRad);
    const yAU = rAU * Math.sin(thetaRad);
    const distKm = rAU * AU_KM;
    const vEscKmS = solarEscapeVelocity(distKm);

    // Tangential and radial velocity components
    const vr = ((rAU - (leg.startAU)) / Math.max(1, clampedDay - leg.startDay)) * (AU_KM / DAY_SECONDS);
    const vt = Math.sqrt(Math.max(0, speedKmS * speedKmS - vr * vr));
    const vx = vr * Math.cos(thetaRad) - vt * Math.sin(thetaRad);
    const vy = vr * Math.sin(thetaRad) + vt * Math.cos(thetaRad);

    // Determine current mission phase
    let phase = 'Interplanetary Cruise';
    let phaseZh = '行星际巡航';
    let closePlanet = null;
    if (clampedDay < 10) { phase = 'Earth Departure'; phaseZh = '地球出发'; }
    else if (Math.abs(clampedDay - 688) < 15) { phase = 'Jupiter Gravity Assist'; phaseZh = '木星引力弹弓'; closePlanet = 'JUPITER'; }
    else if (Math.abs(clampedDay - 1466) < 15) { phase = 'Saturn Gravity Assist'; phaseZh = '土星引力弹弓'; closePlanet = 'SATURN'; }
    else if (Math.abs(clampedDay - 3079) < 20) { phase = 'Uranus Gravity Assist'; phaseZh = '天王星引力弹弓'; closePlanet = 'URANUS'; }
    else if (Math.abs(clampedDay - 4388) < 20) { phase = 'Neptune Gravity Assist'; phaseZh = '海王星引力弹弓'; closePlanet = 'NEPTUNE'; }
    else if (clampedDay >= 15052) { phase = 'Interstellar Medium (Beyond Heliopause)'; phaseZh = '星际空间（穿过日球层）'; }
    else if (clampedDay > 4388) { phase = 'Heliosheath Journey'; phaseZh = '日鞘层航行'; }

    const dateObj = new Date(LAUNCH_DATE_EPOCH + clampedDay * DAY_SECONDS * 1000);
    const dateStr = dateObj.toISOString().split('T')[0];

    return {
      day: clampedDay,
      dateStr: dateStr,
      legName: leg.name,
      phase: phase,
      phaseZh: phaseZh,
      closePlanet: closePlanet,
      xAU: xAU,
      yAU: yAU,
      zAU: zAU,
      rAU: rAU,
      distKm: distKm,
      speedKmS: speedKmS,
      vEscKmS: vEscKmS,
      isEscaping: speedKmS >= vEscKmS,
      velocityVector: { x: vx, y: vy, z: 0, speed: speedKmS },
      rtgPowerWatts: rtgPowerWatts(clampedDay),
      lightTime: lightTimeInfo(distKm)
    };
  }

  /**
   * Interactive Sandbox Simulator:
   * Test custom launch parameters (C3 energy, flyby periapsis aim offset at Jupiter)
   * to see if probe achieves solar escape, Grand Tour alignment, or falls into Sun.
   */
  function simulateCustomLaunch(injectionDeltaVKmS, jupiterAimFactor = 1.0) {
    // Base Earth injection
    const vEarth = PLANETS.EARTH.orbSpeedKmS;
    const vInject = vEarth + injectionDeltaVKmS;
    const rStart = 1.0 * AU_KM;

    // Check if orbit reaches Jupiter (a_transfer >= (r_earth + r_jup)/2)
    const rJup = PLANETS.JUPITER.aAU * AU_KM;
    const energy0 = 0.5 * vInject * vInject - MU_SUN / rStart;
    const a0Km = -MU_SUN / (2 * energy0);

    let reachesJupiter = false;
    let apoapsisAU = 0;
    if (energy0 < 0) {
      apoapsisAU = (2 * a0Km - rStart) / AU_KM;
      reachesJupiter = apoapsisAU >= PLANETS.JUPITER.aAU;
    } else {
      reachesJupiter = true; // Hyperbolic
      apoapsisAU = Infinity;
    }

    if (!reachesJupiter) {
      return {
        success: false,
        outcome: 'APOAPSIS_SHORT_OF_JUPITER',
        outcomeZh: '未达木星轨道（远日点过低）',
        apoapsisAU: apoapsisAU,
        details: `Aphelion is ${apoapsisAU.toFixed(2)} AU, short of Jupiter's 5.20 AU.`
      };
    }

    // Velocity arriving at Jupiter
    const vArrKmS = visVivaSpeed(rJup, a0Km, MU_SUN);
    const vScIn = { x: vArrKmS * 0.4, y: vArrKmS * 0.9 };
    const vJup = { x: 0, y: PLANETS.JUPITER.orbSpeedKmS };
    const rpKm = PLANETS.JUPITER.radiusKm * (2.0 + Math.abs(jupiterAimFactor) * 7.2);

    const assist = computeGravityAssist(vScIn, vJup, rpKm, PLANETS.JUPITER.mu, jupiterAimFactor);
    const vPostKmS = assist.vScOut.speed;
    const vEscAtJup = solarEscapeVelocity(rJup);

    let outcome = 'INTERPLANETARY_ELLIPSE';
    let outcomeZh = '太阳系内椭圆轨道';
    if (vPostKmS >= vEscAtJup) {
      if (Math.abs(jupiterAimFactor - 1.0) < 0.25 && injectionDeltaVKmS >= 8.8) {
        outcome = 'GRAND_TOUR_CORRIDOR';
        outcomeZh = '解锁完美“大航行”四星连珠廊道！';
      } else {
        outcome = 'SOLAR_SYSTEM_ESCAPE';
        outcomeZh = '达成太阳系逃逸（星际弹弓）';
      }
    } else if (jupiterAimFactor < 0) {
      outcome = 'GRAVITY_BRAKE_INNER_SOLAR';
      outcomeZh = '木星减速弹弓（坠向内太阳系）';
    }

    return {
      success: true,
      outcome: outcome,
      outcomeZh: outcomeZh,
      reachesJupiter: true,
      vInjectionKmS: vInject,
      vArrivalJupiterKmS: vArrKmS,
      rpKm: rpKm,
      rpRadii: rpKm / PLANETS.JUPITER.radiusKm,
      turnAngleDeg: assist.turnAngleDeg,
      vPostJupiterKmS: vPostKmS,
      vEscAtJupKmS: vEscAtJup,
      deltaVKmS: assist.deltaV.mag,
      deltaEnergyKm2S2: assist.deltaEnergyKm2S2
    };
  }

  // Pre-calculated trajectory cache of 300 points for smooth canvas rendering
  function generateTrajectoryPolyline(numPoints = 300) {
    const points = [];
    const maxDay = 18000;
    for (let i = 0; i <= numPoints; i++) {
      const d = (i / numPoints) * maxDay;
      const state = trajectoryAtDay(d);
      points.push({
        day: d,
        xAU: state.xAU,
        yAU: state.yAU,
        zAU: state.zAU,
        rAU: state.rAU,
        speedKmS: state.speedKmS,
        vEscKmS: state.vEscKmS
      });
    }
    return points;
  }

  return {
    AU_KM,
    SPEED_OF_LIGHT,
    MU_SUN,
    DAY_SECONDS,
    YEAR_DAYS,
    LAUNCH_DATE_EPOCH,
    PLANETS,
    KEY_MILESTONES,
    planetPosition,
    hyperbolicTurnAngle,
    hyperbolicEccentricity,
    computeGravityAssist,
    solarEscapeVelocity,
    visVivaSpeed,
    rtgPowerWatts,
    lightTimeInfo,
    trajectoryAtDay,
    simulateCustomLaunch,
    generateTrajectoryPolyline
  };
});
