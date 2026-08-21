/**
 * 1851 Schooner America Sea, Yacht, Aero-Hydro Streamlines & Tactical Renderer
 */

import { DEG_TO_RAD, RAD_TO_DEG } from "./physics.js";

export class SeaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Particle systems
    this.wakeParticles = [];
    this.streamlines = [];
    this.wavePhase = 0;
    this.telltalePhase = 0;

    // View settings
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.viewMode = "topdown"; // 'topdown' | 'tactical' | 'hydro_lab'
    this.showVectors = true;
    this.showStreamlines = true;
    this.showWake = true;
    this.showTelltales = true;

    this.initStreamlines();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
  }

  initStreamlines() {
    this.streamlines = [];
    for (let i = 0; i < 48; i++) {
      this.streamlines.push({
        x: (Math.random() - 0.5) * 350,
        y: (Math.random() - 0.5) * 350,
        length: 24 + Math.random() * 32,
        life: Math.random(),
        speed: 1.0 + Math.random() * 0.4,
      });
    }
  }

  addWakeParticle(x, y, vx, vy, isBow = false, intensity = 1.0) {
    if (this.wakeParticles.length > 250) this.wakeParticles.shift();
    this.wakeParticles.push({
      x,
      y,
      vx: vx + (Math.random() - 0.5) * 0.4,
      vy: vy + (Math.random() - 0.5) * 0.4,
      radius: (isBow ? 2.5 : 4.0) + Math.random() * 2.5,
      alpha: 0.65 * intensity,
      decay: isBow ? 0.025 : 0.015,
      isBow,
    });
  }

  updateParticles(dt, sim) {
    this.wavePhase += dt * 1.8;
    this.telltalePhase += dt * 12.0;

    // Emit wake particles from boat bow and stern
    if (sim.telemetry.speed_knots > 0.8 && this.showWake) {
      const hdg = sim.heading_rad;
      const bowX = sim.x + Math.sin(hdg) * (sim.hull.loa * 0.48);
      const bowY = sim.y + Math.cos(hdg) * (sim.hull.loa * 0.48);
      const sternX = sim.x - Math.sin(hdg) * (sim.hull.loa * 0.45);
      const sternY = sim.y - Math.cos(hdg) * (sim.hull.loa * 0.45);

      const bowSpread = sim.hull.bowType === "wave_line" ? 0.4 : 1.2;
      const bowInt = sim.hull.bowType === "wave_line" ? 0.6 : 1.4;

      this.addWakeParticle(bowX, bowY, -Math.cos(hdg) * 0.8 * bowSpread, Math.sin(hdg) * 0.8 * bowSpread, true, bowInt);
      this.addWakeParticle(sternX, sternY, 0, 0, false, 1.0);
    }

    // Update wake particles
    for (let i = this.wakeParticles.length - 1; i >= 0; i--) {
      const p = this.wakeParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.radius += dt * 3.0;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.wakeParticles.splice(i, 1);
      }
    }
  }

  render(sim) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Sea Background Grid & Wind Waves
    this.renderSea(ctx, w, h, dpr, sim);

    // Coordinate Transform centered on Boat
    const cx = w * 0.5;
    const cy = h * 0.5;
    const pxPerMeter = 6.8 * dpr * this.camera.zoom;

    ctx.save();
    ctx.translate(cx, cy);

    // 2. Render Kelvin Wake & Foam Field
    if (this.showWake) {
      this.renderWakeField(ctx, sim, pxPerMeter, dpr);
    }

    // 3. Render Aero Streamlines Field
    if (this.showStreamlines) {
      this.renderAeroStreamlines(ctx, sim, pxPerMeter, dpr);
    }

    // 4. Render The Yacht (Deck, Hull, Masts, Rigging, Canvas Sails)
    this.renderYacht(ctx, sim, pxPerMeter, dpr);

    // 5. Render Physics Vectors Overlay
    if (this.showVectors) {
      this.renderPhysicsVectors(ctx, sim, pxPerMeter, dpr);
    }

    ctx.restore();

    // 6. Tactical Mini-Map & HUD Corner Inset
    this.renderTacticalMiniMap(ctx, sim, w, h, dpr);

    ctx.restore();
  }

  renderSea(ctx, w, h, dpr, sim) {
    // Deep Solent Sea Gradient
    const seaGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40 * dpr, w * 0.5, h * 0.5, w * 0.7);
    seaGrad.addColorStop(0, "#0e1e36");
    seaGrad.addColorStop(0.6, "#0a1527");
    seaGrad.addColorStop(1, "#060d19");
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, w, h);

    // Moving Wind Ripple Lines
    const twd = sim.twd_deg * DEG_TO_RAD;
    const waveDirX = -Math.sin(twd);
    const waveDirY = -Math.cos(twd);

    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
    ctx.lineWidth = 1.2 * dpr;

    const spacing = 38 * dpr;
    const offset = (this.wavePhase * 24 * dpr) % spacing;

    for (let d = -w; d < w + h; d += spacing) {
      const y = d + offset;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 40 * dpr) {
        const waveHeight = Math.sin((x + y * 0.5) * 0.02 + this.wavePhase) * 4 * dpr;
        if (x === 0) ctx.moveTo(x, y + waveHeight);
        else ctx.lineTo(x, y + waveHeight);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  renderWakeField(ctx, sim, pxPerMeter, dpr) {
    const hdg = sim.heading_rad;

    ctx.save();
    // Render particles
    for (const p of this.wakeParticles) {
      const relX = (p.x - sim.x) * pxPerMeter;
      const relY = -(p.y - sim.y) * pxPerMeter; // Canvas Y is inverted

      ctx.beginPath();
      ctx.arc(relX, relY, p.radius * dpr, 0, Math.PI * 2);
      ctx.fillStyle = p.isBow ? `rgba(224, 242, 254, ${p.alpha * 0.8})` : `rgba(186, 230, 253, ${p.alpha * 0.5})`;
      ctx.fill();
    }

    // Kelvin Wake V-Lines from bow
    const speed = sim.telemetry.speed_knots;
    if (speed > 2.0) {
      const bowRelY = -(sim.hull.loa * 0.48) * pxPerMeter;
      const kelvinHalfAngle = (19.47 * DEG_TO_RAD) * (sim.hull.bowType === "wave_line" ? 0.75 : 1.2);
      const wakeLen = Math.min(speed * 12.0 * pxPerMeter, 180 * dpr);

      ctx.save();
      ctx.rotate(hdg);
      ctx.strokeStyle = sim.hull.bowType === "wave_line" ? "rgba(147, 197, 253, 0.22)" : "rgba(239, 68, 68, 0.35)";
      ctx.lineWidth = 2 * dpr;

      // Port Kelvin Crest
      ctx.beginPath();
      ctx.moveTo(0, bowRelY);
      ctx.lineTo(-Math.sin(kelvinHalfAngle) * wakeLen, bowRelY + Math.cos(kelvinHalfAngle) * wakeLen);
      ctx.stroke();

      // Starboard Kelvin Crest
      ctx.beginPath();
      ctx.moveTo(0, bowRelY);
      ctx.lineTo(Math.sin(kelvinHalfAngle) * wakeLen, bowRelY + Math.cos(kelvinHalfAngle) * wakeLen);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  renderAeroStreamlines(ctx, sim, pxPerMeter, dpr) {
    const aw = sim.telemetry;
    const awdRad = (aw.awd_deg || 0) * DEG_TO_RAD;
    const aws = aw.aws_knots;
    if (aws < 1.0) return;

    ctx.save();
    // Rotate so streamlines flow in apparent wind direction
    const flowAngle = awdRad + Math.PI;

    for (const line of this.streamlines) {
      line.life += 0.016 * line.speed * (aws / 12.0);
      if (line.life > 1.0) {
        line.life = 0;
        line.x = (Math.random() - 0.5) * 320 * dpr;
        line.y = -180 * dpr - Math.random() * 60 * dpr;
      }

      ctx.save();
      ctx.rotate(flowAngle);
      const curY = line.y + line.life * 360 * dpr;
      const curX = line.x;

      // Check deflection near sails
      const distFromCenter = Math.hypot(curX, curY);
      let alpha = Math.sin(line.life * Math.PI) * 0.45;
      let color = "rgba(56, 189, 248, "; // Cyan default

      if (distFromCenter < 70 * dpr) {
        // Near sail flow: leeward (suction cyan) vs windward (pressure amber)
        color = line.x > 0 ? "rgba(251, 191, 36, " : "rgba(56, 189, 248, ";
        alpha *= 1.3;
      }

      ctx.strokeStyle = color + alpha + ")";
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX, curY + line.length * dpr);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  renderYacht(ctx, sim, pxPerMeter, dpr) {
    const hull = sim.hull;
    const hdg = sim.heading_rad;
    const heel = (sim.telemetry.heel_deg || 0) * DEG_TO_RAD;

    ctx.save();
    ctx.rotate(hdg);

    // Heel visual translation offset
    const heelOffset = Math.sin(heel) * (hull.beam * 0.25) * pxPerMeter;
    ctx.translate(heelOffset, 0);

    const halfL = (hull.loa * 0.5) * pxPerMeter;
    const halfB = (hull.beam * 0.5) * pxPerMeter;
    const bowspritLen = (hull.loa * 0.22) * pxPerMeter;

    // 1. Bowsprit
    ctx.beginPath();
    ctx.moveTo(0, -halfL);
    ctx.lineTo(0, -halfL - bowspritLen);
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 3.5 * dpr;
    ctx.lineCap = "round";
    ctx.stroke();

    // 2. Hull Shell (Top-Down Waterline Plan)
    ctx.beginPath();
    ctx.moveTo(0, -halfL); // Bow Tip

    if (hull.bowType === "wave_line") {
      // George Steers Hollow Concave Bow:
      // Max beam is placed further aft at 55% of hull length
      const beamY = halfL * 0.1; // 55% from bow
      // Starboard side (concave entrance, swell to max beam, fine run to transom)
      ctx.bezierCurveTo(halfB * 0.25, -halfL * 0.65, halfB * 0.95, -halfL * 0.2, halfB, beamY);
      ctx.bezierCurveTo(halfB * 1.02, halfL * 0.45, halfB * 0.75, halfL * 0.85, halfB * 0.55, halfL);
      // Transom
      ctx.lineTo(-halfB * 0.55, halfL);
      // Port side
      ctx.bezierCurveTo(-halfB * 0.75, halfL * 0.85, -halfB * 1.02, halfL * 0.45, -halfB, beamY);
      ctx.bezierCurveTo(-halfB * 0.95, -halfL * 0.2, -halfB * 0.25, -halfL * 0.65, 0, -halfL);
    } else {
      // British Traditional "Cod's Head" Blunt Convex Bow:
      // Max beam placed forward at 35% of length
      const beamY = -halfL * 0.3;
      ctx.bezierCurveTo(halfB * 0.75, -halfL * 0.8, halfB * 1.05, -halfL * 0.55, halfB, beamY);
      ctx.bezierCurveTo(halfB * 0.95, halfL * 0.2, halfB * 0.6, halfL * 0.75, halfB * 0.45, halfL);
      ctx.lineTo(-halfB * 0.45, halfL);
      ctx.bezierCurveTo(-halfB * 0.6, halfL * 0.75, -halfB * 0.95, halfL * 0.2, -halfB, beamY);
      ctx.bezierCurveTo(-halfB * 1.05, -halfL * 0.55, -halfB * 0.75, -halfL * 0.8, 0, -halfL);
    }
    ctx.closePath();

    // Hull Outer Shell Fill & Stroke
    ctx.fillStyle = hull.hullColor || "#171a22";
    ctx.fill();
    ctx.strokeStyle = hull.color || "#e2b855";
    ctx.lineWidth = 2.2 * dpr;
    ctx.stroke();

    // 3. Wooden Deck Inset
    ctx.save();
    ctx.beginPath();
    ctx.scale(0.86, 0.92);
    if (hull.bowType === "wave_line") {
      const bY = halfL * 0.1;
      ctx.moveTo(0, -halfL);
      ctx.bezierCurveTo(halfB * 0.25, -halfL * 0.65, halfB * 0.95, -halfL * 0.2, halfB, bY);
      ctx.bezierCurveTo(halfB * 1.02, halfL * 0.45, halfB * 0.75, halfL * 0.85, halfB * 0.55, halfL);
      ctx.lineTo(-halfB * 0.55, halfL);
      ctx.bezierCurveTo(-halfB * 0.75, halfL * 0.85, -halfB * 1.02, halfL * 0.45, -halfB, bY);
      ctx.bezierCurveTo(-halfB * 0.95, -halfL * 0.2, -halfB * 0.25, -halfL * 0.65, 0, -halfL);
    } else {
      const bY = -halfL * 0.3;
      ctx.moveTo(0, -halfL);
      ctx.bezierCurveTo(halfB * 0.75, -halfL * 0.8, halfB * 1.05, -halfL * 0.55, halfB, bY);
      ctx.bezierCurveTo(halfB * 0.95, halfL * 0.2, halfB * 0.6, halfL * 0.75, halfB * 0.45, halfL);
      ctx.lineTo(-halfB * 0.45, halfL);
      ctx.bezierCurveTo(-halfB * 0.6, halfL * 0.75, -halfB * 0.95, halfL * 0.2, -halfB, bY);
      ctx.bezierCurveTo(-halfB * 1.05, -halfL * 0.55, -halfB * 0.75, -halfL * 0.8, 0, -halfL);
    }
    ctx.closePath();
    ctx.fillStyle = hull.deckColor || "#38291a";
    ctx.fill();
    ctx.strokeStyle = "rgba(226, 184, 85, 0.4)";
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    // Deck Planks Hatching
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 0.8 * dpr;
    for (let py = -halfL * 0.85; py <= halfL * 0.85; py += 12 * dpr) {
      ctx.beginPath();
      ctx.moveTo(-halfB * 0.6, py);
      ctx.lineTo(halfB * 0.6, py);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Masts & Spars
    const isSchooner = hull.rig.includes("Schooner");
    const foreMastY = -halfL * 0.35;
    const mainMastY = isSchooner ? halfL * 0.15 : -halfL * 0.05;

    // Foremast
    ctx.beginPath();
    ctx.arc(0, foreMastY, 3.8 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Mainmast
    ctx.beginPath();
    ctx.arc(0, mainMastY, 4.2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // 5. Sails & Aerodynamic Camber
    const sheet = sim.telemetry.sheet_deg * DEG_TO_RAD;
    const awa = sim.telemetry.awa_deg * DEG_TO_RAD;
    const tackSign = awa >= 0 ? 1 : -1;
    const boomAngle = tackSign * Math.min(Math.abs(awa), sheet);

    // Draw Mainsail & Boom
    const mainBoomLen = halfL * (isSchooner ? 0.65 : 0.85);
    this.renderSail(ctx, 0, mainMastY, mainBoomLen, boomAngle, sim, dpr, "Mainsail");

    // Draw Foresail (if schooner) or Jib
    if (isSchooner) {
      const foreBoomLen = halfL * 0.42;
      this.renderSail(ctx, 0, foreMastY, foreBoomLen, boomAngle * 0.92, sim, dpr, "Foresail");
      // Jib from Bowsprit to Foremast
      this.renderJib(ctx, 0, -halfL - bowspritLen * 0.8, 0, foreMastY, boomAngle * 0.75, sim, dpr);
    } else {
      // Cutter Jib & Staysail
      this.renderJib(ctx, 0, -halfL - bowspritLen * 0.9, 0, mainMastY, boomAngle * 0.8, sim, dpr);
    }

    // 6. Rudder / Tiller
    const tillerLen = 18 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, halfL);
    ctx.lineTo(-Math.sin(sim.rudder_rad) * tillerLen, halfL + Math.cos(sim.rudder_rad) * tillerLen);
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 3 * dpr;
    ctx.stroke();

    ctx.restore();
  }

  renderSail(ctx, mastX, mastY, boomLen, boomAngle, sim, dpr, label) {
    const isFlatCotton = sim.hull.sailType === "flat_cotton";
    const camberAmount = isFlatCotton ? 0.12 : 0.28; // Baggy flax has deep excessive camber
    const endX = mastX + Math.sin(boomAngle) * boomLen;
    const endY = mastY + Math.cos(boomAngle) * boomLen;

    // Camber Control Point (bows to leeward under wind pressure)
    const midX = (mastX + endX) * 0.5;
    const midY = (mastY + endY) * 0.5;
    const normX = -Math.cos(boomAngle);
    const normY = Math.sin(boomAngle);
    const tackSign = sim.telemetry.awa_deg >= 0 ? 1 : -1;
    const ctrlX = midX + normX * (boomLen * camberAmount * tackSign);
    const ctrlY = midY + normY * (boomLen * camberAmount * tackSign);

    // Boom Spar
    ctx.beginPath();
    ctx.moveTo(mastX, mastY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2.5 * dpr;
    ctx.stroke();

    // Sail Canvas Curve
    ctx.beginPath();
    ctx.moveTo(mastX, mastY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);

    ctx.strokeStyle = isFlatCotton ? "#fef08a" : "#cbd5e1";
    ctx.lineWidth = 3.5 * dpr;
    ctx.stroke();

    // Telltales on Sail
    if (this.showTelltales) {
      const isLuffing = sim.telemetry.isLuffing;
      const isStalled = sim.telemetry.stalled;
      const tellX = (mastX + ctrlX) * 0.5;
      const tellY = (mastY + ctrlY) * 0.5;

      const ribbonLen = 14 * dpr;
      let flutterAngle = boomAngle;

      if (isLuffing) {
        flutterAngle += Math.sin(this.telltalePhase * 3.0) * 0.8;
      } else if (isStalled) {
        flutterAngle += (Math.random() - 0.5) * 1.2;
      } else {
        flutterAngle += Math.sin(this.telltalePhase) * 0.1; // Smooth attached stream
      }

      ctx.beginPath();
      ctx.moveTo(tellX, tellY);
      ctx.lineTo(tellX + Math.sin(flutterAngle) * ribbonLen, tellY + Math.cos(flutterAngle) * ribbonLen);
      ctx.strokeStyle = isLuffing ? "#ef4444" : (isStalled ? "#f97316" : "#22c55e");
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
    }
  }

  renderJib(ctx, tackX, tackY, clewMastX, clewMastY, jibAngle, sim, dpr) {
    const endX = tackX + Math.sin(jibAngle) * (clewMastY - tackY) * 0.85;
    const endY = tackY + Math.cos(jibAngle) * (clewMastY - tackY) * 0.85;

    ctx.beginPath();
    ctx.moveTo(tackX, tackY);
    ctx.quadraticCurveTo((tackX + endX) * 0.5 + 10 * dpr, (tackY + endY) * 0.5, endX, endY);
    ctx.strokeStyle = sim.hull.sailType === "flat_cotton" ? "#fef08a" : "#cbd5e1";
    ctx.lineWidth = 2.8 * dpr;
    ctx.stroke();
  }

  renderPhysicsVectors(ctx, sim, pxPerMeter, dpr) {
    const telem = sim.telemetry;
    const originX = 0;
    const originY = 0;

    const drawArrow = (fromX, fromY, toX, toY, color, label, strokeW = 2.5) => {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.hypot(dx, dy);
      if (len < 4 * dpr) return;

      const angle = Math.atan2(dy, dx);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeW * dpr;

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Arrowhead
      const headLen = 8 * dpr;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLen * Math.cos(angle - 0.4), toY - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(toX - headLen * Math.cos(angle + 0.4), toY - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();

      // Label
      if (label) {
        ctx.font = `bold ${10 * dpr}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillText(label, toX + Math.cos(angle) * 14 * dpr, toY + Math.sin(angle) * 14 * dpr);
      }
      ctx.restore();
    };

    // 1. Boat Velocity Vector V_b (Yellow)
    const bspeedScale = 4.5 * dpr;
    const bvx = 0;
    const bvy = -telem.speed_knots * bspeedScale;
    drawArrow(originX, originY, bvx, bvy, "#facc15", `V_b ${telem.speed_knots.toFixed(1)}k`);

    // 2. Apparent Wind Vector V_a (Cyan)
    const awdRad = telem.awd_deg * DEG_TO_RAD;
    const awRelAngle = awdRad - sim.heading_rad;
    const awsScale = 3.2 * dpr;
    const avx = -Math.sin(awRelAngle) * telem.aws_knots * awsScale;
    const avy = -Math.cos(awRelAngle) * telem.aws_knots * awsScale;
    drawArrow(originX, originY, avx, avy, "#38bdf8", `V_a ${telem.aws_knots.toFixed(1)}k`);

    // 3. True Wind Vector V_t (Emerald)
    const twdRad = telem.twd_deg * DEG_TO_RAD;
    const twRelAngle = twdRad - sim.heading_rad;
    const twsScale = 3.2 * dpr;
    const tvx = -Math.sin(twRelAngle) * telem.tws_knots * twsScale;
    const tvy = -Math.cos(twRelAngle) * telem.tws_knots * twsScale;
    drawArrow(originX, originY, tvx, tvy, "#10b981", `V_t ${telem.tws_knots.toFixed(1)}k`);

    // 4. Forward Thrust F_T (Green) & Lateral Side Force F_H (Purple)
    const forceScale = 0.0028 * dpr;
    const thrustY = -telem.thrust * forceScale;
    const sideX = telem.sideForce * forceScale;
    drawArrow(originX, originY, 0, thrustY, "#4ade80", `F_thrust`, 2.0);
    drawArrow(originX, originY, sideX, 0, "#c084fc", `F_heel`, 2.0);
  }

  renderTacticalMiniMap(ctx, sim, w, h, dpr) {
    const mapW = 210 * dpr;
    const mapH = 150 * dpr;
    const mapX = w - mapW - 16 * dpr;
    const mapY = 16 * dpr;

    ctx.save();
    // Background Frame
    ctx.fillStyle = "rgba(10, 16, 28, 0.92)";
    ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
    ctx.lineWidth = 1.2 * dpr;
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Title
    ctx.fillStyle = "#e2b855";
    ctx.font = `bold ${10 * dpr}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = "left";
    ctx.fillText("1851 ISLE OF WIGHT REGATTA", mapX + 8 * dpr, mapY + 14 * dpr);

    // Isle of Wight Silhouette (simplified 53-mile course)
    const ox = mapX + mapW * 0.5;
    const oy = mapY + mapH * 0.58;
    const scale = mapW * 0.008;

    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#334155";
    ctx.beginPath();
    // Isle of Wight diamond contour
    ctx.moveTo(ox - 35 * scale, oy - 2 * scale); // The Needles (West)
    ctx.lineTo(ox - 8 * scale, oy - 22 * scale); // Cowes (North)
    ctx.lineTo(ox + 18 * scale, oy - 14 * scale); // Ryde / Spithead (North-East)
    ctx.lineTo(ox + 36 * scale, oy + 4 * scale); // Culver Cliff (East)
    ctx.lineTo(ox + 2 * scale, oy + 26 * scale); // St. Catherine's Point (South)
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 1851 Historic Course Line
    ctx.beginPath();
    ctx.moveTo(ox - 8 * scale, oy - 22 * scale); // Start: Cowes
    ctx.lineTo(ox + 18 * scale, oy - 14 * scale); // No Man's Land
    ctx.lineTo(ox + 42 * scale, oy - 6 * scale);  // Nab Light
    ctx.lineTo(ox + 36 * scale, oy + 4 * scale);  // Dunnose
    ctx.lineTo(ox + 2 * scale, oy + 32 * scale);  // St Catherine's
    ctx.lineTo(ox - 42 * scale, oy + 4 * scale);  // The Needles
    ctx.lineTo(ox - 8 * scale, oy - 22 * scale); // Finish: Cowes
    ctx.strokeStyle = "rgba(226, 184, 85, 0.5)";
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([3 * dpr, 2 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Landmarks
    ctx.fillStyle = "#facc15";
    ctx.font = `${8 * dpr}px -apple-system, sans-serif`;
    ctx.fillText("Cowes (Start/Finish)", ox - 14 * scale, oy - 25 * scale);
    ctx.fillText("The Needles", ox - 52 * scale, oy + 6 * scale);
    ctx.fillText("St. Catherine's", ox - 8 * scale, oy + 36 * scale);

    // Live Boat Indicator
    ctx.beginPath();
    ctx.arc(ox - 8 * scale, oy - 22 * scale, 4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    ctx.restore();
  }
}
