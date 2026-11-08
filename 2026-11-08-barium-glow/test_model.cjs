const assert = require('node:assert/strict');
const m = require('./model.js');
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);

// --- attenuation physics ---
for (const key of Object.keys(m.MATERIALS)) {
  let previous = Infinity;
  for (const kvp of [20, 30, 45, 60, 80, 100, 120]) {
    const mu = m.muAt(key, kvp);
    assert.ok(mu > 0 && mu < previous, `${key}: mu must fall as rays harden (${kvp} kVp)`);
    previous = mu;
  }
}
const order = ['lead', 'brass', 'steel', 'bone', 'flesh', 'paper', 'wood'];
for (let i = 1; i < order.length; i++) {
  assert.ok(m.muAt(order[i - 1], 60) > m.muAt(order[i], 60), `${order[i - 1]} must out-attenuate ${order[i]}`);
}
// Paper stops very little at 60 kVp; lead stops essentially everything.
assert.ok(m.transmission(3.6, 'paper', 60) > 0.4 && m.transmission(3.6, 'paper', 60) < 0.7);
assert.ok(m.transmission(1, 'lead', 120) < 1e-5);
// Tube output grows with the square of the peak voltage.
near(m.fluxAt(60), m.FLUX_60);
near(m.fluxAt(120), 4 * m.FLUX_60, 1e-9);
near(m.fluxAt(30), m.FLUX_60 / 4, 1e-9);
// Photoelectric stretch: bone loses contrast far faster than flesh does.
const boneRatio = m.muAt('bone', 30) / m.muAt('bone', 120);
const fleshRatio = m.muAt('flesh', 30) / m.muAt('flesh', 120);
assert.ok(boneRatio > fleshRatio * 1.5, 'bone must be the more energy-sensitive material');

// --- objects: deterministic maps with the right secrets inside ---
const hand = m.buildMaps('hand');
const hand2 = m.buildMaps('hand');
assert.deepEqual(Array.from(hand.maps.bone.map), Array.from(hand2.maps.bone.map), 'maps must be deterministic');
assert.deepEqual(hand.major, hand2.major);
assert.ok(hand.minor.length > 40, `finger bones must cover pixels (${hand.minor.length})`);
assert.ok(hand.major.length > hand.minor.length * 3, 'flesh should dominate the hand');
// The ring is brass and sits on the ring finger: brass pixels above y of the palm.
let brassTop = Infinity, brassBottom = -Infinity;
for (let i = 0; i < hand.maps.brass.map.length; i++) {
  if (hand.maps.brass.map[i] > 0) {
    const y = Math.floor(i / m.PLATE_W);
    brassTop = Math.min(brassTop, y); brassBottom = Math.max(brassBottom, y);
  }
}
assert.ok(brassBottom - brassTop < 14, `ring band should be narrow (${brassBottom - brassTop}px)`);
const book = m.buildMaps('book');
assert.ok(book.minor.length > 20, 'paperclip must be present');
const wood = m.buildMaps('wood');
assert.ok(wood.minor.length > 20, 'nail must be present');
const lead = m.buildMaps('lead');
assert.equal(lead.pair, null);
assert.ok(lead.minor.length === 0 && lead.major.length === 0);

// --- contrast falls with voltage ---
function contrastOf(data, kvp) {
  return Math.log(m.groupTransmission(data, data.major, kvp) / m.groupTransmission(data, data.minor, kvp));
}
const c30 = contrastOf(hand, 30), c60 = contrastOf(hand, 60), c100 = contrastOf(hand, 100);
assert.ok(c30 > c60 && c60 > c100, `contrast must fall with kVp (${c30}, ${c60}, ${c100})`);
assert.ok(c60 > m.CONTRAST_MIN, '60 kVp must clear the contrast bar for the hand');
assert.ok(c100 < m.CONTRAST_MIN, '100 kVp must wash the hand out');
assert.ok(c30 > c60 * 2, 'soft rays must be dramatic on bone');

// --- grading: the sweet spots and the failure modes ---
const good = m.grade('hand', 60, 12);
assert.equal(good.stars, 3, JSON.stringify(good));
assert.ok(!good.underExposed && !good.overExposed && good.contrastOk);
assert.ok(good.lamObject > m.EXPOSURE_LOW && good.lamObject < m.EXPOSURE_HIGH, `lambda ${good.lamObject}`);

const foggy = m.grade('hand', 30, 6);
assert.equal(foggy.stars, 1, JSON.stringify(foggy));
assert.ok(foggy.underExposed, 'soft rays with a small mAs must starve the plate');
// But patience can rescue soft rays: forty mA·s at 30 kVp is a real image.
assert.equal(m.grade('hand', 30, 40).stars, 3, JSON.stringify(m.grade('hand', 30, 40)));

const washed = m.grade('hand', 115, 8);
assert.ok(washed.stars < 3, JSON.stringify(washed));
assert.ok(washed.contrastOk === false || washed.overExposed, '115 kVp must fail the hand somehow');

const black = m.grade('hand', 120, 40);
assert.ok(black.overExposed || black.stars < 3, JSON.stringify(black));

const nail = m.grade('wood', 55, 12);
assert.equal(nail.stars, 3, JSON.stringify(nail));
const clip = m.grade('book', 45, 12);
assert.equal(clip.stars, 3, JSON.stringify(clip));
assert.ok(contrastOf(book, 45) >= m.CONTRAST_MIN, `paperclip contrast ${contrastOf(book, 45)}`);
const leadVerdict = m.grade('lead', 120, 40);
assert.ok(leadVerdict.blocked && leadVerdict.stars === 0, JSON.stringify(leadVerdict));

// mAs only moves exposure, never contrast.
const g1 = m.grade('hand', 60, 6), g2 = m.grade('hand', 60, 24);
assert.ok(g2.lamObject > g1.lamObject * 3, 'four times the mAs, four times the photons');
assert.ok(g1.contrastOk === g2.contrastOk);

// --- validation and formatting ---
assert.throws(() => m.grade('foot', 60, 10), RangeError);
assert.throws(() => m.grade('hand', 5, 10), RangeError);
assert.throws(() => m.grade('hand', 60, 0), RangeError);
assert.throws(() => m.muAt('unobtainium', 60), RangeError);
assert.equal(m.formatMas(12), '12 mA·s');
assert.equal(m.formatMas(3.5), '3.5 mA·s');
assert.equal(m.formatMas(0.75), '0.75 mA·s');
assert.equal(m.OBJECTS.hand.pair[0], 'flesh');

// The plate grid is big enough to read a hand, small enough to render fast.
assert.equal(m.PLATE_W * m.PLATE_H, 27648);
const t0 = process.hrtime.bigint();
m.buildMaps('hand');
assert.ok(Number(process.hrtime.bigint() - t0) < 5e8, 'map build must stay under 0.5 s');

console.log('PASS: attenuation laws, kVp^2 flux, deterministic maps with ring/nail/paperclip, contrast vs kVp, verdict bands, validation.');
