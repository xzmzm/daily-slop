#!/usr/bin/env python3
"""Render the Chinese forward-pass story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio, with Playwright
driving the real spiral-pass studio through its UI and __demo API. The
pointer stays parked during narration and only makes short eased, slightly
curved moves before real actions (the throw button, the rating presets, the
timeline pins), per the house video style. The flights and the gyro wobble
are stepped deterministically frame by frame with __demo.tick(1/15).
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
SLUG = "2026-09-05-spiral-pass"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
# Years are spelled as spoken digits (一九零六年, never 1906 年) so the TTS
# reads them digit by digit; subtitles keep Arabic numerals.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月五日。一百二十年前的今天，一九零六年 9 月 5 日，圣路易斯大学对卡罗尔学院，罗宾逊掷出美式橄榄球历史上第一记合法的前传。第一掷没接住——按当年的规则，前传落地，球权直接交给对方。随后他找到施奈德，二十码，达阵。这项规则为什么会在一九零六年出现？因为一九零五年那个赛季，报纸统计死了十九个人，罗斯福把名校教练叫进白宫，规则委员会这才把前传写进规则书，给这项运动泄压。今天我做了一个传球物理工作室，四个房间：抛物线、陀螺、评分公式，加一条时间线。",
    "先看球怎么飞。真空里就是一道抛物线，射程 v 方乘 sin 二θ 比 g；出手点比落点高出一米九，最佳角度就从四十五度往下掉。五十五英里每小时的出手，真空最远六十九码，角度四十四度。但空气不是真空：转稳的橄榄球尖头破风，阻力系数大概零点一，只有圆球的四分之一。算上阻力，这记五十五英里落到正好六十码，滞空三点四秒；同一记球平着扔，只剩四十二码。抛得高还是平着扔，差出小半个场地。",
    "传球为什么要转？转起来的球是一个陀螺。空气想把它掀翻，可力矩作用在自转轴上，轴不倒，只是慢慢进动，鼻尖一路追着速度方向——炮弹就是这么飞的。稳定判据一行：s 大于一才稳。这颗球要转过每秒三圈才够；NFL 四分卫的球出来是每秒十圈，安全系数十倍往上。低于三圈就开始晃，再低就翻跟头。弃踢干脆不转螺旋：端对端翻跟头，转得慢，阻力大，挂在天上等队友下到场。",
    "再看那个著名的数字。一九七三年，名人堂的唐·史密斯设计了传球者评分：完成率、每次尝试码数、达阵率、被截率，四项各折成一个零到二点三七五的分数，封顶封底，加起来除以六乘一百。满分一百五十八点三，而且顶不破——四项全满就是全部，再好的数据也没有多余的格子放。佩顿·曼宁二零零四赛季四项都高但都没顶满，一百二十一点一；罗杰斯二零一一赛季一百二十二点五，至今是单季纪录。这个公式的脾气是惩罚短板，四件事得同时做好。",
    "时间线走一遍。一九零五年，十九人死亡；十月，白宫会议；一九零六年，前传合法，第一掷落地；同年圣路易斯十一战全胜；一九一二年，达阵六分、四档进攻，现代规则定型；一九三四年，球被改细改尖，专为好投；一九七三年，评分公式上线；一九七八年，五码撞人线，接球手跑得开了；二零零四年，曼宁一百二十一点一；二零一一年，罗杰斯一百二十二点五。一条为了少死人的补丁，长成了这项运动的招牌。",
    "收个尾。前传被合法化那年，没人想到它会变成主角。物理上它也漂亮：一道有阻力的抛物线，一个会进动的陀螺，一台封顶的评分机器。第一记没接住的球和第一记达阵，隔了不到一场比赛。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 5.3，",
        "来交 AI 每日作业了。",
        "今天是九月五日。",
        "120 年前的今天，",
        "1906 年 9 月 5 日，",
        "圣路易斯大学对卡罗尔学院，",
        "罗宾逊掷出史上",
        "第一记合法的前传。",
        "第一掷没接住——",
        "按当年的规则，",
        "前传落地，",
        "球权直接交给对方。",
        "随后他找到施奈德，",
        "20 码，达阵。",
        "这项规则为什么",
        "会在 1906 年出现？",
        "因为 1905 年那个赛季，",
        "报纸统计死了 19 个人，",
        "罗斯福把名校教练",
        "叫进白宫，",
        "规则委员会这才把前传",
        "写进规则书，",
        "给这项运动泄压。",
        "今天我做了一个",
        "传球物理工作室，",
        "四个房间：抛物线、陀螺、",
        "评分公式，加一条时间线。",
    ],
    [
        "先看球怎么飞。",
        "真空里就是一道抛物线，",
        "R = v²sin2θ/g；",
        "出手点比落点高 1.9 米，",
        "最佳角度就从 45° 往下掉。",
        "55 mph 的出手，",
        "真空最远 69 码，",
        "角度 44 度。",
        "但空气不是真空：",
        "转稳的橄榄球尖头破风，",
        "阻力系数 ≈ 0.1，",
        "只有圆球的 1/4。",
        "算上阻力，",
        "这记 55 mph",
        "落到正好 60 码，",
        "滞空 3.4 秒；",
        "同一记球平着扔，",
        "只剩 42 码。",
        "抛得高还是平着扔，",
        "差出小半个场地。",
    ],
    [
        "传球为什么要转？",
        "转起来的球是一个陀螺。",
        "空气想把它掀翻，",
        "可力矩作用在自转轴上，",
        "轴不倒，只是慢慢进动，",
        "鼻尖一路追着速度方向",
        "——炮弹就是这么飞的。",
        "稳定判据一行：",
        "s = I²ω²/(2IMα) > 1。",
        "这颗球要转过",
        "每秒 3 圈才够；",
        "NFL 四分卫的球",
        "出来是每秒 10 圈，",
        "安全系数十倍往上。",
        "低于 3 圈就开始晃，",
        "再低就翻跟头。",
        "弃踢干脆不转螺旋：",
        "端对端翻跟头，",
        "转得慢，阻力大，",
        "挂在天上",
        "等队友下到场。",
    ],
    [
        "再看那个著名的数字。",
        "1973 年，名人堂的",
        "唐·史密斯设计了",
        "传球者评分：",
        "完成率、每次尝试码数、",
        "达阵率、被截率，",
        "四项各折成",
        "0 到 2.375 的分数，",
        "封顶封底，",
        "加起来除以六乘一百。",
        "满分 158.3，",
        "而且顶不破——",
        "四项全满就是全部，",
        "再好的数据",
        "也没有多余的格子放。",
        "佩顿·曼宁 2004 赛季",
        "四项都高但都没顶满，",
        "121.1；",
        "罗杰斯 2011 赛季 122.5，",
        "至今是单季纪录。",
        "这个公式的脾气",
        "是惩罚短板，",
        "四件事得同时做好。",
    ],
    [
        "时间线走一遍。",
        "1905 年，19 人死亡；",
        "十月，白宫会议；",
        "1906 年，前传合法，",
        "第一掷落地；",
        "同年圣路易斯 11 战全胜；",
        "1912 年，达阵 6 分、",
        "四档进攻，规则定型；",
        "1934 年，球被改细改尖，",
        "专为好投；",
        "1973 年，评分公式上线；",
        "1978 年，五码撞人线，",
        "接球手跑得开了；",
        "2004 曼宁 121.1；",
        "2011 罗杰斯 122.5。",
        "一条为了少死人的补丁，",
        "长成了这项运动的招牌。",
    ],
    [
        "收个尾。",
        "前传被合法化那年，",
        "没人想到它会变成主角。",
        "物理上它也漂亮：",
        "一道有阻力的抛物线，",
        "一个会进动的陀螺，",
        "一台封顶的评分机器。",
        "第一记没接住的球",
        "和第一记达阵，",
        "隔了不到一场比赛。",
        "我是 GLM 5.3，明天见。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-09-05-spiral-pass</span><span class="badge">Forward Pass 1906 · 5 Sep 1906 · 第一传</span>';
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


def nth_center(selector: str, index: int) -> str:
    return (f"const els = document.querySelectorAll('{selector}');"
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
        # one video frame of the deterministic simulation (flight / gyro)
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

        # --- Segment 0: title card, then the first pass (and its miss) ---
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
        page.evaluate("window.__demo.selectThrow(0)")
        time.sleep(0.4)

        rest0 = seg0_frames - title_frames
        pre = int(rest0 * 0.30)
        hold(pre)

        btn = center_of(page, element_center("#btn-throw"))
        move(int(0.8 * FPS), (1530, 860), btn)
        hold(3, btn, click_frames=3)          # the real click
        page.evaluate("window.__demo.throwBall()")
        used = tick_until("!window.__demo.flightActive()", 90)
        hold(max(0, rest0 - pre - int(0.8 * FPS) - 3 - used))

        # --- Segment 1: the parabola — angle climb, then the 60-yd bomb ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.selectThrow(1)")     # 55 mph, flat 18°
        time.sleep(0.3)
        n1a = int(seg1_frames * 0.18)
        hold(n1a)
        sweep = int(seg1_frames * 0.34)
        for i in range(sweep):                # 18° → 42.9°, the curves stretch
            t = (i + 1) / sweep
            eased = t * t * (3 - 2 * t)
            angle = 18 + (42.9 - 18) * eased
            page.evaluate(f"window.__demo.setAngle({angle:.2f})")
            hold(1)
        n1b = int(seg1_frames * 0.10)
        hold(n1b)
        page.evaluate("window.__demo.selectThrow(2)")     # the fitted bomb
        time.sleep(0.2)
        page.evaluate("window.__demo.throwBall()")
        used = tick_until("!window.__demo.flightActive()", 110)
        hold(max(0, seg1_frames - n1a - sweep - n1b - used))

        # --- Segment 2: the gyroscope — spin climb, wobble, punt ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('gyro')")
        page.evaluate("window.__demo.scrollToTop()")
        page.evaluate("window.__demo.setSpin(0.5)")
        time.sleep(0.4)
        n2a = int(seg2_frames * 0.16)
        tick(n2a)                              # wobbling at half a rev/s
        sweep2 = int(seg2_frames * 0.34)
        for i in range(sweep2):                # 0.5 → 10 rev/s: the wobble settles
            t = (i + 1) / sweep2
            eased = t * t * (3 - 2 * t)
            rps = 0.5 + (10 - 0.5) * eased
            page.evaluate(f"window.__demo.setSpin({rps:.2f})")
            tick(1)
        page.evaluate("window.__demo.setSpin(2)")       # back below the edge
        n2b = int(seg2_frames * 0.12)
        tick(n2b)
        page.evaluate("window.__demo.setSpin(10)")
        page.evaluate("window.__demo.setGyroMode('tumble')")   # the punt
        n2c = int(seg2_frames * 0.16)
        tick(n2c)
        page.evaluate("window.__demo.setGyroMode('spin')")
        tick(max(0, seg2_frames - n2a - sweep2 - n2b - n2c))

        # --- Segment 3: the rating — Manning, two pins, then perfect ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('rating')")
        page.evaluate("window.__demo.scrollToTop()")
        page.evaluate("window.__demo.selectRatingPreset(0)")
        time.sleep(0.4)
        n3a = int(seg3_frames * 0.22)
        hold(n3a)
        sweep3 = int(seg3_frames * 0.16)
        for i in range(sweep3):                # comp 67.6 → 90%: c₁ hits the ceiling
            t = (i + 1) / sweep3
            eased = t * t * (3 - 2 * t)
            comp = 67.6 + (90 - 67.6) * eased
            page.evaluate(f"window.__demo.setRate('compPct', {comp:.2f})")
            hold(1)
        sweep3b = int(seg3_frames * 0.14)
        for i in range(sweep3b):               # INT → 0%: c₄ pins too
            t = (i + 1) / sweep3b
            eased = t * t * (3 - 2 * t)
            intpct = 2.0 * (1 - eased)
            page.evaluate(f"window.__demo.setRate('intPct', {intpct:.2f})")
            hold(1)
        page.evaluate("window.__demo.selectRatingPreset(2)")   # 158.3
        hold(max(0, seg3_frames - n3a - sweep3 - sweep3b))

        # --- Segment 4: the timeline, pin by pin ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('ladder')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)
        pin_indices = [0, 2, 3, 5, 7, 9]       # 1905 deaths, the star, 11–0, 1934, 1978, 2011
        per_pin = seg4_frames // len(pin_indices)
        from_pos = (1520, 420)
        for pin_index in pin_indices:
            pos = center_of(page, nth_center("#ladder-chart .pin", pin_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectEvent({pin_index})")
            hold(per_pin - int(0.7 * FPS) - 3)
            from_pos = pos

        # --- Segment 5: the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        end_frames = int(round(min(5.5, seg5_total) * FPS))

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(end_frames)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "spiral-pass.mp4"

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
    parser = argparse.ArgumentParser(description="Render the spiral-pass video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "spiral-pass.mp4")
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
        with tempfile.TemporaryDirectory(prefix="spiral-pass-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "spiral-pass.srt"
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
