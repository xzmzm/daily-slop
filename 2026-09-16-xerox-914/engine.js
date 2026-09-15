/* ==========================================================================
   Xerox 914 studio — the closed-form physics of the first plain-paper copy.

   Every number the UI shows comes from these pure functions, and
   test_xerox.mjs pins them to hand-computed values. Two kinds of constants
   live here:

   · M914 / HISTORY are documented anchors (Wikipedia "Xerox 914" and
     "Xerography" / "Chester Carlson", Smithsonian, The Henry Ford,
     Office Museum, David Owen's "Copies in Seconds").
   · The physics defaults (selenium thickness, toner radius, q/m, …) are
     textbook electrophotography values from the modelling literature
     (e.g. Schein, "Electrophotography and Development Physics"); they are
     representative of the era, not factory data for the 914, and NOTES.md
     says so explicitly.

   Sign convention: the 914's selenium surface charges POSITIVE and its
   toner is NEGATIVE, so "image" areas (dark on the original) keep their
   charge and attract toner — the copy is born with the right polarity.
   ========================================================================== */

export const EPS0 = 8.8541878128e-12;   // F/m
export const Q_E = 1.602176634e-19;      // C
export const HC = 1.98644586e-25;        // J·m  (h·c)
export const ER_SE = 6.3;                // relative permittivity, amorphous selenium
export const RHO_TONER = 1100;           // kg/m³ (≈1.1 g/cm³ carbon-in-resin toner)
export const E_AIR = 3e6;                // V/m, approximate breakdown field of air
export const CP_TONER = 1300;            // J/(kg·K) specific heat of toner resin
export const D_T_FUSE = 130;             // K, fuser lift above room temperature

/* ---- documented 914 / history anchors ---- */
export const M914 = {
  copyWidth: 9, copyLength: 14,          // inches — the machine's whole name
  cpm: 7,                                // copies per minute
  weightLb: 650,                         // Smithsonian: 648
  dimsIn: [42, 46, 45],                  // H × W × D
  purchase: 27500,                       // sale price (the US government buys, never rents)
  leaseMonth: 95, leaseIncluded: 2000, leaseExtra: 0.04, // 1959 lease: 2,000 copies included
  rentMonth: 25, rentCopy: 0.10,         // 1965 metered rental: $25 + 10¢/copy
  maxCopiesMonth: 100000,
};
export const COPY_AREA_M2 = M914.copyWidth * 0.0254 * M914.copyLength * 0.0254; // 0.0812 m²

/* Alternatives, circa 1959 — supplies cost per copy, sources in NOTES.md */
export const RIVALS = [
  { name: 'Photostat', rate: 0.35, note: 'camera copy on photographic paper' },
  { name: 'Verifax', rate: 0.15, note: 'Kodak wet-process; $0.15 supplies in 1969' },
  { name: 'Thermofax', rate: 0.075, note: '3M heat-sensitive coated paper' },
  { name: 'Mimeograph', rate: 0.008, stencil: 0.90, note: 'cut a stencil first, purple ink' },
];

/* ---- working defaults shared by machines 1–3 ---- */
export const DEFAULTS = {
  V0: 900,          // V, corona charge on the selenium surface
  Vr: 75,           // V, residual potential (trapped charge; the PIDC floor)
  lambda: 480e-9,   // m, exposure wavelength — selenium is blind past ~600 nm
  eta: 0.6,         // quantum efficiency of carrier generation
  d: 45e-6,         // m, vacuum-deposited amorphous selenium layer
  wireR: 80e-6,     // m, corona wire radius
  coronaGap: 8e-3,  // m, wire-to-drum distance (Wikipedia: 6–13 mm)
  coronaV: 6500,    // V, corona supply
  rhoDark: 1e14,    // Ω·cm, selenium dark resistivity
  fluence: 4,       // erg/cm², light landing on the WHITE areas of the original
  printOD: 1.3,     // optical density of the original's ink → image fluence attenuation
  gap: 300e-6,      // m, development gap (bead contact height over the drum)
  qm: 4e-3,         // C/kg, toner charge-to-mass (4 µC/g)
  tonerR: 4e-6,     // m, toner particle radius
  eVdw: 1.9e6,      // V/m, effective van der Waals release threshold (modelled)
  packing: 0.55,    // random-close packing of the toner monolayer
  odSolid: 2.0,     // optical density of a fully fused toner film
};

/* ---- copy cadence ---- */
export const copyCycleSeconds = () => 60 / M914.cpm;               // 8.571 s
export const halfRotationSeconds = () => copyCycleSeconds() / 2;   // charge→develop lag

/* ==========================================================================
   Machine 2 — corona charging and the photoconductor
   ========================================================================== */

/* Peek's law: field at which air breaks down at a wire surface. */
export function peekOnset(rWire, delta = 1) {
  return 3e6 * delta * (1 + 0.0301 / Math.sqrt(delta * rWire)); // V/m
}

/* Field at the wire surface, wire parallel to a plane distance h away
   (equivalent-cylinder approximation of the coaxial result). */
export function coronaField(rWire, h, V) {
  return V / (rWire * Math.log(2 * h / rWire)); // V/m
}
export function coronaOnsetVoltage(rWire, h, delta = 1) {
  return peekOnset(rWire, delta) * rWire * Math.log(2 * h / rWire); // V
}
export const coronaIsOn = (s) => coronaField(s.wireR, s.coronaGap, s.coronaV) > peekOnset(s.wireR);

/* Selenium layer as a parallel-plate capacitor. */
export const plateCap = (d) => (EPS0 * ER_SE) / d;            // F/m²
export const capPFcm2 = (d) => plateCap(d) * 1e8;             // pF/cm²
export const surfaceCharge = (V, d) => (EPS0 * ER_SE * V) / d; // C/m²

/* Dark decay: a Maxwell relaxation with τ = ρε. */
export const darkTau = (rhoOhmCm) => (rhoOhmCm / 100) * EPS0 * ER_SE; // s
export const darkDecay = (V0, t, tau) => V0 * Math.exp(-t / tau);     // V

/* Photodischarge: every absorbed photon of charge e that crosses the layer
   neutralises exactly one capacitor charge e.  Linear-in-fluence discharge
   down to a trapping residual — the first-order a-Se PIDC.  Selenium's
   ~2 eV band gap makes it blind to red: past 610 nm the photon is simply
   not absorbed, so the response cuts off hard (which is why the 1938
   experiment and the darkrooms after it could work under red safelights). */
export const SPECTRAL_CUTOFF = 610e-9; // m (≈ 2.03 eV band edge)
export const spectralResponse = (lambda) => (lambda <= SPECTRAL_CUTOFF ? 1 : 0);
export function photoRate(lambda, eta, d) { // V of discharge per J/m² of light
  return ((Q_E * eta * lambda) / HC) * (d / (EPS0 * ER_SE)) * spectralResponse(lambda);
}
export const photoPerErg = (lambda, eta, d) => photoRate(lambda, eta, d) * 1e-3; // V per erg/cm²
export function pid(fluenceErg, V0, Vr, lambda, eta, d, attenuation = 1) {
  return Math.max(Vr, V0 - photoPerErg(lambda, eta, d) * fluenceErg * attenuation);
}
export const imageAttenuation = (printOD) => Math.pow(10, -printOD);

export const vBackground = (s) => pid(s.fluence, s.V0, s.Vr, s.lambda, s.eta, s.d, 1);
export const vImage = (s) => pid(s.fluence, s.V0, s.Vr, s.lambda, s.eta, s.d, imageAttenuation(s.printOD));
export const contrastPotential = (s) => vImage(s) - vBackground(s);

/* ==========================================================================
   Machine 3 — cascade development
   ========================================================================== */

/* Field over an image element, development gap g over a dielectric drum
   coating of thickness d: the coating counts as its electrical thickness
   d/εr. */
export const gapEffective = (s) => s.gap + s.d / ER_SE;
export const devField = (Vc, g, d) => Vc / (g + d / ER_SE);         // V/m
export const devFieldState = (s) => devField(contrastPotential(s), s.gap, s.d);
export const bgFieldState = (s) => devField(vBackground(s), s.gap, s.d);
export const belowAirBreakdown = (E) => E < E_AIR;

/* Image-force adhesion: a charged toner sphere touching a conductor is held
   by its own image with F = q²/(16πε0 r²); releasing it needs
   qE ≥ F, i.e. E ≥ (q/m)·ρ·r/(12ε0).  Purely electrostatic; van der
   Waals adds a roughly radius-independent floor (modelled as eVdw). */
export const tonerCharge = (qm, r, rho = RHO_TONER) => qm * rho * (4 / 3) * Math.PI * r ** 3; // C
export const releaseField = (qm, r, rho = RHO_TONER) => (qm * rho * r) / (12 * EPS0); // V/m
export const releaseTotal = (s) => releaseField(s.qm, s.tonerR) + s.eVdw; // V/m

/* Neutralisation development: toner deposits until its charge screens the
   field.  M/A = ε0·E / (q/m)  (Schein, ch. on cascade development). */
export const massPerArea = (Vc, g, d, qm) => (EPS0 * devField(Vc, g, d)) / qm; // kg/m²
export const massPerAreaState = (s) => massPerArea(contrastPotential(s), s.gap, s.d, s.qm);
export const mgPerCm2 = (kgPerM2) => kgPerM2 * 100; // 1 kg/m² = 100 mg/cm²

/* Monolayer statistics: n statistical monolayers → area coverage. */
export const monolayerMass = (r, rho = RHO_TONER, packing = 0.55) => (4 / 3) * packing * rho * r; // kg/m²
export const coverage = (MA, r, packing = 0.55) => 1 - Math.exp(-MA / monolayerMass(r, RHO_TONER, packing));
/* Murray–Davies print density from area coverage. */
export const opticalDensity = (c, odSolid = 2) => -Math.log10(1 - c + c * Math.pow(10, -odSolid));

export const tonerPerCm2 = (MA, r, rho = RHO_TONER) => MA / (rho * (4 / 3) * Math.PI * r ** 3) / 1e4;

/* Regime verdict, in physical order: if the field over the discharged
   background already releases toner, the whole page dirties (fog); else if
   the image field can't pull toner off the beads, the copy stays white
   (blank); else it's good. */
export const imageDevelops = (s) => devFieldState(s) > releaseTotal(s);
export const backgroundFogs = (s) => bgFieldState(s) > releaseTotal(s);
export function regime(s) {
  if (backgroundFogs(s)) return 'fog';
  if (!imageDevelops(s)) return 'blank';
  return 'good';
}
/* White-background discharge needed to just avoid fog, and the fluence
   that achieves it (inverted photodischarge). */
export const vBgNoFog = (s) => releaseTotal(s) * gapEffective(s);
export const fluenceNoFog = (s) => Math.max(0, (s.V0 - vBgNoFog(s)) / photoPerErg(s.lambda, s.eta, s.d));

/* ---- fuser arithmetic ---- */
export const fuseEnergy = (kg) => kg * CP_TONER * D_T_FUSE; // J
export const tonerPerCopyKg = (MA) => MA * COPY_AREA_M2;    // full-coverage copy
export const fusePowerAtCpm = (kg) => (fuseEnergy(kg) * M914.cpm) / 60; // W average

/* ==========================================================================
   Machine 4 — the copy economy
   ========================================================================== */

export const leaseMonthly = (n) => M914.leaseMonth + Math.max(0, n - M914.leaseIncluded) * M914.leaseExtra;
export const rentMonthly = (n) => M914.rentMonth + M914.rentCopy * n;
export const mimeoMonthly = (n, originals) => RIVALS[3].stencil * originals + RIVALS[3].rate * n;
export const perCopy = (cost, n) => (n <= 0 ? Infinity : cost / n);

/* Break-even volume against a flat per-copy rival (null if never). */
export function crossoverFlat(rate) {
  const denom = rate - M914.leaseExtra;
  if (denom <= 0) return null;
  const n = (M914.leaseMonth - M914.leaseIncluded * M914.leaseExtra) / denom;
  return n > 0 ? n : null;
}
/* Break-even volume against the mimeograph at `originals` distinct masters
   per month (null if the mimeograph is always cheaper). */
export function crossoverMimeo(originals) {
  const num = RIVALS[3].stencil * originals - (M914.leaseMonth - M914.leaseIncluded * M914.leaseExtra);
  const denom = M914.leaseExtra - RIVALS[3].rate;
  if (num <= 0) return null;
  return num / denom;
}

/* Scorch gauge for machine 1. The honest thermodynamics above shows melting
   the toner itself costs single-digit watts — the real 914 fires came off
   the fuser nip scorching heavy-coverage paper (pages full of zeros and
   O's were the notorious case). So the gauge is a rated-coverage toy:
   load = dark fraction of the original × (developed mass / rated mass),
   fire above 0.40, smoke above 0.28. Not data — a dramatisation knob. */
export const RATED_MA = 0.0051; // kg/m², the design development level
export const SCORCH_FIRE = 0.40;
export const SCORCH_SMOKE = 0.28;
export const scorchLoad = (docCoverage, MA) => docCoverage * (MA / RATED_MA);
export const catchesFire = (docCoverage, MA) => scorchLoad(docCoverage, MA) > SCORCH_FIRE;

/* ---- timeline (all rows documented; see NOTES.md) ---- */
export const TIMELINE = [
  ['1938-10-22', 'Astoria, Queens', 'Carlson & Kornei: sulfur on zinc, a handkerchief charge, lycopodium dust — "10.-22.-38 ASTORIA." copied in seconds'],
  ['1942-10-06', 'Patent 2,297,691', 'Electrophotography patented after years of rejections (20+ companies said no)'],
  ['1944/45', 'Battelle', 'Battelle Memorial Institute takes over development as Carlson\'s agent'],
  ['1946-12', 'Haloid', 'Haloid licenses xerography for $10,000 — about 10 % of its 1945 earnings'],
  ['1949', 'Xerox Model A', 'First commercial xerographic machine: 39 manual steps per copy ("Ox Box")'],
  ['1955', 'Copyflo', 'Continuous-flow xerographic printer keeps the drum idea earning'],
  ['1959-09-16', 'Sherry-Netherland', 'The 914 shown on live television; one of the two demo machines catches fire'],
  ['1960-03', 'Deliveries', 'First 914s reach customers; plain paper, 7 copies a minute'],
  ['1961', 'Xerox Corporation', 'Haloid-Xerox renames itself after a copier'],
  ['1965', '$25 + 10¢', 'Metered rental; the 914 is credited with roughly two-thirds of revenue (~$243 M)'],
  ['1970', '95 %', 'Xerox holds about 95 % of the plain-paper copier market'],
  ['1977', 'Retirement', 'Last 914 built; Smithsonian keeps unit #517'],
];
