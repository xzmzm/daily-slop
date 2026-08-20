/**
 * Mechanical Cutaway & X-Ray Visualizer for the 1888 Burroughs Adding Machine.
 * Renders the internal gear train, sector racks, key stop pins, carry mechanism,
 * oil dashpot fluid dynamics, and print carriage with high visual fidelity.
 */

import { PHASES, NUM_COLUMNS } from './mechanism.js';

export class BurroughsRenderer {
  constructor(canvas, mechanism) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mech = mechanism;

    // View settings
    this.activeCol = 6; // Column to view in side cutaway (default: hundreds column)
    this.zoom = 1.0;
    this.showLabels = true;
    this.showFlowParticles = true;

    // Dashpot fluid simulation particles
    this.particles = [];
    this._initParticles();

    // Resize handling
    this.width = 0;
    this.height = 0;
    this.resize();
  }

  _initParticles() {
    this.particles = [];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * 36 - 18,
        y: Math.random() * 90 - 45,
        vx: 0,
        vy: 0,
        size: Math.random() * 2.5 + 1.2,
        alpha: Math.random() * 0.6 + 0.3
      });
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = rect.height || 480;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setActiveColumn(col) {
    if (col >= 0 && col < NUM_COLUMNS) {
      this.activeCol = col;
    }
  }

  render(dt = 0.016) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Dark vintage drafting blueprint / workshop backdrop
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#101318');
    grad.addColorStop(1, '#080a0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines (blueprint style)
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.save();
    // Center layout coordinates
    const cx = w * 0.5;
    const cy = h * 0.52;
    const scale = Math.min(w / 820, h / 500) * 0.95;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 2. Machine Chassis Outer Silhouette (Cast iron & bevelled glass)
    this._drawChassis(ctx);

    // 3. Key Stem & Stop Pins (under selected column)
    this._drawKeyboardPivots(ctx);

    // 4. Sector Rack Lever (pivoting gear quadrant)
    this._drawSectorRack(ctx);

    // 5. Accumulator Pinion & Cradle
    this._drawAccumulator(ctx);

    // 6. Tens-Carry Latch & Sweep Cam
    this._drawCarryMechanism(ctx);

    // 7. Type Sector, Hammer & Paper Roll
    this._drawPrintCarriage(ctx);

    // 8. Hydraulic Dashpot (The oil damper)
    this._drawDashpot(ctx, dt);

    // 9. Component Callout Labels (if enabled)
    if (this.showLabels) {
      this._drawLabels(ctx);
    }

    ctx.restore();

    // 10. Phase Badge & Legend Overlay
    this._drawHUD(ctx, w, h);
  }

  _drawChassis(ctx) {
    ctx.save();
    // Glass side panel outline
    ctx.fillStyle = 'rgba(24, 30, 40, 0.45)';
    ctx.strokeStyle = '#3a4454';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-360, 180);
    ctx.lineTo(340, 180);
    ctx.lineTo(340, -140);
    ctx.lineTo(160, -180);
    ctx.lineTo(-240, -180);
    ctx.lineTo(-360, -80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Brass corner brackets & bolts
    const bolts = [
      [-350, 170], [330, 170], [330, -130], [150, -170], [-230, -170], [-350, -70]
    ];
    for (const [bx, by] of bolts) {
      ctx.fillStyle = '#c5a059';
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6a5223';
      ctx.stroke();
    }

    // Main Pivot Shafts (Fixed machine axles)
    ctx.fillStyle = '#616c7d';
    // Main sector shaft
    ctx.beginPath();
    ctx.arc(-60, 40, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c5a059';
    ctx.beginPath();
    ctx.arc(-60, 40, 4, 0, Math.PI * 2);
    ctx.fill();

    // Keyboard stop line guide
    ctx.strokeStyle = 'rgba(100, 120, 150, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(-280, -90);
    ctx.lineTo(0, -90);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  _drawKeyboardPivots(ctx) {
    ctx.save();
    const activeKey = this.mech.keyboard[this.activeCol]; // 0..9

    // Draw 9 key stems slanting downward into the stop chamber
    for (let k = 1; k <= 9; k++) {
      const kx = -260 + (k - 1) * 26;
      const isDown = (activeKey === k);
      const kyTop = isDown ? -120 : -140;
      const kyBottom = isDown ? -65 : -95; // Down key drops its stop pin into the sector rack path!

      // Key Stem
      ctx.strokeStyle = isDown ? '#e5c07b' : '#7f8c9d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(kx, kyTop);
      ctx.lineTo(kx, kyBottom);
      ctx.stroke();

      // Key Button Top (Ivory/Celluloid button)
      const colGroup = Math.floor(this.activeCol / 3);
      const isBlackKey = colGroup === 0 || colGroup === 2;
      ctx.fillStyle = isDown ? '#d4af37' : (isBlackKey ? '#1e2124' : '#e6dfd1');
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(kx, kyTop, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Key Number Label
      ctx.fillStyle = isDown ? '#000' : (isBlackKey ? '#fff' : '#111');
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(k.toString(), kx, kyTop);

      // Return spring on stem
      ctx.strokeStyle = 'rgba(180, 150, 90, 0.4)';
      ctx.lineWidth = 1;
      for (let s = 0; s < 4; s++) {
        const sy = kyTop + 10 + s * 4;
        ctx.beginPath();
        ctx.arc(kx, sy, 3, 0, Math.PI);
        ctx.stroke();
      }

      // Stop Pin Lug at bottom
      ctx.fillStyle = isDown ? '#ffcc00' : '#556070';
      ctx.fillRect(kx - 3, kyBottom - 3, 6, 6);
    }

    ctx.restore();
  }

  _drawSectorRack(ctx) {
    ctx.save();
    const pivotX = -60;
    const pivotY = 40;
    const rackProgress = this.mech.rackPositions[this.activeCol]; // 0.0 to 9.0
    // Angle rotation around pivot: 0 digit = 0 rad, 9 digit = ~0.35 rad down
    const angle = (rackProgress / 9.0) * 0.36;

    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);

    // Long Sector Arm
    ctx.fillStyle = '#8c7647';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;

    // Sector body shape
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-200, -110);
    ctx.lineTo(-215, -70);
    ctx.lineTo(-140, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stepped Stop Tail (hits the depressed key pin!)
    ctx.fillStyle = '#b89441';
    for (let s = 1; s <= 9; s++) {
      const sx = -200 + (s - 1) * 22;
      const sy = -110 + (s - 1) * 7.5;
      ctx.fillRect(sx, sy, 4, 8);
    }

    // Rear Gear Quadrant (Toothed Arc that meshes with Accumulator Pinion)
    const arcRadius = 110;
    const startAngle = -0.3;
    const endAngle = 0.5;

    ctx.beginPath();
    ctx.arc(0, 0, arcRadius, startAngle, endAngle);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Gear Teeth on Arc
    ctx.strokeStyle = '#ffe89c';
    ctx.lineWidth = 2.5;
    for (let t = 0; t <= 12; t++) {
      const ta = startAngle + (t / 12) * (endAngle - startAngle);
      const tx1 = Math.cos(ta) * (arcRadius - 4);
      const ty1 = Math.sin(ta) * (arcRadius - 4);
      const tx2 = Math.cos(ta) * (arcRadius + 6);
      const ty2 = Math.sin(ta) * (arcRadius + 6);
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();
    }

    // Rear Tail driving the Type Sector
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(130, -50);
    ctx.stroke();

    ctx.restore();
  }

  _drawAccumulator(ctx) {
    ctx.save();
    // Pinion Gear Position
    // The cradle swings in and out:
    // Meshed: x = 50, y = 35. Unmeshed: x = 50, y = 52 (swung down 17px)
    const isMeshed = this.mech.pinionsMeshed;
    const cradleOffsetY = isMeshed ? 0 : 16;
    const gx = 50;
    const gy = 35 + cradleOffsetY;

    // Rocker Cradle Arm
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(50, 95);
    ctx.lineTo(gx, gy);
    ctx.stroke();

    // Pivot bolt of cradle
    ctx.fillStyle = '#a0aec0';
    ctx.beginPath();
    ctx.arc(50, 95, 4, 0, Math.PI * 2);
    ctx.fill();

    // Accumulator Pinion Gear (10-toothed brass wheel)
    const angle = this.mech.pinionAngles[this.activeCol];
    const accVal = this.mech.accumulator[this.activeCol];

    ctx.translate(gx, gy);
    ctx.rotate(angle);

    // Gear Disk
    ctx.fillStyle = isMeshed ? '#e5c07b' : '#9c814b';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 10 Teeth around circumference
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x1 = Math.cos(a) * 17;
      const y1 = Math.sin(a) * 17;
      const x2 = Math.cos(a) * 26;
      const y2 = Math.sin(a) * 26;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Number Dial markings (0 to 9)
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tx = Math.cos(a) * 11;
      const ty = Math.sin(a) * 11;
      ctx.fillStyle = (i === accVal) ? '#ffcc00' : '#2d3748';
      ctx.fillText(i.toString(), tx, ty);
    }

    // Carry Trip Lug (cam dog at position 9)
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(16, -3, 6, 6);

    ctx.restore();

    // Draw dial reading magnifier window
    ctx.save();
    ctx.fillStyle = '#0a0d12';
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 115, 36, 24);
    ctx.fillRect(32, 115, 36, 24);

    ctx.fillStyle = '#fffae0';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(accVal.toString(), 50, 127);

    ctx.fillStyle = '#a0aec0';
    ctx.font = '9px sans-serif';
    ctx.fillText(`Col ${this.activeCol + 1}`, 50, 150);
    ctx.restore();
  }

  _drawCarryMechanism(ctx) {
    ctx.save();
    const isPrimed = this.mech.carryPrimed[this.activeCol];
    const isRippling = this.mech.phase === PHASES.CARRY && this.mech.carryColIndex === this.activeCol;

    // Carry Latch Lever
    const lx = 86;
    const ly = 32;

    ctx.strokeStyle = isPrimed ? '#ff5252' : '#718096';
    ctx.lineWidth = 3;

    // Latch pivots at (86, 60)
    ctx.beginPath();
    ctx.moveTo(86, 60);
    // If primed, latch is tripped down/left
    const latchTipY = isPrimed ? 38 : 30;
    ctx.lineTo(lx, latchTipY);
    ctx.lineTo(lx - 12, latchTipY + 4);
    ctx.stroke();

    // Primed LED / Glow Indicator
    if (isPrimed) {
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff5555';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lx, latchTipY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Carry Sweep Geneva Cam / Pawl
    ctx.fillStyle = isRippling ? '#ffe855' : '#4a5568';
    ctx.beginPath();
    ctx.arc(105, 55, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawPrintCarriage(ctx) {
    ctx.save();
    const rackProgress = this.mech.rackPositions[this.activeCol];
    const typeBarY = -80 + (rackProgress / 9.0) * 55; // Moves up/down with sector rack

    // Vertical Type Bar
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(170, 40);
    ctx.lineTo(170, -110);
    ctx.stroke();

    // Embossed Steel Type Head (carrying 0..9 digits)
    ctx.fillStyle = '#2d3748';
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 1.5;
    ctx.fillRect(162, -100, 16, 80);
    ctx.strokeRect(162, -100, 16, 80);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    for (let d = 0; d <= 9; d++) {
      ctx.fillText(d.toString(), 170, -94 + d * 8);
    }

    // Print Line Platen & Inked Ribbon (Black/Red)
    const platenX = 220;
    const platenY = -60;

    // Platen rubber roller
    ctx.fillStyle = '#1a202c';
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(platenX, platenY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inked Ribbon Band
    ctx.strokeStyle = '#9b1c1c'; // Red ribbon band
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(platenX - 22, platenY - 24);
    ctx.lineTo(platenX - 22, platenY + 24);
    ctx.stroke();

    // Paper Tape feeding out from platen
    ctx.fillStyle = '#fffdf0';
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(platenX - 12, platenY - 30);
    ctx.quadraticCurveTo(platenX - 10, platenY - 70, platenX + 15, platenY - 110);
    ctx.lineTo(platenX + 40, platenY - 106);
    ctx.quadraticCurveTo(platenX + 15, platenY - 65, platenX + 12, platenY - 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spring Print Hammer
    const isStriking = (this.mech.phase === PHASES.STRIKE);
    const hammerAngle = isStriking ? -0.35 : 0.25; // Strikes towards platen
    ctx.translate(130, platenY);
    ctx.rotate(hammerAngle);

    ctx.strokeStyle = isStriking ? '#ffcc00' : '#718096';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(55, 0);
    ctx.stroke();

    // Hammer head
    ctx.fillStyle = isStriking ? '#ff5555' : '#4a5568';
    ctx.fillRect(50, -6, 12, 12);

    ctx.restore();
  }

  _drawDashpot(ctx, dt) {
    ctx.save();
    // Dashpot Cylinder mounted near front-bottom (-180, 110)
    const cylX = -180;
    const cylY = 100;
    const cylW = 38;
    const cylH = 100;

    // Handle position drives the dashpot piston rod
    // handlePos: 0 (rest, piston high) to 1 (pulled, piston bottom)
    const hPos = this.mech.handlePos;
    const pistonY = cylY - 30 + hPos * 60;

    // Outer Brass Cylinder Chamber
    ctx.fillStyle = 'rgba(30, 24, 15, 0.85)';
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 2.5;
    ctx.fillRect(cylX - cylW / 2, cylY - cylH / 2, cylW, cylH);
    ctx.strokeRect(cylX - cylW / 2, cylY - cylH / 2, cylW, cylH);

    // Amber Mineral/Castor Oil in chamber
    const oilGrad = ctx.createLinearGradient(cylX - cylW / 2, 0, cylX + cylW / 2, 0);
    oilGrad.addColorStop(0, 'rgba(212, 140, 20, 0.45)');
    oilGrad.addColorStop(0.5, 'rgba(255, 180, 50, 0.25)');
    oilGrad.addColorStop(1, 'rgba(212, 140, 20, 0.45)');
    ctx.fillStyle = oilGrad;
    ctx.fillRect(cylX - cylW / 2 + 2, cylY - cylH / 2 + 2, cylW - 4, cylH - 4);

    // Fluid particles moving through bypass valve
    if (this.showFlowParticles) {
      const isReturning = (this.mech.phase === PHASES.RETURN);
      const velocity = isReturning ? 120 / Math.max(0.1, this.mech.dashpotViscosity) : -30;

      ctx.fillStyle = 'rgba(255, 230, 150, 0.75)';
      for (const p of this.particles) {
        if (this.mech.phase !== PHASES.IDLE) {
          p.y += velocity * dt * (p.x < 0 ? 1 : -1);
          if (p.y > 45) p.y = -45;
          if (p.y < -45) p.y = 45;
        }
        ctx.beginPath();
        ctx.arc(cylX + p.x * 0.7, cylY + p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Piston Head & Bleed Port Holes
    ctx.fillStyle = '#718096';
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cylX - 16, pistonY - 5, 32, 10);
    ctx.strokeRect(cylX - 16, pistonY - 5, 32, 10);

    // Orifice holes
    ctx.fillStyle = '#1a202c';
    ctx.beginPath();
    ctx.arc(cylX - 8, pistonY, 2, 0, Math.PI * 2);
    ctx.arc(cylX + 8, pistonY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Piston Rod extending upwards
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cylX, pistonY);
    ctx.lineTo(cylX, cylY - 75);
    ctx.stroke();

    // Linkage connecting piston rod to operating crank lever
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cylX, cylY - 75);
    ctx.lineTo(-60, 40 - hPos * 30);
    ctx.stroke();

    ctx.restore();
  }

  _drawLabels(ctx) {
    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#e2e8f0';

    const labels = [
      { text: 'Key Stop Pins (1-9)', x: -160, y: -160, tx: -160, ty: -100 },
      { text: 'Pivoting Sector Rack', x: -180, y: -25, tx: -110, ty: 5 },
      { text: 'Oil Dashpot Governor', x: -180, y: 175, tx: -180, ty: 120 },
      { text: 'Accumulator Pinion', x: 50, y: 15, tx: 50, ty: 35 },
      { text: 'Tens-Carry Latch', x: 100, y: 85, tx: 86, ty: 45 },
      { text: 'Print Platen & Tape', x: 230, y: -130, tx: 215, ty: -70 }
    ];

    for (const l of labels) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 1;

      const tw = ctx.measureText(l.text).width;
      ctx.fillRect(l.x - tw / 2 - 4, l.y - 12, tw + 8, 16);
      ctx.strokeRect(l.x - tw / 2 - 4, l.y - 12, tw + 8, 16);

      ctx.fillStyle = '#fffae0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.text, l.x, l.y - 4);

      // Pointer line
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
      ctx.beginPath();
      ctx.moveTo(l.x, l.y + 4);
      ctx.lineTo(l.tx, l.ty);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawHUD(ctx, w, h) {
    ctx.save();

    // Top Phase Badge
    const phaseNames = {
      [PHASES.IDLE]: 'READY (IDLE)',
      [PHASES.PULL]: 'PHASE 1: DOWNSTROKE (RACK DROP & KEY STOPS)',
      [PHASES.STRIKE]: 'PHASE 2: HAMMER STRIKE & PINION MESH',
      [PHASES.RETURN]: 'PHASE 3: RETURN STROKE (DASHPOT-DAMPED ROTATION)',
      [PHASES.CARRY]: 'PHASE 4: TENS-CARRY RIPPLE (RIGHT-TO-LEFT SWEEP)'
    };

    const phaseColors = {
      [PHASES.IDLE]: '#4ade80',
      [PHASES.PULL]: '#38bdf8',
      [PHASES.STRIKE]: '#fbbf24',
      [PHASES.RETURN]: '#f472b6',
      [PHASES.CARRY]: '#a78bfa'
    };

    const curPhase = this.mech.phase;
    const title = phaseNames[curPhase] || 'CYCLE';
    const col = phaseColors[curPhase] || '#fff';

    ctx.font = 'bold 12px monospace';
    const textWidth = ctx.measureText(title).width;

    ctx.fillStyle = 'rgba(15, 20, 28, 0.9)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;

    const bx = 16;
    const by = 16;
    ctx.fillRect(bx, by, textWidth + 24, 28);
    ctx.strokeRect(bx, by, textWidth + 24, 28);

    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, bx + 12, by + 14);

    // Overthrow Warning Alert
    if (this.mech.lastOverthrowError) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 1.5;
      const errText = '⚠ INERTIAL OVERTHROW: GEAR SLIP DETECTED (DASHPOT DISABLED/TOO FAST)';
      const ew = ctx.measureText(errText).width;
      ctx.fillRect(bx, by + 36, ew + 24, 26);
      ctx.strokeRect(bx, by + 36, ew + 24, 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(errText, bx + 12, by + 49);
    }

    ctx.restore();
  }
}
