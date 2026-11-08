(function (root) {
  'use strict';
  // A 19th-century X-ray bench. The tube makes a broad spectrum up to the
  // peak voltage; every material takes a bite out of the beam by Lambert–Beer
  // law, and the plate only sees the photons that survive the trip.

  const PLATE_W = 192;             // plate pixels across
  const PLATE_H = 144;             // plate pixels down
  const PX_PER_CM = 6;             // plate resolution
  const FLUX_60 = 50;              // photons per mA·s per pixel at 60 kVp, transmission 1
  const MAS_MAX = 40;              // exposure counter never runs past this
  const EXPOSURE_LOW = 60;         // mean photons/pixel below which the plate is fog
  const EXPOSURE_HIGH = 2000;      // mean photons/pixel above which the plate is black
  const CONTRAST_MIN = 0.32;       // ln(T_major/T_minor) needed to read a shadow

  // Mass attenuation is set by hand at 60 kVp and stretched with energy:
  // a photoelectric term (strong, ~E^-3, grows with Z) over a weakly varying
  // Compton floor. Good enough for shadows; not a substitute for NIST tables.
  const MATERIALS = {
    flesh: {label: 'Soft tissue', rho: 1.06, mu60: 0.22, photoW: 0.12},
    bone: {label: 'Bone', rho: 1.85, mu60: 0.80, photoW: 0.45},
    paper: {label: 'Paper', rho: 0.75, mu60: 0.16, photoW: 0.10},
    wood: {label: 'Wood', rho: 0.55, mu60: 0.11, photoW: 0.08},
    steel: {label: 'Steel', rho: 7.85, mu60: 2.7, photoW: 0.65},
    brass: {label: 'Brass', rho: 8.50, mu60: 21.0, photoW: 0.75},
    lead: {label: 'Lead', rho: 11.35, mu60: 57.0, photoW: 0.85},
  };

  // Each object is a set of thickness maps (cm of material per plate pixel)
  // plus the two groups whose shadow difference is the point of the picture.
  const OBJECTS = {
    book: {
      label: 'Book', detail: '3.6 cm of pages, one brass paperclip inside',
      pair: ['paper', 'brass'], pairNote: 'pages vs paperclip',
    },
    wood: {
      label: 'Wood block', detail: '3 cm of softwood, one steel nail hidden inside',
      pair: ['wood', 'steel'], pairNote: 'wood vs nail',
    },
    hand: {
      label: 'Hand', detail: 'flesh, finger bones, and a brass ring',
      pair: ['flesh', 'bone'], pairNote: 'flesh vs bone',
    },
    lead: {
      label: 'Lead disc', detail: '1 cm of lead — the ray-stopper', pair: null,
    },
  };

  function validate(objectKey, kvp) {
    if (!OBJECTS[objectKey]) throw new RangeError('Unknown object');
    if (!Number.isFinite(kvp) || kvp < 10 || kvp > 140) throw new RangeError('kVp must lie between 10 and 140');
  }

  // Linear attenuation coefficient, 1/cm, for a photon of energy `kvp` keV.
  function muAt(materialKey, kvp) {
    const m = MATERIALS[materialKey];
    if (!m) throw new RangeError('Unknown material');
    const r = 60 / kvp;
    return m.mu60 * (m.photoW * r * r * r + (1 - m.photoW) * Math.pow(r, 0.35));
  }

  // Tube output: roughly proportional to the square of the peak voltage.
  function fluxAt(kvp) {
    return FLUX_60 * (kvp / 60) * (kvp / 60);
  }

  function transmission(thicknessCm, materialKey, kvp) {
    return Math.exp(-muAt(materialKey, kvp) * thicknessCm);
  }

  // ---- procedural objects -------------------------------------------------
  // Maps are built in centimetres (x right, y up, origin at plate centre) and
  // rasterised at PX_PER_CM. A capsule is the set of points within `r` of the
  // segment p→q; the ring is a short band wrapped across one finger.

  function capsuleDistance(px, py, p, q) {
    const vx = q[0] - p[0], vy = q[1] - p[1];
    const wx = px - p[0], wy = py - p[1];
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
    const dx = px - (p[0] + t * vx), dy = py - (p[1] + t * vy);
    return Math.hypot(dx, dy);
  }

  function inEllipse(px, py, c, rx, ry) {
    const dx = (px - c[0]) / rx, dy = (py - c[1]) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function add(map, index, amount) {
    map[index] += amount;
  }

  // One finger: flesh capsule with a bone core running most of its length.
  function finger(p, q, r, boneFrac) {
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const bx = (q[0] - p[0]) * boneFrac / 2, by = (q[1] - p[1]) * boneFrac / 2;
    return {p, q, r, pb: [mid[0] - bx, mid[1] - by], qb: [mid[0] + bx, mid[1] + by], boneR: r * 0.42};
  }

  const HAND = (function () {
    const fingers = [
      finger([-2.7, -1.2], [-3.1, 4.6], 0.58, 0.62),   // index
      finger([-0.95, -1.4], [-1.05, 5.6], 0.60, 0.64), // middle
      finger([0.85, -1.4], [1.15, 5.0], 0.58, 0.62),   // ring
      finger([2.5, -1.2], [3.3, 2.9], 0.52, 0.58),     // little
    ];
    return {
      palm: {c: [-0.2, -4.4], rx: 3.6, ry: 3.4},
      fingers,
      thumb: finger([-3.1, -4.6], [-5.4, -1.6], 0.62, 0.6),
      wrist: {x: -2.2, w: 4.4, y0: -12, y1: -7.6},
      foreBones: [[-1.15, -1.35], [1.05, -1.35]],            // radius & ulna
      ring: {finger: 2, y: 0.6, halfW: 0.72, halfH: 0.38, t: 0.35}, // on the ring finger
    };
  })();

  function buildHand(maps) {
    const {flesh, bone, brass} = maps;
    const palm = HAND.palm, wrist = HAND.wrist;
    for (let y = 0; y < PLATE_H; y++) {
      for (let x = 0; x < PLATE_W; x++) {
        const px = (x - PLATE_W / 2 + 0.5) / PX_PER_CM;
        const py = (PLATE_H / 2 - y - 0.5) / PX_PER_CM;
        const i = y * PLATE_W + x;
        let soft = 0;
        if (inEllipse(px, py, [palm.c[0], palm.c[1]], palm.rx, palm.ry)) soft = 2.6;
        if (px >= wrist.x && px <= wrist.x + wrist.w && py >= wrist.y0 && py <= wrist.y1) soft = 2.8;
        for (const f of HAND.fingers) {
          if (capsuleDistance(px, py, f.p, f.q) <= f.r) soft = 1.7;
        }
        const th = HAND.thumb;
        if (capsuleDistance(px, py, th.p, th.q) <= th.r) soft = 1.8;
        if (soft > 0) add(flesh.map, i, soft);
        for (const f of HAND.fingers.concat([HAND.thumb])) {
          if (capsuleDistance(px, py, f.pb, f.qb) <= f.boneR) add(bone.map, i, f.boneR * 2 * 0.9);
        }
        if (soft > 0 && py >= palm.c[1] - 1.2 && py <= palm.c[1] + 1.0) {
          for (const mc of [-2.7, -0.95, 0.85, 2.5]) {
            if (Math.abs(px - mc) < 0.22) add(bone.map, i, 0.7);   // metacarpals
          }
        }
        if (px >= wrist.x && px <= wrist.x + wrist.w && py >= wrist.y0 && py <= wrist.y1) {
          for (const fc of HAND.foreBones) {
            if (Math.abs(px - fc[0]) < 0.34) add(bone.map, i, 1.1); // radius & ulna
          }
        }
        // The ring wraps the finger, so in projection it is a solid band.
        const ring = HAND.ring, f = HAND.fingers[ring.finger];
        const flen = Math.hypot(f.q[0] - f.p[0], f.q[1] - f.p[1]);
        const fx = f.p[0] + (f.q[0] - f.p[0]) * ring.y / flen;
        const fy = f.p[1] + (f.q[1] - f.p[1]) * ring.y / flen;
        if (Math.abs(px - fx) <= ring.halfW + f.r && Math.abs(py - fy) <= ring.halfH) {
          add(brass.map, i, ring.t);
        }
      }
    }
  }

  function buildSlab(maps, key, isInside) {
    const map = maps[key].map;
    for (let y = 0; y < PLATE_H; y++) {
      for (let x = 0; x < PLATE_W; x++) {
        const px = (x - PLATE_W / 2 + 0.5) / PX_PER_CM;
        const py = (PLATE_H / 2 - y - 0.5) / PX_PER_CM;
        const t = isInside(px, py);
        if (t > 0) add(map, y * PLATE_W + x, t);
      }
    }
  }

  // Build all four thickness maps for one object. Pure and deterministic.
  function buildMaps(objectKey) {
    validate(objectKey, 60);
    const maps = {
      flesh: {material: 'flesh', map: new Float32Array(PLATE_W * PLATE_H)},
      bone: {material: 'bone', map: new Float32Array(PLATE_W * PLATE_H)},
      paper: {material: 'paper', map: new Float32Array(PLATE_W * PLATE_H)},
      wood: {material: 'wood', map: new Float32Array(PLATE_W * PLATE_H)},
      steel: {material: 'steel', map: new Float32Array(PLATE_W * PLATE_H)},
      brass: {material: 'brass', map: new Float32Array(PLATE_W * PLATE_H)},
      lead: {material: 'lead', map: new Float32Array(PLATE_W * PLATE_H)},
    };
    if (objectKey === 'hand') buildHand(maps);
    if (objectKey === 'book') {
      buildSlab(maps, 'paper', (px, py) => (Math.abs(px) < 6.5 && Math.abs(py) < 8.5 ? 3.6 : 0));
      // Paperclip: a flattened S hugging the book's left edge.
      const clips = [[[-5.4, 7.4], [-5.4, -6.2]], [[-5.4, -6.2], [-2.6, -6.2]], [[-2.6, -6.2], [-2.6, 5.4]], [[-2.6, 5.4], [-4.6, 5.4]]];
      for (const [p, q] of clips) {
        buildSlab(maps, 'brass', (px, py) => (capsuleDistance(px, py, p, q) <= 0.16 ? 0.28 : 0));
      }
    }
    if (objectKey === 'wood') {
      buildSlab(maps, 'wood', (px, py) => (Math.abs(px) < 7 && Math.abs(py) < 9 ? 3.0 : 0));
      buildSlab(maps, 'steel', (px, py) => (capsuleDistance(px, py, [-4.5, -5], [3.5, 4.5]) <= 0.18 ? 0.7 : 0));
    }
    if (objectKey === 'lead') {
      buildSlab(maps, 'lead', (px, py) => (Math.hypot(px, py + 1) <= 5.5 ? 1.0 : 0));
    }
    // Index the two groups the verdict compares, plus where nothing at all is.
    const [majorKey, minorKey] = OBJECTS[objectKey].pair || [null, null];
    const solid = [], major = [], minor = [], bare = [];
    const majorMap = majorKey ? maps[majorKey].map : null;
    const minorMap = minorKey ? maps[minorKey].map : null;
    for (let i = 0; i < PLATE_W * PLATE_H; i++) {
      let any = false;
      for (const key of Object.keys(maps)) if (maps[key].map[i] > 0) { any = true; break; }
      if (!any) { bare.push(i); continue; }
      solid.push(i);
      if (!majorKey) continue;
      if (minorMap[i] > 0.05) minor.push(i);
      else if (majorMap[i] > 0.2) major.push(i);
    }
    return {object: objectKey, pair: OBJECTS[objectKey].pair, maps, solid, major, minor, bare};
  }

  // Mean transmission of a pixel group at a given kVp.
  function groupTransmission(data, indices, kvp) {
    if (!indices.length) return 1;
    let acc = 0;
    for (const i of indices) {
      let tau = 0;
      for (const key of Object.keys(data.maps)) {
        tau += muAt(key, kvp) * data.maps[key].map[i];
      }
      acc += Math.exp(-tau);
    }
    return acc / indices.length;
  }

  // Grade a finished plate. Everything here is expectation values, so the
  // verdict is reproducible; the noise on the plate itself is the app's job.
  function grade(objectKey, kvp, mAs, data) {
    validate(objectKey, kvp);
    if (!Number.isFinite(mAs) || mAs <= 0) throw new RangeError('mAs must be positive');
    data = data || buildMaps(objectKey);
    const flux = fluxAt(kvp);
    // The eye reads the subject: photons per pixel where the object actually
    // is. The direct beam around it always burns black — like a real film.
    const subject = data.pair ? data.major.concat(data.minor) : data.solid;
    let tauSum = 0;
    for (const i of subject) {
      let tau = 0;
      for (const key of Object.keys(data.maps)) tau += muAt(key, kvp) * data.maps[key].map[i];
      tauSum += Math.exp(-tau);
    }
    const lamObject = subject.length ? flux * mAs * (tauSum / subject.length) : flux * mAs;

    const blocked = lamObject < 0.05;
    const underExposed = !blocked && lamObject < EXPOSURE_LOW;
    const overExposed = lamObject > EXPOSURE_HIGH;
    let contrast = null, contrastOk = null;
    if (OBJECTS[objectKey].pair) {
      const tMajor = groupTransmission(data, data.major, kvp);
      const tMinor = groupTransmission(data, data.minor, kvp);
      contrast = Math.log(tMajor / Math.max(1e-9, tMinor));
      contrastOk = contrast >= CONTRAST_MIN;
    }
    let stars, title, detail;
    if (blocked) {
      stars = 0; title = 'Nothing but fog.';
      detail = 'Lead stops this beam cold — that is exactly why shields are made of it.';
    } else if (underExposed) {
      stars = 1; title = 'Fog.';
      detail = lamObject < 12
        ? 'Barely a photon per pixel. Raise the voltage for penetration, or give the plate more mA·s.'
        : 'Thin quantum counts: the plate is mostly grain. More mA·s, or harder rays.';
    } else if (overExposed) {
      stars = 1; title = 'Black plate.';
      detail = 'The film drank far more radiation than it could hold. Only the densest shadow survives.';
    } else if (contrastOk === false) {
      stars = 2; title = 'Washed out.';
      detail = 'Hard enough to expose, too hard to tell ' + OBJECTS[objectKey].pairNote + ' apart. Ease the voltage down.';
    } else {
      stars = 3; title = 'A textbook plate.';
      detail = kvp < 50
        ? `Exposure and contrast landed, but soft rays made you pay ${Math.round((60 / kvp) ** 2)}× the dose for it. Harder rays get here for a third of the waiting.`
        : kvp > 85
          ? 'Exposed and readable, with gentle shadows — voltage running ahead of what the picture needs.'
          : 'Exposure, penetration and contrast all landed. This is the one you show the professor.';
    }
    return {object: objectKey, kvp, mAs, lamObject, blocked, underExposed, overExposed, contrast, contrastOk, stars, title, detail};
  }

  function formatMas(mAs) {
    return (mAs >= 10 ? Math.round(mAs * 10) / 10 : Math.round(mAs * 100) / 100) + ' mA·s';
  }

  const api = {
    PLATE_W, PLATE_H, PX_PER_CM, FLUX_60, MAS_MAX, EXPOSURE_LOW, EXPOSURE_HIGH, CONTRAST_MIN,
    MATERIALS, OBJECTS, HAND,
    muAt, fluxAt, transmission, buildMaps, groupTransmission, grade, formatMas,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.XrayModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
