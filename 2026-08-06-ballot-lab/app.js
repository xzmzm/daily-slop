"use strict";
/* ballot-lab — six voting systems, one set of ballots.
 *
 * Data model
 * ----------
 * candidates: array of single letters, e.g. ["A","B","C"].
 *   The index determines the CSS color class cand-A, cand-B, ...
 * ballots: array of { count, ranking:[idx,...], approve:[bool,...] }
 *   - ranking[i] is the candidate index placed at rank i (rank 0 = first).
 *   - approve has one entry per candidate index.
 * Methods: Plurality, Top-2 Runoff, Instant-Runoff (IRV), Borda, Condorcet,
 *   Approval. Each returns { name, winner, rounds, note } where rounds is a
 *   list of { tally:{idx:count}, elim:[idx], elected:idx|null } for the
 *   story panel.
 */

// ---------- candidate palette ----------
const CAND_NAMES = ["A", "B", "C", "D", "E"];
const FULL_NAMES = {
  A: "Amara",
  B: "Belden",
  C: "Cho",
  D: "Dara",
  E: "Efron",
};
const candClass = (c) => "cand-" + CAND_NAMES[c];

// ---------- presets ----------
// Each preset is the full ballot list. Counts are voter counts.
// Each preset's ballots are hand-verified against all six methods (see
// NOTES.md). Approval arrays are indexed by candidate: approve[c] = true means
// that ballot's voter marks candidate c as acceptable.
const PRESETS = [
  {
    name: "The 2026 town race",
    blurb:
      "100 voters, three candidates. A textbook split: the plurality winner is " +
      "the Condorcet loser, and the Condorcet winner is eliminated first under IRV.",
    candidates: 3,
    // Plurality→C · Runoff→A · IRV→A · Borda→B · Condorcet→B · Approval→A
    ballots: [
      { count: 30, ranking: [0, 1, 2], approve: [true, false, false] },
      { count: 2, ranking: [0, 1, 2], approve: [true, true, false] },
      { count: 25, ranking: [1, 0, 2], approve: [true, true, false] },
      { count: 37, ranking: [2, 1, 0], approve: [false, false, true] },
      { count: 6, ranking: [2, 0, 1], approve: [false, false, true] },
    ],
  },
  {
    name: "Center squeeze",
    blurb:
      "B is everyone's acceptable compromise — approved by all 100 voters and " +
      "the Condorcet winner. But B has so few first-choice votes that plurality " +
      "never sees them and IRV eliminates them in round one.",
    candidates: 3,
    // Plurality→A · Runoff→A · IRV→A · Borda→B · Condorcet→B · Approval→B
    ballots: [
      { count: 42, ranking: [0, 1, 2], approve: [true, true, false] },
      { count: 40, ranking: [2, 1, 0], approve: [false, true, true] },
      { count: 18, ranking: [1, 0, 2], approve: [true, true, false] },
    ],
  },
  {
    name: "Condorcet cycle",
    blurb:
      "A beats B, B beats C, C beats A — a strict rock-paper-scissors cycle. No " +
      "Condorcet winner exists: the group is collectively intransitive, even " +
      "though every individual ballot is a perfectly rational ranking.",
    candidates: 3,
    // Plurality→A · Runoff→A · IRV→C · Borda→A · Condorcet→none · Approval→A
    ballots: [
      { count: 34, ranking: [0, 1, 2], approve: [true, false, false] },
      { count: 33, ranking: [1, 2, 0], approve: [false, true, false] },
      { count: 33, ranking: [2, 0, 1], approve: [false, false, true] },
    ],
  },
  {
    name: "Spoiler",
    blurb:
      "A and C are allies splitting the same bloc. C's 15 votes are enough to " +
      "hand plurality to B — the outsider a majority actually opposes. Remove C " +
      "and A beats B 55-45. Every ranked method, and approval, recovers A.",
    candidates: 3,
    // Plurality→B · Runoff→A · IRV→A · Borda→A · Condorcet→A · Approval→A
    ballots: [
      { count: 40, ranking: [0, 2, 1], approve: [true, false, false] },
      { count: 15, ranking: [2, 0, 1], approve: [true, false, true] },
      { count: 45, ranking: [1, 0, 2], approve: [false, true, false] },
    ],
  },
];

// ---------- state ----------
let state = {
  preset: 0,
  numCandidates: 3,
  ballots: [],
};
let activeCands = []; // candidate indices currently used

function loadPreset(i) {
  const p = PRESETS[i];
  state.preset = i;
  state.numCandidates = p.candidates;
  state.ballots = p.ballots.map((b) => ({
    count: b.count,
    ranking: b.ranking.slice(),
    approve: b.approve.slice(),
  }));
  renderAll();
}

// ---------- expand ballots to a flat list for counting ----------
function expand(ballots) {
  const out = [];
  for (const b of ballots) {
    for (let i = 0; i < b.count; i++) {
      out.push({ ranking: b.ranking.slice(), approve: b.approve.slice() });
    }
  }
  return out;
}
function totalVoters(ballots) {
  return ballots.reduce((s, b) => s + b.count, 0);
}

// ---------- tally helpers ----------
function firstPrefs(flat, activeSet) {
  const t = {};
  for (const c of activeSet) t[c] = 0;
  for (const b of flat) {
    for (const c of b.ranking) {
      if (activeSet.has(c)) {
        t[c] = (t[c] || 0) + 1;
        break;
      }
    }
  }
  return t;
}
function approvals(flat, allCands) {
  const t = {};
  for (const c of allCands) t[c] = 0;
  for (const b of flat) {
    for (const c of allCands) if (b.approve[c]) t[c] = (t[c] || 0) + 1;
  }
  return t;
}
function pairwise(flat, allCands) {
  // m[a][b] = number of voters ranking a over b
  const m = {};
  for (const a of allCands) {
    m[a] = {};
    for (const b of allCands) m[a][b] = 0;
  }
  for (const b of flat) {
    for (let i = 0; i < b.ranking.length; i++) {
      const a = b.ranking[i];
      for (let j = i + 1; j < b.ranking.length; j++) {
        const c = b.ranking[j];
        m[a][c]++;
      }
    }
  }
  return m;
}

// ---------- the six methods ----------

// 1. PLURALITY (first-past-the-post)
function countPlurality(ballots, allCands) {
  const flat = expand(ballots);
  const active = new Set(allCands);
  const t = firstPrefs(flat, active);
  const total = flat.length;
  const round = { tally: t, elim: [], elected: null };
  let winner = null;
  let mx = -1;
  for (const c of allCands) {
    if (t[c] > mx) {
      mx = t[c];
      winner = c;
    }
  }
  round.elected = winner;
  const pct = total > 0 ? ((mx / total) * 100).toFixed(0) + "%" : "—";
  return {
    name: "Plurality",
    sub: "first-past-the-post",
    unit: "votes",
    winner,
    rounds: [round],
    note:
      "Whoever gets the most first-choice votes wins — even if most voters " +
      "would have preferred someone else. Used in the US, UK, Canada, India.",
  };
}

// 2. TOP-TWO RUNOFF
function countRunoff(ballots, allCands) {
  const flat = expand(ballots);
  const active = new Set(allCands);
  const t1 = firstPrefs(flat, active);
  const total = flat.length;
  const r1 = { tally: t1, elim: [], elected: null };
  // pick top two by first prefs
  const sorted = allCands.slice().sort((a, b) => t1[b] - t1[a]);
  const top2 = sorted.slice(0, 2);
  const elim = allCands.filter((c) => !top2.includes(c));
  r1.elim = elim;
  // final round: head-to-head between top2
  const [a, b] = top2;
  let av = 0,
    bv = 0;
  for (const bal of flat) {
    const ra = bal.ranking.indexOf(a);
    const rb = bal.ranking.indexOf(b);
    if (ra === -1 && rb === -1) continue;
    if (ra === -1) bv++;
    else if (rb === -1) av++;
    else if (ra < rb) av++;
    else bv++;
  }
  const t2 = {};
  t2[a] = av;
  t2[b] = bv;
  const winner = av >= bv ? a : b;
  const r2 = { tally: t2, elim: [], elected: winner };
  return {
    name: "Top-2 Runoff",
    sub: "two-round system",
    unit: "votes",
    winner,
    rounds: [r1, r2],
    note:
      "Like plurality, but if nobody clears 50%, the top two fight a second " +
      "round. Used in France (president), Georgia, and many local races.",
  };
}

// 3. INSTANT-RUNOFF (IRV / RCV)
function countIRV(ballots, allCands) {
  const flat = expand(ballots);
  const total = flat.length;
  let active = new Set(allCands);
  const rounds = [];
  let winner = null;
  const eliminated = [];
  // safety: cap rounds
  for (let guard = 0; guard < allCands.length + 2; guard++) {
    const t = firstPrefs(flat, active);
    const round = { tally: t, elim: [], elected: null };
    // fill zero for inactives
    let mx = -1,
      topCand = null;
    for (const c of active) {
      if (t[c] > mx) {
        mx = t[c];
        topCand = c;
      }
    }
    if (mx > total / 2) {
      round.elected = topCand;
      winner = topCand;
      rounds.push(round);
      break;
    }
    // eliminate the current last-place candidate
    let mn = Infinity,
      loser = null;
    for (const c of active) {
      if (t[c] < mn) {
        mn = t[c];
        loser = c;
      }
    }
    if (loser === null) break;
    round.elim = [loser];
    eliminated.push(loser);
    rounds.push(round);
    active.delete(loser);
    if (active.size === 0) break;
  }
  return {
    name: "Instant-Runoff",
    sub: "ranked-choice · RCV",
    unit: "votes",
    winner,
    rounds,
    note:
      "Voters rank once. The last-place candidate is eliminated and their " +
      "ballots flow to their next choice, repeating until someone clears 50%. " +
      "Used in Australia, Ireland, Alaska, NYC, Utah.",
  };
}

// 4. BORDA COUNT
function countBorda(ballots, allCands) {
  const N = allCands.length;
  const t = {};
  for (const c of allCands) t[c] = 0;
  for (const b of ballots) {
    for (let i = 0; i < b.ranking.length; i++) {
      const c = b.ranking[i];
      t[c] += (N - 1 - i) * b.count;
    }
  }
  let winner = null,
    mx = -1;
  for (const c of allCands) {
    if (t[c] > mx) {
      mx = t[c];
      winner = c;
    }
  }
  return {
    name: "Borda Count",
    sub: "rank points",
    unit: "points",
    winner,
    rounds: [{ tally: t, elim: [], elected: winner }],
    note:
      "Last place earns 0, next earns 1, … top earns N−1. Highest total wins. " +
      "Used in Slovenia and the Eurovision Song Contest.",
  };
}

// 5. CONDORCET
function countCondorcet(ballots, allCands) {
  const flat = expand(ballots);
  const m = pairwise(flat, allCands);
  // find a candidate who beats every other
  let winner = null;
  let loser = null;
  for (const a of allCands) {
    let beatsAll = true;
    let losesToAll = true;
    for (const b of allCands) {
      if (a === b) continue;
      if (m[a][b] <= m[b][a]) beatsAll = false;
      if (m[a][b] >= m[b][a]) losesToAll = false;
    }
    if (beatsAll) winner = a;
    if (losesToAll) loser = a;
  }
  const tally = {};
  for (const a of allCands) {
    let wins = 0;
    for (const b of allCands) if (a !== b && m[a][b] > m[b][a]) wins++;
    tally[a] = wins;
  }
  return {
    name: "Condorcet",
    sub: "pairwise winner",
    unit: "wins",
    winner,
    rounds: [{ tally, elim: [], elected: winner }],
    loser,
    pairwise: m,
    note:
      "Who would win a head-to-head against every single opponent? " +
      "That candidate — if one exists — is the Condorcet winner. " +
      "Not used directly anywhere, but the gold-standard fairness test.",
  };
}

// 6. APPROVAL
function countApproval(ballots, allCands) {
  const flat = expand(ballots);
  const t = approvals(flat, allCands);
  let winner = null,
    mx = -1;
  for (const c of allCands) {
    if (t[c] > mx) {
      mx = t[c];
      winner = c;
    }
  }
  return {
    name: "Approval",
    sub: "mark all you accept",
    unit: "approvals",
    winner,
    rounds: [{ tally: t, elim: [], elected: winner }],
    note:
      "No ranking — just mark every candidate you can live with. " +
      "Most approvals wins. Used in the IEEE, Dartmouth alumni, and pirates.",
  };
}

const METHODS = [
  countPlurality,
  countRunoff,
  countIRV,
  countBorda,
  countCondorcet,
  countApproval,
];

// ---------- rendering ----------

function $(sel) {
  return document.querySelector(sel);
}

function renderAll() {
  // figure out which candidates are in use
  const candSet = new Set();
  for (const b of state.ballots) for (const c of b.ranking) candSet.add(c);
  activeCands = [...candSet].sort((a, b) => a - b);
  // ensure ranking/approve arrays cover all active cands
  for (const b of state.ballots) {
    for (const c of activeCands) {
      if (b.ranking.indexOf(c) === -1) b.ranking.push(c);
      while (b.approve.length <= c) b.approve.push(false);
    }
  }

  renderBallots();
  renderResults();
  renderPairwise();
  renderStory();
  renderTotal();
}

function renderTotal() {
  $("#totalVoters").textContent = totalVoters(state.ballots);
  $("#numBallots").textContent = state.ballots.length;
}

// ----- ballot editor -----
function renderBallots() {
  const table = $("#ballotsTable");
  // rebuild header so colspan matches the active candidate count
  const nc = activeCands.length;
  const thr = table.querySelector("thead tr");
  thr.innerHTML =
    `<th class="nh-voters">Voters</th>` +
    `<th class="nh-rank" colspan="${nc}">Ranking &nbsp;<span class="muted">(left = 1st)</span></th>` +
    `<th class="nh-appr">Approve</th>` +
    `<th class="nh-x"></th>`;

  const body = $("#ballotsBody");
  body.innerHTML = "";
  state.ballots.forEach((b, bi) => {
    const tr = document.createElement("tr");
    tr.dataset.idx = bi;

    // count cell
    const tdC = document.createElement("td");
    tdC.className = "n-count";
    const inp = document.createElement("input");
    inp.className = "count";
    inp.type = "number";
    inp.min = "0";
    inp.value = b.count;
    inp.addEventListener("input", () => {
      let v = parseInt(inp.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      state.ballots[bi].count = v;
      renderResults();
      renderPairwise();
      renderStory();
      renderTotal();
    });
    tdC.appendChild(inp);
    tr.appendChild(tdC);

    // rank cells (one per active candidate, sorted by rank)
    for (let r = 0; r < activeCands.length; r++) {
      const td = document.createElement("td");
      td.className = "rank-cell";
      const c = b.ranking[r];
      const chip = document.createElement("div");
      chip.className = "chip " + candClass(c);
      chip.textContent = CAND_NAMES[c];
      chip.title = "Click to cycle which candidate sits at rank " + (r + 1);
      chip.addEventListener("click", () => cycleRank(bi, r));
      td.appendChild(chip);
      tr.appendChild(td);
    }

    // approve cell — one dot per active candidate, labeled by candidate
    const tdA = document.createElement("td");
    tdA.className = "appr-cell";
    const dots = document.createElement("div");
    dots.className = "appr-dots";
    for (const c of activeCands) {
      const dot = document.createElement("span");
      dot.className =
        "appr-dot sm" + (b.approve[c] ? " on " + candClass(c) : "");
      dot.textContent = CAND_NAMES[c];
      dot.title = `Toggle approval of ${CAND_NAMES[c]}`;
      dot.addEventListener("click", () => {
        state.ballots[bi].approve[c] = !state.ballots[bi].approve[c];
        renderAll();
      });
      dots.appendChild(dot);
    }
    tdA.appendChild(dots);
    tr.appendChild(tdA);

    // remove
    const tdX = document.createElement("td");
    tdX.className = "n-x";
    const x = document.createElement("button");
    x.className = "x-btn";
    x.textContent = "×";
    x.title = "Remove this ballot type";
    x.addEventListener("click", () => {
      state.ballots.splice(bi, 1);
      renderAll();
    });
    tdX.appendChild(x);
    tr.appendChild(tdX);

    body.appendChild(tr);
  });
}

function cycleRank(bi, rankPos) {
  // replace the candidate at rankPos with the next unused candidate
  const b = state.ballots[bi];
  const cur = b.ranking[rankPos];
  const next = (cur + 1) % CAND_NAMES.length;
  // find where next currently sits and swap
  const swapWith = b.ranking.indexOf(next);
  if (swapWith !== -1) {
    b.ranking[swapWith] = cur;
    b.ranking[rankPos] = next;
  } else {
    b.ranking[rankPos] = next;
  }
  // extend approve if needed
  while (b.approve.length < CAND_NAMES.length) b.approve.push(false);
  // make sure all active cands stay present
  for (const c of activeCands) {
    if (b.ranking.indexOf(c) === -1) b.ranking.push(c);
  }
  renderAll();
}

// ----- method cards -----
function renderResults() {
  const allCands = activeCands;
  const host = $("#methods");
  host.innerHTML = "";

  // count winners, so we can highlight when they disagree
  const results = METHODS.map((m) => m(state.ballots, allCands));
  const winnerSet = new Set(results.map((r) => r.winner));
  const agreement = winnerSet.size === 1;

  // legend
  const legend = $("#winnerLegend");
  if (allCands.length === 0) {
    legend.textContent = "";
  } else if (agreement) {
    legend.innerHTML =
      `All methods agree: <span class="cn ${candClass(results[0].winner)}">${CAND_NAMES[results[0].winner]}</span> wins everywhere.`;
  } else {
    legend.innerHTML = `Methods disagree — <strong>${winnerSet.size} different winners</strong> from the same ballots.`;
  }

  for (const r of results) {
    const card = document.createElement("div");
    card.className = "method";
    const head = document.createElement("div");
    head.className = "method-head";
    const nm = document.createElement("span");
    nm.className = "method-name";
    nm.textContent = r.name;
    const sub = document.createElement("span");
    sub.className = "method-winner";
    if (r.winner !== null) {
      sub.innerHTML =
        `<span class="crown">★</span> elects <span class="cn ${candClass(r.winner)}">${CAND_NAMES[r.winner]}</span>`;
    } else {
      sub.innerHTML = `<span class="crown" style="color:var(--accent)">↻</span> no winner (cycle)`;
    }
    head.appendChild(nm);
    head.appendChild(sub);
    card.appendChild(head);

    // tally rounds
    const tally = document.createElement("div");
    tally.className = "tally";
    r.rounds.forEach((round, ri) => {
      const row = document.createElement("div");
      row.className = "tally-round";
      const lbl = document.createElement("span");
      lbl.className = "rlabel";
      lbl.textContent = r.rounds.length > 1 ? `R${ri + 1}` : "·";
      const bars = document.createElement("div");
      bars.className = "tally-bars";
      // sort candidates by tally desc
      const ordered = allCands.slice().sort((a, b) => round.tally[b] - round.tally[a]);
      const mx = Math.max(1, ...ordered.map((c) => round.tally[c] || 0));
      const total = totalVoters(state.ballots);
      const unit = r.unit || "votes";
      for (const c of ordered) {
        const v = round.tally[c] || 0;
        const wrap = document.createElement("span");
        wrap.className = "bar-wrap";
        const bar = document.createElement("span");
        bar.className = "bar " + candClass(c);
        bar.style.width = `${4 + (v / mx) * 52}px`;
        const num = document.createElement("span");
        num.className = "bar-num";
        // Only voter-count methods (votes/approvals) divide into a meaningful
        // percentage of the electorate. Borda points and Condorcet wins are
        // different units, so show them raw with their unit label.
        let numHtml;
        if (unit === "votes" || unit === "approvals") {
          const pct = total > 0 ? ((v / total) * 100).toFixed(0) : "0";
          numHtml = `${v}<span class="pct">/${total} (${pct}%)</span>`;
        } else if (unit === "wins") {
          numHtml = `${v}<span class="pct"> ${unit}</span>`;
        } else {
          numHtml = `${v}<span class="pct"> ${unit}</span>`;
        }
        num.innerHTML = numHtml;
        wrap.appendChild(bar);
        wrap.appendChild(num);
        bars.appendChild(wrap);
      }
      row.appendChild(lbl);
      row.appendChild(bars);
      // tags
      if (round.elim && round.elim.length) {
        for (const e of round.elim) {
          const tag = document.createElement("span");
          tag.className = "elim-tag";
          tag.innerHTML = `× ${CAND_NAMES[e]} out`;
          row.appendChild(tag);
        }
      }
      if (round.elected !== null && ri === r.rounds.length - 1) {
        const tag = document.createElement("span");
        tag.className = "elected-tag";
        tag.innerHTML = `${CAND_NAMES[round.elected]} elected`;
        row.appendChild(tag);
      }
      tally.appendChild(row);
    });
    card.appendChild(tally);

    // note
    if (r.note) {
      const nt = document.createElement("p");
      nt.className = "method-note";
      nt.textContent = r.note;
      card.appendChild(nt);
    }

    host.appendChild(card);
  }
}

// ----- pairwise matrix -----
function renderPairwise() {
  const allCands = activeCands;
  const host = $("#pairwise");
  host.innerHTML = "";
  const note = $("#pairwiseNote");
  if (allCands.length < 2) {
    note.innerHTML = "Add at least two candidates to compare.";
    return;
  }
  const flat = expand(state.ballots);
  const m = pairwise(flat, allCands);

  // find condorcet winner & loser
  let cw = null,
    cl = null;
  for (const a of allCands) {
    let beatsAll = true,
      losesAll = true;
    for (const b of allCands) {
      if (a === b) continue;
      if (m[a][b] <= m[b][a]) beatsAll = false;
      if (m[a][b] >= m[b][a]) losesAll = false;
    }
    if (beatsAll) cw = a;
    if (losesAll) cl = a;
  }

  const grid = document.createElement("div");
  grid.className = "matrix";
  const cols = allCands.length + 1;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  // header row
  const corner = document.createElement("div");
  corner.className = "cell hdr";
  corner.textContent = "";
  grid.appendChild(corner);
  for (const b of allCands) {
    const h = document.createElement("div");
    h.className = "cell hdr";
    h.textContent = CAND_NAMES[b];
    grid.appendChild(h);
  }
  // body rows: each row a = "X over column"
  for (const a of allCands) {
    const rowHdr = document.createElement("div");
    rowHdr.className = "cell hdr";
    rowHdr.textContent = CAND_NAMES[a];
    grid.appendChild(rowHdr);
    for (const b of allCands) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (a === b) {
        cell.className = "cell diag";
        cell.textContent = "—";
      } else {
        const v = m[a][b];
        const other = m[b][a];
        if (v > other) cell.classList.add("win");
        else cell.classList.add("lose");
        if (cw === a) cell.classList.add("condorcet-row");
        cell.textContent = v;
      }
      grid.appendChild(cell);
    }
  }
  host.appendChild(grid);

  // caption
  const total = totalVoters(state.ballots);
  let html = "";
  if (cw !== null) {
    html += `<strong><span class="cn ${candClass(cw)}">${CAND_NAMES[cw]}</span> is the Condorcet winner</strong> — beats everyone head-to-head.`;
  } else {
    html += `No Condorcet winner — the preferences contain a cycle (A&gt;B&gt;C&gt;A). No candidate beats all others.`;
  }
  if (cl !== null) {
    html += ` <span class="loser"><span class="cn ${candClass(cl)}">${CAND_NAMES[cl]}</span> is the Condorcet loser</span> — loses to everyone head-to-head.`;
  }
  html += ` <span class="muted">${total} voters.</span>`;
  note.innerHTML = html;
}

// ----- story -----
function renderStory() {
  const allCands = activeCands;
  const host = $("#story");
  const total = totalVoters(state.ballots);
  if (total === 0 || allCands.length === 0) {
    host.innerHTML = `<p class="callout">No voters yet. Add a ballot or pick a preset.</p>`;
    return;
  }
  const results = METHODS.map((m) => m(state.ballots, allCands));
  const byName = {};
  for (const r of results) byName[r.name] = r;
  const winners = results.map((r) => r.winner);
  const uniq = [...new Set(winners.filter((w) => w !== null))];
  const agreement = uniq.length <= 1;

  const preset = PRESETS[state.preset];

  let html = `<p><strong>${preset.name}.</strong> ${preset.blurb}</p>`;

  if (agreement && uniq.length === 1) {
    const w = uniq[0];
    html += `<p>Every method agrees: <span class="cn ${candClass(w)}">${CAND_NAMES[w]}</span> wins. That's rare and suspicious — try a preset designed to break it.</p>`;
  } else {
    html += `<div class="callout">From the <span class="stat">${total}</span> identical ballots, the six methods elect <span class="stat">${uniq.length}</span> different winners:</div>`;
    html += `<ul>`;
    for (const r of results) {
      const w = r.winner;
      const wTxt =
        w === null
          ? `<em>no winner</em>`
          : `<span class="cn ${candClass(w)}">${CAND_NAMES[w]}</span>`;
      html += `<li><strong>${r.name}:</strong> ${wTxt}</li>`;
    }
    html += `</ul>`;
  }

  // specific insights
  const cond = byName["Condorcet"];
  const pl = byName["Plurality"];
  if (cond.winner !== null && pl.winner !== null && cond.winner !== pl.winner) {
    html += `<p>The plurality winner <span class="cn ${candClass(pl.winner)}">${CAND_NAMES[pl.winner]}</span> is not the Condorcet winner <span class="cn ${candClass(cond.winner)}">${CAND_NAMES[cond.winner]}</span>. The most first-choice votes ≠ the candidate who'd win every one-on-one.</p>`;
  }
  if (cond.loser !== null && pl.winner === cond.loser) {
    html += `<div class="callout">Worse: the plurality winner <span class="cn ${candClass(pl.winner)}">${CAND_NAMES[pl.winner]}</span> is the <strong>Condorcet loser</strong> — beaten by every other candidate head-to-head. A majority of voters actively preferred someone else, and plurality still handed them the seat.</div>`;
  }
  const irv = byName["Instant-Runoff"];
  if (irv && cond.winner !== null && irv.winner !== cond.winner) {
    // did IRV eliminate the condorcet winner?
    let eliminatedEarly = false;
    for (const r of irv.rounds) {
      if (r.elim && r.elim.includes(cond.winner)) eliminatedEarly = true;
    }
    if (eliminatedEarly) {
      html += `<p>Instant-Runoff eliminated the Condorcet winner <span class="cn ${candClass(cond.winner)}">${CAND_NAMES[cond.winner]}</span> in an early round — the classic <em>center squeeze</em>. Their second-choice votes scattered and a polarised candidate slipped through.</p>`;
    }
  }
  // borda vs plurality spoiler
  const borda = byName["Borda Count"];
  if (
    borda.winner !== null &&
    pl.winner !== null &&
    borda.winner !== pl.winner
  ) {
    html += `<p>Borda, which weighs every rank, elects <span class="cn ${candClass(borda.winner)}">${CAND_NAMES[borda.winner]}</span> — not plurality's <span class="cn ${candClass(pl.winner)}">${CAND_NAMES[pl.winner]}</span>. Same ballots, different question.</p>`;
  }

  host.innerHTML = html;
}

// ---------- wiring ----------
function setup() {
  loadPreset(0);

  $("#presetBtn").addEventListener("click", () => {
    const next = (state.preset + 1) % PRESETS.length;
    loadPreset(next);
  });
  $("#clearBtn").addEventListener("click", () => {
    state.ballots = [];
    renderAll();
  });
  $("#addRowBtn").addEventListener("click", () => {
    const N = activeCands.length || 3;
    const ranking = [];
    for (let i = 0; i < N; i++) ranking.push(i);
    const approve = ranking.map(() => false);
    state.ballots.push({ count: 10, ranking, approve });
    state.preset = -1; // mark as edited
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", setup);
