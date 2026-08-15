#!/usr/bin/env python3
"""Render the Chinese loop-the-loop story video from local browser captures and TTS.

The video is intentionally reproducible without an API key. It uses the macOS
Tingting voice, and Playwright to capture the real loop-the-loop UI while the
release handle is dragged, coasters are dispatched, the short loop falls and
is rescued by upstop wheels, the clothoid halves the g-bill, and the friction
preset rolls back to the station.
"""

from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


FPS = 15
DESIGN_WIDTH = 1280
DESIGN_HEIGHT = 720
WIDTH = 1920
HEIGHT = 1080
SILENCE_BETWEEN = 0.22
SILENCE_TAIL = 1.6
PROJECT_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = PROJECT_DIR.parent
VIDEO_DIR = Path(__file__).resolve().parent
SLUG = "2026-08-16-loop-the-loop"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月十六日，国家过山车日——一八九八年的今天，埃德温·普雷斯科特拿到了垂直回环的专利。我做了一个叫 loop-the-loop 的小工具，把这个回环一百多年的物理账单，摊开给你玩。",
    "规则只有一句话：轨道只会推，不会拉。车在环顶不掉下来，需要 v 平方大于 g 乘 r；拿能量一算，出发高度必须在环最低点上方整整二点五倍半径。我把释放高度正好放在二点五 r 上，放车——环顶零个 g，完全失重；环底六个 g。这就是一八九八年乘客脖子受伤的原因。",
    "把高度拉低一点再放：车在上升段就离开轨道，因为需要的向心力超过了重力能给的。打开一九七六年才普及的防脱轮，同一辆车倒挂在环顶也被拉住，照样跑完全程。再换掉普雷斯科特的正圆环，用一九七六年的缓和曲线泪滴环：同样的高度、同样的释放，峰值 g 从六降到三点四——把最急的弯，花在已经没有速度的地方。",
    "摩擦力这边也有个漂亮结论：它做的功，等于 μmg 乘以水平距离，跟路径的形状完全无关。所以需要的释放高度就是二点五 r 加上 μ 乘 Δx。把 μ 拉大，账单立刻变长，车会卡在半路滚回来——能量账本上，每一米都记着去向。",
    "最后是驼峰。老式的侧摩擦轮没有防脱轮，速度够快时，驼峰顶的重力比需要的向心力还要多，车会真的飞起来一小段。去拖你自己的过山车吧——二点五 r 这条线，就画在轨道上方等你。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月十六日，国家过山车日——",
        "一八九八年的今天，埃德温·普雷斯科特拿到了垂直回环的专利。",
        "我做了一个叫 loop-the-loop 的小工具，",
        "把这个回环一百多年的物理账单，摊开给你玩。",
    ],
    [
        "规则只有一句话：轨道只会推，不会拉。",
        "车在环顶不掉下来，需要 v 平方大于 g 乘 r；",
        "拿能量一算，出发高度必须在环最低点上方整整二点五倍半径。",
        "我把释放高度正好放在二点五 r 上，放车——",
        "环顶零个 g，完全失重；环底六个 g。",
        "这就是一八九八年乘客脖子受伤的原因。",
    ],
    [
        "把高度拉低一点再放：",
        "车在上升段就离开轨道，",
        "因为需要的向心力超过了重力能给的。",
        "打开一九七六年才普及的防脱轮，",
        "同一辆车倒挂在环顶也被拉住，照样跑完全程。",
        "再换掉普雷斯科特的正圆环，用一九七六年的缓和曲线泪滴环：",
        "同样的高度、同样的释放，峰值 g 从六降到三点四——",
        "把最急的弯，花在已经没有速度的地方。",
    ],
    [
        "摩擦力这边也有个漂亮结论：",
        "它做的功，等于 μmg 乘以水平距离，跟路径的形状完全无关。",
        "所以需要的释放高度就是二点五 r 加上 μ 乘 Δx。",
        "把 μ 拉大，账单立刻变长，车会卡在半路滚回来——",
        "能量账本上，每一米都记着去向。",
    ],
    [
        "最后是驼峰。",
        "老式的侧摩擦轮没有防脱轮，速度够快时，",
        "驼峰顶的重力比需要的向心力还要多，车会真的飞起来一小段。",
        "去拖你自己的过山车吧——",
        "二点五 r 这条线，就画在轨道上方等你。",
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
        color: #9d9487; background: #161310; border-bottom: 1px solid #393129;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #3a332b; border-radius: 7px; background: #211d18; color: #c0b6a6;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #e8853a; letter-spacing: 1px; font-size: 10px; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-16-loop-the-loop</span><span class="badge">LIVE DEMO</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 22px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1100px; width: max-content;
        padding: 8px 18px 10px; border-radius: 8px;
        color: #fffaf1; background: rgba(10, 8, 6, .80);
        box-shadow: 0 4px 24px rgba(0,0,0,.22);
        text-align: center; white-space: pre-wrap;
        font: 24px/1.42 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
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
        transform: translate(-3px, -3px); opacity: 1;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,.65));
      }
      #video-cursor svg { display: block; width: 24px; height: 30px; }
      #video-cursor .click-ring {
        position: absolute; left: 4px; top: 4px; width: 17px; height: 17px;
        border: 2px solid #e8853a; border-radius: 50%; opacity: 0;
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
        local = cursor
        for line, weight in zip(lines, weights):
            end = local + segment_duration * weight / total
            cues.append((local, end, line))
            local = end
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
    page.screenshot(path=str(path), animations="disabled")


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
    """Capture a short, eased, slightly curved pointer movement.

    Long linear drifts read as an animation, not a person using a mouse. The
    pointer moves over a compact interval with a gentle ease-in/ease-out
    and a tiny arc, then stays still.
    """
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


def chip_center(page, key: str) -> tuple[float, float]:
    return page.evaluate(
        """(key) => {
      const r = document.querySelector(`.chip[data-preset="${key}"]`).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }""", key)


def btn_center(page, id_: str) -> tuple[float, float]:
    return page.evaluate(
        """(id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }""", id_)


def make_audio(work_dir: Path) -> tuple[Path, list[float]]:
    audio_dir = work_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    segment_durations: list[float] = []
    for index, text in enumerate(SEGMENTS):
        aiff = audio_dir / f"segment-{index:02d}.aiff"
        wav = audio_dir / f"segment-{index:02d}.wav"
        run(["say", "-v", "Tingting", "-r", "190", "-o", str(aiff), text])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(aiff),
             "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
        segment_durations.append(duration(wav))

    silence = audio_dir / "silence.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(SILENCE_BETWEEN),
         "-c:a", "pcm_s16le", str(silence)])
    tail_silence = audio_dir / "tail-silence.wav"
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
    narration = work_dir / "narration.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
         "-safe", "0", "-i", str(concat_list), "-c:a", "copy", str(narration)])
    return narration, segment_durations


def timecode(value: float) -> str:
    millis = int(round(value * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    seconds, millis = divmod(millis, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def write_srt(path: Path, segment_durations: list[float]) -> None:
    srt_cues: list[str] = []
    for cue_id, (start, end, text) in enumerate(caption_cues(segment_durations), 1):
        srt_cues.append(f"{cue_id}\n{timecode(start)} --> {timecode(end)}\n{text}\n")
    path.write_text("\n".join(srt_cues), encoding="utf-8")


def capture_frames(work_dir: Path, segment_durations: list[float], port: int) -> Path:
    frames_dir = work_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    frame_number = 0
    timeline = 0.0
    cues = caption_cues(segment_durations)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": DESIGN_WIDTH, "height": DESIGN_HEIGHT},
            device_scale_factor=1.5,
        )
        page = context.new_page()
        page.goto(f"http://127.0.0.1:{port}/{SLUG}/", wait_until="networkidle")
        page.wait_for_timeout(700)
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)
        page.evaluate("() => window.__demo.setPaused(true)")

        def hold(seconds: float,
                 cursor: tuple[float, float] | None = None,
                 click_frames: int = 0) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_hold(
                page, frames_dir, frame_number,
                max(1, round(seconds * FPS)), timeline, cues, cursor, click_frames,
            )

        def move(seconds: float,
                 start: tuple[float, float], end: tuple[float, float]) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_move(
                page, frames_dir, frame_number,
                max(1, round(seconds * FPS)), timeline, cues, start, end,
            )

        def run_coaster(speed: float, seconds: float,
                        cursor: tuple[float, float] | None = None) -> None:
            """Advance the paused simulation deterministically, one frame each."""
            nonlocal frame_number, timeline
            frames = max(1, round(seconds * FPS))
            for _ in range(frames):
                page.evaluate("(d) => window.__demo.stepDraw(d)", speed / FPS)
                capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, cursor)
                frame_number += 1
                timeline += 1 / FPS

        def dispatch_run(speed: float, seconds: float, cursor) -> None:
            page.evaluate("() => window.__demo.dispatch()")
            run_coaster(speed, seconds, cursor)

        parked = (1050, 640)

        # ── Segment 1: title card, then the untouched app ─────────────────
        title = context.new_page()
        title.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=intro",
                   wait_until="networkidle")
        add_caption_overlay(title)
        title_frames = min(round(2.8 * FPS), max(1, round(segment_durations[0] * FPS) - 1))
        for _ in range(title_frames):
            capture(title, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        page.evaluate("window.scrollTo(0, 0)")
        hold(max(0.1, segment_durations[0] - title_frames / FPS + SILENCE_BETWEEN),
             cursor=parked)

        # ── Segment 2: the 2.5r rule, dispatched exactly on the line ──────
        seg2 = segment_durations[1] + SILENCE_BETWEEN
        handle = page.evaluate("() => window.__demo.releasePx()")
        move(0.7, parked, (handle["x"], handle["y"]))
        # a small real drag: up a touch, back onto the 2.5r line
        page.mouse.move(handle["x"], handle["y"])
        page.mouse.down()
        for i in range(6):
            target = (handle["x"], handle["y"] - (i + 1) * 5)
            page.mouse.move(*target)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, target)
            frame_number += 1
            timeline += 1 / FPS
        page.evaluate("() => window.__demo.setH(22.5)")
        for i in range(6):
            target = (handle["x"], handle["y"] - 30 + (i + 1) * 5)
            page.mouse.move(*target)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, target)
            frame_number += 1
            timeline += 1 / FPS
        page.mouse.up()
        used = 0.7 + 12 / FPS
        hold(0.6, cursor=(handle["x"], handle["y"]))
        used += 0.6
        btn = btn_center(page, "dispatchBtn")
        move(0.65, (handle["x"], handle["y"]), (btn["x"], btn["y"]))
        used += 0.65
        page.evaluate("() => window.__demo.dispatch()")
        hold(0.4, cursor=(btn["x"], btn["y"]), click_frames=round(0.4 * FPS))
        used += 0.4
        run_coaster(1.0, max(0.2, seg2 - used), cursor=(btn["x"], btn["y"]))

        # ── Segment 3: fall, rescue, clothoid ─────────────────────────────
        seg3 = segment_durations[2] + SILENCE_BETWEEN
        chip = chip_center(page, "short")
        move(0.7, (btn["x"], btn["y"]), (chip["x"], chip["y"]))
        used = 0.7
        page.evaluate('(key) => window.__demo.setPreset(key)', "short")
        hold(0.35, cursor=(chip["x"], chip["y"]), click_frames=round(0.35 * FPS))
        used += 0.35
        # drop the release height below the line for the fall
        page.evaluate("() => window.__demo.setH(18.5)")
        hold(0.8, cursor=(chip["x"], chip["y"]))
        used += 0.8
        page.evaluate("() => window.__demo.dispatch()")
        run_coaster(1.0, 7.5, cursor=(chip["x"], chip["y"]))
        used += 7.5
        # rescue with upstop wheels
        chk = btn_center(page, "upstopChk")
        move(0.6, (chip["x"], chip["y"]), (chk["x"], chk["y"]))
        used += 0.6
        page.evaluate("() => window.__demo.setUpstop(true)")
        hold(0.4, cursor=(chk["x"], chk["y"]), click_frames=round(0.4 * FPS))
        used += 0.4
        page.evaluate("() => window.__demo.dispatch()")
        run_coaster(1.4, 7.0, cursor=(chk["x"], chk["y"]))
        used += 7.0
        # the 1976 clothoid
        clo = btn_center(page, "shapeClothoid")
        move(0.6, (chk["x"], chk["y"]), (clo["x"], clo["y"]))
        used += 0.6
        page.evaluate("() => window.__demo.setShape('clothoid')")
        hold(0.5, cursor=(clo["x"], clo["y"]), click_frames=round(0.5 * FPS))
        used += 0.5
        page.evaluate("() => window.__demo.setPreset('clothoid')")
        page.evaluate("() => window.__demo.dispatch()")
        run_coaster(1.4, max(0.2, seg3 - used), cursor=(clo["x"], clo["y"]))

        # ── Segment 4: the friction bill, rollback at 2.5× ────────────────
        seg4 = segment_durations[3] + SILENCE_BETWEEN
        page.evaluate("() => window.__demo.setPreset('friction')")
        chip = chip_center(page, "friction")
        move(0.6, (clo["x"], clo["y"]), (chip["x"], chip["y"]))
        used = 0.6
        hold(0.35, cursor=(chip["x"], chip["y"]), click_frames=round(0.35 * FPS))
        used += 0.35
        page.evaluate("() => window.__demo.dispatch()")
        run_coaster(2.5, max(0.2, seg4 - used), cursor=(chip["x"], chip["y"]))

        # ── Segment 5: airtime hills, then out ────────────────────────────
        seg5 = segment_durations[4]
        page.evaluate("() => window.__demo.setPreset('airtime')")
        chip = chip_center(page, "airtime")
        move(0.6, (chip["x"], chip["y"]), (chip["x"], chip["y"]))
        used = 0.6
        hold(0.35, cursor=(chip["x"], chip["y"]), click_frames=round(0.35 * FPS))
        used += 0.35
        page.evaluate("() => window.__demo.dispatch()")
        run_coaster(1.0, max(0.2, seg5 - used - 1.6), cursor=(chip["x"], chip["y"]))

        # end card
        end_page = context.new_page()
        end_page.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=end",
                      wait_until="networkidle")
        add_caption_overlay(end_page)
        for _ in range(round(1.6 * FPS)):
            capture(end_page, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        browser.close()
    return frames_dir


def assemble(work_dir: Path, frames_dir: Path, narration: Path, subtitles: Path, output: Path) -> None:
    silent_video = work_dir / "video-only.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
         "-i", str(frames_dir / "%06d.png"), "-c:v", "libx264", "-preset", "medium",
         "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS), str(silent_video)])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(silent_video),
         "-i", str(narration), "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "128k", "-shortest", str(output)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "loop-the-loop-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="loop-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = VIDEO_DIR / "loop-the-loop-zh.srt"
    write_srt(subtitles, segment_durations)
    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT_DIR)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(port)
        frames_dir = capture_frames(work_dir, segment_durations, port)
    finally:
        server.terminate()
        server.wait(timeout=10)
    assemble(work_dir, frames_dir, narration, subtitles, args.output)
    metadata = {
        "voice": "macOS Tingting, 190 wpm",
        "segment_durations": segment_durations,
        "video_duration": duration(args.output),
        "fps": FPS,
        "resolution": f"{WIDTH}x{HEIGHT}",
        "work_dir": str(work_dir),
    }
    (VIDEO_DIR / "loop-the-loop-zh.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
