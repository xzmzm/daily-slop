/* Closed-form assertions for the Little Animals studio. Run: node test_animalcules.mjs */
import * as E from './engine.js';

let passed = 0;
const checks = [];
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  checks.push([ok, `${name}: got ${got.toPrecision(8)}, want ${want.toPrecision(8)} ±${tol.toPrecision(3)}`]);
  if (ok) passed++;
}
function rel(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol * Math.abs(want);
  checks.push([ok, `${name}: got ${got.toPrecision(10)}, want ${want.toPrecision(10)} rel ±${tol}`]);
  if (ok) passed++;
}
function isTrue(name, cond, detail = '') {
  checks.push([cond, `${name} ${detail}`]);
  if (cond) passed++;
}

/* ---------- documented anchors (guard the history against typos) ---------- */
isTrue('the letter is dated the day this studio celebrates', E.LETTER.date === '1683-09-17');
isTrue('it went to Francis Aston', E.LETTER.to.startsWith('Francis Aston'));
isTrue('published in Phil. Trans. 14 (1684)', E.LETTER.published.includes('1684') && E.LETTER.published.includes('568'));
isTrue('the pike quote survives verbatim', E.LETTER.quotePike.includes('like a pike does through the water'));
isTrue('the top-spinner quote survives verbatim', E.LETTER.quoteTop.includes('spun round like a top'));
isTrue('the old man quote survives verbatim', E.LETTER.quoteOldMan.includes('unbelievably great company'));
isTrue('survivors span 68×–275×', E.SURVIVORS.magMin === 68 && E.SURVIVORS.magMax === 275);
isTrue('measured resolution band is 1–2.1 µm', E.SURVIVORS.resMinUm === 1.0 && E.SURVIVORS.resMaxUm === 2.1);
isTrue('nine survivors on today\'s count', E.SURVIVORS.count === 9);
isTrue('timeline keeps the 17 September 1683 entry', E.TIMELINE.some((t) => t[0] === '1683-09-17'));
isTrue('timeline keeps the 9 October 1676 bacteria letter', E.TIMELINE.some((t) => t[0] === '1676-10-09'));
isTrue('timeline keeps the 1677 verification', E.TIMELINE.some((t) => t[0] === '1677'));
isTrue('timeline keeps Ford\'s 1981 strong-room find', E.TIMELINE.some((t) => t[0] === '1981' && t[2].includes('Ford')));
isTrue('timeline keeps Ruska 1931', E.TIMELINE.some((t) => t[0] === '1931'));
isTrue('three sorts of animalcules', E.SPECIES.length === 3 && E.SPECIES[0].id === 'spirochete');
isTrue('the pike is long and thin', E.SPECIES[0].lengthUm === 12 && E.SPECIES[0].widthUm === 0.25);

/* ---------- ball lens closed forms ---------- */
const n = 1.52, D = 1.6, LAM = 0.55;
near('f of a 1.6 mm soda-lime bead', E.ballFocalLength(n, D), 1.1692308, 1e-5);
near('back focus (eye side)', E.ballBackFocus(n, D), 0.3692308, 1e-5);
near('magnification at the near point', E.ballMagnification(n, D), 213.8158, 0.02);
near('full-cone NA', E.ballNA(n), 0.6842105, 1e-6);
near('diffraction limit of that cone', E.abbeResolutionUm(n), 0.4019231, 1e-5);
rel('NA = R/f exactly (tangent cone from the focus)', E.ballNA(n), (D / 2) / E.ballFocalLength(n, D), 1e-12);
rel('M·D = 1000(n−1)/n exactly', E.ballMagnification(n, D) * D, (1000 * (n - 1)) / n, 1e-12);
near('the 275× survivor needs a 1.244 mm bead', E.ballDiameterFor(n, 275), 1.2440191, 1e-5);
isTrue('higher index → shorter focus', E.ballFocalLength(1.75, D) < E.ballFocalLength(1.45, D));
isTrue('higher index → wider NA cone', E.ballNA(1.75) > E.ballNA(1.45));
isTrue('the default bead beats Hooke\'s compound by ~8×', E.ballMagnification(n, D) > 8 * E.HOOKE_MAG);
isTrue('NA never reaches 1 for any real glass (n<2)', E.ballNA(1.9) < 1);

/* ---------- the eye's say ---------- */
near('a 1 µm feature at 213.8× looks 2.94 arcmin tall', E.apparentArcmin(1, 213.8158), 2.9402, 0.002);
near('the eye needs 181.8× to place a 0.4 µm feature on its 1′ bar', E.eyeNeedsMagnification(0.4), 181.8051, 0.02);
rel('the arcmin identity closes: M sized by eyeNeeds puts the feature at exactly 1′',
  E.apparentArcmin(1, E.eyeNeedsMagnification(1)), 1, 1e-12);
near('largest bead that clears the eye bar at n=1.52', E.maxDiameterForEye(n), 1.8907608, 0.005);
rel('…and that bead really magnifies exactly what the eye asks for',
  E.ballMagnification(n, E.maxDiameterForEye(n)), E.eyeNeedsMagnification(E.abbeResolutionUm(n)), 1e-9);
isTrue('the 275× survivor (1.244 mm) sits inside the eye-bar limit', E.ballDiameterFor(n, 275) < E.maxDiameterForEye(n));
isTrue('a 3 mm bead would waste its own diffraction on the eye', 3 > E.maxDiameterForEye(n));

/* ---------- depth of field and the screw ---------- */
near('DOF at the full 0.684 cone', E.depthOfFieldUm(LAM, E.ballNA(n)), 1.1748521, 1e-4);
near('DOF stopped to 0.152', E.depthOfFieldUm(LAM, 0.152), 23.805402, 0.005);
near('screw degrees per DOF, full cone', E.screwDegreesPerDOF(LAM, E.ballNA(n), 0.5), 0.8458935, 1e-3);
near('screw degrees per DOF, stopped', E.screwDegreesPerDOF(LAM, 0.152, 0.5), 17.139889, 0.01);
isTrue('stopping down buys a ~20× gentler screw', E.screwDegreesPerDOF(LAM, 0.152, 0.5) > 15 * E.screwDegreesPerDOF(LAM, E.ballNA(n), 0.5));

/* ---------- the exact ray trace ---------- */
const f0 = E.ballFocalLength(n, D);
const a5 = E.traceBallRay(n, D, 0.005, f0).exitAngleRad;
const a10 = E.traceBallRay(n, D, 0.01, f0).exitAngleRad;
near('paraxial ray leaves essentially parallel to the axis', a5, -1.4343e-6, 5e-7);
near('exit angle grows as h³ near the axis (doubling h ×8)', a10 / a5, 8.0, 0.05);
isTrue('no TIR anywhere on a ball fed from air', [0.02, 0.2, 0.4, 0.6, 0.7, 0.79, 0.7995].every((h) => E.traceBallRay(n, D, h, f0).tir === false));
{
  const hs = [0.05, 0.15, 0.3, 0.45, 0.6];
  let mono = true;
  for (let i = 1; i < hs.length; i++) {
    if (Math.abs(E.traceBallRay(n, D, hs[i], f0).exitAngleRad) <= Math.abs(E.traceBallRay(n, D, hs[i - 1], f0).exitAngleRad)) mono = false;
  }
  isTrue('spherical aberration grows monotonically with ray height', mono);
}
isTrue('grazing entry still comes out (the sphere cannot trap it)', E.traceBallRay(n, D, 0.7999, f0).tir === false);
isTrue('a height beyond the radius is rejected outright', E.traceBallRay(n, D, 0.9, f0) === null);

/* ---------- dispersion and the colour trap ---------- */
rel('Cauchy anchors n(F) − n(C) = (n_d − 1)/V exactly',
  E.cauchyIndex(0.4861) - E.cauchyIndex(0.6563), (n - 1) / 64, 1e-9);
isTrue('blue bends more than red', E.cauchyIndex(0.4861) > E.cauchyIndex(0.6563));
near('green sits between the C and F lines', E.cauchyIndex(0.55), 1.5217418, 2e-6);
near('axial colour of the 1.6 mm bead', E.axialChromatismUm(D, n, 64), 11.9454769, 0.005);
near('flint glass runs ×1.48 the colour', E.axialChromatismUm(D, 1.62, 36) / E.axialChromatismUm(D, n, 64), 1.4840612, 2e-5);
isTrue('colour grows linearly with diameter', E.axialChromatismUm(3.0, n, 64) < 2 * E.axialChromatismUm(D, n, 64) + 1e-9 && E.axialChromatismUm(3.0, n, 64) > 1.8 * E.axialChromatismUm(D, n, 64));

const df = E.axialChromatismUm(D, n, 64);
near('the sweet-spot cone NA*', E.optimalNA(LAM, df), 0.1517276, 1e-5);
near('the sweet-spot floor d_min', E.minResolutionUm(LAM, df), 2.5632035, 1e-4);
rel('the total blur at NA* equals d_min exactly (the optimum is closed-form)',
  E.totalBlurUm(LAM, df, E.optimalNA(LAM, df)), E.minResolutionUm(LAM, df), 1e-12);
isTrue('NA* is a true minimum', E.totalBlurUm(LAM, df, E.optimalNA(LAM, df)) < E.totalBlurUm(LAM, df, E.optimalNA(LAM, df) + 0.01)
  && E.totalBlurUm(LAM, df, E.optimalNA(LAM, df)) < E.totalBlurUm(LAM, df, E.optimalNA(LAM, df) - 0.01));
isTrue('the model lands within a factor of two of the measured 1–2.1 µm band',
  E.minResolutionUm(LAM, df) < 2 * E.SURVIVORS.resMaxUm && E.minResolutionUm(LAM, df) > E.SURVIVORS.resMinUm * 0.5);
isTrue('wide open, colour ruins the bead', E.totalBlurUm(LAM, df, E.ballNA(n)) > 6);
isTrue('flint pushes the optimum to a narrower cone', E.optimalNA(LAM, E.axialChromatismUm(D, 1.62, 36)) < E.optimalNA(LAM, df));

/* ---------- the letter: verdicts and the company ---------- */
isTrue('at the measured 1.4 µm the pike is seen', E.verdictFor(12, 1.4) === 'resolved');
isTrue('…but its 0.25 µm width never resolves', E.verdictFor(0.25, 1.4) === 'invisible');
isTrue('at 1.4 µm the rod is seen full length', E.verdictFor(4, 1.4) === 'resolved');
isTrue('the 0.8 µm third sort is below the measured floor — "exceeding small"',
  E.verdictFor(0.8, 1.4) === 'invisible' && E.verdictFor(0.8, 2.1) === 'invisible');
isTrue('at the model floor the rod drops to a blip', E.verdictFor(4, E.minResolutionUm(LAM, df)) === 'blip');
isTrue('modern optics (0.2 µm) resolves the cocci at last', E.verdictFor(0.8, 0.2) === 'resolved');
isTrue('only the electron floor resolves the pike\'s width', E.verdictFor(0.25, 0.0005) === 'resolved');

near('1 mg of plaque carries 10⁸ creatures', E.plaqueCount(1), 1e8, 1);
isTrue('one milligram out-populates the Dutch Republic', E.plaqueCount(1) > 52 * E.POPULATIONS[0].people);
near('it takes just 1.1 mg to out-populate all of Europe', E.plaqueCount(1.1), E.POPULATIONS[1].people, 1e3);

/* ---------- the ladder ---------- */
{
  const sizes = E.LADDER.map((x) => x.sizeUm);
  let ordered = true;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] >= sizes[i - 1]) ordered = false;
  isTrue('the ladder descends monotonically', ordered);
}
isTrue('floors descend from Hooke to the electron', E.FLOORS[0].um > E.FLOORS[1].um && E.FLOORS[3].um < E.FLOORS[2].um);
isTrue('the bead\'s floor sits between Hooke and modern optics', E.FLOORS[0].um > E.FLOORS[1].um && E.FLOORS[1].um > E.FLOORS[2].um);
isTrue('the cocci width (0.8 µm) falls below the bead floor (1.4 µm)', E.LADDER.find((x) => x.id === 'coccus').sizeUm < E.FLOORS.find((x) => x.id === 'leeuwenhoek').um);

/* ---------- report ---------- */
const failed = checks.filter((c) => !c[0]);
for (const [ok, msg] of checks) console.log(`${ok ? 'ok ' : 'FAIL'}  ${msg}`);
console.log(`\n${passed}/${checks.length} assertions passed${failed.length ? ` — ${failed.length} FAILED` : ''}`);
if (failed.length) process.exit(1);
