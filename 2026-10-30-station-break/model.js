// Station Break — who heard a disclaimer during the 1938 War of the Worlds hour?
// Time is in minutes after 8:00 pm Eastern. A listener "believes" once they
// have heard `belief` minutes of the fake newscast without hearing any
// announcement that it is a play. Every number here is a toy, not a census.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StationBreakModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const C = {
    hour: 60,
    newsStart: 3,      // weather report and dance band begin the fake live broadcast
    newsEnd: 40,       // the field reporter's rooftop goes silent; the break follows
    announceLen: 0.5,  // minutes an "this is a play" announcement takes
    signoff: 58,       // Welles steps out of character to say goodnight
    n: 480,            // simulated listeners
    seed: 1938,
    maxExtra: 3,       // announcements you may add inside the newscast
  };

  // What was on the air, paraphrased (not quoted) from the broadcast's structure.
  const BEATS = [
    [0, 'CBS announces: Orson Welles and the Mercury Theatre in a play.'],
    [1, 'Welles narrates a prologue about minds watching Earth from space.'],
    [3, 'A weather report, then dance music from a hotel ballroom.'],
    [5, 'Bulletin: astronomers report gas explosions on Mars.'],
    [8, 'An astronomer is interviewed at his observatory.'],
    [11, 'Bulletin: a flaming object has fallen on a New Jersey farm.'],
    [12, 'Over on NBC, the ventriloquist sketch ends and a singer begins. Dials turn.'],
    [14, 'A reporter at Grovers Mill describes a metal cylinder.'],
    [16, 'The cylinder opens. A heat ray. The field microphone goes dead.'],
    [21, 'State militia are sent in. Martial law is declared.'],
    [26, 'The militia is wiped out. Machines rise on tripod legs.'],
    [30, 'A cabinet secretary asks the nation for calm.'],
    [33, 'Bombers and artillery engage the machines and fail.'],
    [36, 'Black smoke drifts over the Hudson toward Manhattan.'],
    [38, 'A reporter on a rooftop describes the city until he stops talking.'],
    [39.5, 'A lone radio operator calls into silence. No answer.'],
    [40, 'Station break: “You are listening to a CBS presentation…”'],
    [41, 'A professor’s diary: the rest of the story, told as a narrative.'],
    [58, 'Welles, out of character: it was a Halloween prank, nothing more.'],
  ];

  const PRESETS = {
    aired: { extras: [], breakAt: 40, belief: 8, label: 'As aired, 1938' },
    every10: { extras: [10, 20, 30], breakAt: 40, belief: 8, label: 'Every ten minutes' },
  };

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(r) {
    return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  }

  // Three kinds of listener: Mercury regulars from the top of the hour,
  // dial-twisters arriving when Edgar Bergen's NBC sketch gave way to a song
  // (about 8:12), and a steady drift of people tuning in at random.
  function makeListeners(n = C.n, seed = C.seed) {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = r();
      let kind, arrive;
      if (u < 0.32) { kind = 'regular'; arrive = 0; }
      else if (u < 0.74) { kind = 'dial'; arrive = Math.min(16, Math.max(10.5, 12.4 + 1.1 * normal(r))); }
      else { kind = 'drift'; arrive = 1 + r() * 55; }
      const stay = -Math.log(1 - r()) * (kind === 'regular' ? 45 : 28);
      const leave = Math.min(C.hour, arrive + 4 + stay);
      out.push({ id: i, kind, arrive, leave });
    }
    out.sort((a, b) => a.arrive - b.arrive || a.id - b.id);
    return out;
  }

  // All announcements, as [start, end] minute spans, sorted.
  function announcements(cfg) {
    const starts = [0, cfg.breakAt, C.signoff].concat(cfg.extras || []);
    return starts
      .filter(t => t >= 0 && t < C.hour)
      .sort((a, b) => a - b)
      .map(t => [t, t + C.announceLen]);
  }

  // Fake-newscast minutes in [a, b], minus any announcement spans.
  function newsMinutes(a, b, spans, breakAt) {
    const lo = Math.max(a, C.newsStart), hi = Math.min(b, Math.min(C.newsEnd, breakAt));
    if (hi <= lo) return 0;
    let total = hi - lo;
    for (const [s, e] of spans) total -= Math.max(0, Math.min(e, hi) - Math.max(s, lo));
    return total;
  }

  // Walk one listener through the hour. Returns when they were warned, when
  // they came to believe, and how many minutes of newscast they heard unwarned.
  function follow(L, spans, cfg) {
    const breakAt = cfg.breakAt;
    let warnedAt = null;
    for (const [s, e] of spans) {
      if (e > L.arrive && s < L.leave) { warnedAt = Math.max(s, L.arrive); break; }
    }
    const until = warnedAt === null ? L.leave : warnedAt;
    const heard = newsMinutes(L.arrive, until, spans, breakAt);
    let believedAt = null;
    if (heard >= cfg.belief) {
      // find the moment the running total crossed the threshold
      let lo = L.arrive, hi = until;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (newsMinutes(L.arrive, mid, spans, breakAt) >= cfg.belief) hi = mid; else lo = mid;
      }
      believedAt = hi;
    }
    return { warnedAt, believedAt, heard };
  }

  function evaluate(cfg, listeners = makeListeners()) {
    const spans = announcements(cfg);
    const fates = listeners.map(L => Object.assign({}, L, follow(L, spans, cfg)));
    const count = (pred) => fates.filter(pred).length;
    const believers = count(f => f.believedAt !== null);
    const dial = fates.filter(f => f.kind === 'dial');
    const breaks = (cfg.extras || []).filter(t => t >= C.newsStart && t < Math.min(C.newsEnd, cfg.breakAt)).length
      + (cfg.breakAt < C.newsEnd ? 1 : 0);
    // longest unbroken stretch of newscast: how long the spell can hold
    const cuts = [C.newsStart].concat(spans.map(s => s[0]).filter(t => t > C.newsStart && t < Math.min(C.newsEnd, cfg.breakAt)), Math.min(C.newsEnd, cfg.breakAt));
    let longest = 0;
    for (let i = 1; i < cuts.length; i++) longest = Math.max(longest, cuts[i] - cuts[i - 1] - (i > 1 ? C.announceLen : 0));
    return {
      spans,
      fates,
      believers,
      share: believers / fates.length,
      dialShare: dial.filter(f => f.believedAt !== null).length / dial.length,
      regularShare: fates.filter(f => f.kind === 'regular' && f.believedAt !== null).length / Math.max(1, count(f => f.kind === 'regular')),
      neverWarned: count(f => f.warnedAt === null),
      breaks,
      longest,
    };
  }

  // Best positions for k extra announcements on a half-minute grid.
  // Exhaustive for k <= 2; coordinate descent from the k = 2 answer for k = 3.
  function best(k, cfg, listeners = makeListeners()) {
    const grid = [];
    for (let t = C.newsStart; t < Math.min(C.newsEnd, cfg.breakAt); t += 0.5) grid.push(t);
    const score = (extras) => evaluate(Object.assign({}, cfg, { extras }), listeners).believers;
    if (k <= 0) return { extras: [], believers: score([]) };
    let bestSet = null, bestScore = Infinity;
    if (k === 1) {
      for (const a of grid) { const s = score([a]); if (s < bestScore) { bestScore = s; bestSet = [a]; } }
    } else {
      for (let i = 0; i < grid.length; i++) for (let j = i + 1; j < grid.length; j++) {
        const s = score([grid[i], grid[j]]);
        if (s < bestScore) { bestScore = s; bestSet = [grid[i], grid[j]]; }
      }
      for (let extra = 2; extra < k; extra++) {
        bestSet = bestSet.concat(grid[Math.floor(grid.length / 2)]);
        bestScore = score(bestSet);
        for (let pass = 0; pass < 3; pass++) for (let idx = 0; idx < bestSet.length; idx++) {
          for (const t of grid) {
            const trial = bestSet.slice(); trial[idx] = t;
            const s = score(trial);
            if (s < bestScore) { bestScore = s; bestSet = trial; }
          }
        }
      }
    }
    return { extras: bestSet.sort((a, b) => a - b), believers: bestScore };
  }

  function beatAt(t) {
    let text = BEATS[0][1];
    for (const [at, line] of BEATS) if (t >= at) text = line;
    return text;
  }

  function clock(t) {
    const m = Math.min(59.99, Math.max(0, t));
    const mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
    return `8:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  return { C, BEATS, PRESETS, rng, makeListeners, announcements, newsMinutes, follow, evaluate, best, beatAt, clock };
});
