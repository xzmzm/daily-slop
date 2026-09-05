#!/usr/bin/env python3
"""Render the Chinese Turtle-1776 story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio, with Playwright
driving the real bushnells-turtle studio through its UI and __demo API. The
pointer stays parked during narration and only makes short eased, slightly
curved moves before real actions (the blow button, the crank/air presets,
出航, the timeline pins), per the house video style. The trim transitions and
the whole attack run are stepped deterministically frame by frame with
__demo.tick(1/15) (the mission plays at tick(2.2/15) so the night fits in
half a minute of screen time).
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
SLUG = "2026-09-06-bushnells-turtle"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
# Years are spelled as spoken digits (一七七六年, never 1776 年) so the TTS
# reads them digit by digit; subtitles keep Arabic numerals. Non-year
# quantities (2.74, 802 升, 56 瓦) stay ordinary numbers.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月六日。二百五十年前的今晚，一七七六年 9 月 6 日夜，纽约港，军士李钻进一只橡木桶，潜到英国旗舰鹰号船底，想把一桶火药拧上船壳。这是人类历史上第一次潜艇攻击，桶里那颗手摇螺旋桨，也是螺旋桨第一次下水。这只桶是耶鲁毕业生布什内尔造的，名字叫海龟。今天做一个海龟工作室，四个房间：配平、曲柄、空气，加一条攻击航线。",
    "先看它怎么浮沉。木桶十英尺长、六英尺高，满排水 2.74 吨，自己只有一吨半——差下的一千一百五十公斤，全靠往舱底灌水补齐，悬停是一把刀刃。这里有个反直觉的恒等式：气袋体积，等于干重折合的水量减掉构件体积。铁比水重，每公斤铁换回 0.85 升空气；木头比水轻，每公斤橡木吃掉 0.36 升。所以潜艇必须压铁龙骨——压载买的不只是稳，是气。危急时丢掉 200 磅铅，桶以每秒 0.89 米弹出水面。",
    "再看它怎么走。功率是阻力乘速度，稳航速就成了功率的立方根：八倍功率才换两倍速度。一条胳膊持续摇一百瓦，速度 1.2 英里每小时；记载说静水 3 英里，按阻力算要 1452 瓦——那是环法冲刺的腿。而真正的对手是潮流：东河能到两节，海龟全力才一节出头。地面速度等于曲柄速度减潮流，这道减法，决定整晚的命运。",
    "第三间房，空气。满配平后壳里只剩 802 升，一张单人床的大小。卡脖子的不是氧气，是呼出的二氧化碳：到了 3% 就开始喘。56 瓦曲柄，正好 30 分钟撞线——史书上那个数；顶钻 130 瓦，只剩 16 分钟。李出发时只剩 20 分钟，他钻到喘不上气才撒手。",
    "攻击之夜，出发时刻是唯一的旋钮。23 点整出航：捕鲸艇拖到一半解缆，顶流苦摇一小时，距船 150 米下潜，潜到鹰号船底开钻——咬到的是舵铁垫铁，铜皮太薄，反而不是对手。二氧化碳到 3%，放雷上浮，引信走 40 分钟，他抢在起爆前 13 分钟爬上白厅石阶。这也是窗口的最后一格：再晚半小时，整夜都被潮流收走；凌晨 1 点出发，顶流摇到天亮也到不了。",
    "时间线走一遍。一七七五年，耶鲁的木桶；十一月，冷夜萤火熄了；一七七六年，鹰之夜；十月，载着海龟的运输船被击沉；一七七七年，木桶鱼雷第一次命中；一七七八年，木桶之战，英军朝河面开了一整天炮；一八二四年，布什内尔化名戴维·布什死去；八十八年后的一八六四年，亨利号才第一次真正炸沉军舰，自己也跟着沉了。",
    "收个尾。海龟一炮未响，四道题却留给了此后每一代潜艇：配平、功率、空气、潮流。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 5.3，",
        "来交 AI 每日作业了。",
        "今天是九月六日。",
        "250 年前的今晚，",
        "1776 年 9 月 6 日夜，纽约港，",
        "军士李钻进一只橡木桶，",
        "潜到英国旗舰鹰号船底，",
        "想把一桶火药拧上船壳。",
        "这是人类历史上",
        "第一次潜艇攻击，",
        "桶里那颗手摇螺旋桨，",
        "也是螺旋桨第一次下水。",
        "这只桶是耶鲁毕业生",
        "布什内尔造的，",
        "名字叫海龟。",
        "今天做一个海龟工作室，",
        "四个房间：配平、曲柄、",
        "空气，加一条攻击航线。",
    ],
    [
        "先看它怎么浮沉。",
        "木桶十英尺长、六英尺高，",
        "满排水 2.74 吨，",
        "自己只有一吨半——",
        "差下的 1150 公斤，",
        "全靠往舱底灌水补齐，",
        "悬停是一把刀刃。",
        "这里有个反直觉的恒等式：",
        "气袋体积 = 干重折合水量",
        "− 构件体积。",
        "铁比水重，",
        "每公斤铁换回 0.85 升空气；",
        "木头比水轻，",
        "每公斤橡木吃掉 0.36 升。",
        "所以潜艇必须压铁龙骨——",
        "压载买的不只是稳，是气。",
        "危急时丢掉 200 磅铅，",
        "桶以每秒 0.89 米",
        "弹出水面。",
    ],
    [
        "再看它怎么走。",
        "功率 = 阻力 × 速度，",
        "稳航速就是功率的立方根：",
        "8 倍功率才换 2 倍速度。",
        "一条胳膊持续摇 100 瓦，",
        "速度 1.2 英里每小时；",
        "记载说静水 3 英里，",
        "按阻力算要 1452 瓦",
        "——那是环法冲刺的腿。",
        "而真正的对手是潮流：",
        "东河能到两节，",
        "海龟全力才一节出头。",
        "地面速度",
        "= 曲柄速度 − 潮流，",
        "这道减法，",
        "决定整晚的命运。",
    ],
    [
        "第三间房，空气。",
        "满配平后壳里只剩 802 升，",
        "一张单人床的大小。",
        "卡脖子的不是氧气，",
        "是呼出的二氧化碳：",
        "到了 3% 就开始喘。",
        "56 瓦曲柄，",
        "正好 30 分钟撞线",
        "——史书上那个数；",
        "顶钻 130 瓦，",
        "只剩 16 分钟。",
        "李出发时只剩 20 分钟，",
        "他钻到喘不上气才撒手。",
    ],
    [
        "攻击之夜，",
        "出发时刻是唯一的旋钮。",
        "23 点整出航：",
        "捕鲸艇拖到一半解缆，",
        "顶流苦摇一小时，",
        "距船 150 米下潜，",
        "潜到鹰号船底开钻——",
        "咬到的是舵铁垫铁，",
        "铜皮太薄，反而不是对手。",
        "二氧化碳到 3%，",
        "放雷上浮，",
        "引信走 40 分钟，",
        "他抢在起爆前 13 分钟",
        "爬上白厅石阶。",
        "这也是窗口的最后一格：",
        "再晚半小时，",
        "整夜都被潮流收走；",
        "凌晨 1 点出发，",
        "顶流摇到天亮也到不了。",
    ],
    [
        "时间线走一遍。",
        "1775 年，耶鲁的木桶；",
        "十一月，冷夜萤火熄了；",
        "1776 年，鹰之夜；",
        "十月，载着海龟的",
        "运输船被击沉；",
        "1777 年，",
        "木桶鱼雷第一次命中；",
        "1778 年，木桶之战，",
        "英军朝河面开了",
        "一整天炮；",
        "1824 年，",
        "布什内尔化名戴维·布什",
        "死去；",
        "八十八年后的 1864 年，",
        "亨利号才第一次",
        "真正炸沉军舰，",
        "自己也跟着沉了。",
    ],
    [
        "收个尾。",
        "海龟一炮未响，",
        "四道题却留给了",
        "此后每一代潜艇：",
        "配平、功率、空气、潮流。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-09-06-bushnells-turtle</span><span class="badge">Turtle 1776 · 6 Sep 1776 · 鹰之夜</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f2edda; background: rgba(11, 20, 31, 0.9);
        box-shadow: 0 4px 24px rgba(0, 0, 0, .5);
        border: 1px solid rgba(179, 172, 147, 0.5);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(3, 8, 14, 0.6);
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
        # one video frame of the deterministic simulation (trim / mission)
        nonlocal frame_idx, timeline
        for _ in range(count):
            page.evaluate("window.__demo.tick(1/15)")
            frame_idx, timeline = write_hold(page, frames_dir, frame_idx, 1, timeline, cues)

    def tick_until(condition_js: str, budget: int, dt: float = 1 / 15):
        nonlocal frame_idx, timeline
        used = 0
        while used < budget and not page.evaluate(f"(() => {{ return {condition_js}; }})()"):
            page.evaluate(f"window.__demo.tick({dt})")
            frame_idx, timeline = write_hold(page, frames_dir, frame_idx, 1, timeline, cues)
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

        # --- Segment 0: title card, then the studio on the trim bench ---
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
        page.evaluate("window.__demo.setTab('trim')")
        time.sleep(0.4)
        hold(max(0, seg0_frames - title_frames))

        # --- Segment 1: fill to neutral, overfill to the mud, blow the lead ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        fill = int(seg1_frames * 0.34)
        for i in range(fill):                    # 0 → 1150 kg: she sinks to hover
            t = (i + 1) / fill
            eased = t * t * (3 - 2 * t)
            page.evaluate(f"window.__demo.setBallast({(1150 * eased):.0f})")
            tick(1)
        hold(int(seg1_frames * 0.08))
        over = int(seg1_frames * 0.12)
        for i in range(over):                    # past neutral: down to the seabed
            t = (i + 1) / over
            eased = t * t * (3 - 2 * t)
            page.evaluate(f"window.__demo.setBallast({(1150 + 200 * eased):.0f})")
            tick(1)
        hold(int(seg1_frames * 0.05))
        btn = center_of(page, element_center("#btn-blow"))
        move(int(0.8 * FPS), (1530, 860), btn)
        hold(3, btn, click_frames=3)             # the real click
        page.evaluate("window.__demo.blowLead()")
        # deterministic rise: about six seconds of screen time
        budget = int(6.5 * FPS)
        for _ in range(budget):
            page.evaluate("window.__demo.tick(1/15)")
            frame_idx, timeline = write_hold(page, frames_dir, frame_idx, 1, timeline, cues)
        hold(max(0, seg1_frames - fill - int(seg1_frames * 0.08) - over - int(seg1_frames * 0.05)
                 - int(0.8 * FPS) - 3 - budget))

        # --- Segment 2: the crank — sweep the power, pin the sprint ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('crank')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.3)
        n2a = int(seg2_frames * 0.14)
        hold(n2a)
        sweep = int(seg2_frames * 0.4)
        for i in range(sweep):                   # 40 → 400 W along the cube root
            t = (i + 1) / sweep
            eased = t * t * (3 - 2 * t)
            page.evaluate(f"window.__demo.setCrank({(40 + 360 * eased):.0f})")
            hold(1)
        hold(int(seg2_frames * 0.08))
        btn2 = center_of(page, nth_center("#crank-presets button", 2))   # 冲刺 250 W
        move(int(0.7 * FPS), (1500, 430), btn2)
        hold(3, btn2, click_frames=3)
        page.evaluate("window.__demo.setCrank(250)")
        hold(max(0, seg2_frames - n2a - sweep - int(seg2_frames * 0.08) - int(0.7 * FPS) - 3))

        # --- Segment 3: the air clock — steepen the work, back to the spec ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('air')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.3)
        n3a = int(seg3_frames * 0.14)
        hold(n3a)
        sweep3 = int(seg3_frames * 0.42)
        for i in range(sweep3):                  # 0 → 140 W: the crossing slides left
            t = (i + 1) / sweep3
            eased = t * t * (3 - 2 * t)
            page.evaluate(f"window.__demo.setAirPower({(140 * eased):.0f})")
            hold(1)
        hold(int(seg3_frames * 0.08))
        btn3 = center_of(page, nth_center("#air-presets button", 0))     # 规格三十分钟
        move(int(0.7 * FPS), (1500, 430), btn3)
        hold(3, btn3, click_frames=3)
        page.evaluate("window.__demo.selectAirPreset(0)")
        hold(max(0, seg3_frames - n3a - sweep3 - int(seg3_frames * 0.08) - int(0.7 * FPS) - 3))

        # --- Segment 4: the attack run, launch to boom ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('mission')")
        page.evaluate("window.__demo.scrollToTop()")
        page.evaluate("window.__demo.setLaunch(23)")
        time.sleep(0.3)
        n4a = int(seg4_frames * 0.07)
        hold(n4a)
        btn4 = center_of(page, element_center("#btn-launch"))
        move(int(0.8 * FPS), (1530, 880), btn4)
        hold(3, btn4, click_frames=3)            # the real click
        page.evaluate("window.__demo.launchMission()")
        used = tick_until("!window.__demo.missionActive()", 560, 2.2 / 15)
        hold(max(0, seg4_frames - n4a - int(0.8 * FPS) - 3 - used))

        # --- Segment 5: the timeline, pin by pin ---
        seg5_frames = int(round((durations[5] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('ladder')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.3)
        pin_indices = [0, 2, 5, 7]               # the build, the star, the Kegs, the Hunley
        per_pin = seg5_frames // len(pin_indices)
        from_pos = (1520, 420)
        for pin_index in pin_indices:
            pos = center_of(page, nth_center("#ladder-chart .pin", pin_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectEvent({pin_index})")
            hold(per_pin - int(0.7 * FPS) - 3)
            from_pos = pos

        # --- Segment 6: the end card ---
        seg6_total = durations[6] + SILENCE_TAIL
        end_frames = int(round(min(5.5, seg6_total) * FPS))

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(end_frames)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "bushnells-turtle.mp4"

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
    parser = argparse.ArgumentParser(description="Render the bushnells-turtle video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "bushnells-turtle.mp4")
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
        with tempfile.TemporaryDirectory(prefix="bushnells-turtle-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "bushnells-turtle.srt"
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
