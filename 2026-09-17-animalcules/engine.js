/* ==========================================================================
   The Little Animals — Leeuwenhoek studio, 17 September 1683.

   Every number the UI shows comes from these pure functions, and
   test_animalcules.mjs pins them to hand-computed values. Two kinds of
   constants live here:

   · LETTER / SURVIVORS / TIMELINE / SPECIES are documented anchors
     (Wikipedia "Antonie van Leeuwenhoek", Lens on Leeuwenhoek L-135,
     Dobell 1932, van Zuylen 1981 "The microscopes of Antoni van
     Leeuwenhoek", UCMP Berkeley, Ed Yong "I Contain Multitudes",
     Wired 2008-09-17).
   · The optics defaults (near point 250 mm, 1-arcmin acuity, crown
     dispersion, screw pitch) are standard textbook / modelled values —
     NOTES.md says which is which.

   Geometry of the machine: a tiny glass ball lens of diameter D and
   index n, the specimen pinned just outside the front focus, the eye
   close behind. Distances in mm, resolutions and wavelengths in µm.
   ========================================================================== */

export const NEAR_POINT_MM = 250;          // conventional distinct-vision near point
export const EYE_ARCMIN_RAD = 2.908882e-4; // 1 arcminute in radians (visual acuity)

/* ---- documented 1683 anchors ---- */
export const LETTER = {
  date: '1683-09-17',
  to: 'Francis Aston, Royal Society',
  published: 'Philosophical Transactions, vol. 14 (1684), pp. 568–574',
  title: 'Animals in the Scurf of the Teeth',
  quoteBatter: 'a little white matter, which is as thick as if \'twere batter',
  quoteWonder: 'many very little living animalcules, very prettily a-moving',
  quotePike: 'shot through the water (or spittle) like a pike does through the water',
  quoteTop: 'oft-times spun round like a top … far more in number',
  quoteOldMan: 'an unbelievably great company of living animalcules, a-swimming more nimbly than any I had ever seen up to this time',
  subjects: 'himself and four other people, one an old man who had never cleaned his teeth',
};

/* Surviving instruments — magnifications 68×–275×, measured resolution ~1–2.1 µm
   (van Zuylen 1981; FSU Museum of Microscopy; counts vary by source, Wikipedia
   currently says nine survive). */
export const SURVIVORS = { count: 9, magMin: 68, magMax: 275, resMinUm: 1.0, resMaxUm: 2.1 };

/* Contemporaries: compound microscopes stayed useful only to ~20–30× (Wired). */
export const HOOKE_MAG = 25;

/* What survives of the man: >500 lenses, ~560 letters in all (~190 to the RS). */
export const LEEUWENHOEK = { lensesMade: 500, lettersTotal: 560, lettersToRS: 190 };

/* ---- the three sorts he described, with modern identities and sizes ---- */
export const SPECIES = [
  { id: 'spirochete', label: 'the biggest sort — the pike', modern: 'oral spirochete (Treponema)',
    lengthUm: 12, widthUm: 0.25, motion: 'darting swimmer; bends its body into curves',
    quote: LETTER.quotePike },
  { id: 'rod', label: 'the second sort — the top-spinner', modern: 'plump rod (Selenomonas-like)',
    lengthUm: 4, widthUm: 1.0, motion: 'tumbles end over end',
    quote: LETTER.quoteTop },
  { id: 'coccus', label: 'the third sort — the exceeding small', modern: 'streptococcal chain',
    lengthUm: 6, widthUm: 0.8, motion: 'scarcely stirring, heaped together', quote: null },
];

export const REFERENCES = [
  { id: 'hair', label: 'a hair of one\'s head', sizeUm: 70 },
  { id: 'rbc', label: 'red blood cell', sizeUm: 7.5 },
];

/* ==========================================================================
   Machine I — the bead of glass (ball-lens closed forms)
   ========================================================================== */

/* Paraxial focal length of a ball lens, from the sphere centre. */
export const ballFocalLength = (n, D) => (n * D) / (4 * (n - 1));          // mm
/* Focus measured from the back surface — where the eye's near point sits. */
export const ballBackFocus = (n, D) => ballFocalLength(n, D) - D / 2;      // mm
/* Magnifier magnification at the 250 mm near point. */
export const ballMagnification = (n, D, near = NEAR_POINT_MM) => near / ballFocalLength(n, D);
/* The bead diameter that yields a wanted magnification. */
export const ballDiameterFor = (n, M, near = NEAR_POINT_MM) => (4 * (n - 1) * near) / (n * M); // mm

/* Numerical aperture of the full sphere as seen from the axial object point
   sitting at the front focus: sin u = R/f, and f = nR/(2(n−1)) so the R
   cancels — the NA of a ball magnifier depends only on the glass index. */
export const ballNA = (n) => (2 * (n - 1)) / n;

/* Abbe resolution of that full cone. */
export const abbeResolutionUm = (n, lambdaUm = 0.55) => lambdaUm / (2 * ballNA(n));

/* How big a feature of `sizeUm` looks through magnification M, in arcminutes. */
export const apparentArcmin = (sizeUm, M) =>
  ((sizeUm * 1e-3 * M) / NEAR_POINT_MM) / EYE_ARCMIN_RAD;

/* The magnification at which a feature of `sizeUm` lands exactly on the eye's
   1-arcminute bar. */
export const eyeNeedsMagnification = (sizeUm) =>
  (NEAR_POINT_MM * 1000 * EYE_ARCMIN_RAD) / sizeUm;

/* The largest bead whose diffraction limit still clears the eye's bar —
   the whole reason his lenses had to be pinheads. */
export const maxDiameterForEye = (n, lambdaUm = 0.55, near = NEAR_POINT_MM) =>
  ballDiameterFor(n, eyeNeedsMagnification(abbeResolutionUm(n, lambdaUm)), near);

/* Wave-optical depth of field, and how many degrees of his ~0.5 mm-pitch
   focus screw one depth of field costs (pitch is modelled, see NOTES). */
export const depthOfFieldUm = (lambdaUm, NA) => lambdaUm / (NA * NA);
export const screwDegreesPerDOF = (lambdaUm, NA, pitchMm = 0.5) =>
  360 * (depthOfFieldUm(lambdaUm, NA) / 1000) / pitchMm;

/* ==========================================================================
   Exact ray trace through a sphere (Snell twice, no paraxial approx).
   Object sits on the axis at distance f from the centre; the ray enters at
   surface height h on the front hemisphere. Returns the entry/exit points
   (for drawing) and the exit angle (0 = paraxial-parallel for an object at
   the front focus). A ray entering a sphere from air can never total-
   internally reflect on exit — the internal angle at the far surface equals
   the refracted entry angle, which is always sub-critical — so `tir` is a
   guard that honest callers expect to be false.
   ========================================================================== */
export function traceBallRay(n, D, h, objectDist) {
  const R = D / 2;
  if (!(h > 0) || h >= R || objectDist <= R) return null;
  const P = { x: -Math.sqrt(R * R - h * h), y: h };
  const S = { x: -objectDist, y: 0 };
  let d = { x: P.x - S.x, y: P.y - S.y };
  const len = Math.hypot(d.x, d.y);
  d = { x: d.x / len, y: d.y / len };

  const refract = (dir, Nout, n1, n2) => {
    // Nout is the OUTWARD normal; flip it to face the incoming ray so the
    // same Snell code serves both the entry (air→glass) and exit surfaces.
    let N = Nout;
    let cosI = -(dir.x * N.x + dir.y * N.y);
    if (cosI < 0) { N = { x: -N.x, y: -N.y }; cosI = -cosI; }
    const s2 = ((n1 / n2) ** 2) * (1 - cosI * cosI);
    if (s2 > 1) return null;                       // total internal reflection
    const cosT = Math.sqrt(1 - s2);
    const k = n1 / n2;
    return { x: k * dir.x + (k * cosI - cosT) * N.x, y: k * dir.y + (k * cosI - cosT) * N.y };
  };

  const Nin = { x: P.x / R, y: P.y / R };
  const d2 = refract(d, Nin, 1, n);
  if (!d2) return { tir: true };
  const t = -2 * (P.x * d2.x + P.y * d2.y);        // chord through the sphere
  const Q = { x: P.x + t * d2.x, y: P.y + t * d2.y };
  const d3 = refract(d2, { x: Q.x / R, y: Q.y / R }, n, 1);
  if (!d3) return { tir: true };
  return {
    tir: false, entry: P, exit: Q,
    exitAngleRad: Math.atan2(d3.y, d3.x),
    exitDir: d3,
  };
}

/* ==========================================================================
   Machine II — the colour trap (chromatic vs diffraction sweet spot)
   ========================================================================== */

/* Cauchy dispersion anchored at n_d (0.5876 µm) and an Abbe V-number. */
export const cauchyIndex = (lambdaUm, nd = 1.52, v = 64) => {
  const B = ((nd - 1) / v) / (1 / 0.4861 ** 2 - 1 / 0.6563 ** 2);
  return nd + B * (1 / lambdaUm ** 2 - 1 / 0.5876 ** 2);
};

/* Axial chromatic aberration of a ball lens: |f_F − f_C| in µm. */
export const axialChromatismUm = (D, nd = 1.52, v = 64) => {
  const nF = cauchyIndex(0.4861, nd, v);
  const nC = cauchyIndex(0.6563, nd, v);
  return 1000 * (D / 4) * Math.abs(nF / (nF - 1) - nC / (nC - 1));
};

/* Stopped down to an effective cone NA, the two blurs add in quadrature:
   diffraction grows as NA falls, chromatic smear grows as NA rises. */
export const totalBlurUm = (lambdaUm, dfUm, NA) =>
  Math.hypot(lambdaUm / (2 * NA), dfUm * NA);

/* Closed-form optimum of that trade — the NA where colour and diffraction
   blur meet. Minimising a²/x² + b²x² gives x⁴ = a²/b². */
export const optimalNA = (lambdaUm, dfUm) => Math.sqrt(lambdaUm / (2 * dfUm));
export const minResolutionUm = (lambdaUm, dfUm) => Math.sqrt(lambdaUm * dfUm);

export const GLASSES = [
  { id: 'sodalime', label: 'soda-lime glass', nd: 1.52, v: 64 },
  { id: 'flint', label: 'flint glass', nd: 1.62, v: 36 },
  { id: 'highindex', label: 'high-index (modelled)', nd: 1.75, v: 45 },
];

/* ==========================================================================
   Machine III — the scurf of the teeth
   ========================================================================== */

/* Modern oral microbiology: wet dental plaque runs ~10¹¹ bacteria per gram.
   Historical demography (labelled estimates in the UI): the Dutch Republic
   c. 1675 ≈ 1.9 million; Europe c. 1700 ≈ 110 million. */
export const PLAQUE_PER_GRAM = 1e11;
export const POPULATIONS = [
  { id: 'republic', label: 'the Dutch Republic (c. 1675)', people: 1.9e6 },
  { id: 'europe', label: 'all of Europe (c. 1700)', people: 1.1e8 },
];

export const plaqueCount = (massMg) => PLAQUE_PER_GRAM * (massMg / 1000);

/* Verdict of a bead whose (stopped-down) blur is d µm on a feature of the
   given width: cleanly resolved, a visible blip, or below the floor. */
export function verdictFor(sizeUm, blurUm) {
  if (sizeUm >= 2 * blurUm) return 'resolved';
  if (sizeUm >= blurUm) return 'blip';
  return 'invisible';
}

/* ==========================================================================
   Machine IV — the ladder and the timeline
   ========================================================================== */

export const LADDER = [
  { id: 'hair', label: 'a hair of one\'s head', sizeUm: 70, kind: 'reference' },
  { id: 'rbc', label: 'red blood cell', sizeUm: 7.5, kind: 'reference' },
  { id: 'rod', label: 'the plump rod (length)', sizeUm: 4, kind: 'creature' },
  { id: 'coccus', label: 'the exceeding small (width)', sizeUm: 0.8, kind: 'creature' },
  { id: 'spirochete', label: 'the pike (width)', sizeUm: 0.25, kind: 'creature' },
];

export const FLOORS = [
  { id: 'hooke', label: 'Hooke\'s compound, c. 1665', um: 5 },
  { id: 'leeuwenhoek', label: 'Leeuwenhoek\'s bead, measured', um: 1.4 },
  { id: 'modern-light', label: 'modern optical (NA 1.4 oil)', um: 0.2 },
  { id: 'electron', label: 'electron microscope', um: 0.0005 },
];

export const TIMELINE = [
  ['1632-10-24', 'A draper is born', 'Antonie van Leeuwenhoek is born in Delft; he will sell cloth, gauge wine for the city, and never learn Latin.'],
  ['1654', 'The shop in Delft', 'Back from his Amsterdam apprenticeship he opens a draper\'s shop — the magnifying glasses for counting thread are the day job.'],
  ['1665', 'Micrographia', 'Hooke\'s engraved flea dazzles Europe, but his compound microscope fogs past ~20–30×.'],
  ['1673', 'First letter to London', 'His observations on moulds and bees reach the Royal Society, forwarded through Henry Oldenburg.'],
  ['1674-09-07', 'Green streaks in Berkelse Mite lake', 'Spiral filaments "of the thickness of a hair of one\'s head" — the first microorganisms anyone describes.'],
  ['1676-10-09', 'The pepper water', 'Bacteria at last: in a rainwater infusion of pepper he finds creatures smaller than anything he has measured before (his 9 October 1676 letter).'],
  ['1677', 'London verifies', 'Disbelief, then witnesses repeat the observation; Hooke confirms with a single-lens microscope of his own making.'],
  ['1680-02', 'Fellow of the Royal Society', 'Elected on Croone\'s nomination; he never attends a single meeting.'],
  ['1683-09-17', 'The scurf of the teeth', 'The letter to Francis Aston: plaque "as thick as if \'twere batter", little animals "very prettily a-moving", the pike, the top-spinners — the first description of bacteria.'],
  ['1697-10', 'Peter the Great on the boat', 'The touring Tsar calls on the 65-year-old and leaves with an eel-viewer for studying blood circulation.'],
  ['1723-08-26', 'Ninety years, then silence', 'He dies in Delft; his pastor credits "certain most excellent lenses" made "by diligence and tireless labour". Roughly 560 letters, more than 500 lenses — nine microscopes survive today.'],
  ['1861', 'Pasteur\'s germs', 'A hundred and seventy-eight years after the pike, germ theory finally gives the little animals a job.'],
  ['1876', 'Koch\'s pure culture', 'Bacillus anthracis grown in isolation: microbiology becomes a laboratory science.'],
  ['1884', 'The Gram stain', 'Bacteria get names, colours and a taxonomy.'],
  ['1931', 'The electron microscope', 'Ruska\'s electron optics push the resolution floor four orders of magnitude past the bead.'],
  ['1981', 'The strong room', 'Brian Ford finds Leeuwenhoek\'s original specimen packets still filed in the Royal Society collections — well enough preserved to re-photograph. The little animals were really there.'],
  ['today', 'Seven hundred species', 'Modern oral microbiology counts ~700 bacterial species in the healthy human mouth — every one of them his descendants-in-observation.'],
];
