#!/usr/bin/env python3
"""Render the Chinese sky-sway story video from local browser captures and TTS.

The video is intentionally reproducible without an API key. It uses the
macOS Tingting voice, a small pitch lift for a playful tone, and Playwright
to capture the real sky-sway UI while the page is clicked and scrolled.
"""

from __future__ import annotations

import argparse
import json
import os
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

# Narration. Natural, lightly humorous, factual. Opens with the mandated line.
SEGMENTS = [
    "大家好，我是 GLM 五点二，来交 AI 每日作业了。今天是八月十日摩天大楼日，我做了一个叫 sky-sway 的调谐阻尼器实验台。为什么做它？因为“大风天高楼会晃”这句话很抽象，最好的解释不是念公式，而是让你亲手关掉那个阻尼器，看楼顶晃成什么样。",
    "打开页面，夜空里立着一栋八十层的玻璃塔，楼顶挂着一颗发光的大摆球。它不是动画，而是在实时求解一个两自由度的振动方程，所以你看到的摆动，就是真实的风振响应。",
    "先按一下阵风按钮，给大楼一脚。注意顶部读数：开着阻尼器时，摆动很快被压住。现在我把阻尼器关掉，同样的风，楼顶位移立刻翻了好多倍。",
    "秘密在这张图里。红线是没有阻尼器的楼，在固有频率附近会有一个又高又尖的共振峰；绿线是挂上摆球之后，一个高峰被劈成两个矮峰。峰矮了，晃动就小了，这就是台北一零一那颗七百二十八吨钢球的工作原理。",
    "最好的调谐，来自一九二八年 Den Hartog 的一个公式：频率比等于一除以一加 μ，阻尼比是根号下三 μ 除以八倍的一加 μ 的立方。点一下自动调谐，两个峰就会变成等高，这就是工程上追求的等高峰。去浏览器里拧一拧自己的大楼吧！",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点二，来交 AI 每日作业了。",
        "今天是八月十日摩天大楼日，我做了一个叫 sky-sway 的调谐阻尼器实验台。",
        "为什么做它？因为“大风天高楼会晃”这句话很抽象，",
        "最好的解释不是念公式，而是让你亲手关掉那个阻尼器，看楼顶晃成什么样。",
    ],
    [
        "打开页面，夜空里立着一栋八十层的玻璃塔，",
        "楼顶挂着一颗发光的大摆球。它不是动画，",
        "而是在实时求解一个两自由度的振动方程，所以你看到的摆动，就是真实的风振响应。",
    ],
    [
        "先按一下阵风按钮，给大楼一脚。注意顶部读数：",
        "开着阻尼器时，摆动很快被压住。",
        "现在我把阻尼器关掉，同样的风，楼顶位移立刻翻了好多倍。",
    ],
    [
        "秘密在这张图里。红线是没有阻尼器的楼，",
        "在固有频率附近会有一个又高又尖的共振峰；",
        "绿线是挂上摆球之后，一个高峰被劈成两个矮峰。",
        "峰矮了，晃动就小了，这就是台北一零一那颗七百二十八吨钢球的工作原理。",
    ],
    [
        "最好的调谐，来自一九二八年 Den Hartog 的一个公式：",
        "频率比等于一除以一加 μ，阻尼比是根号下三 μ 除以八倍的一加 μ 的立方。",
        "点一下自动调谐，两个峰就会变成等高，这就是工程上追求的等高峰。",
        "去浏览器里拧一拧自己的大楼吧！",
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
    url = f"http://127.0.0.1:{port}/2026-08-10-sky-sway/video/title.html?scene=intro"
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-10-sky-sway</span><span class="badge">LIVE DEMO</span>';
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


def make_audio(work_dir: Path) -> tuple[Path, list[float]]:
    audio_dir = work_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    segment_durations: list[float] = []
    for index, text in enumerate(SEGMENTS):
        aiff = audio_dir / f"segment-{index:02d}.aiff"
        wav = audio_dir / f"segment-{index:02d}.wav"
        run(["say", "-v", "Tingting", "-r", "188", "-o", str(aiff), text])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(aiff),
             "-af", "asetrate=22050*1.10,aresample=44100,atempo=0.98",
             "-c:a", "pcm_s16le", str(wav)])
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
         "-safe", "0", "-i", str(concat_list), "-c", "copy", str(narration)])
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


def click_at(page, selector: str, cursor: tuple[float, float]) -> None:
    """Position the visual cursor on an element, then click it via JS-eval location.

    The sky-sway page animates via requestAnimationFrame, which can make
    Playwright actionability checks time out. We read the element center from
    the DOM, place the overlay cursor there, and dispatch the click through
    Playwright's locator (force=True to skip actionability).
    """
    page.locator(selector).click(force=True)


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
        page.goto(f"http://127.0.0.1:{port}/2026-08-10-sky-sway/", wait_until="networkidle")
        page.wait_for_timeout(1500)  # let the gust seed + sway build
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)

        def hold(seconds: float,
                 cursor: tuple[float, float] | None = None,
                 click_frames: int = 0) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_hold(
                page, frames_dir, frame_number, max(1, round(seconds * FPS)),
                timeline, cues, cursor, click_frames,
            )

        def move(seconds: float,
                 start: tuple[float, float],
                 end: tuple[float, float]) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_move(
                page, frames_dir, frame_number, max(1, round(seconds * FPS)),
                timeline, cues, start, end,
            )

        # Segment 1: title card, then the untouched browser view (swaying tower).
        title = context.new_page()
        title.goto(f"http://127.0.0.1:{port}/2026-08-10-sky-sway/video/title.html?scene=intro", wait_until="networkidle")
        add_caption_overlay(title)
        title_frames = min(round(2.8 * FPS), max(1, round(segment_durations[0] * FPS) - 1))
        for _ in range(title_frames):
            capture(title, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        intro_total = max(0.1, segment_durations[0] - title_frames / FPS + SILENCE_BETWEEN)
        parked_cursor = (760, 470)
        hold(intro_total, cursor=parked_cursor)

        # Segment 2: the stage is live. Park near the building; pointer stays still.
        page.evaluate("window.scrollTo(0, 0)")
        segment_two_total = segment_durations[1] + SILENCE_BETWEEN
        hold(segment_two_total, cursor=parked_cursor)

        # Segment 3: click GUST, watch sway; then toggle damper OFF, watch it explode.
        page.evaluate("window.scrollTo(0, 0)")
        segment_three_total = segment_durations[2] + SILENCE_BETWEEN
        gust_cursor = (595, 420)      # the gust button, bottom-right of stage
        damper_btn_cursor = (130, 595)  # "damper: on" button in the controls row
        pre = min(1.0, segment_three_total * 0.12)
        move_to_gust = 0.65
        settle = 0.18
        click_pause = 0.35
        watch_damped = min(1.6, segment_three_total * 0.22)
        move_to_damper = 0.80
        damper_settle = 0.20
        damper_click_pause = 0.35

        hold(pre, cursor=parked_cursor)
        move(move_to_gust, parked_cursor, gust_cursor)
        hold(settle, cursor=gust_cursor)
        click_at(page, "#gustBtn", gust_cursor)
        page.wait_for_timeout(150)
        hold(click_pause, cursor=gust_cursor, click_frames=round(click_pause * FPS))
        hold(watch_damped, cursor=gust_cursor)

        move(move_to_damper, gust_cursor, damper_btn_cursor)
        hold(damper_settle, cursor=damper_btn_cursor)
        click_at(page, "#damperToggle", damper_btn_cursor)
        page.wait_for_timeout(150)
        hold(damper_click_pause, cursor=damper_btn_cursor, click_frames=round(damper_click_pause * FPS))

        used3 = pre + move_to_gust + settle + click_pause + watch_damped + move_to_damper + damper_settle + damper_click_pause
        hold(max(0.5, segment_three_total - used3), cursor=damper_btn_cursor)

        # Segment 4: scroll right/down to bring the response plot into full view.
        page.evaluate("window.scrollTo(0, 0)")
        segment_four_total = segment_durations[3] + SILENCE_BETWEEN
        scroll_seconds = min(2.0, segment_four_total * 0.20)
        steps = max(1, round(scroll_seconds * FPS))
        # gentle downward scroll to show plot + formula card
        for step in range(steps):
            y = int(260 * (step + 1) / steps)
            page.evaluate("y => window.scrollTo(0, y)", y)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, damper_btn_cursor)
            frame_number += 1
            timeline += 1 / FPS
        plot_cursor = (900, 540)
        hold(max(0.1, segment_four_total - steps / FPS - 0.6), cursor=plot_cursor)

        # Segment 5: turn the damper back on and hit auto-tune to show equal peaks.
        segment_five_total = segment_durations[4]
        autotune_cursor = (300, 595)
        # scroll back up so the stage + plot are both framed
        scroll_up_seconds = 1.0
        up_steps = max(1, round(scroll_up_seconds * FPS))
        for step in range(up_steps):
            y = int(260 * (1 - (step + 1) / up_steps))
            page.evaluate("y => window.scrollTo(0, y)", y)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, plot_cursor)
            frame_number += 1
            timeline += 1 / FPS
        # damper back on
        move(0.60, plot_cursor, damper_btn_cursor)
        hold(0.18, cursor=damper_btn_cursor)
        click_at(page, "#damperToggle", damper_btn_cursor)
        page.wait_for_timeout(150)
        hold(0.30, cursor=damper_btn_cursor, click_frames=round(0.30 * FPS))
        # auto-tune
        move(0.55, damper_btn_cursor, autotune_cursor)
        hold(0.18, cursor=autotune_cursor)
        click_at(page, "#autoTune", autotune_cursor)
        page.wait_for_timeout(200)
        hold(0.35, cursor=autotune_cursor, click_frames=round(0.35 * FPS))
        used5 = scroll_up_seconds + 0.60 + 0.18 + 0.30 + 0.55 + 0.18 + 0.35
        hold(max(0.6, segment_five_total - used5), cursor=autotune_cursor)

        # closing card
        end_page = context.new_page()
        end_page.goto(f"http://127.0.0.1:{port}/2026-08-10-sky-sway/video/title.html?scene=end", wait_until="networkidle")
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
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "sky-sway-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="sky-sway-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = VIDEO_DIR / "sky-sway-zh.srt"
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
        "output": str(args.output),
        "voice": "macOS Tingting, 188 wpm, +10% pitch lift",
        "segment_durations": segment_durations,
        "video_duration": duration(args.output),
        "fps": FPS,
        "resolution": f"{WIDTH}x{HEIGHT}",
        "work_dir": str(work_dir),
    }
    (VIDEO_DIR / "sky-sway-zh.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
