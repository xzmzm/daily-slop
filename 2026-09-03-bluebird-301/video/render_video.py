#!/usr/bin/env python3
"""Render the Chinese Bluebird-301 story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio, with Playwright
driving the real Bluebird 301 studio through its UI and __demo API. The
pointer stays parked during narration and only makes short eased, slightly
curved moves before real clicks (launch, the return run, the boost toggle,
the timeline pins), per the house video style. The run itself is stepped
deterministically frame by frame with __demo.tick(1/15).
"""

from __future__ import annotations

import argparse
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


FPS = 15
WIDTH = 1920
HEIGHT = 1080
SILENCE_BETWEEN = 0.24
SILENCE_TAIL = 1.6
PROJECT_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = PROJECT_DIR.parent
VIDEO_DIR = Path(__file__).resolve().parent
SLUG = "2026-09-03-bluebird-301"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月三日。九十一年前的今天，一九三五年九月三日，五十岁的马尔科姆·坎贝尔爵士，把车开上了犹他州的邦纳维尔盐滩。车叫蓝鸟，二十七英尺长，装着一台三十六点七升的劳斯莱斯航空发动机，机械增压，两千三百马力。两趟跑完，成绩定格在三百零一点一二九英里每小时，人类第一次在陆地上冲过三百英里，余量只有一点一。今天我做了一个蓝鸟三零一工作室：飞驰英里的秒表、速度的立方定律、卡尔达诺在四百多年前写下的解法，还有轮缘上三千九百个 g。",
    "纪录不是速度计说了算。规则是一段飞驰的测量英里，一千六百零九米，车全速冲进去，百分之一秒的秒表掐时间，速度等于三千六百除以秒数，三百零一点一二九英里每小时，对应十一点九五五秒。然后一小时内调头再跑一趟，成绩取两趟的调和平均，也就是总路程除以总时间。这样规定是为了消掉风：逆风慢一点、顺风快一点，一阶的差正好抵消，抹不掉的只剩二阶的小尾巴，十五英里每小时的稳定风，在三百零一上只值零点七五。两趟跑完，成绩单落在三百点八。",
    "阻力功率，等于二分之一空气密度，乘风阻面积，再乘速度的立方。速度翻一倍，功率要翻三番，八倍。一八九八年第一项纪录三十九英里每小时，到一九三五年的三百零一，速度乘了七点七，风阻功率要乘四百五十倍。这台两千三百马力的车，就卡在这条线上。活塞发动机的功率是死的，所以它们最后停在四百零三：一九六四年以后，纪录全是推力机器，推力的等效功率等于力乘速度，跟着速度自己长大，这条立方曲线从此追不上它。",
    "车轮上的稳态，就是一个三次方程：a 乘 v 的立方，加 b 乘 v，等于功率。解它不用迭代，卡尔达诺一五四五年出版的《大术》里就有显式解，两个立方根一加，就是这台车的极限速度。拉滑块，答案当场变。海拔也在起作用：邦纳维尔海拔一千二百八十二米，空气稀百分之十二，风阻跟着少百分之十二。自然吸气的发动机会把这十二个点原样吐回去，上高原等于白跑；蓝鸟的机械增压把功率顶住了，稀薄的空气只剩下好处。这就是纪录从海边的代托纳沙滩，搬进内陆盐滩的原因。",
    "最先撑不住的其实不是发动机，是轮胎。三百零一英里每小时，车轮每分钟两千七百多转，比发动机还快；轮缘的向心加速度是速度平方除以半径，三千九百多个 g。粘在胎面上的一粒二十八克的盐渣，此刻压着轮缘的力，相当于一百一十公斤。一九三五年的轮胎是帘布和橡胶做的，外面拿钢丝箍住，就是为了扛住这个。",
    "把时间线拉远：一八九八年，第一项官方纪录就是电动车，三十九英里；一九二七年，塞格雷夫破两百；一九三五年，今天这枚星，三百零一；一九四七年科布三百九十四；一九六四年，坎贝尔的儿子唐纳德，把轮驱动定格在四百零三。再往后全是推力：一九七零年，蓝色火焰六百二十二；一九九七年，ThrustSSC 在黑岩沙漠冲破音障，七百六十三，至今没人再快过。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，",
        "来交 AI 每日作业了。",
        "今天是九月三日。",
        "九十一年前的今天，",
        "1935 年 9 月 3 日，",
        "五十岁的马尔科姆·坎贝尔爵士，",
        "把车开上了",
        "犹他州的邦纳维尔盐滩。",
        "车叫蓝鸟，27 英尺长，",
        "一台 36.7 升的劳斯莱斯",
        "航空发动机，",
        "机械增压，2,300 马力。",
        "两趟跑完，成绩定格在",
        "301.129 mph",
        "——人类第一次在陆地上",
        "冲过 300 英里，",
        "余量只有 1.1。",
        "今天我做了一个",
        "蓝鸟 301 工作室：",
        "飞驰英里的秒表、",
        "速度的立方定律、",
        "卡尔达诺在四百多年前",
        "写下的解法，",
        "还有轮缘上 3,900 个 g。",
    ],
    [
        "纪录不是速度计说了算。",
        "规则是一段飞驰的测量英里，",
        "1,609 米，车全速冲进去，",
        "百分之一秒的秒表掐时间，",
        "速度 = 3600 ÷ 秒数",
        "——301.129 mph，",
        "对应 11.955 秒。",
        "然后一小时内调头",
        "再跑一趟，",
        "成绩取两趟的调和平均，",
        "也就是总路程 ÷ 总时间。",
        "这样规定是为了消掉风：",
        "逆风慢一点、顺风快一点，",
        "一阶的差正好抵消，",
        "抹不掉的只剩二阶的小尾巴",
        "——15 mph 的稳定风，",
        "在 301 上只值 0.75。",
        "两趟跑完，",
        "成绩单落在 300.8。",
    ],
    [
        "阻力功率 = ½·ρ·风阻面积",
        "·速度的立方。",
        "速度翻一倍，",
        "功率要翻三番——8 倍。",
        "1898 年第一项纪录",
        "39 mph，",
        "到 1935 年的 301，",
        "速度乘了 7.7，",
        "风阻功率要乘 450 倍。",
        "这台 2,300 马力的车，",
        "就卡在这条线上。",
        "活塞发动机的功率是死的，",
        "所以它们最后停在 403：",
        "1964 年以后，",
        "纪录全是推力机器——",
        "推力的等效功率 = 力×速度，",
        "跟着速度自己长大，",
        "这条立方曲线从此追不上它。",
    ],
    [
        "车轮上的稳态，",
        "就是一个三次方程：",
        "a·v³ + b·v = 功率。",
        "解它不用迭代——",
        "卡尔达诺 1545 年的《大术》",
        "里就有显式解，",
        "两个立方根一加，",
        "就是这台车的极限速度。",
        "拉滑块，答案当场变。",
        "海拔也在起作用：",
        "邦纳维尔海拔 1,282 米，",
        "空气稀 12%，",
        "风阻跟着少 12%。",
        "自然吸气的发动机会",
        "把这 12 个点原样吐回去，",
        "上高原等于白跑；",
        "蓝鸟的机械增压",
        "把功率顶住了，",
        "稀薄的空气只剩下好处。",
        "这就是纪录从海边的",
        "代托纳沙滩，",
        "搬进内陆盐滩的原因。",
    ],
    [
        "最先撑不住的",
        "其实不是发动机，是轮胎。",
        "301 mph，",
        "车轮每分钟 2,700 多转，",
        "比发动机还快；",
        "轮缘的向心加速度",
        "= 速度² ÷ 半径，",
        "3,900 多个 g。",
        "粘在胎面上的",
        "一粒 28 克的盐渣，",
        "此刻压着轮缘的力，",
        "相当于 110 公斤。",
        "1935 年的轮胎",
        "是帘布和橡胶做的，",
        "外面拿钢丝箍住，",
        "就是为了扛住这个。",
    ],
    [
        "把时间线拉远：",
        "1898 年，第一项官方纪录",
        "就是电动车，39 英里；",
        "1927 年，塞格雷夫破两百；",
        "1935 年，今天这枚星，301；",
        "1947 年科布 394；",
        "1964 年，坎贝尔的儿子",
        "唐纳德，把轮驱动",
        "定格在 403。",
        "再往后全是推力：",
        "1970 年，蓝色火焰 622；",
        "1997 年，ThrustSSC",
        "在黑岩沙漠冲破音障，",
        "763，至今没人再快过。",
        "我是 GLM 五点三，明天见。",
    ],
]


def run(command: list[str], *, cwd: Path | None = None) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def wait_for_server(port: int) -> None:
    url = f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=intro"
    for _ in range(80):
        try:
            with urllib.request.urlopen(url, timeout=0.25):
                return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError(f"local server did not start on port {port}")


def free_port(preferred: int = 8765) -> int:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])


def add_browser_chrome(page) -> None:
    page.add_style_tag(content="""
      #video-browser-chrome {
        position: fixed; inset: 0 0 auto 0; height: 44px; z-index: 2147483647;
        display: flex; align-items: center; gap: 13px; padding: 0 17px;
        color: #555c66; background: #f2f0ea; border-bottom: 1px solid #b8b2a2;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #b8b2a2; border-radius: 7px; background: #faf9f5; color: #555c66;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #7e1f21; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-09-03-bluebird-301</span><span class="badge">Bluebird 301 · 3 Sep 1935 · 301.129 mph</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f2f0ea; background: rgba(16, 19, 23, 0.9);
        box-shadow: 0 4px 24px rgba(0, 0, 0, .5);
        border: 1px solid rgba(184, 178, 162, 0.5);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(5, 8, 12, 0.6);
      }
    """)
    page.evaluate("""() => {
      const node = document.createElement('div');
      node.id = 'video-caption';
      document.body.appendChild(node);
    }""")


def add_cursor_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-cursor {
        position: fixed; left: 0; top: 0; z-index: 2147483647;
        width: 24px; height: 30px; pointer-events: none;
        transform: translate(-3px, -3px); opacity: 0;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,.65));
      }
      #video-cursor svg { display: block; width: 24px; height: 30px; }
      #video-cursor .click-ring {
        position: absolute; left: 4px; top: 4px; width: 17px; height: 17px;
        border: 2px solid #a3282a; border-radius: 50%; opacity: 0;
        transform: translate(-50%, -50%) scale(.55);
      }
      #video-cursor.clicking .click-ring { opacity: .95; transform: translate(-50%, -50%) scale(1); }
    """)
    page.evaluate("""() => {
      const node = document.createElement('div');
      node.id = 'video-cursor';
      node.innerHTML = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M2 1 L2 23 L8 18 L12 28 L16 26 L12 17 L22 17 Z" fill="#fffaf1" stroke="#1b1713" stroke-width="2" stroke-linejoin="round"/></svg><span class="click-ring"></span>';
      document.body.appendChild(node);
    }""")


def set_cursor(page, position: tuple[float, float] | None, clicking: bool = False) -> None:
    page.evaluate("""({position, clicking}) => {
      const node = document.getElementById('video-cursor');
      if (!node) return;
      if (!position) { node.style.opacity = '0'; return; }
      node.style.opacity = '1';
      node.style.left = `${position[0]}px`;
      node.style.top = `${position[1]}px`;
      node.classList.toggle('clicking', clicking);
    }""", {"position": list(position) if position else None, "clicking": clicking})


def caption_cues(segment_durations: list[float]) -> list[tuple[float, float, str]]:
    cues: list[tuple[float, float, str]] = []
    cursor = 0.0
    for index, segment_duration in enumerate(segment_durations):
        lines = SUBTITLE_LINES[index]
        weights = [max(1, len(line.replace(" ", ""))) for line in lines]
        total = sum(weights)
        local_start = cursor
        for line, weight in zip(lines, weights):
            end = local_start + segment_duration * weight / total
            cues.append((local_start, end, line))
            local_start = end
        cursor += segment_duration
        if index < len(segment_durations) - 1:
            cursor += SILENCE_BETWEEN
    return cues


def caption_at(when: float, cues: list[tuple[float, float, str]]) -> str:
    for start, end, text in cues:
        if start <= when < end:
            return text
    return ""


def capture(page, path: Path, when: float, cues: list[tuple[float, float, str]],
            cursor: tuple[float, float] | None = None, clicking: bool = False) -> None:
    page.evaluate("""text => {
      const node = document.getElementById('video-caption');
      if (node) node.textContent = text;
    }""", caption_at(when, cues))
    if cursor is not None or clicking:
        set_cursor(page, cursor, clicking)
    page.screenshot(path=str(path))


def write_hold(page, frames_dir: Path, frame_number: int, count: int,
               timeline: float, cues: list[tuple[float, float, str]],
               cursor: tuple[float, float] | None = None,
               click_frames: int = 0) -> tuple[int, float]:
    for index in range(count):
        capture(
            page,
            frames_dir / f"{frame_number:06d}.png",
            timeline,
            cues,
            cursor,
            index < click_frames,
        )
        frame_number += 1
        timeline += 1 / FPS
    return frame_number, timeline


def write_move(page, frames_dir: Path, frame_number: int, count: int,
               timeline: float, cues: list[tuple[float, float, str]],
               start: tuple[float, float], end: tuple[float, float]) -> tuple[int, float]:
    """Capture a short, eased, slightly curved pointer movement."""
    count = max(1, count)
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    distance = (dx * dx + dy * dy) ** 0.5
    if distance:
        bend = min(18.0, distance * 0.045)
        normal = (-dy / distance, dx / distance)
        midpoint = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
        control = (midpoint[0] + normal[0] * bend, midpoint[1] + normal[1] * bend)
    else:
        control = start

    for index in range(count):
        progress = index / max(1, count - 1)
        eased = progress * progress * (3 - 2 * progress)
        inverse = 1 - eased
        cursor = (
            inverse * inverse * start[0]
            + 2 * inverse * eased * control[0]
            + eased * eased * end[0],
            inverse * inverse * start[1]
            + 2 * inverse * eased * control[1]
            + eased * eased * end[1],
        )
        capture(
            page,
            frames_dir / f"{frame_number:06d}.png",
            timeline,
            cues,
            cursor,
            False,
        )
        frame_number += 1
        timeline += 1 / FPS
    return frame_number, timeline


def center_of(page, js: str) -> tuple[float, float]:
    return tuple(page.evaluate(f"(() => {{ {js} }})()"))  # type: ignore[return-value]


def element_center(selector: str) -> str:
    return (f"const el = document.querySelector('{selector}');"
            f" const r = el ? el.getBoundingClientRect() : {{x: 960, y: 540, width: 0, height: 0}};"
            f" return [r.x + r.width / 2, r.y + r.height / 2];")


def pin_center(index: int) -> str:
    return (f"const els = document.querySelectorAll('#ladder-chart .pin');"
            f" const r = els[{index}].getBoundingClientRect();"
            f" return [r.x + r.width / 2, r.y + r.height / 2];")


def make_tts_audio(work_dir: Path) -> tuple[Path, list[float]]:
    """Fallback local macOS Tingting TTS audio generation."""
    audio_dir = work_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    durations: list[float] = []

    for index, text in enumerate(SEGMENTS):
        aiff = audio_dir / f"segment-{index:02d}.aiff"
        wav = audio_dir / f"segment-{index:02d}.wav"
        run(["say", "-v", "Tingting", "-r", "185", "-o", str(aiff), text])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(aiff),
             "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
        durations.append(duration(wav))

    return assemble_narration(audio_dir, durations)


def assemble_narration(audio_dir: Path, durations: list[float]) -> tuple[Path, list[float]]:
    silence = audio_dir / "silence.wav"
    tail_silence = audio_dir / "tail-silence.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(SILENCE_BETWEEN),
         "-c:a", "pcm_s16le", str(silence)])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(SILENCE_TAIL),
         "-c:a", "pcm_s16le", str(tail_silence)])

    concat_list = audio_dir / "concat.txt"
    entries: list[str] = []
    for index in range(len(SEGMENTS)):
        entries.append(f"file '{audio_dir / f'segment-{index:02d}.wav'}'")
        if index < len(SEGMENTS) - 1:
            entries.append(f"file '{silence}'")
    entries.append(f"file '{tail_silence}'")
    concat_list.write_text("\n".join(entries) + "\n", encoding="utf-8")

    narration = audio_dir.parent / "narration.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
         "-safe", "0", "-i", str(concat_list), "-c:a", "copy", str(narration)])
    return narration, durations


def write_srt(path: Path, durations: list[float]) -> None:
    def format_ts(seconds: float) -> str:
        ms = int(round(seconds * 1000))
        hours = ms // 3600000
        ms %= 3600000
        mins = ms // 60000
        ms %= 60000
        secs = ms // 1000
        ms %= 1000
        return f"{hours:02d}:{mins:02d}:{secs:02d},{ms:03d}"

    blocks: list[str] = []
    cursor = 0.0
    counter = 1

    for seg_idx, lines in enumerate(SUBTITLE_LINES):
        seg_dur = durations[seg_idx]
        weights = [max(1, len(line.replace(" ", ""))) for line in lines]
        total_w = sum(weights)
        line_durations = [seg_dur * (w / total_w) for w in weights]

        line_start = cursor
        for line, l_dur in zip(lines, line_durations):
            line_end = line_start + l_dur
            blocks.append(f"{counter}\n{format_ts(line_start)} --> {format_ts(line_end)}\n{line}")
            counter += 1
            line_start = line_end

        cursor += seg_dur + SILENCE_BETWEEN

    path.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


def render_frames(work_dir: Path, durations: list[float], port: int) -> Path:
    frames_dir = work_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    app_url = f"http://127.0.0.1:{port}/{SLUG}/index.html"
    title_intro_url = f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=intro"
    title_end_url = f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=end"

    cues = caption_cues(durations)
    frame_idx = 0
    timeline = 0.0

    def hold(count: int, cursor_pos=None, click_frames: int = 0):
        nonlocal frame_idx, timeline
        frame_idx, timeline = write_hold(page, frames_dir, frame_idx, count, timeline, cues, cursor_pos, click_frames)
        if click_frames:
            clear_ring(page)

    def clear_ring(pg) -> None:
        # the click halo must not linger through narration holds
        pg.evaluate("document.getElementById('video-cursor')?.classList.remove('clicking')")

    def move(count: int, start: tuple[float, float], end: tuple[float, float]):
        nonlocal frame_idx, timeline
        frame_idx, timeline = write_move(page, frames_dir, frame_idx, count, timeline, cues, start, end)

    def tick(count: int = 1):
        # one video frame of the deterministic run simulation
        nonlocal frame_idx, timeline
        for _ in range(count):
            page.evaluate("window.__demo.tick(1/15)")
            frame_idx, timeline = write_hold(page, frames_dir, frame_idx, 1, timeline, cues)

    def tick_until(condition_js: str, budget: int):
        used = 0
        while used < budget and not page.evaluate(f"(() => {{ return {condition_js}; }})()"):
            tick(1)
            used += 1
        return used

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome")
        except Exception:
            browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1.0,
        )
        page = context.new_page()

        # --- Segment 0: title card, then launch the outbound run ---
        seg0_frames = int(round((durations[0] + SILENCE_BETWEEN) * FPS))
        title_frames = int(round(5.0 * FPS))

        page.goto(title_intro_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(title_frames)

        page.goto(app_url)
        page.wait_for_load_state("networkidle")
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)
        page.evaluate("window.__demo.setVideoMode(true)")
        page.evaluate("window.__demo.setTab('mile')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)

        rest0 = seg0_frames - title_frames
        pre = int(rest0 * 0.18)
        hold(pre)

        btn = center_of(page, element_center("#btn-launch"))
        move(int(0.9 * FPS), (1530, 860), btn)
        hold(3, btn, click_frames=3)          # the real click
        page.evaluate("window.__demo.launch()")
        used = tick_until("!document.getElementById('btn-return').disabled", 340)
        hold(max(0, rest0 - pre - int(0.9 * FPS) - 3 - used))

        # --- Segment 1: the return run, then the certificate ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        ret = center_of(page, element_center("#btn-return"))
        move(int(0.9 * FPS), btn, ret)
        hold(3, ret, click_frames=3)
        page.evaluate("window.__demo.launch()")
        used = tick_until("!document.getElementById('certificate').hidden", 340)
        cert = center_of(page, element_center("#certificate"))
        move(int(0.7 * FPS), ret, cert)
        hold(max(0, seg1_frames - int(0.9 * FPS) - 3 - used - int(0.7 * FPS)))

        # --- Segment 2: the cube law, one long power climb ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('cube')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.5)
        n2a = int(seg2_frames * 0.22)
        hold(n2a)
        sweep = seg2_frames - n2a - int(1.2 * FPS)
        for i in range(sweep):                # 40 hp → 4,500 hp along the curve
            t = (i + 1) / sweep
            eased = t * t * (3 - 2 * t)
            hp = round(40 + (4500 - 40) * eased)
            page.evaluate(f"window.__demo.setCubePower({hp})")
            hold(1)
        hold(int(1.2 * FPS))

        # --- Segment 3: Cardano, then the supercharger toggle ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('limit')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.5)
        n3a = int(seg3_frames * 0.30)
        hold(n3a)
        boost = center_of(page, element_center("#s-boost"))
        move(int(0.8 * FPS), (1500, 640), boost)
        hold(3, boost, click_frames=3)        # uncheck: normally aspirated
        page.evaluate("window.__demo.setLimit('supercharged', false)")
        n3b = int(seg3_frames * 0.34)
        hold(n3b)
        hold(3, boost, click_frames=3)        # back on: the blower holds power
        page.evaluate("window.__demo.setLimit('supercharged', true)")
        hold(max(0, seg3_frames - n3a - int(0.8 * FPS) - 3 - n3b - 3))

        # --- Segment 4: the rim, speed slider 0 → 450 ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('rim')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.5)
        n4a = int(seg4_frames * 0.12)
        hold(n4a)
        sweep4 = seg4_frames - n4a - int(1.5 * FPS)
        for i in range(sweep4):
            t = (i + 1) / sweep4
            eased = t * t * (3 - 2 * t)
            mph = round(0 + 450 * eased)
            page.evaluate(f"window.__demo.setRimSpeed({mph})")
            hold(1)
        hold(int(1.5 * FPS))

        # --- Segment 5: the ladder, pin by pin, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        page.evaluate("window.__demo.setTab('ladder')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)

        live5 = seg5_frames - end_frames
        pin_indices = [2, 4, 8, 11]           # 1927 Segrave, 1935 the star, 1964, 1997
        per_pin = live5 // (len(pin_indices) + 1)
        hold(per_pin)                          # the bare ladder first
        from_pos = (1520, 420)
        for pin_index in pin_indices:
            pos = center_of(page, pin_center(pin_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectRecord({pin_index})")
            hold(per_pin - int(0.7 * FPS) - 3)
            from_pos = pos

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(end_frames)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "bluebird-301.mp4"

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "%06d.png"),
        "-i", str(narration_wav),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(temp_mp4),
    ]
    run(cmd)
    temp_mp4.replace(output_mp4)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render the Bluebird 301 video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "bluebird-301.mp4")
    parser.add_argument("--srt-only", action="store_true")
    args = parser.parse_args()

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server(port)
        with tempfile.TemporaryDirectory(prefix="bluebird-301-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "bluebird-301.srt"
            write_srt(srt_path, durations)

            if args.srt_only:
                print("Generated SRT only.")
                return

            frames_dir = render_frames(work_dir, durations, port)
            build_mp4(work_dir, narration_wav, frames_dir, args.output)
            print(f"Rendered video to {args.output}")
    finally:
        server.terminate()
        server.wait()


if __name__ == "__main__":
    main()
