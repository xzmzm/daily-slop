/**
 * Illustrative 2D toy inspired by Philae, not an exact trajectory/history.
 * Synthetic silhouette, landmark coordinates, mass split and initial conditions.
 * Includes rotating-frame acceleration, simplified impacts and shadow raycasting.
 * Third-contact settling is forced; hardware and rechargeable reserve are toys.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CometModel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Physical constants of Comet 67P
  const G = 6.67430e-11; // Gravitational constant (m^3 kg^-1 s^-2)
  const ROTATION_PERIOD_S = 12.404 * 3600; // 12.404 hours in seconds (~44654 s)
  const OMEGA = (2 * Math.PI) / ROTATION_PERIOD_S; // Angular velocity: ~1.407e-4 rad/s

  // Dual-lobe mass representation:
  // Body Lobe (Lobe 1): ~7.0e12 kg, center at (-650m, -80m)
  // Head Lobe (Lobe 2): ~3.0e12 kg, center at (+780m, +180m)
  // Total mass: 1.0e13 kg (~10 billion metric tons)
  const LOBES = {
    body: { x: -650, y: -80, mass: 7.0e12, softening: 420 },
    head: { x: 780, y: 180, mass: 3.0e12, softening: 340 }
  };

  // Synthetic landmark coordinates in meters; not a geographic map of 67P.
  const LANDMARKS = {
    agilkia: { x: 780, y: 800, name: 'Agilkia (Site J)', desc: 'Initial touchdown site on head lobe; open, well-illuminated' },
    hathor: { x: 260, y: 520, name: 'Hathor Cliffs', desc: '900-meter sheer cliff dropping into Hapi neck' },
    hapi: { x: 40, y: 390, name: 'Hapi (Neck)', desc: 'Smooth dust-covered saddle connecting the two lobes' },
    hatmehit: { x: 1080, y: 540, name: 'Hatmehit Basin', desc: 'Large shallow depression on head lobe' },
    abydos: { x: -440, y: 640, name: 'Abydos (illustrative)', desc: 'Synthetic marker inspired by the final resting site; not its real coordinates' },
    wosret: { x: -1420, y: 100, name: 'Wosret Plateau', desc: 'Flat elevated region on body lobe' }
  };

  /**
   * Generates a 72-point polygon representing the cross-section of Comet 67P.
   * Produces the iconic rubber-duck / contact-binary silhouette with a pinched neck.
   */
  function generateCometPolygon(samples = 72) {
    const points = [];
    for (let i = 0; i < samples; i++) {
      const angle = (2 * Math.PI * i) / samples;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Binary search for equipotential / distance boundary along ray
      let rLow = 80.0;
      let rHigh = 2800.0;
      for (let iter = 0; iter < 24; iter++) {
        const rMid = (rLow + rHigh) / 2;
        const x = rMid * cosA;
        const y = rMid * sinA;

        // Normalized distance to body lobe
        const d1 = Math.pow((x + 650.0) / 1150.0, 2) + Math.pow((y + 80.0) / 880.0, 2);
        // Normalized distance to head lobe
        const d2 = Math.pow((x - 780.0) / 710.0, 2) + Math.pow((y - 200.0) / 630.0, 2);

        // Neck waist pinch factor: draws in the saddle between x=-200 and x=+200
        const pinch = 1.0 + 1.55 * Math.exp(-Math.pow((x - 40.0) / 260.0, 2)) * Math.pow(y / 620.0, 2);

        // Blended surface function
        const val = (Math.pow(1.0 / Math.max(0.001, d1), 2.5) + Math.pow(1.0 / Math.max(0.001, d2), 2.5)) / Math.pow(pinch, 2.5);

        // Small geological surface roughness / ridges
        const terrainDetail = 0.04 * Math.sin(7 * angle) + 0.02 * Math.cos(13 * angle);
        if (val + terrainDetail < 1.0) {
          rHigh = rMid;
        } else {
          rLow = rMid;
        }
      }
      points.push({
        x: Math.round(rLow * cosA * 10) / 10,
        y: Math.round(rLow * sinA * 10) / 10
      });
    }
    return points;
  }

  const COMET_POLYGON = generateCometPolygon();

  /**
   * Calculates gravitational acceleration from both lobes at (x, y).
   */
  function getGravity(x, y) {
    // Body lobe
    const dx1 = x - LOBES.body.x;
    const dy1 = y - LOBES.body.y;
    const r1Sq = dx1 * dx1 + dy1 * dy1 + LOBES.body.softening * LOBES.body.softening;
    const r1 = Math.sqrt(r1Sq);
    const f1 = (G * LOBES.body.mass) / r1Sq;
    const gx1 = -f1 * (dx1 / r1);
    const gy1 = -f1 * (dy1 / r1);

    // Head lobe
    const dx2 = x - LOBES.head.x;
    const dy2 = y - LOBES.head.y;
    const r2Sq = dx2 * dx2 + dy2 * dy2 + LOBES.head.softening * LOBES.head.softening;
    const r2 = Math.sqrt(r2Sq);
    const f2 = (G * LOBES.head.mass) / r2Sq;
    const gx2 = -f2 * (dx2 / r2);
    const gy2 = -f2 * (dy2 / r2);

    const gx = gx1 + gx2;
    const gy = gy1 + gy2;
    return {
      gx,
      gy,
      mag: Math.hypot(gx, gy)
    };
  }

  /**
   * Calculates centrifugal acceleration in the comet-fixed rotating frame.
   * a_cent = omega^2 * r (directed outward away from rotation axis)
   */
  function getCentrifugal(x, y) {
    const ax = OMEGA * OMEGA * x;
    const ay = OMEGA * OMEGA * y;
    return { ax, ay, mag: Math.hypot(ax, ay) };
  }

  /**
   * Calculates Coriolis acceleration in the rotating frame.
   * a_cor = -2 (omega x v) = (2 * omega * vy, -2 * omega * vx)
   */
  function getCoriolis(vx, vy) {
    const ax = 2 * OMEGA * vy;
    const ay = -2 * OMEGA * vx;
    return { ax, ay, mag: Math.hypot(ax, ay) };
  }

  /**
   * Net effective acceleration in the rotating frame:
   * a_net = g(x,y) + a_cent + a_cor
   */
  function getNetAccel(x, y, vx, vy) {
    const g = getGravity(x, y);
    const cent = getCentrifugal(x, y);
    const cor = getCoriolis(vx, vy);
    return {
      ax: g.gx + cent.ax + cor.ax,
      ay: g.gy + cent.ay + cor.ay,
      gMag: g.mag,
      centMag: cent.mag,
      corMag: cor.mag
    };
  }

  /**
   * Approximate inertial escape speed from the softened toy gravity potential.
   * Position-dependent, of order 1 m/s near the surface; not a rotating-frame
   * speed threshold or a prediction of escape from the Solar System.
   */
  function getEscapeSpeed(x, y) {
    const r1 = Math.hypot(x - LOBES.body.x, y - LOBES.body.y, LOBES.body.softening);
    const r2 = Math.hypot(x - LOBES.head.x, y - LOBES.head.y, LOBES.head.softening);
    return Math.sqrt(2 * G * (LOBES.body.mass / r1 + LOBES.head.mass / r2));
  }

  /**
   * Tests if point (x, y) is inside the comet polygon (point-in-polygon).
   */
  function isInsideComet(x, y, polygon = COMET_POLYGON) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Finds intersection between line segment (p1->p2) and polygon edges.
   * Returns closest collision hit: { point, normal, edgeIndex, u } or null.
   */
  function checkTerrainCollision(p1, p2, polygon = COMET_POLYGON) {
    let closestHit = null;
    let minU = 1.0;

    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const a = polygon[i];
      const b = polygon[j];

      // Line-line intersection between (p1->p2) and (a->b)
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const ex = b.x - a.x;
      const ey = b.y - a.y;

      const denom = dx * ey - dy * ex;
      if (Math.abs(denom) < 1e-8) continue; // parallel

      const t = ((a.x - p1.x) * ey - (a.y - p1.y) * ex) / denom;
      const u = ((a.x - p1.x) * dy - (a.y - p1.y) * dx) / denom;

      if (t >= 0 && t <= minU && u >= 0 && u <= 1) {
        minU = t;
        // Normal vector pointing outward from terrain edge (right-hand rule)
        let nx = ey;
        let ny = -ex;
        const nlen = Math.hypot(nx, ny);
        if (nlen > 0) {
          nx /= nlen;
          ny /= nlen;
        }
        // Ensure normal points outward (away from comet center)
        const hitX = p1.x + t * dx;
        const hitY = p1.y + t * dy;
        if (hitX * nx + hitY * ny < 0) {
          nx = -nx;
          ny = -ny;
        }

        closestHit = {
          x: hitX,
          y: hitY,
          nx,
          ny,
          t,
          edgeIndex: i
        };
      }
    }
    return closestHit;
  }

  /**
   * Returns unit vector pointing toward the Sun at elapsed time t (seconds).
   * In the rotating frame, the Sun appears to revolve clockwise at -OMEGA rad/s.
   */
  function getSunVector(timeSec, initialAngleRad = Math.PI / 4) {
    const angle = initialAngleRad - OMEGA * timeSec;
    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
      angle
    };
  }

  /**
   * Raycasts from (x, y) toward the Sun to check if blocked by terrain (shadow).
   */
  function isPointInShadow(x, y, sunVec, polygon = COMET_POLYGON) {
    // Ray start slightly above surface
    const p1 = { x: x + sunVec.x * 2.0, y: y + sunVec.y * 2.0 };
    const p2 = { x: x + sunVec.x * 5000.0, y: y + sunVec.y * 5000.0 };

    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const a = polygon[i];
      const b = polygon[j];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const ex = b.x - a.x;
      const ey = b.y - a.y;

      const denom = dx * ey - dy * ex;
      if (Math.abs(denom) < 1e-8) continue;

      const t = ((a.x - p1.x) * ey - (a.y - p1.y) * ex) / denom;
      const u = ((a.x - p1.x) * dy - (a.y - p1.y) * dx) / denom;

      if (t > 0 && t <= 1 && u >= 0 && u <= 1) {
        return true; // Ray hit comet terrain: point is shadowed
      }
    }
    return false;
  }

  /**
   * Toy solar input: fixed 32 W in sunlight, 1.5 W in shadow.
   * No panel orientation, thermal model or historical power reconstruction.
   */
  function calculateSolarPower(x, y, timeSec, polygon = COMET_POLYGON) {
    const sunVec = getSunVector(timeSec);
    const shadowed = isPointInShadow(x, y, sunVec, polygon);
    if (shadowed) {
      // Arbitrary residual input for the toy, not measured coma illumination.
      return { powerW: 1.5, shadowed: true, sunVec };
    }
    // Fixed illustrative input; no panel geometry is modeled.
    return { powerW: 32.0, shadowed: false, sunVec };
  }

  /**
   * Simulation Engine class
   */
  class Simulation {
    constructor(config = {}) {
      this.polygon = COMET_POLYGON;
      this.reset(config);
    }

    reset(config = {}) {
      this.time = 0.0; // Simulated time in seconds
      this.stepCount = 0;
      this.status = 'descending'; // 'descending' | 'bounced' | 'anchored' | 'settled' | 'escaped'
      this.touchdowns = [];

      // Subsystem switches
      this.harpoonsEnabled = config.harpoonsEnabled !== undefined ? config.harpoonsEnabled : false;
      this.thrusterEnabled = config.thrusterEnabled !== undefined ? config.thrusterEnabled : false;
      this.restitution = config.restitution !== undefined ? config.restitution : 0.38; // Normal coefficient of restitution
      this.friction = config.friction !== undefined ? config.friction : 0.85; // Tangential friction

      // Initial position and velocity
      // Starting descent trajectory toward Agilkia (Site J at x=780, y=800)
      this.x = config.x !== undefined ? config.x : 920.0;
      this.y = config.y !== undefined ? config.y : 1380.0;
      this.vx = config.vx !== undefined ? config.vx : -0.25;
      this.vy = config.vy !== undefined ? config.vy : -0.96; // ~1.0 m/s descent speed
      this.attitudeRad = config.attitudeRad !== undefined ? config.attitudeRad : 0.1;
      this.spinRadS = 0.002;

      // Simplified rechargeable 100 Wh reserve, NOT Philae's primary battery.
      this.batteryWh = 100.0;
      this.solarPowerW = 32.0;
      this.isShadowed = false;

      // Trajectory history log for rendering & analysis
      this.trajectory = [{
        t: 0,
        x: this.x,
        y: this.y,
        vx: this.vx,
        vy: this.vy,
        alt: this.getAltitude(this.x, this.y),
        speed: Math.hypot(this.vx, this.vy)
      }];

      this.preset = config.preset || 'historical';
    }

    getAltitude(x, y) {
      // Signed shortest distance to terrain segments, not just their vertices.
      let minDist = Infinity;
      for (let i = 0; i < this.polygon.length; i++) {
        const a = this.polygon[i];
        const b = this.polygon[(i + 1) % this.polygon.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        const t = lengthSq ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq)) : 0;
        minDist = Math.min(minDist, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
      }
      return isInsideComet(x, y, this.polygon) ? -minDist : minDist;
    }

    /**
     * Executes one RK4 integration step.
     */
    step(dt = 1.0) {
      if (this.status === 'anchored' || this.status === 'settled' || this.status === 'escaped') {
        // Landed or escaped: advance clock, update solar & battery
        this.time += dt;
        this.stepCount++;
        const solar = calculateSolarPower(this.x, this.y, this.time, this.polygon);
        this.solarPowerW = solar.powerW;
        this.isShadowed = solar.shadowed;
        // Battery power balance: instruments consume 18W
        const netW = this.solarPowerW - 18.0;
        this.batteryWh = Math.max(0, Math.min(100, this.batteryWh + (netW * dt) / 3600));
        return;
      }

      const p1 = { x: this.x, y: this.y };

      // RK4 integration for unpowered ballistic coast
      // k1
      const a1 = getNetAccel(this.x, this.y, this.vx, this.vy);
      const vx1 = this.vx + 0.5 * a1.ax * dt;
      const vy1 = this.vy + 0.5 * a1.ay * dt;
      const x1 = this.x + 0.5 * this.vx * dt;
      const y1 = this.y + 0.5 * this.vy * dt;

      // k2
      const a2 = getNetAccel(x1, y1, vx1, vy1);
      const vx2 = this.vx + 0.5 * a2.ax * dt;
      const vy2 = this.vy + 0.5 * a2.ay * dt;
      const x2 = this.x + 0.5 * vx1 * dt;
      const y2 = this.y + 0.5 * vy1 * dt;

      // k3
      const a3 = getNetAccel(x2, y2, vx2, vy2);
      const vx3 = this.vx + a3.ax * dt;
      const vy3 = this.vy + a3.ay * dt;
      const x3 = this.x + vx2 * dt;
      const y3 = this.y + vy2 * dt;

      // k4
      const a4 = getNetAccel(x3, y3, vx3, vy3);

      let nextX = this.x + (this.vx + 2 * vx1 + 2 * vx2 + vx3) * (dt / 6.0);
      let nextY = this.y + (this.vy + 2 * vy1 + 2 * vy2 + vy3) * (dt / 6.0);
      let nextVx = this.vx + (a1.ax + 2 * a2.ax + 2 * a3.ax + a4.ax) * (dt / 6.0);
      let nextVy = this.vy + (a1.ay + 2 * a2.ay + 2 * a3.ay + a4.ay) * (dt / 6.0);

      const p2 = { x: nextX, y: nextY };

      // Check collision with comet surface
      const hit = checkTerrainCollision(p1, p2, this.polygon);

      if (hit) {
        const impactSpeed = Math.hypot(this.vx, this.vy);
        const vn = this.vx * hit.nx + this.vy * hit.ny; // Normal velocity (negative when approaching)
        const vtX = this.vx - vn * hit.nx;
        const vtY = this.vy - vn * hit.ny;

        const touchdownRecord = {
          time: this.time + hit.t * dt,
          x: hit.x,
          y: hit.y,
          speed: impactSpeed,
          normalSpeed: Math.abs(vn),
          number: this.touchdowns.length + 1
        };
        this.touchdowns.push(touchdownRecord);

        // Case 1: Active Anchoring (Nominal Plan)
        if (this.harpoonsEnabled) {
          this.x = hit.x;
          this.y = hit.y;
          this.vx = 0.0;
          this.vy = 0.0;
          this.status = 'anchored';
        } else if (this.thrusterEnabled && vn < 0) {
          // Thruster pushes down, canceling normal rebound
          this.x = hit.x;
          this.y = hit.y;
          this.vx = 0.0;
          this.vy = 0.0;
          this.status = 'anchored';
        } else {
          // Case 2: Ballistic Rebound (Historical / Unanchored)
          // Normal rebound with restitution e
          const rebVn = -vn * this.restitution;
          const rebVtX = vtX * this.friction;
          const rebVtY = vtY * this.friction;

          const newVx = rebVtX + rebVn * hit.nx;
          const newVy = rebVtY + rebVn * hit.ny;
          const rebSpeed = Math.hypot(newVx, newVy);

          // Position slightly above surface along normal
          this.x = hit.x + hit.nx * 2.0;
          this.y = hit.y + hit.ny * 2.0;
          this.vx = newVx;
          this.vy = newVy;

          // Toy cutoff: force settling at the third contact, regardless of energy.
          if (rebSpeed < 0.05 || this.touchdowns.length >= 3) {
            this.vx = 0.0;
            this.vy = 0.0;
            this.status = 'settled';
          } else {
            this.status = 'bounced';
          }
        }
      } else {
        // No collision this step
        this.x = nextX;
        this.y = nextY;
        this.vx = nextVx;
        this.vy = nextVy;

        // Toy escape flag: outward travel beyond 3.8 km with positive
        // inertial specific energy; not a rigorous long-term escape proof.
        const r = Math.hypot(this.x, this.y);
        const speed = Math.hypot(this.vx - OMEGA * this.y, this.vy + OMEGA * this.x);
        const vEsc = getEscapeSpeed(this.x, this.y);
        if (r > 3800.0 && speed > vEsc && this.x * this.vx + this.y * this.vy > 0) {
          this.status = 'escaped';
        }
      }

      this.time += dt;
      this.stepCount++;
      this.attitudeRad += this.spinRadS * dt;

      // Update solar and battery
      const solar = calculateSolarPower(this.x, this.y, this.time, this.polygon);
      this.solarPowerW = solar.powerW;
      this.isShadowed = solar.shadowed;
      const netW = this.solarPowerW - 18.0;
      this.batteryWh = Math.max(0, Math.min(100, this.batteryWh + (netW * dt) / 3600));

      // Append trajectory sample (downsampled for efficiency)
      if (this.stepCount % 5 === 0 || hit || this.status === 'anchored' || this.status === 'settled') {
        this.trajectory.push({
          t: this.time,
          x: this.x,
          y: this.y,
          vx: this.vx,
          vy: this.vy,
          alt: this.getAltitude(this.x, this.y),
          speed: Math.hypot(this.vx, this.vy)
        });
      }
    }

    /**
     * Pre-computes the complete flight trajectory for the chosen scenario
     * up to maxDurationSec.
     */
    simulateComplete(maxDurationSec = 7200, dt = 1.0) {
      while (this.time < maxDurationSec && this.status !== 'anchored' && this.status !== 'settled' && this.status !== 'escaped') {
        this.step(dt);
      }
      return this.trajectory;
    }

    /**
     * Preset Scenarios
     */
    static getPresets() {
      return {
        historical: {
          name: 'Philae-inspired Bounce (Toy)',
          tagline: 'Unanchored synthetic trajectory; not the historical flight',
          config: {
            preset: 'historical',
            harpoonsEnabled: false,
            thrusterEnabled: false,
            restitution: 0.38,
            friction: 0.85,
            x: 880.0,
            y: 1140.0,
            vx: -0.26,
            vy: -0.96
          }
        },
        nominal: {
          name: 'Idealized Latch',
          tagline: 'Either toy hold-down switch stops motion on contact',
          config: {
            preset: 'nominal',
            harpoonsEnabled: true,
            thrusterEnabled: true,
            restitution: 0.38,
            friction: 0.85,
            x: 880.0,
            y: 1140.0,
            vx: -0.26,
            vy: -0.96
          }
        },
        escape: {
          name: 'Escape Velocity Exceeded',
          tagline: 'Fast arrival may escape the comet, not the Solar System',
          config: {
            preset: 'escape',
            harpoonsEnabled: false,
            thrusterEnabled: false,
            restitution: 0.72,
            friction: 0.95,
            x: 880.0,
            y: 1140.0,
            vx: -0.32,
            vy: -1.25 // Fast arrival speed ~1.3 m/s
          }
        },
        trampoline: {
          name: 'Hard Ice Trampoline',
          tagline: 'Illustrative e=0.60; not a measured ice property',
          config: {
            preset: 'trampoline',
            harpoonsEnabled: false,
            thrusterEnabled: false,
            restitution: 0.60,
            friction: 0.75,
            x: 880.0,
            y: 1140.0,
            vx: -0.26,
            vy: -0.96
          }
        }
      };
    }
  }

  return {
    G,
    ROTATION_PERIOD_S,
    OMEGA,
    LOBES,
    LANDMARKS,
    COMET_POLYGON,
    generateCometPolygon,
    getGravity,
    getCentrifugal,
    getCoriolis,
    getNetAccel,
    getEscapeSpeed,
    isInsideComet,
    checkTerrainCollision,
    getSunVector,
    isPointInShadow,
    calculateSolarPower,
    Simulation
  };
}));
