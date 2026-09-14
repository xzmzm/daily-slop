/* ==========================================================================
   Random Surfer (1997) — the index side: a 16-page snapshot of the web as
   it looked the day BEFORE anyone registered the domain. No page contains
   the word "google" (the tests guard this): the misspelling had zero
   results on 14 Sep 1997 (its nearest index word, googol, sits two edits
   away), and a domain by the next evening. Inverted index, BM25 scoring,
   Levenshtein did-you-mean, and the authority × relevance blend.
   ========================================================================== */

import { D_PAPER } from './pagerank.js';

export const DOCS = [
  {
    id: 'yahoo', site: 'Yahoo!', url: 'www.yahoo.com',
    title: 'Yahoo! — A Directory of the Web',
    body: 'Yahoo organizes the web. Human surfers pick the best web sites by hand and list them by subject: arts, business, computers, news, reference, science. Add your own web site to the directory for free. Search or browse the web — the most popular starting point on the internet.',
    out: ['altavista', 'webcrawler', 'geocities', 'stanford'],
  },
  {
    id: 'altavista', site: 'AltaVista', url: 'www.altavista.digital.com',
    title: 'AltaVista: The Fastest Way to Search the Web',
    body: 'Search the web with AltaVista, the fastest search engine on the internet. Our super spider has crawled more of the web than anyone else. Type words in the search box and the index answers in under a second. AltaVista is a search service of Digital.',
    out: ['dec', 'yahoo'],
  },
  {
    id: 'webcrawler', site: 'WebCrawler', url: 'www.webcrawler.com',
    title: 'WebCrawler Search',
    body: 'WebCrawler searches the web with a friendly robot. Built at the University of Washington, now run by America Online. Natural language web search: just type a question and the search engine does the rest.',
    out: ['yahoo', 'aol'],
  },
  {
    id: 'lycos', site: 'Lycos', url: 'www.lycos.com',
    title: 'Lycos — Catalog of the Internet',
    body: 'Lycos, from Carnegie Mellon University: a catalog of the internet. Millions of web pages indexed by our search spider. Find pictures, sounds, ftp files, and web pages on any topic.',
    out: ['yahoo', 'cmu'],
  },
  {
    id: 'dec', site: 'Digital', url: 'www.digital.com',
    title: 'Digital Equipment Corporation',
    body: 'Digital Equipment Corporation builds Alpha workstations and servers — the fastest 64-bit processors on earth. Digital power runs the AltaVista search service. Semiconductors, minicomputers, storage, networks.',
    out: ['altavista'],
  },
  {
    id: 'cmu', site: 'CMU', url: 'www.cmu.edu',
    title: 'Carnegie Mellon University',
    body: 'Carnegie Mellon University in Pittsburgh: computer science, robotics, drama, and the birthplace of the Lycos catalog of the internet. Departments, courses, research, and campus news.',
    out: ['lycos'],
  },
  {
    id: 'aol', site: 'AOL', url: 'www.aol.com',
    title: 'America Online',
    body: 'America Online: the internet service for the family. Sign up and get email, chat rooms, news, and the web through our gateway. Keywords take you anywhere. Try our new web search.',
    out: ['webcrawler'],
  },
  {
    id: 'stanford', site: 'Stanford', url: 'www-cs.stanford.edu',
    title: 'Stanford Computer Science',
    body: 'The computer science department of Stanford University, in the Gates Computer Science Building. Research groups, faculty, students and projects: databases, graphics, robotics, and web research. Home of the Stanford digital library.',
    out: ['backrub', 'searchnotes', 'gates360', 'yahoo'],
  },
  {
    id: 'backrub', site: 'BackRub', url: 'backrub.stanford.edu',
    title: 'BackRub: A Web Search Research Project',
    body: 'BackRub is a web search research project at Stanford. It analyzes back links — which pages point to which — the way a scientific paper collects citations. The structure of the web graph decides the ranking of every page. Written by Larry and Sergey.',
    out: ['searchnotes', 'stanford'],
  },
  {
    id: 'searchnotes', site: 'Research Notes', url: 'ilab.stanford.edu/notes',
    title: 'Search Engine Research Notes (draft)',
    body: 'Technical notes on a large scale hypertext search engine. The random surfer follows links and occasionally jumps to a random page; the steady probability of landing on a page is its rank. On a crawl of 24 million pages and 322 million links the rank computation converged in 52 iterations at damping factor 0.85.',
    out: ['backrub', 'stanford'],
  },
  {
    id: 'gates360', site: 'Gates 360', url: 'www-cs.stanford.edu/gates360',
    title: 'Gates Building, Room 360',
    body: 'The fourth floor of the Gates Computer Science Building: grad student offices, whiteboards, late night brainstorming about names for new projects. The espresso machine is broken again.',
    out: ['stanford'],
  },
  {
    id: 'geocities', site: 'GeoCities', url: 'www.geocities.com',
    title: 'GeoCities — Free Home Pages',
    body: 'Build a free home page on GeoCities, the largest neighborhood on the web. Move into a community: Hollywood, Silicon Valley, Athens. Thousands of personal web pages by real people, listed by interest.',
    out: ['typing', 'homework', 'fanpage'],
  },
  {
    id: 'typing', site: 'Personal Page', url: 'geocities.com/SiliconValley/typing',
    title: 'Kris’s Typing Tips',
    body: 'A personal home page about typing: keyboard posture, qwerty versus dvorak, and my favorite typing tutor shareware. Typos are forever — check your spelling before you register anything. One misspelling can name a company.',
    out: ['geocities'],
  },
  {
    id: 'homework', site: 'GeoCities', url: 'geocities.com/Athens/homework',
    title: 'Homework Helper',
    body: 'Stuck on homework? This page collects the best reference web sites for math, science, and english homework: dictionaries, encyclopedias, and math tables. A student’s guide to the web, made on GeoCities.',
    out: ['yahoo', 'geocities', 'googol'],
  },
  {
    id: 'googol', site: 'Math', url: 'www.mathpages.com/googol',
    title: 'What Is a Googol?',
    body: 'A googol is the large number 10^100 — a one followed by one hundred zeros. The word googol was coined in 1938 by nine-year-old Milton Sirotta, nephew of the mathematician Edward Kasner. A googol exceeds the number of atoms in the observable universe. See also the googolplex.',
    out: [],
  },
  {
    id: 'fanpage', site: 'Personal Page', url: 'geocities.com/SiliconValley/fanpage',
    title: 'Frank’s Search Engine Fan Page',
    body: 'My personal comparison of every search engine on the web: Yahoo the directory, AltaVista the speed demon, Lycos the catalog, WebCrawler the friendly robot, and BackRub, the new idea from Stanford that ranks pages by their links. Updated weekly!',
    out: ['yahoo', 'altavista', 'webcrawler', 'lycos', 'backrub'],
  },
];

export const SNAPSHOT_EDGES = (() => {
  const idx = Object.fromEntries(DOCS.map((d, i) => [d.id, i]));
  const edges = [];
  for (const d of DOCS) for (const o of d.out) edges.push([idx[d.id], idx[o]]);
  return edges;
})();

/* ---------- tokenizer and inverted index ---------- */

export function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function buildIndex(docs = DOCS) {
  const N = docs.length;
  const tf = docs.map(() => ({}));
  const len = new Array(N).fill(0);
  const postings = {};
  docs.forEach((doc, i) => {
    const tokens = tokenize(`${doc.title} ${doc.url.replace(/\./g, ' ')} ${doc.body}`);
    len[i] = tokens.length;
    for (const t of tokens) {
      tf[i][t] = (tf[i][t] || 0) + 1;
      if (!postings[t]) postings[t] = [];
      if (postings[t][postings[t].length - 1] !== i) postings[t].push(i);
    }
  });
  const avgdl = len.reduce((a, b) => a + b, 0) / N;
  const vocab = Object.keys(postings).sort();
  return { N, tf, len, avgdl, postings, vocab, docs };
}

export const df = (idx, term) => (idx.postings[term] || []).length;

/* Robertson–Spärck Jones idf, the non-negative variant. */
export function idf(idx, term) {
  const n = df(idx, term);
  return Math.log(1 + (idx.N - n + 0.5) / (n + 0.5));
}

export function bm25Term(idx, i, term, k1 = 1.2, b = 0.75) {
  const f = idx.tf[i][term] || 0;
  if (!f) return 0;
  const norm = k1 * (1 - b + (b * idx.len[i]) / idx.avgdl);
  return (idf(idx, term) * f * (k1 + 1)) / (f + norm);
}

export function bm25Score(idx, i, terms, k1 = 1.2, b = 0.75) {
  let s = 0;
  for (const t of terms) s += bm25Term(idx, i, t, k1, b);
  return s;
}

/* AND semantics over posting lists (the 1998 engine was an AND engine). */
export function searchAND(idx, query, k1 = 1.2, b = 0.75) {
  const terms = [...new Set(tokenize(query))];
  let live = null;
  let killedBy = null;
  const steps = [];
  for (const t of terms) {
    const p = idx.postings[t];
    if (!p) return { terms, docs: [], killedBy: t, steps };
    const next = live === null ? p.slice() : live.filter((x) => p.includes(x));
    steps.push({ term: t, before: live === null ? p.length : live.length, after: next.length });
    live = next;
    if (!live.length) {
      killedBy = t;
      break;
    }
  }
  const docs = (live || [])
    .map((i) => ({ i, score: bm25Score(idx, i, terms, k1, b) }))
    .sort((a, b2) => b2.score - a.score || a.i - b2.i);
  return { terms, docs, killedBy, steps };
}

/* ---------- did you mean ---------- */

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

export function didYouMean(idx, query) {
  const out = [];
  for (const t of tokenize(query)) {
    if (idx.postings[t]) continue;
    let best = null;
    let bd = 3;
    for (const w of idx.vocab) {
      const dd = levenshtein(t, w);
      if (dd < bd || (dd === bd && best !== null && w < best)) { best = w; bd = dd; }
    }
    if (best !== null && bd <= 2) out.push({ from: t, to: best, dist: bd });
  }
  return out;
}

/* ---------- the blend: authority × relevance ---------- */

const minmax = (vals) => {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (hi - lo < 1e-300) return vals.map(() => 0.5);
  return vals.map((v) => (v - lo) / (hi - lo));
};

export function blendResults(idx, pr, query, alpha = 0.35, k1 = 1.2, b = 0.75) {
  const { terms, docs, killedBy, steps } = searchAND(idx, query, k1, b);
  const bmN = minmax(docs.map((d) => d.score));
  const prN = minmax(docs.map((d) => pr[d.i]));
  const blended = docs
    .map((d, n) => ({
      ...d,
      bm: d.score,
      pr: pr[d.i],
      bmN: bmN[n],
      prN: prN[n],
      final: alpha * prN[n] + (1 - alpha) * bmN[n],
    }))
    .sort((a, b2) => b2.final - a.final || a.i - b2.i);
  return { terms, killedBy, steps, docs: blended };
}

/* Snippet around the first query-term occurrence, with <b> highlights. */
export function snippet(doc, terms, radius = 14) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const words = doc.body.split(/\s+/);
  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
  let at = 0;
  for (let i = 0; i < words.length; i++) if (terms.includes(lower[i])) { at = i; break; }
  const from = Math.max(0, at - radius);
  const to = Math.min(words.length, at + radius + 1);
  const parts = words.slice(from, to).map((w) => {
    const bare = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    return terms.includes(bare) ? `<b>${esc(w)}</b>` : esc(w);
  });
  return `${from > 0 ? '… ' : ''}${parts.join(' ')}${to < words.length ? ' …' : ''}`;
}

export { D_PAPER };
