/* A fictional chart in plane coordinates. Six chart units represent a kilometre. */
const Coast = (() => {
  const width = 864, height = 528, cell = 3, unitsPerKm = 6;
  const spans = [24, 12, 6, 3];
  const headlands = [
    [192,355],[159,345],[130,320],[169,298],[204,308],[224,285],
    [181,272],[196,251],[248,255],[279,231],[271,208],[302,196],
    [281,167],[324,174],[348,198],[368,182],[349,156],[362,129],
    [391,116],[416,145],[444,149],[458,122],[478,127],[507,99],
    [521,72],[556,60],[580,83],[552,110],[567,132],[605,116],
    [626,90],[658,78],[671,97],[644,129],[684,134],[721,115],
    [747,135],[713,158],[667,166],[654,188],[604,206],[623,224],
    [653,215],[683,239],[656,257],[614,241],[580,261],[557,253],
    [549,287],[506,310],[493,338],[462,349],[447,382],[406,385],
    [401,362],[430,338],[427,316],[400,326],[379,357],[347,371],
    [327,397],[292,406],[302,375],[318,348],[290,346],[258,368],
    [246,403],[218,429],[194,410],[211,384],
  ];

  function hash(x, y) {
    let n = Math.imul(x + 173, 374761393) + Math.imul(y + 97, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function noise(x, y, scale) {
    x = x / scale + 0.37;
    y = y / scale + 0.71;
    const i = Math.floor(x), j = Math.floor(y);
    let u = x - i, v = y - j;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    const a = hash(i, j) * (1 - u) + hash(i + 1, j) * u;
    const b = hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u;
    return (a * (1 - v) + b * v) * 2 - 1;
  }

  function relief(x, y) {
    let inside = false, nearestSquared = Infinity;
    for (let i = 0, j = headlands.length - 1; i < headlands.length; j = i++) {
      const [ax, ay] = headlands[j], [bx, by] = headlands[i];
      const dx = bx - ax, dy = by - ay;
      const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      nearestSquared = Math.min(nearestSquared, (x - ax - along * dx) ** 2 + (y - ay - along * dy) ** 2);
      if ((ay > y) !== (by > y) && x < ax + (y - ay) * dx / dy) inside = !inside;
    }
    const distance = Math.sqrt(nearestSquared) * (inside ? 1 : -1);
    return distance * 0.84 + 15 * noise(x, y, 35) + 8 * noise(x, y, 15) + 4 * noise(x, y, 6)
      + Math.max(0, distance) * 0.44 * noise(x, y, 64);
  }

  // Adjacent marching-squares cells share the same edge ID and intersection.
  function contours(samples, columns, rows, level) {
    const edges = new Map();
    function cross(id, x, y, dx, dy, a, b) {
      if (!edges.has(id)) {
        const t = (level - a) / (b - a);
        edges.set(id, { x: (x + dx * t) * cell, y: (y + dy * t) * cell, next: [] });
      }
      return id;
    }
    function join(a, b) {
      edges.get(a).next.push(b);
      edges.get(b).next.push(a);
    }
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < columns - 1; x++) {
        const i = y * columns + x;
        const a = samples[i], b = samples[i + 1], c = samples[i + columns + 1], d = samples[i + columns];
        const high = a > level;
        if ((b > level) === high && (c > level) === high && (d > level) === high) continue;
        const hits = [];
        if ((b > level) !== high) hits.push(cross(2 * i, x, y, 1, 0, a, b));
        if ((b > level) !== (c > level)) hits.push(cross(2 * (i + 1) + 1, x + 1, y, 0, 1, b, c));
        if ((c > level) !== (d > level)) hits.push(cross(2 * (i + columns), x, y + 1, 1, 0, d, c));
        if ((d > level) !== high) hits.push(cross(2 * i + 1, x, y, 0, 1, a, d));
        if (hits.length === 4 && ((a + b + c + d) / 4 > level) !== high) {
          hits.push(hits.shift()); // Pair right with bottom and left with top.
        }
        join(hits[0], hits[1]);
        if (hits.length === 4) join(hits[2], hits[3]);
      }
    }
    const lines = [], seen = new Set();
    for (const start of edges.keys()) {
      if (seen.has(start)) continue;
      const line = [];
      let previous = -1, id = start;
      while (id !== undefined && !seen.has(id)) {
        seen.add(id);
        const { x, y, next } = edges.get(id);
        line.push({ x, y });
        const forward = next.find(neighbour => neighbour !== previous);
        previous = id;
        id = forward;
      }
      if (id === start && line.length >= 3) lines.push(line);
    }
    return lines;
  }

  function signedArea(line) {
    return line.reduce((area, a, i) => {
      const b = line[(i + 1) % line.length];
      return area + a.x * b.y - b.x * a.y;
    }, 0) / 2;
  }

  function makeChart() {
    const columns = width / cell + 1, rows = height / cell + 1;
    const samples = new Float32Array(columns * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) samples[y * columns + x] = relief(x * cell, y * cell);
    }
    const levels = [-34, -25, -17, -10, -5, 0, 4, 8, 13, 19, 26, 34, 43, 53, 64, 76];
    const bands = new Map(levels.map(level => [level, contours(samples, columns, rows, level)]));
    const shore = bands.get(0).reduce((a, b) => Math.abs(signedArea(a)) > Math.abs(signedArea(b)) ? a : b).slice();
    if (signedArea(shore) < 0) shore.reverse(); // Clockwise on a screen.
    const origin = shore.reduce((best, p, i) =>
      Math.hypot(p.x - 218, p.y - 430) < Math.hypot(shore[best].x - 218, shore[best].y - 430) ? i : best, 0);
    return { bands, shore: [...shore.slice(origin), ...shore.slice(0, origin + 1)] };
  }

  // From each planted foot, follow the shore until it first leaves the span circle.
  function walk(shore, span) {
    if (!(span > 0 && Number.isFinite(span))) throw new RangeError('The divider span must be positive.');
    const pins = [shore[0]];
    let foot = shore[0], from = foot;
    for (let i = 1; i < shore.length;) {
      const to = shore[i];
      const dx = to.x - from.x, dy = to.y - from.y;
      const edgeSquared = dx * dx + dy * dy;
      if (edgeSquared === 0 || Math.hypot(to.x - foot.x, to.y - foot.y) < span) {
        from = to;
        i++;
        continue;
      }
      const ox = from.x - foot.x, oy = from.y - foot.y;
      const dot = ox * dx + oy * dy;
      const root = Math.sqrt(Math.max(0, dot * dot + edgeSquared * (span * span - ox * ox - oy * oy)));
      const t = Math.min(1, Math.max(0, (root - dot) / edgeSquared));
      foot = { x: from.x + t * dx, y: from.y + t * dy };
      pins.push(foot);
      from = foot; // The unused part of this same edge can still contain more steps.
    }
    const end = shore[shore.length - 1];
    const fullSteps = pins.length - 1;
    let remainder = Math.hypot(end.x - foot.x, end.y - foot.y);
    if (remainder > 1e-8) pins.push(end);
    else remainder = 0;
    return { pins, fullSteps, remainder, length: fullSteps * span + remainder };
  }

  return { width, height, unitsPerKm, spans, makeChart, walk, hash };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Coast;
