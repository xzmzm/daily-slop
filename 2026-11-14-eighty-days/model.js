/* Eighty Days — data + pure game logic, no DOM.
 * The clock is "absolute hours" since 1889-11-14 00:00 UTC.
 * Nellie Bly's real itinerary (Around the World in Seventy-Two Days,
 * Chapter XVIII) drives every sailing: pick the same boats and you
 * land on her official 72d 6h 11m. Miss a mail boat and you lose a week.
 */
(function (global) {
  'use strict';

  const START = 9 + 40 / 60 + 5; // Thu 1889-11-14 09:40 EST → 14.667h absolute
  const EPOCH_YEAR = 1889;
  const NELLIE_TOTAL = 72 * 24 + 6 + 11 / 60; // official tally, hours
  const VERNE_TOTAL = 80 * 24;
  const BISLAND_TOTAL = 1843; // her westbound run: 18h out to Jan 30, 08:00 EST (interpolated)
  const WEEKDAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
  const MONTHS = { 11: 'November', 12: 'December', 1: 'January', 2: 'February' };

  /* Port time zones: railway standard time as adopted by 1889, rounded.
   * (Penang uses +6:30, half-way to true local mean time.) */
  const PORTS = {
    hoboken: { name: 'Hoboken, N.J.', short: 'Hoboken', lon: -74.03, lat: 40.74, tz: -5, onRoute: true,
      flavor: 'The World\'s newsroom put you on the 9:40 boat-train cab. Fourteen steamers, twenty trains, one ocean liner — pick well.' },
    southampton: { name: 'Southampton, England', short: 'Southampton', lon: -1.4, lat: 50.9, tz: 0, onRoute: true,
      flavor: 'Down the gangway at 2:30 a.m. into fog, flashbulbs and a special boat-train.' },
    london: { name: 'London, England', short: 'London', lon: -0.12, lat: 51.51, tz: 0, onRoute: true,
      flavor: 'Charing Cross: telegrams from Pulitzer, then the Continental express.' },
    brindisi: { name: 'Brindisi, Italy', short: 'Brindisi', lon: 17.95, lat: 40.63, tz: 1, onRoute: true,
      flavor: 'The mail boat for India sails from the end of the mole — be on it.' },
    portsaid: { name: 'Port Said, Egypt', short: 'Port Said', lon: 32.56, lat: 31.26, tz: 2, onRoute: true,
      flavor: 'Coaling barges, flies, and the Suez Canal convoy leaving in the morning.' },
    aden: { name: 'Aden, Arabia', short: 'Aden', lon: 45.03, lat: 12.79, tz: 3, onRoute: true,
      flavor: 'A coal station, not a city. The steamer tops up and pushes east.' },
    colombo: { name: 'Colombo, Ceylon', short: 'Colombo', lon: 79.86, lat: 6.93, tz: 5.5, onRoute: true,
      flavor: 'Evening breeze, curry heat, and the P&O mail for Penang at eight.' },
    penang: { name: 'Penang, Straits Settlements', short: 'Penang', lon: 100.34, lat: 5.42, tz: 6.5, onRoute: true,
      flavor: 'Six hours in harbor. The boat for Singapore does not wait.' },
    singapore: { name: 'Singapore', short: 'Singapore', lon: 103.85, lat: 1.29, tz: 7, onRoute: true,
      flavor: 'Arrived at 5 a.m., sailing again at 9 p.m. — the fastest port call of the trip.' },
    hongkong: { name: 'Hong Kong', short: 'Hong Kong', lon: 114.17, lat: 22.3, tz: 8, onRoute: true,
      flavor: 'Christmas morning in the harbor — and the Oceanic will not sail for three days.' },
    yokohama: { name: 'Yokohama, Japan', short: 'Yokohama', lon: 139.64, lat: 35.44, tz: 9, onRoute: true,
      flavor: 'Four days of tatami and telegrams before the Pacific crossing.' },
    sanfran: { name: 'San Francisco, Cal.', short: 'San Francisco', lon: -122.42, lat: 37.77, tz: -8, onRoute: true,
      flavor: 'Back on home sand, two days early. The Overland Limited leaves at 5:30 p.m.' },
    chicago: { name: 'Chicago, Ill.', short: 'Chicago', lon: -87.63, lat: 41.88, tz: -6, onRoute: true,
      flavor: 'The World has a special engine and a clear track waiting. 1,013 miles to the finish.' },
  };

  // Waypoints for the map; the first/last match the ports' coordinates.
  const VIA = {
    atlantic: [[-74.03, 40.74], [-52, 48], [-26, 49.4], [-1.4, 50.9]],
    boatTrain: [[-1.4, 50.9], [-0.75, 51.2], [-0.12, 51.51]],
    viaParis: [[-0.12, 51.51], [2.3, 49.9], [7.7, 45.1], [12.5, 41.9], [17.95, 40.63]],
    viaCologne: [[-0.12, 51.51], [6.96, 50.94], [11.57, 48.14], [11.35, 47.26], [11.9, 44.5], [17.95, 40.63]],
    levant: [[17.95, 40.63], [24, 37.5], [28, 35.5], [32.56, 31.26]],
    canal: [[32.56, 31.26], [32.35, 30.6], [32.55, 29.97], [34.6, 27.5], [38.8, 20], [43.5, 13.6], [45.03, 12.79]],
    arabianSea: [[45.03, 12.79], [53, 11], [62, 8], [72, 7], [79.86, 6.93]],
    bayOfBengal: [[79.86, 6.93], [88, 6.2], [95, 6.3], [100.34, 5.42]],
    malacca: [[100.34, 5.42], [101.5, 3.2], [103.85, 1.29]],
    chinaSea: [[103.85, 1.29], [106.5, 8], [110.5, 17], [114.17, 22.3]],
    formosa: [[114.17, 22.3], [121, 26.5], [127.5, 32.5], [132.5, 33.6], [139.64, 35.44]],
    pacific: [[139.64, 35.44], [150, 38], [165, 41], [178, 43.5], [-178, 44.6], [-168, 45.5], [-155, 45.5], [-140, 43.5], [-130, 40.5], [-122.42, 37.77]],
    overland: [[-122.42, 37.77], [-112, 41], [-102, 41.3], [-95, 41], [-87.63, 41.88]],
    lakeshore: [[-87.63, 41.88], [-81, 41.6], [-77, 41.3], [-74.03, 40.74]],
  };

  /* Each leg: from/to, a carrier, duration hours, and departures.
   *  - at:   fixed sailings, given as local civil {mo, d, hh, mm} at origin.
   *  - daily:{hh, mm} local, every day.
   *  - charter: departs a fixed delay after you book it.
   */
  const LEGS = [
    { id: 'augusta-victoria', from: 'hoboken', to: 'southampton', kind: 'steamer', carrier: 'Hamburg America — Augusta Victoria',
      duration: 179.3333, via: VIA.atlantic,
      at: [{ mo: 11, d: 14, hh: 10, mm: 10 }], next: null,
      note: 'The liner Bly actually sailed on, Thursday Nov 14. Six days of champagne and pacing the deck.' },
    { id: 'etruria', from: 'hoboken', to: 'southampton', kind: 'steamer', carrier: 'Cunard — Etruria',
      duration: 148, via: VIA.atlantic,
      at: [{ mo: 11, d: 15, hh: 12, mm: 0 }], next: null,
      note: 'A Blue Riband express, a day later but nearly two days faster. Same Southampton, same mail boat onward.' },
    { id: 'boat-train', from: 'southampton', to: 'london', kind: 'rail', carrier: 'London & South Western boat train',
      duration: 2.5, via: VIA.boatTrain, daily: { hh: 3, mm: 10 } },
    { id: 'express-paris', from: 'london', to: 'brindisi', kind: 'rail', carrier: 'Charing Cross route — via Paris & Amiens',
      duration: 62.5, via: VIA.viaParis, daily: { hh: 10, mm: 0 },
      note: 'Historically chosen: two days for Jules Verne in Amiens, then the special train south. Catches the same mail boat.' },
    { id: 'express-cologne', from: 'london', to: 'brindisi', kind: 'rail', carrier: 'Mail express — via Cologne & the Brenner',
      duration: 52, via: VIA.viaCologne, daily: { hh: 19, mm: 30 },
      note: 'A straight run for sleep, not stories. Still reaches Brindisi before the Victoria sails.' },
    { id: 'victoria', from: 'brindisi', to: 'portsaid', kind: 'steamer', carrier: 'P&O — Victoria',
      duration: 59.5, via: VIA.levant,
      at: [{ mo: 11, d: 25, hh: 3, mm: 0 }, { mo: 12, d: 2, hh: 3, mm: 0 }, { mo: 12, d: 9, hh: 3, mm: 0 }], next: null,
      note: 'The weekly India mail from the mole. Miss it and you cool your heels for a week.' },
    { id: 'canal-boat', from: 'portsaid', to: 'aden', kind: 'steamer', carrier: 'P&O — through the Canal',
      duration: 123, via: VIA.canal,
      at: [{ mo: 11, d: 28, hh: 7, mm: 0 }, { mo: 12, d: 5, hh: 7, mm: 0 }, { mo: 12, d: 12, hh: 7, mm: 0 }], next: null,
      note: 'Ismailia by 11, Suez by 9 p.m., then five hot days down the Red Sea.' },
    { id: 'aden-mail', from: 'aden', to: 'colombo', kind: 'steamer', carrier: 'P&O — Aden mail',
      duration: 115.5, via: VIA.arabianSea,
      at: [{ mo: 12, d: 3, hh: 13, mm: 0 }, { mo: 12, d: 10, hh: 13, mm: 0 }, { mo: 12, d: 17, hh: 13, mm: 0 }], next: null,
      note: 'The same hull after coaling — two hours on the coal barges and away.' },
    { id: 'colombo-mail', from: 'colombo', to: 'penang', kind: 'steamer', carrier: 'P&O — Eastern mail',
      duration: 178, via: VIA.bayOfBengal,
      at: [{ mo: 12, d: 8, hh: 20, mm: 0 }, { mo: 12, d: 15, hh: 20, mm: 0 }, { mo: 12, d: 22, hh: 20, mm: 0 }], next: null,
      note: 'A slow coastal run with calls along the Coromandel shore. Best taken with a book.' },
    { id: 'penang-mail', from: 'penang', to: 'singapore', kind: 'steamer', carrier: 'P&O — Malacca shuttle',
      duration: 38.5, via: VIA.malacca,
      at: [{ mo: 12, d: 16, hh: 14, mm: 0 }, { mo: 12, d: 23, hh: 14, mm: 0 }, { mo: 12, d: 30, hh: 14, mm: 0 }], next: null,
      note: 'Down the straits through the 2 a.m. heat. Short, hot, punctual.' },
    { id: 'singapore-mail', from: 'singapore', to: 'hongkong', kind: 'steamer', carrier: 'P&O — China mail',
      duration: 153, via: VIA.chinaSea,
      at: [{ mo: 12, d: 18, hh: 21, mm: 0 }, { mo: 12, d: 25, hh: 21, mm: 0 }, { mo: 1, d: 1, hh: 21, mm: 0 }], next: null,
      note: 'Up the Gulf of Tonkin with the mail, calling once. Christmas Day in the harbor if you hold the schedule.' },
    { id: 'oceanic-hk', from: 'hongkong', to: 'yokohama', kind: 'steamer', carrier: 'Occidental & Oriental — Oceanic',
      duration: 137.5, via: VIA.formosa,
      at: [{ mo: 12, d: 28, hh: 14, mm: 30 }, { mo: 1, d: 4, hh: 14, mm: 30 }, { mo: 1, d: 11, hh: 14, mm: 30 }], next: null,
      note: 'The ship Bly waited three days for — the last fast link before the Pacific. Via Nagasaki.' },
    { id: 'oceanic-pacific', from: 'yokohama', to: 'sanfran', kind: 'steamer', carrier: 'Occidental & Oriental — Oceanic',
      duration: 350.0833, via: VIA.pacific,
      at: [{ mo: 1, d: 7, hh: 10, mm: 55 }, { mo: 1, d: 21, hh: 10, mm: 55 }, { mo: 2, d: 4, hh: 10, mm: 55 }], next: null,
      note: '4,500 miles east across the 180th meridian. The calendar jumps back a day; the mail does not wait.' },
    { id: 'overland-limited', from: 'sanfran', to: 'chicago', kind: 'rail', carrier: 'Overland Limited',
      duration: 35.5833, via: VIA.overland, daily: { hh: 17, mm: 30 },
      note: 'Departs 5:30 p.m. daily. Historically slowed by blizzards over the Sierra and the plains.' },
    { id: 'world-special', from: 'chicago', to: 'hoboken', kind: 'charter', carrier: 'New York World special engine',
      duration: 50.7667, charterDelay: 5, via: VIA.lakeshore,
      note: 'Booked once, on demand: a private engine, a clear track, and orders to ignore every other timetable.' },
    { id: 'ny-mail', from: 'chicago', to: 'hoboken', kind: 'rail', carrier: 'New York mail train',
      duration: 55, via: VIA.lakeshore, daily: { hh: 10, mm: 0 },
      note: 'The ordinary mail. It arrives too — four hours late for the headlines.' },
  ];

  const LEGS_BY_PORT = {};
  LEGS.forEach((leg) => { (LEGS_BY_PORT[leg.from] = LEGS_BY_PORT[leg.from] || []).push(leg); });

  // Nellie's real absolute arrival hours (UTC) per port, from Chapter XVIII.
  const NELLIE_ARRIVALS = {
    hoboken: START, southampton: 194.5, london: 197.6667, brindisi: 264.5, portsaid: 325.5,
    aden: 464, colombo: 581.5, penang: 768.5, singapore: 814, hongkong: 983,
    yokohama: 1200, sanfran: 1648, chicago: 1693.0833,
  };

  // News that lands while you are underway, keyed by absolute hour.
  const NEWS = [
    { h: 18, text: 'New York wires: Elizabeth Bisland, the Cosmopolitan\'s answer, left the same hour — the other way around the world.' },
    { h: 188, text: 'San Francisco: Bisland boards the City of Peking, racing you westward.' },
    { h: 728, text: 'Bisland reaches Hong Kong, thirty days out. The two reporters miss each other by one harbor.' },
    { h: 1440, text: 'Bisland passes Brindisi on the overland dash for Queenstown. Her papers say she is winning.' },
    { h: 1560, text: 'Queenstown, Jan 18: her fast ship is gone — Bisland sails on the slower Cunard Bothnia, eleven rough days from home.' },
    { h: 1861, text: 'The Bothnia docks in New York: 76½ days by the Cosmopolitan\'s count. Only your clock still runs.' },
  ];

  /* Elizabeth Bisland's westbound progress, milestones interpolated from the
   * published account (16 days SF→Yokohama, 36h stay, 5 days to Hong Kong,
   * Bothnia from Queenstown Jan 18). Position = {lon, lat, label}. */
  const BISLAND_MILESTONES = [
    { h: 18, port: 'hoboken', label: 'New York — train west' },
    { h: 158, port: 'sanfran', label: 'San Francisco' },
    { h: 188, port: 'sanfran', label: 'San Francisco — City of Peking' },
    { h: 572, port: 'yokohama', label: 'Yokohama' },
    { h: 608, port: 'yokohama', label: 'Yokohama — sailing' },
    { h: 728, port: 'hongkong', label: 'Hong Kong' },
    { h: 992, port: 'colombo', label: 'Colombo' },
    { h: 1160, port: 'aden', label: 'Aden' },
    { h: 1272, port: 'portsaid', label: 'Port Said' },
    { h: 1440, port: 'brindisi', label: 'Brindisi — overland' },
    { h: 1495, port: 'london', label: 'London' },
    { h: 1501, port: 'london', label: 'London — Holyhead boat' },
    { h: 1560, port: 'portsaid', label: 'At sea aboard the Bothnia', at: { lon: -8.3, lat: 51.79 } },
    { h: 1861, port: 'hoboken', label: 'New York — finished, 76½ days' },
  ];

  /* ---------- calendar ---------- */

  function civilToHours(mo, d, hh, mm) {
    const base = mo === 11 ? d - 14 : mo === 12 ? 17 + d - 1 : mo === 1 ? 48 + d - 1 : 79 + d - 1;
    if (base < 0 || Number.isNaN(base)) throw new Error('civil date outside Nov 14 1889 – Feb 28 1890');
    return base * 24 + hh + mm / 60;
  }

  function hoursToCivil(h) {
    let days = Math.floor(h / 24 + 1e-9);
    let rem = h - days * 24;
    let hh = Math.floor(rem + 1e-9);
    let mm = Math.round((rem - hh) * 60);
    if (mm >= 60) { mm -= 60; hh += 1; }
    if (hh >= 24) { hh -= 24; days += 1; }
    let mo, date, year;
    if (days <= 16) { mo = 11; date = 14 + days; year = 1889; }
    else if (days <= 47) { mo = 12; date = days - 16; year = 1889; }
    else if (days <= 78) { mo = 1; date = days - 47; year = 1890; }
    else { mo = 2; date = days - 78; year = 1890; }
    return { mo, date, year, hh, mm, weekday: WEEKDAYS[days % 7] };
  }

  function clock12(hh, mm) {
    const suffix = hh < 12 ? 'a.m.' : 'p.m.';
    let h12 = hh % 12; if (h12 === 0) h12 = 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
  }

  function formatLocal(h, tz) {
    const c = hoursToCivil(h + tz);
    return `${c.weekday}, ${MONTHS[c.mo]} ${c.date}, ${c.year} · ${clock12(c.hh, c.mm)}`;
  }

  function formatShort(h, tz) {
    const c = hoursToCivil(h + tz);
    const mon = { 11: 'Nov', 12: 'Dec', 1: 'Jan', 2: 'Feb' }[c.mo];
    return `${c.weekday.slice(0, 3)} ${mon} ${c.date} · ${clock12(c.hh, c.mm)}`;
  }

  function formatElapsed(h) {
    const mins = Math.max(0, Math.round(h * 60));
    const d = Math.floor(mins / 1440);
    const hh = Math.floor((mins % 1440) / 60);
    const mm = mins % 60;
    return `${d}d ${hh}h ${String(mm).padStart(2, '0')}m`;
  }

  /* ---------- departures ---------- */

  function localDep(leg, dep) {
    const tz = PORTS[leg.from].tz;
    return civilToHours(dep.mo, dep.d, dep.hh, dep.mm) - tz;
  }

  // Up to `count` upcoming departures (absolute hours) strictly after `now`.
  function nextDepartures(leg, now, count = 3) {
    const out = [];
    if (leg.at) {
      for (const dep of leg.at) {
        const abs = localDep(leg, dep);
        if (abs > now + 1e-6) out.push(abs);
      }
    } else if (leg.daily) {
      const tz = PORTS[leg.from].tz;
      const local = now + tz;
      let target = Math.floor(local / 24) * 24 + leg.daily.hh + leg.daily.mm / 60;
      if (target < local + 1e-6) target += 24;
      for (let k = 0; k < count; k++) out.push(target - tz + k * 24);
    } else if (leg.charterDelay !== undefined) {
      out.push(now + leg.charterDelay);
    }
    return out.slice(0, count);
  }

  // What you can board right now, each with its next sailing.
  function optionsAt(portId, now) {
    return (LEGS_BY_PORT[portId] || []).map((leg) => {
      const deps = nextDepartures(leg, now, leg.kind === 'rail' ? 2 : 3);
      return { leg, departures: deps };
    }).filter((opt) => opt.departures.length > 0);
  }

  function travel(leg, depAbs) {
    return depAbs + leg.duration;
  }

  // Steamers that sailed from `portId` while you stood there and did not board.
  function missedSailings(portId, arrived, departed) {
    let missed = 0;
    for (const leg of LEGS_BY_PORT[portId] || []) {
      if (!leg.at) continue;
      for (const dep of leg.at) {
        const abs = localDep(leg, dep);
        if (abs > arrived + 1e-6 && abs < departed - 1e-6) missed += 1;
      }
    }
    return missed;
  }

  /* ---------- rival ---------- */

  function unwrapLon(from, to) {
    let t = to;
    while (t - from > 180) t -= 360;
    while (from - t > 180) t += 360;
    return t;
  }

  function bislandPosition(h) {
    if (h <= BISLAND_MILESTONES[0].h) return { ...coordsAt(BISLAND_MILESTONES[0]), label: BISLAND_MILESTONES[0].label };
    for (let i = 0; i < BISLAND_MILESTONES.length - 1; i++) {
      const a = BISLAND_MILESTONES[i];
      const b = BISLAND_MILESTONES[i + 1];
      if (h >= a.h && h < b.h) {
        const pa = pointAt(a);
        const pb = pointAt(b);
        const t = (h - a.h) / (b.h - a.h);
        const lon = pa.lon + (unwrapLon(pa.lon, pb.lon) - pa.lon) * t;
        return {
          lon: ((lon % 360) + 540) % 360 - 180,
          lat: pa.lat + (pb.lat - pa.lat) * t,
          label: t < 0.5 ? a.label : b.label,
        };
      }
    }
    const last = BISLAND_MILESTONES[BISLAND_MILESTONES.length - 1];
    return { ...coordsAt(last), label: last.label };
  }

  function coordsAt(m) {
    if (m.at) return m.at;
    const p = PORTS[m.port];
    return { lon: p.lon, lat: p.lat };
  }

  function pointAt(m) {
    return coordsAt(m);
  }

  /* ---------- verdicts ---------- */

  function verdict(elapsed, missed, stranded) {
    if (stranded) {
      return { tier: 'stranded', title: 'Stranded by the timetable',
        text: 'No further sailing on this line this season. The mail chain has carried Bisland home and the harbor is empty.' };
    }
    const over = elapsed - NELLIE_TOTAL;
    if (missed === 0 && elapsed <= NELLIE_TOTAL + 0.5) {
      return { tier: 'record', title: 'A perfect run — 72d 6h 11m',
        text: 'You caught every mail boat Nellie Bly caught, to the hour of her official world record. Jules Verne owes you applause with both hands.' };
    }
    if (elapsed < VERNE_TOTAL) {
      const cost = over > 1 / 60 ? `, but missed sailings cost you ${formatElapsed(over)}` : ', and missed sailings cost you nothing but stories';
      return { tier: 'verne', title: 'Inside eighty days',
        text: `You beat Verne's fictional clock by ${formatElapsed(VERNE_TOTAL - elapsed)}${cost}. Nellie did it in 72d 6h 11m.` };
    }
    return { tier: 'over', title: 'Over eighty days',
      text: `The fictional record stands. You needed ${formatElapsed(over)} more than Verne's travelers, and ${formatElapsed(over)} more than Nellie Bly's 72d 6h 11m.` };
  }

  const EightyDays = {
    START, NELLIE_TOTAL, VERNE_TOTAL, BISLAND_TOTAL, PORTS, LEGS, LEGS_BY_PORT,
    NELLIE_ARRIVALS, NEWS, BISLAND_MILESTONES, VIA,
    civilToHours, hoursToCivil, clock12, formatLocal, formatShort, formatElapsed,
    nextDepartures, optionsAt, travel, missedSailings, bislandPosition, verdict,
  };

  global.EightyDays = EightyDays;
  if (typeof module !== 'undefined' && module.exports) module.exports = EightyDays;
})(typeof window !== 'undefined' ? window : globalThis);
