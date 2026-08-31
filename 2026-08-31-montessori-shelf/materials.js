// materials.js — Montessori math-shelf studio, exact forms.
// 31 Aug 1870: Maria Montessori was born at Chiaravalle (Ancona), Italy — 156
// years ago today. In 1907 she opened the Casa dei Bambini in the San Lorenzo
// slum of Rome and gave poor children materials they could hold: golden beads
// that make place value visible, a pink tower whose ten cubes hide a number-
// theory identity, and wooden boxes that are literally algebraic cubes. The
// pedagogy is famous; what this studio catalogues is the exact arithmetic
// inside the materials, because every one of them is a closed form:
//
//   (1) the exchange algebra — a "category vector" (u, t, h, k) counts loose
//       beads, ten-bars, hundred-squares, thousand-cubes; its value
//       V = u + 10t + 100h + 1000k is invariant under every exchange
//       10-of-a-kind ⇄ 1-of-the-next-kind, and dynamic addition is nothing
//       but combine-then-canonicalize with carry digits ≤ 9;
//   (2) Nicomachus's theorem, hidden in the pink tower — the ten cubes have
//       edges 1..10 cm and volumes 1³..10³, whose sum is exactly T² with
//       T = 1+2+…+10 = 55 (the number rods' total length in cm), and the
//       nested L-gnomons of a 55×55 square have areas exactly 1³, 2³, …, 10³
//       because T(n)² − T(n−1)² = n·(T(n)+T(n−1)) = n·n² = n³;
//   (3) the binomial cube — 8 wooden pieces fill a box of volume (a+b)³
//       because a³ + 3a²b + 3ab² + b³ counts them exactly (1+1+3+3 = 8);
//   (4) the trinomial cube — 27 pieces, (a+b+c)³ = Σa³ + 3Σ_sym a²b + 6abc
//       (3 + 18 + 6 = 27).
//
// Here a=6, b=4 and a=5, b=3, c=2 so both boxes are exactly 10 cm on a side:
// volume 1000 cm³ — the same as the largest pink-tower cube. (Commercial
// materials use the manufacturer's own cuts; the identities are the point.)

export const CATS = [
  { key: "unit",    label: "个",   letter: "u", value: 1,     color: "#3f9d63", cn: "个位 · 绿" },
  { key: "ten",     label: "十",   letter: "t", value: 10,    color: "#3f7fb8", cn: "十位 · 蓝" },
  { key: "hundred", label: "百",   letter: "h", value: 100,   color: "#c0504d", cn: "百位 · 红" },
  { key: "thousand",label: "千",   letter: "k", value: 1000,  color: "#2e7d53", cn: "千位 · 绿" },
  { key: "tenK",    label: "万",   letter: "w", value: 10000, color: "#2f6da0", cn: "万位 · 蓝" },
];

export const zeroCounts = () => ({ unit: 0, ten: 0, hundred: 0, thousand: 0, tenK: 0 });

// V = u + 10t + 100h + 1000k (+ 10000w) — exact while totals stay ≪ 2^53.
export function valueOf(counts) {
  return CATS.reduce((sum, cat) => sum + counts[cat.key] * cat.value, 0);
}

export function bigintValueOf(counts) {
  return CATS.reduce((sum, cat) => sum + BigInt(counts[cat.key]) * BigInt(cat.value), 0n);
}

// Split a plain number into one category vector (no canonicalization:
// the whole point is that 15 lives in the vector as {unit: 15} until the
// child walks it to the bank).
export function countsFromNumber(n) {
  const counts = zeroCounts();
  counts.unit = n; // everything arrives as loose units, like a counted pile
  return counts;
}

// The bank exchange: 10 of category idx ⇄ 1 of category idx+1.
// Returns { counts, ok } — ok is false when there is nothing to exchange
// or when the category is already the largest we stock.
export function exchangeDown(counts, idx) {
  if (idx < 0 || idx >= CATS.length - 1) return { counts, ok: false };
  if (counts[CATS[idx].key] < 10) return { counts, ok: false };
  const next = { ...counts };
  next[CATS[idx].key] -= 10;
  next[CATS[idx + 1].key] += 1;
  return { counts: next, ok: true };
}

// Canonical form: no category holds ten or more — the fully exchanged pile.
// This is exactly the schoolbook carry algorithm run on a bead vector.
export function canonicalize(counts) {
  const c = { ...counts };
  for (let idx = 0; idx < CATS.length - 1; idx += 1) {
    const carry = Math.floor(c[CATS[idx].key] / 10);
    if (carry > 0) {
      c[CATS[idx].key] %= 10;
      c[CATS[idx + 1].key] += carry;
    }
  }
  return c;
}

export function isCanonical(counts) {
  return CATS.slice(0, -1).every((cat) => counts[cat.key] < 10);
}

// Combine = pointwise addition of two category vectors (the physical act of
// sliding tray B onto tray A, before any trip to the bank).
export function addCounts(a, b) {
  const sum = zeroCounts();
  for (const cat of CATS) sum[cat.key] = a[cat.key] + b[cat.key];
  return sum;
}

// The ledger of dynamic addition: one column per place, carry in/out, digit.
// Runs on plain integers (the numbers here are ≤ 19998) and is checked
// against BigInt in the tests.
export function dynamicAddLedger(aNum, bNum) {
  const cols = [];
  let carry = 0;
  let carryCount = 0;
  for (let idx = 0; idx < CATS.length; idx += 1) {
    const ai = Math.floor(aNum / CATS[idx].value) % 10;
    const bi = Math.floor(bNum / CATS[idx].value) % 10;
    const s = ai + bi + carry;
    const digit = s % 10;
    const carryOut = s >= 10 ? 1 : 0;
    cols.push({ idx, cat: CATS[idx].key, label: CATS[idx].label, color: CATS[idx].color,
                a: ai, b: bi, carryIn: carry, sum: s, digit, carryOut });
    if (carryOut) carryCount += 1;
    carry = carryOut;
  }
  // overflow past the highest stocked category (e.g. 9999 + 1 = 10000)
  const result = aNum + bNum;
  if (carry !== 0) {
    const overflow = Math.floor(result / CATS[CATS.length - 1].value);
    cols[CATS.length - 1].digit = overflow; // ten-thousands live in the w column
  }
  return { cols, carryCount, result, aNum, bNum };
}

// A step-by-step script of every physical exchange the child performs to get
// from the merged pile to the canonical answer: bottom-up, one group of ten
// at a time. Each step records the category traded up and the running value,
// which never changes.
export function exchangeScript(counts) {
  const steps = [];
  let current = { ...counts };
  for (let idx = 0; idx < CATS.length - 1; idx += 1) {
    while (current[CATS[idx].key] >= 10) {
      const { counts: next } = exchangeDown(current, idx);
      steps.push({ fromIdx: idx, fromKey: CATS[idx].key, toKey: CATS[idx + 1].key,
                   counts: next, valueBefore: valueOf(current), valueAfter: valueOf(next) });
      current = next;
    }
  }
  return { steps, final: current };
}

// --- Nicomachus: the pink tower and the 55×55 plate ------------------------

export const triangular = (n) => (n * (n + 1)) / 2;
export const sumCubes = (n) => triangular(n) ** 2; // Nicomachus's theorem
export const sumCubesNaive = (n) => {
  let s = 0;
  for (let k = 1; k <= n; k += 1) s += k ** 3;
  return s;
};

// The pink tower: ten cubes, edges 1..10 cm.
export function pinkTower() {
  const cubes = [];
  for (let n = 1; n <= 10; n += 1) {
    cubes.push({ n, edgeCm: n, volumeCm3: n ** 3 });
  }
  const total = cubes.reduce((s, c) => s + c.volumeCm3, 0);
  return { cubes, totalCm3: total, T: triangular(10), T2: triangular(10) ** 2 };
}

// Nested L-gnomons of the T×T square: gnomon n (the ring added when the
// square grows from (n−1)² to n²) has area exactly n³, because
// T(n)² − T(n−1)² = n·(T(n) + T(n−1)) = n·n².
export function gnomonAreas(n) {
  const out = [];
  for (let k = 1; k <= n; k += 1) out.push({ n: k, area: triangular(k) ** 2 - triangular(k - 1) ** 2 });
  return out;
}

// --- the algebra boxes ------------------------------------------------------

export const BINOMIAL = { a: 6, b: 4, sideCm: 10 };   // box = (6+4)³ = 1000 cm³
export const TRINOMIAL = { a: 5, b: 3, c: 2, sideCm: 10 }; // (5+3+2)³ = 1000 cm³

// One piece per cell (i,j,k) of the 2×2×2 grid; the cell's dimension letters
// along the three axes tell you which term of the expansion the piece is.
export function binomialPieces(a = BINOMIAL.a, b = BINOMIAL.b) {
  const dims = [a, b];
  const terms = { "a³": 0, "a²b": 0, "ab²": 0, "b³": 0 };
  const pieces = [];
  for (let i = 0; i < 2; i += 1)
    for (let j = 0; j < 2; j += 1)
      for (let k = 0; k < 2; k += 1) {
        const letters = [i, j, k].map((d) => (d === 0 ? "a" : "b"));
        const na = letters.filter((x) => x === "a").length;
        const term = na === 3 ? "a³" : na === 2 ? "a²b" : na === 1 ? "ab²" : "b³";
        terms[term] += 1;
        pieces.push({ i, j, k, term,
          dx: dims[i], dy: dims[j], dz: dims[k],
          volume: dims[i] * dims[j] * dims[k] });
      }
  const inventory = [
    { term: "a³",  count: terms["a³"],  each: a ** 3, volume: terms["a³"] * a ** 3 },
    { term: "a²b", count: terms["a²b"], each: a * a * b, volume: terms["a²b"] * a * a * b },
    { term: "ab²", count: terms["ab²"], each: a * b * b, volume: terms["ab²"] * a * b * b },
    { term: "b³",  count: terms["b³"],  each: b ** 3, volume: terms["b³"] * b ** 3 },
  ];
  const pieceCount = inventory.reduce((s, r) => s + r.count, 0);
  const volume = inventory.reduce((s, r) => s + r.volume, 0);
  return { pieces, inventory, pieceCount, volume, boxVolume: (a + b) ** 3, a, b };
}

export function trinomialPieces(a = TRINOMIAL.a, b = TRINOMIAL.b, c = TRINOMIAL.c) {
  const dims = [a, b, c];
  const lettersOf = ["a", "b", "c"];
  const terms = { "a³": 0, "b³": 0, "c³": 0, "a²b": 0, "a²c": 0, "b²a": 0, "b²c": 0, "c²a": 0, "c²b": 0, "abc": 0 };
  const pieces = [];
  for (let i = 0; i < 3; i += 1)
    for (let j = 0; j < 3; j += 1)
      for (let k = 0; k < 3; k += 1) {
        const letters = [lettersOf[i], lettersOf[j], lettersOf[k]];
        const count = { a: 0, b: 0, c: 0 };
        letters.forEach((x) => { count[x] += 1; });
        let term;
        if (count.a === 3) term = "a³";
        else if (count.b === 3) term = "b³";
        else if (count.c === 3) term = "c³";
        else if (count.a === 2) term = count.b === 1 ? "a²b" : "a²c";
        else if (count.b === 2) term = count.a === 1 ? "b²a" : "b²c";
        else if (count.c === 2) term = count.a === 1 ? "c²a" : "c²b";
        else term = "abc";
        terms[term] += 1;
        pieces.push({ i, j, k, term,
          dx: dims[i], dy: dims[j], dz: dims[k],
          volume: dims[i] * dims[j] * dims[k] });
      }
  const inventory = Object.entries(terms).map(([term, count]) => ({ term, count, each: 0, volume: 0 }));
  // exact per-term volumes read off the piece list itself
  for (const row of inventory) {
    row.each = pieces.filter((p) => p.term === row.term)[0].volume;
    row.volume = row.each * row.count;
  }
  const pieceCount = pieces.length;
  const volume = pieces.reduce((s, p) => s + p.volume, 0);
  return { pieces, inventory, pieceCount, volume, boxVolume: (a + b + c) ** 3, a, b, c };
}

// --- the shelf's ledger ------------------------------------------------------

export const PRESETS = [
  { id: "casa1907", name: "儿童之家 · 1907", a: 3567, b: 2795, tab: null,
    note: "三次进位的动态加法：3567 + 2795 = 6362" },
  { id: "cascade", name: "连环四换 · 9999+1", a: 9999, b: 1, tab: null,
    note: "满位进位：四类同时去银行，换出一个万" },
  { id: "static", name: "静态加法 · 不进位", a: 2345, b: 1234, tab: null,
    note: "2345 + 1234 = 3579：一次都不用去银行" },
  { id: "first-exchange", name: "第一课 · 8+7", a: 8, b: 7, tab: null,
    note: "八个加七个：十五粒散珠，换一串十、剩五粒" },
  { id: "nicomachus", name: "粉红塔 · Σn³ = 55²", a: 3567, b: 2795, tab: "tower",
    note: "十块立方体的体积总和，恰好是 55 的平方" },
];

export const TIMELINE = [
  { year: "1870", date: "8 月 31 日", title: "基娅拉瓦莱", text: "玛丽亚·蒙台梭利生在意大利安科纳省的基娅拉瓦莱。今天是她的第 156 个生日。" },
  { year: "1896", title: "医学毕业", text: "罗马大学医学院毕业，是意大利最早的女医生之一；随后在矫正学校与「缺陷儿童」相处，从伊塔与塞甘那里接过了感官教育。" },
  { year: "1907", date: "1 月 6 日", title: "儿童之家", text: "罗马圣洛伦佐贫民区开出第一所 Casa dei Bambini，约六十个孩子。教具进了贫民窟，「书写爆发」震动了全城。" },
  { year: "1909", title: "《蒙台梭利方法》", text: "意文版《科学教育学的方法》出版；1912 年英译本在美国成为轰动一时的畅销书。" },
  { year: "1915", title: "玻璃教室", text: "旧金山巴拿马—太平洋万国博览会上，一间玻璃墙教室让围观人群看着孩子们安静地工作。「游戏是儿童的工作」从此传开。" },
  { year: "1934", title: "离开意大利", text: "与法西斯政权决裂，学校被关。她经西班牙、荷兰辗转到印度，战时在印度培训教师，写下宇宙教育。" },
  { year: "1949–51", title: "三次提名", text: "连续三年获诺贝尔和平奖提名。" },
  { year: "1952", date: "5 月 6 日", title: "北威克", text: "在荷兰北威克去世。墓志铭写着她的话：「我请求亲爱的、无所不能的孩子们，和我一起来建造人与人之间的和平。」" },
  { year: "今天", title: "22,000+ 所学校", text: "蒙台梭利学校遍布全球。谷歌的佩奇与布林、贝索斯、维基百科的威尔士、马尔克斯、朱莉娅·蔡尔德，都曾是蒙台梭利孩子。" },
];

export const QUOTES = [
  { text: "Help me to do it myself.", cn: "帮助我，让我自己做。", note: "孩子对她说的话，也是全部方法的钥匙（意为 Aiutami a fare da solo）" },
  { text: "The hands are the instruments of man's intelligence.", cn: "手是人类智力的器官。", note: "" },
  { text: "Never help a child with a task at which he feels he can succeed.", cn: "绝不要去帮一个孩子做他觉得自己能成功的事。", note: "" },
];

// The famous former Montessori children (commonly cited; see NOTES).
export const ALUMNI = [
  { name: "Larry Page", who: "Google 联合创始人" },
  { name: "Sergey Brin", who: "Google 联合创始人" },
  { name: "Jeff Bezos", who: "亚马逊创始人" },
  { name: "Jimmy Wales", who: "维基百科创始人" },
  { name: "Gabriel García Márquez", who: "诺贝尔文学奖得主" },
  { name: "Julia Child", who: "厨师、电视人" },
  { name: "Anne Frank", who: "《安妮日记》" },
];
