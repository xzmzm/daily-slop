// physics.js — the closed forms of the Straight Line (1927).
// Every number the studio shows comes from here, so every number is testable.
//
// The whole lesson is four exact machines:
//
//   1. The raster. A picture is not sent whole — it is plowed: one furrow
//      (line) at a time, N furrows per field, the way a 14-year-old turned
//      potato rows into a scanning system on a blackboard in 1922. The Kell
//      factor (0.7, NBC's Raymond Kell, 1933) is the honesty discount:
//      N scanned lines never buy N lines of perceived resolution.
//
//   2. The bandwidth law. With horizontal resolution matched to vertical,
//      the highest video frequency is closed-form:
//          B = AR · K · n_v / (2 · T_active)
//            = AR · K · n_v · f_line / (2·(1−β)),   f_line = N · f_frame
//      At fixed frame rate B grows as N² — the square law that killed
//      mechanical television (a Nipkow disk cannot spin megahertz) and drew
//      the VHF/UHF channel map. Verified against the documented video
//      bandwidths of every real analog standard, Baird 30-line to Hi-Vision.
//
//   3. The color bargain (1953). To slip chroma into a black-and-white
//      signal that 10 million sets already understood, NTSC moved the
//      subcarrier to an odd half-multiple of the line rate (227.5) so its
//      dots alternate line-to-line and cancel, and held the audio at an
//      integer line count (4.5 MHz = 286 lines) so the intercarrier stays
//      quiet. The chain is exact rational arithmetic:
//          f_line = 4.5 MHz / 286 = 15734.2657… Hz
//          f_frame = f_line / 525  = 30000/1001 Hz exactly  (29.97)
//          f_sc = 227.5 · f_line   = 315/88 MHz exactly (3579545.45 Hz)
//      The 0.1% frame-rate tax is why timecode drops 108 frames an hour.
//
//   4. The timeline, 1884 → 2009: Nipkow's spiral, Baird's disk, the night
//      of the straight line, the blackboard sketch that won the patent war,
//      525 lines, compatible color, six billion eyes on the Moon, analog
//      sunset.

export const KELL = 0.7;           // Kell factor: effective vertical resolution / scanned lines
export const SOUND_MS = 343;       // m/s, speed of sound (Nipkow rim-speed gauge)

// ── 1 · the bandwidth law ────────────────────────────────────────────────────
//
// B  = AR · K · n_v / (2·T_active)     [Hz]
//
// AR       picture aspect ratio (width/height)
// n_v      active lines per picture (after vertical blanking)
// T_active active (visible) fraction of a line period
// K        Kell factor — scanning N lines yields only K·N of resolution
// The factor 2: one cycle of highest frequency = one dark + one light line.

export function bandwidthHz({ lines, fps, aspect, activeLines, blankH }) {
  const fLine = lines * fps;                    // lines per second
  const tActive = (1 - blankH) / fLine;         // visible seconds per line
  return (aspect * KELL * activeLines) / (2 * tActive);
}

// The same quantity as a step chain (f_line → T_line → T_active → pairs per
// line → Hz) so the closed form and the derivation cross-check to 1e-9.
export function bandwidthSteps(std) {
  const fLine = std.lines * std.fps;
  const tLine = 1 / fLine;
  const tActive = (1 - std.blankH) * tLine;
  const pairsAcrossWidth = (std.aspect * KELL * std.activeLines) / 2;
  const hz = pairsAcrossWidth / tActive;
  return { fLine, tLine, tActive, pairsAcrossWidth, hz };
}

// The real standards. docHz is each system's documented video bandwidth;
// every one of them spends at least the balanced-resolution minimum (they
// bought extra horizontal sharpness with the margin).
export const STANDARDS = [
  {
    id: "baird", name: "贝尔德 30 行", lines: 30, fps: 12.5, interlaced: false,
    aspect: 7 / 3, activeLines: 30, blankH: 0, docHz: 9.2e3, mech: true,
    where: "BBC 中波电台，图像挤在声音频道里", year: 1929,
  },
  {
    id: "l405", name: "英国 405 行", lines: 405, fps: 25, interlaced: true,
    aspect: 5 / 4, activeLines: 377, blankH: 0.185, docHz: 3.0e6,
    where: "1936 年 BBC「制式之战」的赢家", year: 1936,
  },
  {
    id: "ntsc", name: "美国 525 行", lines: 525, fps: 30000 / 1001, interlaced: true,
    aspect: 4 / 3, activeLines: 480, blankH: 0.1745, docHz: 4.2e6,
    where: "1941 年 NTSC 黑白标准，用了五十年", year: 1941,
  },
  {
    id: "l819", name: "法国 819 行", lines: 819, fps: 25, interlaced: true,
    aspect: 4 / 3, activeLines: 747, blankH: 0.18, docHz: 10.0e6,
    where: "法国 1948，一台独占 14 MHz 频谱", year: 1948,
  },
  {
    id: "hv1125", name: "Hi-Vision 1125 行", lines: 1125, fps: 30, interlaced: true,
    aspect: 16 / 9, activeLines: 1035, blankH: 0.13, docHz: 30.0e6,
    where: "NHK 1964 年起步的模拟高清", year: 1964,
  },
  {
    id: "fhd", name: "数字 1080p60", lines: 1125, fps: 60, interlaced: false,
    aspect: 16 / 9, activeLines: 1080, blankH: 0, docHz: 148.5e6, digital: true,
    where: "每秒 2.07 亿像素的采样时钟", year: 1998,
  },
];

// The digital endpoint is exact: 1080p60 blanks the raster to 2200×1125
// samples per frame, 60 frames a second — 148.5 MHz on the nose.
export const FHD_SAMPLE_CLOCK = 2200 * 1125 * 60;   // = 148_500_000 Hz

// Effective vertical resolution the eye actually gets.
export const kellLines = (activeLines) => KELL * activeLines;

// ── the mechanical dead end ─────────────────────────────────────────────────
//
// A Nipkow disk turns once per frame, so its rim speed is closed-form:
//     v = π·D·f_frame                       (Mach gauge for the bearings)
// Each hole crosses one line in T_line; one *picture element* lasts
//     t_pixel = T_active / (AR · n_v)       (selenium cells answer in ~ms)
// and each element is lit only one pixel-time per frame:
//     duty = (1−β) / (AR · n_v · N) ≈ 0.75/N² for 4:3
//     (why mechanical pictures were postage stamps under arc lamps)

export function rimSpeed(diameterM, fps) {
  return Math.PI * diameterM * fps;
}

export function pixelTime(std) {
  const tActive = (1 - std.blankH) / (std.lines * std.fps);
  return tActive / (std.aspect * std.activeLines);
}

export function dutyCycle(std) {
  return pixelTime(std) * std.fps;
}

// ── 2 · the 1953 color bargain ───────────────────────────────────────────────
//
// The NTSC compatible-color chain. All exact rationals:
//   f_line  = 4.5 MHz / 286        (audio = integer 286 lines → quiet beat)
//   f_frame = f_line / 525         = 30000/1001 Hz, exactly
//   f_sc    = 227.5 · f_line       = 315/88 MHz, exactly
//   227.5 is an ODD half-integer → the chroma dot pattern inverts every line
//   and averages away on interlaced displays.

export const NTSC = {
  fAudio: 4.5e6,       // Hz, the sound carrier spacing (set by 10M receivers)
  audioLines: 286,     // 4.5 MHz / f_line — integer by design
  scHalfLines: 227.5,  // odd half-integer by design
  linesPerFrame: 525,
};

export function colorChain() {
  const fLine = NTSC.fAudio / NTSC.audioLines;                  // 15734.2657 Hz
  const fFrame = fLine / NTSC.linesPerFrame;                    // 29.97003 Hz
  const fField = 2 * fFrame;                                    // 59.94006 Hz
  const fSc = fLine * NTSC.scHalfLines;                         // 3579545.45 Hz
  return { fLine, fFrame, fField, fSc };
}

// Chroma subcarrier phase, in cycles, at a given line of a given field.
// 227.5 cycles per line → +0.5 cycle per line (dot inversion);
// 262.5 lines per field → −0.25 cycle per field (a quarter-step the other
// way, closing the 4-field color-frame sequence).
export function dotCycles(line, field) {
  return NTSC.scHalfLines * (line + 262.5 * field);
}

// Drop-frame timecode: 29.97 runs 0.1% slow against wall clock, which is
// 3.5964 s per hour; the fix drops exactly 108 frames an hour (3.6000 s) —
// a deliberate ~3.6 ms/h overcorrection, ≈ 2.6 s a month of residual.
export function dropFrame() {
  const { fFrame } = colorChain();
  const driftSec = 3600 * (1 - fFrame / 30);
  const dropped = Math.round(3600 * 30 * (1 - fFrame / 30));
  return { driftSec, dropped, driftPerDroppedFrame: driftSec / dropped };
}

// ── YIQ and the 1953 FCC matrix ──────────────────────────────────────────────
//
//   Y = 0.299R + 0.587G + 0.114B      (what a 1950 black-and-white set shows)
//   I, Q ride the subcarrier; hue is atan2(Q, I); |IQ| is saturation.
// The rounded coefficients are self-consistent: each row sums to exactly
// 1 (Y) or 0 (I, Q), so white has no color at all — the compatibility trick.

export const YIQ_M = [
  [0.299, 0.587, 0.114],
  [0.5959, -0.2746, -0.3213],
  [0.2115, -0.5227, 0.3112],
];

function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

export const YIQ_INV = inv3(YIQ_M);

export function yiq(rgb) {
  const [r, g, b] = rgb;
  return [
    YIQ_M[0][0] * r + YIQ_M[0][1] * g + YIQ_M[0][2] * b,
    YIQ_M[1][0] * r + YIQ_M[1][1] * g + YIQ_M[1][2] * b,
    YIQ_M[2][0] * r + YIQ_M[2][1] * g + YIQ_M[2][2] * b,
  ];
}

export function rgbFromYiq(v) {
  const [y, i, q] = v;
  return [
    YIQ_INV[0][0] * y + YIQ_INV[0][1] * i + YIQ_INV[0][2] * q,
    YIQ_INV[1][0] * y + YIQ_INV[1][1] * i + YIQ_INV[1][2] * q,
    YIQ_INV[2][0] * y + YIQ_INV[2][1] * i + YIQ_INV[2][2] * q,
  ];
}

// A mis-tuned tint knob demodulates on the wrong axis: the chroma vector is
// rotated by θ. Hue shifts by exactly θ; Y and saturation are untouched —
// luma never notices, which is why black-and-white sets never needed the knob.
export function rotateIQ(v, thetaDeg) {
  const [, i, q] = v;
  const th = (thetaDeg * Math.PI) / 180;
  return [v[0], i * Math.cos(th) - q * Math.sin(th), i * Math.sin(th) + q * Math.cos(th)];
}

export function hueDeg(v) {
  return ((Math.atan2(v[2], v[1]) * 180) / Math.PI + 360) % 360;
}

export function saturation(v) {
  return Math.hypot(v[1], v[2]);
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

// The classic 100% bars, in transmission order — the luma values fall out of
// the Y row exactly, a strictly descending staircase from 1.000 to 0.114.
export const BARS = [
  { name: "白", rgb: [1, 1, 1] },
  { name: "黄", rgb: [1, 1, 0] },
  { name: "青", rgb: [0, 1, 1] },
  { name: "绿", rgb: [0, 1, 0] },
  { name: "品", rgb: [1, 0, 1] },
  { name: "红", rgb: [1, 0, 0] },
  { name: "蓝", rgb: [0, 0, 1] },
];

export function barLuma() {
  return BARS.map((bar) => yiq(bar.rgb)[0]);
}

// ── 3 · the timeline, 1884 → 2009 ────────────────────────────────────────────

export const EVENTS = [
  {
    year: 1884, when: "1884", title: "尼普科夫圆盘",
    text: "柏林，22 岁的尼普科夫为「电望远镜」申请专利：一根螺旋排孔的圆盘把画面切成行。专利纸上的机器，他自己从未造出来。",
  },
  {
    year: 1926, when: "1926.1", title: "贝尔德的转盘",
    text: "伦敦弗里茨街，贝尔德向皇家学会成员演示 30 行机械电视：转盘、硒光电池、氖灯，图像只有邮票大小。",
  },
  {
    year: 1927, when: "1927.9.7", title: "一条直线", star: true,
    text: "旧金山绿街 202 号。玻璃片涂黑、中间刻一道直线；姐夫加德纳把玻璃片转 90°，隔壁房间的接收机跟着转——第一张全电子电视图像。法恩斯沃斯 21 岁。",
  },
  {
    year: 1928, when: "1928.9", title: "美元符号",
    text: "法恩斯沃斯向报界公开演示全电子电视；最早送出的图像之一，是一个美元符号。",
  },
  {
    year: 1935, when: "1935", title: "黑板草图",
    text: "与 RCA 的专利优先权之战中，化学老师托尔曼回忆起 1922 年爱达荷课堂上，那个少年在黑板上画的扫描草图。裁定：发明权归法恩斯沃斯。",
  },
  {
    year: 1936, when: "1936.11", title: "405 行开播",
    text: "BBC 开播世界第一座常规电视台；马可尼-EMI 的 405 行电子系统在「制式之战」里淘汰了贝尔德的 240 行机械系统。",
  },
  {
    year: 1939, when: "1939", title: "RCA 低头",
    text: "纽约世博会，电视第一次走进公众；RCA 向法恩斯沃斯取得专利授权——这家以「收租」闻名的公司，唯一一次向外部发明人低头。",
  },
  {
    year: 1941, when: "1941", title: "525 行标准",
    text: "NTSC 定下美国黑白电视标准：525 行、每秒 30 帧（隔行 60 场）、4.2 MHz 视频带宽——此后半个世纪不变。",
  },
  {
    year: 1953, when: "1953", title: "兼容彩色",
    text: "12 月 17 日，FCC 批准 NTSC 兼容彩色制式：副载波 3.579545 MHz，帧率 30 → 29.97。一亿台黑白电视机毫无损失地照看同一信号。",
  },
  {
    year: 1969, when: "1969.7", title: "六亿人看月亮",
    text: "阿波罗 11 号登月直播，约六亿观众同时观看——人类历史上最大的共同观众，坐的都是那条直线的后代。",
  },
  {
    year: 2009, when: "2009", title: "模拟关机",
    text: "6 月 12 日，美国关闭地面模拟电视。525 行信号退役——距绿街那条直线，八十二年。",
  },
];
