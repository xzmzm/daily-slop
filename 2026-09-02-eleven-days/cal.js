// cal.js — Eleven Days studio, exact calendar arithmetic.
// 2 September 1752, a Wednesday, was the last day the British Empire wrote in
// Julius Caesar's calendar; that night the counters moved to Thursday
// 14 September — eleven dates (3–13 September) that were never printed, while
// the seven-day week ran on unbroken. Caesar's year of 365.25 days is 11
// minutes 14 seconds too long per turn, so the equinox had been sliding a day
// every ~128 years since the Council of Nicaea pinned it to 21 March; by 1582
// it sat on 11 March and Gregory XIII dropped ten days to put it back. Every
// number in this studio is an exact closed form you can check by hand: the
// Julian↔Gregorian serial-day engine (Howard Hinnant's civil algorithms, one
// per calendar, both anchored to the same physical day so the week never
// breaks), the secular gap D(y) = ⌊y/100⌋ − ⌊y/400⌋ − 2, Zeller's
// congruence, Conway's doomsday method (century anchor (5(c mod 4)+2) mod 7,
// plus his Odd+11 shortcut), and the two computus engines — Meeus's anonymous
// Gregorian algorithm and the classical Julian paschalia (paschal full moon
// = 21 March + (19a+15) mod 30, then the next Sunday strictly after).

// --- the three years -------------------------------------------------------
export const JULIAN_YEAR = 365.25;            // Caesar, 46 BC (Julian reform)
export const TROPICAL_YEAR = 365.2422;        // mean tropical year — the famous 11 min 14 s
export const GREGORIAN_YEAR = 365 + 97 / 400; // 365.2425 exactly, by decree
export const SYNODIC_MONTH = 29.530589;       // mean new moon to new moon
export const METONIC_YEARS = 19;
export const METONIC_MONTHS = 235;

export const julianDriftPerYear = JULIAN_YEAR - TROPICAL_YEAR;   // d/yr, +0.0078 (year too long)
export const gregorianDriftPerYear = GREGORIAN_YEAR - TROPICAL_YEAR; // d/yr, +0.0003 (still too long)
export const daysPerJulianSlip = 1 / julianDriftPerYear;        // ≈ 128.2 yr per slipped day
export const daysPerGregorianSlip = 1 / gregorianDriftPerYear;  // ≈ 3,333 yr per slipped day
export const metonicGap = Math.abs(METONIC_YEARS * TROPICAL_YEAR - METONIC_MONTHS * SYNODIC_MONTH); // d
export const metonicGapHours = metonicGap * 24;                 // ≈ 2.07 h per 19 years

// --- serial-day engine (one integer per physical day, both calendars) -------
// Hinnant's days_from_civil, Gregorian: serial 0 = 1970-01-01 (a Thursday).
export function serialGregorian(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
// Julian twin, same epoch, derived so that Julian 0001-01-01 = Gregorian
// 0000-12-30 (serial −719164) and Julian 1582-10-04 = Gregorian 1582-10-14.
export function serialJulian(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 4);
  const yoe = y - era * 4;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + doy;
  return era * 1461 + doe - 719470;
}
// Inverse (Gregorian) — civilFromDays from Hinnant, extended to any era.
export function civilGregorian(serial) {
  let z = serial + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}
export function civilJulian(serial) {
  const z = serial + 719470;
  const era = Math.floor(z / 1461);
  const doe = z - era * 1461;
  const yoe = Math.floor(doe / 365);
  const y = yoe + era * 4;
  const doy = doe - 365 * yoe;
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

// --- weekday ----------------------------------------------------------------
// serial 0 = Thursday; the seven-day cycle has run unbroken through every
// reform — that continuity is the whole reason 2 Sep (Wed) → 14 Sep (Thu).
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
export function weekdayOfSerial(serial) {
  return (((serial + 4) % 7) + 7) % 7; // Sunday = 0
}
export function weekdayGregorian(y, m, d) { return weekdayOfSerial(serialGregorian(y, m, d)); }
export function weekdayJulian(y, m, d) { return weekdayOfSerial(serialJulian(y, m, d)); }

// --- conversion between the two calendars ----------------------------------
export function julianToGregorian(y, m, d) { return civilGregorian(serialJulian(y, m, d)); }
export function gregorianToJulian(y, m, d) { return civilJulian(serialGregorian(y, m, d)); }

// The secular gap: Gregorian date = Julian date + D(y), days skipped by the
// Julian leap days of 1700/1800/1900/2100… that Gregory's rule omits. Exact
// closed form from 300 AD onward; the gap steps at 1 March of a skip year.
export function gapClosedForm(year) {
  return Math.floor(year / 100) - Math.floor(year / 400) - 2;
}
export function gapAtSerial(serial) { // truth: same physical day, read on both calendars
  const j = civilJulian(serial);
  return serial - serialGregorian(j.y, j.m, j.d);
}

// --- leap years -------------------------------------------------------------
export const isLeapJulian = (y) => y % 4 === 0;
export const isLeapGregorian = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// --- Zeller's congruence (Gregorian), independent weekday cross-check -------
export function zellerGregorian(y, m, d) {
  if (m <= 2) { m += 12; y -= 1; }
  const K = y % 100, J = Math.floor(y / 100);
  const h = (d + Math.floor((13 * (m + 1)) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
  return (h + 6) % 7; // h: 0=Saturday → Sunday = 0
}

// --- Conway's doomsday method ----------------------------------------------
export const ANCHOR_1800 = 5, ANCHOR_1900 = 3, ANCHOR_2000 = 2, ANCHOR_2100 = 0; // Sunday = 0
export function anchorDay(year) { // closed form: (5·(c mod 4) + 2) mod 7
  const c = Math.floor(year / 100);
  return (5 * (c % 4) + 2) % 7;
}
export function oddPlus11(year) { // Conway's shortcut for the year part
  let t = year % 100;
  if (t % 2 === 1) t += 11;
  t = Math.floor(t / 2);
  if (t % 2 === 1) t += 11;
  return t % 7;
}
export function doomsdayOfYear(year) {
  const yy = year % 100;
  return (anchorDay(year) + yy + Math.floor(yy / 4)) % 7;
}
// The memorable dates that always land on the doomsday (leap year in brackets).
export const DOOMSDAY_DATES = [
  { m: 1, d: 3, leapD: 4, label: "1/3 [1/4]", zh: "一月" },
  { m: 2, d: 28, leapD: 29, label: "2月最后一天", zh: "二月底" },
  { m: 3, d: 14, leapD: 14, label: "3/14 π日", zh: "π 日" },
  { m: 4, d: 4, leapD: 4, label: "4/4", zh: "" },
  { m: 5, d: 9, leapD: 9, label: "5/9", zh: "" },
  { m: 6, d: 6, leapD: 6, label: "6/6", zh: "" },
  { m: 7, d: 11, leapD: 11, label: "7/11", zh: "" },
  { m: 8, d: 8, leapD: 8, label: "8/8", zh: "" },
  { m: 9, d: 5, leapD: 5, label: "9/5", zh: "" },
  { m: 10, d: 10, leapD: 10, label: "10/10", zh: "" },
  { m: 11, d: 7, leapD: 7, label: "11/7", zh: "" },
  { m: 12, d: 12, leapD: 12, label: "12/12", zh: "" },
];
export function weekdayByDoomsday(y, m, d) {
  const dd = doomsdayOfYear(y);
  const leap = isLeapGregorian(y);
  const anchor = DOOMSDAY_DATES.find((x) => x.m === m);
  const anchorDayOfMonth = leap ? anchor.leapD : anchor.d;
  const diff = ((d - anchorDayOfMonth) % 7 + 7) % 7;
  return (dd + diff) % 7;
}

// --- computus --------------------------------------------------------------
export function goldenNumber(year) { return (year % 19) + 1; }
// Meeus, Astronomical Algorithms ch. 8 — the anonymous Gregorian algorithm of
// 1876/1882 that the Church's own tables encode; the m-term is the pair of
// lunar corrections that fix the 1954/1981/2049/2076 exceptions.
export function easterGregorian(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y: year, m: month, d: day };
}
// The Julian paschalia in one line: paschal full moon = 21 March Julian +
// (19a+15) mod 30 (the Metonic table with its saltus lunae), Easter = the
// next Sunday strictly after it. Returns Julian-calendar dates; call
// julianToGregorian for the civil label the Orthodox churches keep.
export function easterJulian(year) {
  const a = year % 19;
  const d = (19 * a + 15) % 30;
  const pfmSerial = serialJulian(year, 3, 21) + d;
  let s = pfmSerial + 1;
  while (weekdayOfSerial(s) !== 0) s += 1; // first Sunday strictly after
  return { pfm: civilJulian(pfmSerial), ...civilJulian(s) };
}
export function epactGregorian(year) {
  const g = goldenNumber(year); // standard epact from the golden number + solar correction
  const s = Math.floor(year / 100) - Math.floor(year / 400) - 12; // lunar (solar-letter) correction count... exact below
  // Epact = age of the moon on 22 March, ecclesiastically. Use the 1576-era
  // formula via the golden number and the solar equation, mod 30.
  const solar = 3 * Math.floor(year / 400); // days Gregory removed from the moon tables
  const e = ((11 * (g - 1) - solar + 30 * 3) % 30 + 30) % 30;
  return e;
}

// --- the drift of the equinox (mean model, exact line arithmetic) ----------
// Julian-calendar date of the mean equinox, modelled from Nicaea (325, 21 Mar
// Julian) drifting 0.00783 d/yr; Gregory's reform re-set the anchor so the
// 1583 equinox sits on 21 March Gregorian and then drifts 0.00033 d/yr.
export function equinoxJulianLabel(year) {
  const drift = (year - 325) * julianDriftPerYear;
  return 21 - drift; // March-date (may go below 1 → February)
}

// --- the adoption ledger (dates verified; weekdays computed live) ----------
export const ADOPTIONS = [
  { who: "西班牙 · 葡萄牙", en: "Spain & Portugal", y: 1582, old: { y: 1582, m: 10, d: 4 }, newG: { y: 1582, m: 10, d: 15 }, note: "教皇的诏书 Inter gravissimas 首先落地：儒略 10 月 4 日（周四）睡去，格里历 10 月 15 日（周五）醒来。" },
  { who: "法兰西", en: "France", y: 1582, old: { y: 1582, m: 12, d: 9 }, newG: { y: 1582, m: 12, d: 20 }, note: "同年 12 月跟进：12 月 9 日（周日）→ 12 月 20 日（周一）。" },
  { who: "新教德意志 · 丹麦 · 瑞典-芬兰(部分)", en: "Protestant Germany & Denmark", y: 1700, old: { y: 1700, m: 2, d: 18 }, newG: { y: 1700, m: 3, d: 1 }, note: "观望了 118 年才认账的天文数字：2 月 18 日（周日）→ 3 月 1 日（周一），一次跨 11 天。" },
  { who: "大不列颠及其殖民地", en: "Great Britain & colonies", y: 1752, old: { y: 1752, m: 9, d: 2 }, newG: { y: 1752, m: 9, d: 14 }, note: "本作的主角：9 月 2 日（周三）→ 9 月 14 日（周四），9 月只剩 19 天。" },
  { who: "瑞典-芬兰（最终）", en: "Sweden & Finland", y: 1753, old: { y: 1753, m: 2, d: 17 }, newG: { y: 1753, m: 3, d: 1 }, note: "在 1700–1712 年「慢慢漂」失败、1712 年补出个 2 月 30 日之后，瑞典 1753 年直接跳格。" },
  { who: "俄国属地阿拉斯加", en: "Russian Alaska", y: 1867, old: { y: 1867, m: 10, d: 6 }, newG: { y: 1867, m: 10, d: 18 }, note: "卖给美国那天同时换历+换日界线侧：儒略 10 月 6 日（周五）→ 格里历 10 月 18 日（周五），星期名重复了一次。" },
  { who: "日本", en: "Japan", y: 1873, old: { y: 1872, m: 12, d: 2 }, newG: { y: 1873, m: 1, d: 1 }, note: "阴阳历明治五年十二月初二（1872 年 12 月 2 日）的第二天不叫十二月初三，改叫 1873 年 1 月 1 日：十二月的其余 29 天被抹去，1872 年在日本只过了 337 天。" },
  { who: "俄国", en: "Russia", y: 1918, old: { y: 1918, m: 1, d: 31 }, newG: { y: 1918, m: 2, d: 14 }, note: "苏俄最后一跳：1 月 31 日（周三）→ 2 月 14 日（周四），13 天。「十月革命」从此活在 11 月 7 日。" },
  { who: "希腊", en: "Greece", y: 1923, old: { y: 1923, m: 2, d: 15 }, newG: { y: 1923, m: 3, d: 1 }, note: "欧洲最后一家：1923 年 2 月 15 日（儒略）→ 3 月 1 日（格里历），16–28 日不存在。" },
];

// --- living fossils (the 11 days still echoing) -----------------------------
export const FOSSILS = [
  { icon: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", title: "英国纳税年 4 月 6 日", body: "旧岁首「圣母领报节」3 月 25 日（儒略）+1752 年的 11 天+1800 年又跳的 1 天 = 4 月 6 日。一次换历，三百年的报税单都在补差。" },
  { icon: "⛪", title: "东正教圣诞节 1 月 7 日", body: "教堂仍按儒略历过 12 月 25 日；今天的差距是 13 天，所以落在民用历的 1 月 7 日。2100 年后会变成 1 月 8 日。" },
  { icon: "🚩", title: "十月革命在 11 月 7 日", body: "1917 年儒略历 10 月 25 日 = 格里历 11 月 7 日。苏联 1918 年换历后，纪念日跟着日期走，不跟星期走。" },
  { icon: "🗓", title: "1712 年 2 月 30 日", body: "瑞典 1700 年起想靠跳过闰日慢慢对齐格里历，1700–1712 间只跳了一次；1712 年补回一个「2 月 30 日」重返儒略历，1753 年才彻底改宗。" },
  { icon: "🛶", title: "阿拉斯加的两个周五", body: "1867 年购地当天，阿拉斯加同时离开儒略历和日界线西侧：周五 10 月 6 日之后还是周五，10 月 18 日。" },
  { icon: "🌸", title: "明治的短年", body: "日本 1872 年旧历十二月只过到初二，第二天就是 1873 年 1 月 1 日——全年 337 天，年底的月奉还发不发成了真问题。" },
  { icon: "🎂", title: "华盛顿的两个年号", body: "生于旧历 2 月 11 日。当时英国岁首在 3 月 25 日，所以记作「1731/32 年 2 月 11 日」；换算成格里历即 1732 年 2 月 22 日。" },
  { icon: "🔭", title: "修正儒略历 1923", body: "东正教天文学家的版本：平均年 365.242222…，与格里历要到 2800 年才第一次分岔——那次 2 月，一家闰、一家不闰。" },
];

// --- the anchor events ------------------------------------------------------
export const BRITAIN_JUMP = { old: { y: 1752, m: 9, d: 2 }, newG: { y: 1752, m: 9, d: 14 } };
export const NICEA_YEAR = 325;
export const REFORM_YEAR = 1582;

// --- helpers ----------------------------------------------------------------
export const MONTHS_EN = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
export const MONTHS_ZH = ["一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月"];
export const ROMAN_MONTHS = ["Ianuarius", "Februarius", "Martius", "Aprilis", "Maius", "Iunius",
  "Quintilis→Iulius", "Sextilis→Augustus", "September", "October", "November", "December"];

export function fmtDate(c, cal = "G") {
  return `${c.y} 年 ${c.m} 月 ${c.d} 日${cal === "J" ? "（儒略）" : ""}`;
}
export function fmtYMD(c) { return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`; }

// September 1752 in Britain, printed as the almanacs had to print it:
// a 19-day month — Julian-labelled 1st & 2nd, then straight to Gregorian 14–30.
// The eleven dates 3–13 were never attached to any physical day.
export function september1752() {
  const days = [];
  const first = serialJulian(1752, 9, 1);
  for (let s = first; s <= serialGregorian(1752, 9, 30); s += 1) days.push(s);
  return days;
}

export const PRESETS = [
  { id: "jump", label: "1752 · 9 · 2 那一夜", tab: "jump" },
  { id: "drift", label: "儒略的慢性病", tab: "drift" },
  { id: "doomsday", label: "康威的末日算法", tab: "doomsday" },
  { id: "computus", label: "复活节的齿轮（2026）", tab: "computus" },
];
