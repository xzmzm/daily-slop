/**
 * Polar Velocity Diagram & VMG Studio Canvas Renderer
 */

import { SailPhysics, HULL_PRESETS, DEG_TO_RAD, RAD_TO_DEG } from "./physics.js";

export class PolarRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hoverTwaDeg = null;
    this.cachedPolars = {};
    this.currentTws = 14.0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
  }

  updatePolars(tws_knots) {
    this.currentTws = tws_knots;
    this.cachedPolars = {
      america: SailPhysics.generatePolarDiagram(HULL_PRESETS.america, tws_knots),
      aurora: SailPhysics.generatePolarDiagram(HULL_PRESETS.aurora, tws_knots),
      volante: SailPhysics.generatePolarDiagram(HULL_PRESETS.volante, tws_knots),
    };
  }

  render(sim) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Center and radius for half-polar (0 to 180 deg) or full polar
    const cx = w * 0.48;
    const cy = h * 0.52;
    const maxSpeed = 16.0; // knots
    const radius = Math.min(w * 0.42, h * 0.42);
    const scale = radius / maxSpeed;

    // Background chart gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.1);
    bgGrad.addColorStop(0, "rgba(18, 25, 42, 0.95)");
    bgGrad.addColorStop(1, "rgba(9, 13, 24, 0.98)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 1. Draw In-Irons / No-Go Zone (0 to 38 deg)
    const noGoAmerica = HULL_PRESETS.america.minTwaDeg * DEG_TO_RAD;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, -Math.PI * 0.5 - noGoAmerica, -Math.PI * 0.5 + noGoAmerica);
    ctx.closePath();
    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
    ctx.fill();

    // 2. Draw Speed Rings (4, 8, 12, 16 knots)
    ctx.lineWidth = 1 * dpr;
    for (let speed = 4; speed <= 16; speed += 4) {
      const r = speed * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = speed === 16 ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.15)";
      ctx.stroke();

      // Ring label
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = `${10 * dpr}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`${speed} kts`, cx + 6 * dpr, cy - r + 12 * dpr);
    }

    // 3. Radial Angle Lines (0°, 30°, 60°, 90°, 120°, 150°, 180°)
    for (let deg = 0; deg <= 180; deg += 30) {
      const rad = (deg - 90) * DEG_TO_RAD;
      const x1 = cx + Math.cos(rad) * radius;
      const y1 = cy + Math.sin(rad) * radius;
      const x2 = cx - Math.cos(rad) * radius;
      const y2 = cy + Math.sin(rad) * radius;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = deg === 90 ? "rgba(148, 163, 184, 0.4)" : "rgba(148, 163, 184, 0.15)";
      ctx.stroke();

      // Label
      ctx.fillStyle = deg === 0 ? "#38bdf8" : "rgba(203, 213, 225, 0.75)";
      ctx.font = `${11 * dpr}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      const lx = cx + Math.cos(rad) * (radius + 16 * dpr);
      const ly = cy + Math.sin(rad) * (radius + 16 * dpr);
      const label = deg === 0 ? "WIND (0°)" : `${deg}°`;
      ctx.fillText(label, lx, ly + 4 * dpr);
    }

    // 4. Ensure Cached Polars are up to date
    if (!this.cachedPolars.america || this.cachedPolars.america.tws_knots !== sim.tws_knots) {
      this.updatePolars(sim.tws_knots);
    }

    // 5. Draw Comparative Polar Curves
    const drawCurve = (polarData, color, strokeW, isDashed = false) => {
      if (!polarData) return;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeW * dpr;
      if (isDashed) ctx.setLineDash([4 * dpr, 4 * dpr]);

      let first = true;
      for (const pt of polarData.points) {
        if (pt.inIrons || pt.speed_knots <= 0) continue;
        const rad = (pt.twa_deg - 90) * DEG_TO_RAD;
        const px = cx + Math.cos(rad) * (pt.speed_knots * scale);
        const py = cy + Math.sin(rad) * (pt.speed_knots * scale);
        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    // British Cutters
    drawCurve(this.cachedPolars.aurora, "#60a5fa", 1.8, true);
    drawCurve(this.cachedPolars.volante, "#34d399", 1.8, true);
    // Schooner America (Bold Gold)
    drawCurve(this.cachedPolars.america, "#e2b855", 3.0, false);

    // 6. Upwind VMG Optimal Tangent Line for America
    const optUp = this.cachedPolars.america?.optimalUpwind;
    if (optUp && optUp.vmg > 0) {
      const upRad = (optUp.twa_deg - 90) * DEG_TO_RAD;
      const upX = cx + Math.cos(upRad) * (optUp.bspeed * scale);
      const upY = cy + Math.sin(upRad) * (optUp.bspeed * scale);

      // Tangent horizontal line (constant VMG line)
      const vmgY = cy - (optUp.vmg * scale);
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.8, vmgY);
      ctx.lineTo(cx + radius * 0.8, vmgY);
      ctx.strokeStyle = "rgba(226, 184, 85, 0.4)";
      ctx.lineWidth = 1.2 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point marker
      ctx.beginPath();
      ctx.arc(upX, upY, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "#e2b855";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // VMG Label
      ctx.fillStyle = "#fde047";
      ctx.font = `bold ${11 * dpr}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`Peak Upwind VMG: ${optUp.vmg.toFixed(2)} kts @ ${optUp.twa_deg}°`, upX + 10 * dpr, upY - 4 * dpr);
    }

    // 7. Live Boat Operating Point
    const twaDeg = Math.abs(sim.telemetry.twa_deg);
    const bspeed = sim.telemetry.speed_knots;
    const curRad = (twaDeg - 90) * DEG_TO_RAD;
    const curX = cx + Math.cos(curRad) * (bspeed * scale);
    const curY = cy + Math.sin(curRad) * (bspeed * scale);

    // Connecting vector from origin
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(curX, curY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Pulse ring around current point
    const pulse = (Math.sin(Date.now() * 0.006) + 1.0) * 0.5;
    ctx.beginPath();
    ctx.arc(curX, curY, (6 + pulse * 4) * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(curX, curY, 5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Current State Callout
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${12 * dpr}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`${bspeed.toFixed(1)} kts (TWA ${twaDeg.toFixed(0)}°)`, curX + 12 * dpr, curY + 4 * dpr);

    // 8. Legend
    const legX = 16 * dpr;
    const legY = h - 65 * dpr;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1 * dpr;
    ctx.fillRect(legX - 6 * dpr, legY - 14 * dpr, 240 * dpr, 68 * dpr);
    ctx.strokeRect(legX - 6 * dpr, legY - 14 * dpr, 240 * dpr, 68 * dpr);

    const drawLegendItem = (x, y, label, color, isDashed = false) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 22 * dpr, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 * dpr;
      if (isDashed) ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = `${11 * dpr}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(label, x + 28 * dpr, y + 3 * dpr);
    };

    drawLegendItem(legX, legY, "Schooner America (1851)", "#e2b855");
    drawLegendItem(legX, legY + 18 * dpr, "Cutter Aurora (Cod's Head)", "#60a5fa", true);
    drawLegendItem(legX, legY + 36 * dpr, "Cutter Volante (British)", "#34d399", true);

    ctx.restore();
  }
}
