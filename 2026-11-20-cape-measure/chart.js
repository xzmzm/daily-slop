/* The engraved chart is painted once per size. The dividers have their own layer. */
function mountChart(terrainCanvas, routeCanvas, chart) {
  const { width, height, hash, unitsPerKm } = Coast;
  const bands = new Map();
  for (const [level, rings] of chart.bands) {
    const path = new Path2D();
    for (const ring of rings) {
      path.moveTo(ring[0].x, ring[0].y);
      for (const p of ring.slice(1)) path.lineTo(p.x, p.y);
      path.closePath();
    }
    bands.set(level, path);
  }
  const colors = [
    '#c1d9d2', '#c6ded4', '#cee2d5', '#d6e6d6', '#e1eada',
    '#f3e8c9', '#eee4c3', '#e6dfba', '#dedbb2', '#d1d2a6', '#c5cca1',
    '#b8c197', '#a9b68b', '#9baa80', '#92a178', '#82946d',
  ];
  let walk, reference, position;
  let scale = 1, pixelRatio = 1, left = 0, top = 0, small = false;

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function circle(ctx, x, y, r, fill, outline) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.stroke();
    }
  }

  function label(ctx, text, x, y, font, color, angle = 0, halo = '') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = font;
    ctx.textAlign = 'center';
    if (halo) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = halo;
      ctx.strokeText(text, 0, 0);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function compass(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#496760';
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, 2 * Math.PI);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 4);
      const r = i % 2 ? 14 : 27;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath();
      ctx.fillStyle = '#edebd6'; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(4, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = '#486760'; ctx.fill();
      ctx.restore();
    }
    circle(ctx, 0, 0, 2.8, '#c6a170', '#486760');
    label(ctx, 'N', 0, -33, small ? '23px Georgia' : '16px Georgia', '#385a52');
    ctx.restore();
  }

  function drawTerrain() {
    const ctx = terrainCanvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = '#c0d6d0';
    ctx.fillRect(-left / scale, -top / scale, terrainCanvas.width / (pixelRatio * scale), terrainCanvas.height / (pixelRatio * scale));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#6f94873d';
    ctx.lineWidth = .7;
    for (let i = 0; i < 680; i++) {
      const x = width * hash(i, 8), y = height * hash(i, 9);
      line(ctx, x, y, x + 2 + 6 * hash(i, 7), y - .4);
    }
    let tint = 0;
    for (const [level, path] of bands) {
      ctx.fillStyle = colors[tint++];
      ctx.fill(path, 'evenodd');
      ctx.strokeStyle = level < 0 ? '#779b8e94' : level === 0 ? '#405b4e' : '#858e6aa9';
      ctx.lineWidth = level === 0 ? 1.8 : .75;
      ctx.stroke(path);
    }

    ctx.save();
    ctx.clip(bands.get(13), 'evenodd');
    ctx.strokeStyle = '#6877526b';
    ctx.lineWidth = .65;
    for (let i = 0; i < 3500; i++) {
      const x = width * hash(i, 3), y = height * hash(i, 4);
      const run = 2.7 + 3 * hash(i, 5);
      line(ctx, x, y, x + run, y - run * .65);
    }
    ctx.restore();
    ctx.fillStyle = '#30493912';
    for (let i = 0; i < 7500; i++) ctx.fillRect(width * hash(i, 18), height * hash(i, 19), .8, .8);

    // Grid intersections are 20 km apart; edge ticks divide them into quarters.
    const grid = unitsPerKm * 20, edge = 12;
    ctx.strokeStyle = '#536e653d';
    ctx.lineWidth = .8;
    ctx.setLineDash([2, 4]);
    for (let x = width / 2 % grid; x < width - edge; x += grid) line(ctx, x, edge, x, height - edge);
    for (let y = height / 2 % grid; y < height - edge; y += grid) line(ctx, edge, y, width - edge, y);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#54756a';
    ctx.strokeRect(edge, edge, width - 2 * edge, height - 2 * edge);
    for (let x = width / 2 % (grid / 4); x < width - edge; x += grid / 4) {
      const tick = (x - width / 2) % grid === 0 ? 7 : 3;
      line(ctx, x, edge, x, edge + tick);
      line(ctx, x, height - edge, x, height - edge - tick);
    }
    for (let y = height / 2 % (grid / 4); y < height - edge; y += grid / 4) {
      const tick = (y - height / 2) % grid === 0 ? 7 : 3;
      line(ctx, edge, y, edge + tick, y);
      line(ctx, width - edge, y, width - edge - tick, y);
    }

    label(ctx, 'W R E N   I S L A N D', 443, 247, small ? 'italic 33px Georgia' : 'italic 26px Georgia', '#364d3b', -.29, '#e4dfbdc9');
    label(ctx, 'North Sound', 195, 126, small ? 'italic 26px Georgia' : 'italic 21px Georgia', '#53776f', -.14);
    if (!small) {
      label(ctx, 'Kettle Bay', 702, 208, 'italic 16px Georgia', '#486d64', -.06, '#cee1d4');
      label(ctx, 'Tern Ness', 713, 80, 'italic 15px Georgia', '#486056', -.1);
      label(ctx, 'W R E N   P A S S A G E', 567, 425, 'italic 17px Georgia', '#66867b', -.11);
    }
    const origin = chart.shore[0];
    ctx.strokeStyle = '#456055';
    line(ctx, origin.x - 5, origin.y + 3, origin.x - 30, origin.y + 15);
    label(ctx, 'Gull Point', origin.x - 56, origin.y + 28, small ? 'italic 24px Georgia' : 'italic 17px Georgia', '#3e5a4e', 0, '#d7e5d5');
    compass(ctx, 796, 80);

    const endX = 814, barY = 482, barWidth = 20 * unitsPerKm;
    ctx.fillStyle = '#3c5a50';
    ctx.fillRect(endX - barWidth, barY, barWidth / 2, 4);
    ctx.fillStyle = '#f7f1da';
    ctx.fillRect(endX - barWidth / 2, barY, barWidth / 2, 4);
    ctx.strokeStyle = '#3c5a50'; ctx.lineWidth = 1;
    ctx.strokeRect(endX - barWidth, barY, barWidth, 4);
    const scaleFont = (small ? '24' : '13') + 'px Georgia';
    label(ctx, '0', endX - barWidth, barY - 6, scaleFont, '#37584d');
    label(ctx, '20 km', endX, barY - 6, scaleFont, '#37584d');
    ctx.restore();
  }

  function drawDividers(ctx, a, b) {
    // An oblique view lets both steel tips touch their actual chart positions.
    const hub = { x: (a.x + b.x) / 2 + 17, y: Math.max(25, (a.y + b.y) / 2 - 70) };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = '#263b284a'; ctx.shadowBlur = 3 * scale * pixelRatio;
    ctx.shadowOffsetX = 2 * scale * pixelRatio; ctx.shadowOffsetY = 3 * scale * pixelRatio;
    for (const tip of [a, b]) {
      const dx = tip.x - hub.x, dy = tip.y - hub.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length, ny = dx / length;
      const metalX = hub.x + .73 * dx, metalY = hub.y + .73 * dy;
      ctx.beginPath();
      ctx.moveTo(hub.x + nx * 3.4, hub.y + ny * 3.4);
      ctx.lineTo(metalX + nx * 2.3, metalY + ny * 2.3);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(metalX - nx * 2.3, metalY - ny * 2.3);
      ctx.lineTo(hub.x - nx * 3.4, hub.y - ny * 3.4);
      ctx.closePath();
      ctx.fillStyle = '#6e746b'; ctx.strokeStyle = '#293c33'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#b78a4f'; ctx.lineWidth = 4.5;
      line(ctx, hub.x, hub.y, metalX, metalY);
      ctx.strokeStyle = '#e0c48b'; ctx.lineWidth = 1.2;
      line(ctx, hub.x - nx, hub.y - ny, metalX - nx, metalY - ny);
    }
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#374135'; ctx.lineWidth = 6;
    line(ctx, hub.x, hub.y, hub.x + 3, hub.y - 12);
    ctx.strokeStyle = '#c7a368'; ctx.lineWidth = 3;
    line(ctx, hub.x, hub.y, hub.x + 3, hub.y - 12);
    ctx.lineWidth = 1.5;
    circle(ctx, hub.x, hub.y, 5.7, '#c8a568', '#324238');
    circle(ctx, hub.x, hub.y, 2, '#e6cca0', '#76684c');
    ctx.restore();
  }

  function trace(ctx, pins, last) {
    ctx.beginPath();
    ctx.moveTo(pins[0].x, pins[0].y);
    for (let i = 1; i <= last; i++) ctx.lineTo(pins[i].x, pins[i].y);
    ctx.stroke();
  }

  function drawRoute() {
    if (!walk) return;
    const ctx = routeCanvas.getContext('2d');
    ctx.clearRect(-left / scale, -top / scale, routeCanvas.width / (pixelRatio * scale), routeCanvas.height / (pixelRatio * scale));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (reference) {
      ctx.strokeStyle = '#fff7dfc9'; ctx.lineWidth = 4.7;
      trace(ctx, reference.pins, reference.pins.length - 1);
      ctx.setLineDash([8, 5]); ctx.strokeStyle = '#354d75'; ctx.lineWidth = 2.5;
      trace(ctx, reference.pins, reference.pins.length - 1);
      ctx.setLineDash([]);
    }
    const pins = walk.pins, last = pins.length - 1;
    const landed = position === null ? last : Math.floor(position);
    ctx.strokeStyle = '#fcf4dd'; ctx.lineWidth = small ? 5 : 4.7;
    trace(ctx, pins, landed);
    ctx.strokeStyle = '#ac432c'; ctx.lineWidth = small ? 3 : 2.4;
    trace(ctx, pins, landed);
    const dotSize = last > 100 ? 1.65 : last > 45 ? 2.3 : 3.2;
    ctx.lineWidth = 1.3;
    for (let i = 1; i <= landed; i++) circle(ctx, pins[i].x, pins[i].y, dotSize, '#fbefd5', '#9d3d28');
    ctx.lineWidth = 1.7;
    circle(ctx, pins[0].x, pins[0].y, 5.5, '#fbefd5', '#9d3d28');
    circle(ctx, pins[0].x, pins[0].y, 2.1, '#9d3d28');

    if (position === null || landed === 0) drawDividers(ctx, pins[0], pins[1]);
    else if (landed >= last) drawDividers(ctx, pins[last - 1], pins[last]);
    else {
      const pivot = pins[landed], previous = pins[landed - 1], next = pins[landed + 1];
      const start = Math.atan2(previous.y - pivot.y, previous.x - pivot.x);
      const end = Math.atan2(next.y - pivot.y, next.x - pivot.x);
      const turn = Math.atan2(Math.sin(end - start), Math.cos(end - start));
      let t = position - landed;
      t = t * t * (3 - 2 * t);
      const r0 = Math.hypot(previous.x - pivot.x, previous.y - pivot.y);
      const r1 = Math.hypot(next.x - pivot.x, next.y - pivot.y);
      const radius = r0 + (r1 - r0) * t, angle = start + turn * t;
      drawDividers(ctx, pivot, { x: pivot.x + radius * Math.cos(angle), y: pivot.y + radius * Math.sin(angle) });
    }
    ctx.restore();
  }

  function resize() {
    const rect = terrainCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    small = rect.width < 550;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    scale = Math.min(rect.width / width, rect.height / height);
    left = (rect.width - width * scale) / 2;
    top = (rect.height - height * scale) / 2;
    for (const canvas of [terrainCanvas, routeCanvas]) {
      canvas.width = Math.round(rect.width * pixelRatio);
      canvas.height = Math.round(rect.height * pixelRatio);
      canvas.getContext('2d').setTransform(scale * pixelRatio, 0, 0, scale * pixelRatio, left * pixelRatio, top * pixelRatio);
    }
    drawTerrain();
    drawRoute();
  }
  new ResizeObserver(resize).observe(terrainCanvas.parentElement);
  resize();
  return function update(newWalk, overlay, step) {
    walk = newWalk;
    reference = overlay;
    position = step;
    drawRoute();
  };
}
