/* Closed-form assertions for the Random Surfer studio. Run: node test_pagerank.mjs */
import * as P from './pagerank.js';
import * as E from './engine.js';

let passed = 0;
const checks = [];
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  checks.push([ok, `${name}: got ${typeof got === 'number' ? got.toPrecision(6) : got}, want ${want.toPrecision(6)} ±${tol.toPrecision(3)}`]);
  if (ok) passed++;
}
function isTrue(name, cond, detail = '') {
  checks.push([cond, `${name} ${detail}`]);
  if (cond) passed++;
}

const D = 0.85;

/* ---------- PageRank core ---------- */
const N16 = E.DOCS.length;
const A16 = P.linkMatrix(E.SNAPSHOT_EDGES, N16, true);

// sum invariant at EVERY iteration
{
  let x = P.uniform(N16);
  let worst = 0;
  for (let k = 0; k < 80; k++) {
    x = P.googleStep(A16, x, D);
    worst = Math.max(worst, Math.abs(P.sum(x) - 1));
  }
  near('Σr stays exactly 1 through 80 iterations', worst, 0, 1e-12);
}

// power iteration converges to the direct solve of (I − dA) r = (1−d)/N·1
const rExact = P.solveRank(E.SNAPSHOT_EDGES, N16, D, true);
{
  const { x } = P.powerIterate(A16, P.uniform(N16), D, 300);
  const err = Math.max(...x.map((v, i) => Math.abs(v - rExact[i])));
  near('power iteration matches the direct solve (16-page web)', err, 0, 1e-10);
}
near('direct solve also sums to 1', P.sum(rExact), 1, 1e-9);
isTrue('Yahoo outranks the googol page', rExact[0] > rExact[E.DOCS.findIndex((d) => d.id === 'googol')]);
{
  const gi = E.DOCS.findIndex((d) => d.id === 'googol');
  isTrue('the teleport floor holds: nobody links you below (1−d)/N', rExact[gi] >= (1 - D) / N16 - 1e-12);
  near('googol page rank pinned (floor + homework’s one inlink)', rExact[gi], 0.01964, 5e-5);
}

// star closed form (2-state symmetry reduction), exact algebra
{
  const k = 7;
  const { hub, leaf } = P.starRanks(k, D);
  near('star hub rank, closed form', hub, (1 + D * k) / ((k + 1) * (1 + D)), 1e-15);
  near('star leaves sum with hub to 1', hub + k * leaf, 1, 1e-12);
  const rStar = P.solveRank(P.starEdges(k), k + 1, D, true);
  near('star closed form matches the direct solve (hub)', rStar[0], hub, 1e-10);
  near('star closed form matches the direct solve (leaf)', rStar[1], leaf, 1e-10);
}

/* ---------- convergence factor and the spectrum identity ---------- */
{
  const A = P.linkMatrix(P.cycleEdges(8), 8, true);
  const { residuals } = P.powerIterate(A, P.pointMass(8, 0), D, 60);
  near('cycle-8 measured decay ratio = d (seven eigenvalues share modulus d; the ratio hovers)',
    P.measuredFactor(residuals), D, 5e-3);
}
{
  const A = P.linkMatrix(P.starEdges(7), 8, true);
  const { residuals } = P.powerIterate(A, P.pointMass(8, 0), D, 60);
  near('star-8 measured decay ratio = d exactly (strict gap: |μ₂|=1, |μ₃|=0)',
    P.measuredFactor(residuals), D, 1e-6);
}
{
  const A = P.linkMatrix(P.cliquePairEdges(), 8, true);
  const { residuals } = P.powerIterate(A, P.pointMass(8, 0), D, 60);
  near('two disconnected K₄s: factor = d·1 (μ₂ = 1)', P.measuredFactor(residuals), D, 3e-3);
}
{
  // d = 1 on a cycle: period-2 oscillation, no limit
  const A = P.linkMatrix(P.cycleEdges(8), 8, true);
  const { residuals, x } = P.powerIterate(A, P.pointMass(8, 0), 1.0, 300);
  isTrue('d = 1 on a cycle never converges', residuals[299] > 0.1, `(final residual ${residuals[299].toFixed(3)})`);
  isTrue('…and the vector keeps flipping with period 2', Math.abs(x[0] - P.pointMass(8, 0)[0]) > 0.9);
}
{
  // rank starvation: with d = 1 and two worlds, the unseeded component gets nothing
  const A = P.linkMatrix(P.cliquePairEdges(), 8, true);
  const { x } = P.powerIterate(A, P.pointMass(8, 0), 1.0, 300);
  near('stranded component ranks sum to 0 at d = 1', P.sum(x.slice(4)), 0, 1e-9);
  near('surviving component keeps all the mass', P.sum(x.slice(0, 4)), 1, 1e-9);
}
{
  // spec(G) = {1} ∪ {d·μ} verified against the eigenvalues of the formed matrix
  const A = P.linkMatrix(P.cycleEdges(8), 8, true);
  const G = A.map((row) => row.map((v) => D * v + (1 - D) / 8));
  const canon = (list) => list
    .map(([re, im]) => [Math.round(re * 1e6) / 1e6, Math.round(im * 1e6) / 1e6])
    .sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));
  const specDirect = canon(P.eigenvalues(G).map((m) => [m.re, m.im]));
  const specClaim = canon(P.specGoogle(A, D).map((m) => [m.re, m.im]));
  let worst = 0;
  for (let i = 0; i < 8; i++) worst = Math.max(worst, Math.hypot(specDirect[i][0] - specClaim[i][0], specDirect[i][1] - specClaim[i][1]));
  near('eigenvalues of formed G match {1} ∪ d·spec(A)', worst, 0, 1e-6);
  const mods = specDirect.map(([re, im]) => Math.hypot(re, im)).sort((a, b) => b - a);
  near('largest eigenvalue of G is 1', mods[0], 1, 1e-6);
  near('all seven others sit exactly on the circle |λ| = d', mods[1], D, 1e-6);
  near('…including the smallest', mods[7], D, 1e-6);
}
{
  // 3-cycle: the complex pair d·e^{±2πi/3}
  const A = P.linkMatrix(P.cycleEdges(3), 3, true);
  const spec = P.specGoogle(A, D);
  const pair = spec.filter((m) => Math.abs(m.im) > 0.1);
  isTrue('the 3-cycle owns a complex-conjugate pair', pair.length === 2);
  near('its real part is d·cos 120° = −0.425', pair[0].re, -0.425, 1e-6);
  near('its modulus is d·|μ₂| = 0.85', Math.hypot(pair[0].re, pair[0].im), D, 1e-6);
}

/* ---------- dangling pages ---------- */
{
  const leaky = P.linkMatrix(P.lineEdges(6), 6, false);
  const colSum = (j) => leaky.reduce((a, row) => a + row[j], 0);
  isTrue('unrepaired line graph is column-substochastic',
    leaky.every((_, j) => colSum(j) <= 1 + 1e-12) && colSum(5) === 0);
  const { x } = P.powerIterate(leaky, P.uniform(6), D, 200);
  isTrue('without repair the walk drains toward zero', P.sum(x) < 0.5, `(Σr = ${P.sum(x).toFixed(3)})`);
  const repaired = P.linkMatrix(P.lineEdges(6), 6, true);
  isTrue('every repaired column sums to 1',
    repaired.every((_, j) => Math.abs(repaired.reduce((a, row) => a + row[j], 0) - 1) < 1e-12));
  const rLine = P.solveRank(P.lineEdges(6), 6, D, true);
  near('repaired line graph still sums to 1', P.sum(rLine), 1, 1e-9);
}

/* ---------- the 1998 paper's numbers ---------- */
near('0.85⁵² — residual after the paper’s 52-iteration run', Math.pow(0.85, 52), 2.138e-4, 1e-6);
near('worst-case iterations to 1e−6 at d = 0.85', P.iterationsFor(1e-6, 0.85), 86, 0);
near('…at d = 0.99 the same tolerance takes', P.iterationsFor(1e-6, 0.99), 1375, 1);
{
  const g = Array.from({ length: 40 }, (_, i) => Math.pow(0.5, i));
  near('measuredFactor recovers a clean geometric rate', P.measuredFactor(g), 0.5, 1e-9);
}

/* ---------- the surfer ---------- */
{
  const trailOf = (seed) => {
    const rand = P.mulberry32(seed);
    let at = 0;
    return Array.from({ length: 100 }, () => (at = P.surferHop(E.SNAPSHOT_EDGES, N16, at, rand, D)));
  };
  isTrue('seeded surfer walks replay identically',
    JSON.stringify(trailOf(20260915)) === JSON.stringify(trailOf(20260915)));
}

/* ---------- the index ---------- */
const IDX = E.buildIndex();
isTrue('16 pages in the snapshot', IDX.N === 16);
isTrue('no page contains the word “google” (14 Sep 1997)',
  E.DOCS.every((d) => !E.tokenize(`${d.title} ${d.body}`).includes('google')));
{
  for (const t of ['web', 'search', 'googol']) {
    const p = IDX.postings[t];
    isTrue(`postings[${t}] sorted, no duplicates`,
      p.every((v, i) => i === 0 || p[i - 1] < v));
  }
}
{
  const res = E.searchAND(IDX, 'web search');
  const pw = IDX.postings.web, ps = IDX.postings.search;
  const inter = pw.filter((x) => ps.includes(x));
  isTrue('AND result equals the posting intersection',
    JSON.stringify(res.docs.map((d) => d.i).sort((a, b) => a - b)) === JSON.stringify(inter));
  isTrue('intersection respects the min bound', inter.length <= Math.min(pw.length, ps.length));
}

// pinned BM25 winner, recomputed independently from the raw corpus text
{
  const res = E.searchAND(IDX, 'web search', 1.2, 0.75);
  const top = res.docs[0];
  const doc = E.DOCS[top.i];
  const words = E.tokenize(`${doc.title} ${doc.url.replace(/\./g, ' ')} ${doc.body}`);
  const tf = {};
  for (const w of words) tf[w] = (tf[w] || 0) + 1;
  const len = words.length;
  let avg = 0;
  for (const d2 of E.DOCS) avg += E.tokenize(`${d2.title} ${d2.url.replace(/\./g, ' ')} ${d2.body}`).length;
  avg /= E.DOCS.length;
  const dfw = IDX.postings.web.length, dfs = IDX.postings.search.length;
  const idfW = Math.log(1 + (16 - dfw + 0.5) / (dfw + 0.5));
  const idfS = Math.log(1 + (16 - dfs + 0.5) / (dfs + 0.5));
  const sW = (idfW * tf.web * 2.2) / (tf.web + 1.2 * (1 - 0.75 + 0.75 * (len / avg)));
  const sS = (idfS * tf.search * 2.2) / (tf.search + 1.2 * (1 - 0.75 + 0.75 * (len / avg)));
  near(`BM25 winner ${doc.id} score, recomputed from raw text`, top.score, sW + sS, 1e-12);
  isTrue('the AND winner set has no zero scores', res.docs.every((d2) => d2.score > 0));
}

/* ---------- BM25 exact identities ---------- */
{
  const res0 = E.searchAND(IDX, 'web search', 0, 0.75);
  const scores = res0.docs.map((d) => d.score);
  near('k₁ = 0 kills term-frequency: every survivor scores Σidf', Math.max(...scores) - Math.min(...scores), 0, 1e-15);
}
{
  // b = 0 removes length normalization: same tf ⇒ same score, any length
  const pair = [];
  for (let i = 0; i < IDX.N && pair.length < 2; i++) {
    const f = IDX.tf[i].search || 0;
    if (f === 1) pair.push(i);
  }
  isTrue('two same-tf pages exist for the length test', pair.length === 2);
  if (pair.length === 2) {
    isTrue('lengths genuinely differ', IDX.len[pair[0]] !== IDX.len[pair[1]]);
    isTrue('b = 0: scores identical to the last bit',
      E.bm25Term(IDX, pair[0], 'search', 1.2, 0) === E.bm25Term(IDX, pair[1], 'search', 1.2, 0));
    isTrue('b = 0.75: length breaks the tie',
      E.bm25Term(IDX, pair[0], 'search', 1.2, 0.75) !== E.bm25Term(IDX, pair[1], 'search', 1.2, 0.75));
  }
}
{
  const i = IDX.postings.web[0];
  const ceil = E.idf(IDX, 'web') * (1.2 + 1);
  const tf = 1e7, L = IDX.len[i], norm = 1.2 * (1 - 0.75 + 0.75 * L / IDX.avgdl);
  near('tf → ∞ saturates at the ceiling idf·(k₁+1)', (E.idf(IDX, 'web') * tf * 2.2) / (tf + norm), ceil, 1e-4);
}
isTrue('idf is decreasing in df', E.idf(IDX, 'googol') > E.idf(IDX, 'web'));

/* ---------- did you mean ---------- */
near('lev(google, googol) — googol’s “ol” shuffled to “le”', E.levenshtein('google', 'googol'), 2, 0);
near('lev(googol, googolplex)', E.levenshtein('googol', 'googolplex'), 4, 0);
near('lev(web, web)', E.levenshtein('web', 'web'), 0, 0);
{
  const res = E.searchAND(IDX, 'google');
  isTrue('“google” matches nothing in the snapshot', res.docs.length === 0);
  const dym = E.didYouMean(IDX, 'google');
  isTrue('did you mean: googol, two edits away and the nearest word in the index',
    dym.length === 1 && dym[0].to === 'googol' && dym[0].dist === 2);
}
{
  const res = E.searchAND(IDX, 'googol');
  isTrue('“googol” has exactly one AND survivor', res.docs.length === 1);
  isTrue('…and it is the math page', E.DOCS[res.docs[0].i].id === 'googol');
}

/* ---------- the blend ---------- */
{
  const bm = E.blendResults(IDX, rExact, 'web search', 0).docs;
  const pr = E.blendResults(IDX, rExact, 'web search', 1).docs;
  const mid = E.blendResults(IDX, rExact, 'web search', 0.35).docs;
  isTrue('α = 0 ranks by BM25 alone',
    JSON.stringify(bm.map((d) => d.i)) === JSON.stringify([...bm].sort((a, b) => b.score - a.score || a.i - b.i).map((d) => d.i)));
  const prMax = pr.reduce((a, b) => (rExact[b.i] > rExact[a.i] ? b : a));
  isTrue('α = 1 puts the highest-rank survivor on top', pr[0].i === prMax.i,
    `(${E.DOCS[pr[0].i].id} wins)`);
  isTrue('the blend keeps both scores finite', mid.every((d) => d.final >= 0 && d.final <= 1));
  isTrue('pure text and pure links disagree — that is the whole product',
    bm[0].i !== pr[0].i, `(text: ${E.DOCS[bm[0].i].id}, links: ${E.DOCS[pr[0].i].id})`);
}
{
  const snip = E.snippet(E.DOCS[E.DOCS.findIndex((d) => d.id === 'googol')], ['googol']);
  isTrue('snippet highlights the match', snip.includes('<b>googol</b>') || snip.includes('<b>Googol</b>'));
}

const failed = checks.filter((c) => !c[0]);
for (const [ok, msg] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
console.log(`\n${passed}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
