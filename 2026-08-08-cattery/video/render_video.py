#!/usr/bin/env python3
"""Render the Chinese cattery story video from local browser captures and TTS.

The video is intentionally reproducible without an API key. It uses the
macOS Tingting voice, a small pitch lift for a playful tone, and Playwright
to capture the real cattery UI while the page is clicked and scrolled.
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

SEGMENTS = [
    "大家好，我是 GLM 五点二，来交 AI 每日作业了。今天是八月八日国际猫咪日，我做了一个叫 Cattery 的猫咪遗传实验室。为什么做它？因为“玳瑁猫几乎都是母猫”这句话很神奇，最好的解释不是背结论，而是让浏览器自己生一窝小猫。",
    "打开页面，左边是妈妈，右边是爸爸，中间按一下 mate，十二只小猫立刻从基因里长出来。每一只都不是贴图，而是先抽取亲本的基因，再把遗传结果变成一只具体的猫。",
    "它会计算七个位点：橙色、棕色、稀释、虎斑、白斑、显性白和毛长。最后根据这些基因组合，画出橘猫、蓝猫、虎斑、玳瑁和加白等不同的样子。",
    "关键在橙色基因 O：它在 X 染色体上。女儿拿到爸爸和妈妈的两条 X，X^O 加 X^o 就是橘黑相间的玳瑁；儿子只有一条 X，只能是橘色或非橘色，所以这个模型里不会出现玳瑁公猫。Punnett square 把这件事直接摊开。",
    "旁边还会比较理论比例和这次小窝的真实结果。再换一对亲本，重新交配，样本会变化，但规则不会变。去浏览器里养一窝自己的基因小猫吧！",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点二，来交 AI 每日作业了。",
        "今天是八月八日国际猫咪日，我做了一个叫 Cattery 的猫咪遗传实验室。",
        "为什么做它？因为“玳瑁猫几乎都是母猫”这句话很神奇，",
        "最好的解释不是背结论，而是让浏览器自己生一窝小猫。",
    ],
    [
        "打开页面，左边是妈妈，右边是爸爸，中间按一下 mate，",
        "十二只小猫立刻从基因里长出来。每一只都不是贴图，",
        "而是先抽取亲本的基因，再把遗传结果变成一只具体的猫。",
    ],
    [
        "它会计算七个位点：橙色、棕色、稀释、虎斑、白斑、显性白和毛长。",
        "最后根据这些基因组合，画出橘猫、蓝猫、虎斑、玳瑁和加白等不同的样子。",
    ],
    [
        "关键在橙色基因 O：它在 X 染色体上。女儿拿到爸爸和妈妈的两条 X，",
        "X^O 加 X^o 就是橘黑相间的玳瑁；儿子只有一条 X，",
        "所以这个模型里不会出现玳瑁公猫。Punnett square 把这件事直接摊开。",
    ],
    [
        "旁边还会比较理论比例和这次小窝的真实结果。再换一对亲本，重新交配，",
        "样本会变化，但规则不会变。",
        "去浏览器里养一窝自己的基因小猫吧！",
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
    url = f"http://127.0.0.1:{port}/2026-08-08-cattery/video/title.html?scene=intro"
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-08-cattery</span><span class="badge">LIVE DEMO</span>';
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
    pointer now moves over a compact interval with a gentle ease-in/ease-out
    and a tiny arc, then stays still for the rest of the narration.
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


def make_audio(work_dir: Path) -> tuple[Path, list[float]]:
    audio_dir = work_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    segment_durations: list[float] = []
    for index, text in enumerate(SEGMENTS):
        aiff = audio_dir / f"segment-{index:02d}.aiff"
        wav = audio_dir / f"segment-{index:02d}.wav"
        run(["say", "-v", "Tingting", "-r", "190", "-o", str(aiff), text])
        # say emits 22.05 kHz AIFF. A slight rate lift gives the requested
        # playful, high-register feel while atempo keeps it intelligible.
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
        page.goto(f"http://127.0.0.1:{port}/2026-08-08-cattery/", wait_until="networkidle")
        page.wait_for_timeout(700)
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)

        def hold(seconds: float,
                 cursor: tuple[float, float] | None = None,
                 click_frames: int = 0) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_hold(
                page,
                frames_dir,
                frame_number,
                max(1, round(seconds * FPS)),
                timeline,
                cues,
                cursor,
                click_frames,
            )

        def move(seconds: float,
                 start: tuple[float, float],
                 end: tuple[float, float]) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_move(
                page,
                frames_dir,
                frame_number,
                max(1, round(seconds * FPS)),
                timeline,
                cues,
                start,
                end,
            )

        # Segment 1: title card, then the untouched browser view.
        title = context.new_page()
        title.goto(f"http://127.0.0.1:{port}/2026-08-08-cattery/video/title.html?scene=intro", wait_until="networkidle")
        add_caption_overlay(title)
        title_frames = min(round(2.8 * FPS), max(1, round(segment_durations[0] * FPS) - 1))
        for _ in range(title_frames):
            capture(title, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        intro_total = max(0.1, segment_durations[0] - title_frames / FPS + SILENCE_BETWEEN)
        parked_cursor = (1080, 650)
        mate_cursor = (640, 350)
        # Keep the pointer parked while the project is introduced. It only
        # starts moving when the narration reaches the actual mate action.
        hold(intro_total, cursor=parked_cursor)

        # Segment 2: the actual interaction — click mate, then reveal kittens.
        page.goto(f"http://127.0.0.1:{port}/2026-08-08-cattery/", wait_until="networkidle")
        page.wait_for_timeout(500)
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)
        page.evaluate("window.scrollTo(0, 0)")
        segment_two_total = segment_durations[1] + SILENCE_BETWEEN
        pre_click = min(0.75, segment_two_total * 0.10)
        move_to_mate = 0.70
        settle_pause = 0.20
        click_pause = 0.35
        hold(pre_click, cursor=parked_cursor)
        move(move_to_mate, parked_cursor, mate_cursor)
        hold(settle_pause, cursor=mate_cursor)
        page.locator("#mate-btn").click()
        page.wait_for_timeout(180)
        hold(click_pause, cursor=mate_cursor, click_frames=round(click_pause * FPS))
        hold(
            max(0.1, segment_two_total - pre_click - move_to_mate - settle_pause - click_pause),
            cursor=mate_cursor,
        )

        # Segment 3: scroll from the litter into the expected-vs-actual panels.
        page.evaluate("window.scrollTo(0, 0)")
        segment_three_total = segment_durations[2] + SILENCE_BETWEEN
        scroll_seconds = min(1.8, segment_three_total * 0.16)
        steps = max(1, round(scroll_seconds * FPS))
        for step in range(steps):
            y = int(520 * (step + 1) / steps)
            page.evaluate("y => window.scrollTo(0, y)", y)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, mate_cursor)
            frame_number += 1
            timeline += 1 / FPS
        hold(
            max(0.1, segment_three_total - steps / FPS),
            cursor=mate_cursor,
        )

        # Segment 4: keep the Punnett square legible, then gently pan lower.
        page.evaluate("window.scrollTo(0, 520)")
        segment_four_total = segment_durations[3] + SILENCE_BETWEEN
        analysis_cursor = mate_cursor
        punnett_cursor = (1010, 440)
        move_to_punnett = 0.70
        scroll_seconds = min(4.0, segment_four_total * 0.28)
        move(move_to_punnett, analysis_cursor, punnett_cursor)
        hold(max(0.1, segment_four_total - move_to_punnett - scroll_seconds), cursor=punnett_cursor)
        steps = max(1, round(scroll_seconds * FPS))
        for step in range(steps):
            y = int(520 + 350 * (step + 1) / steps)
            page.evaluate("y => window.scrollTo(0, y)", y)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, punnett_cursor)
            frame_number += 1
            timeline += 1 / FPS

        # Segment 5: show the picker as a real interaction, then close on the loci.
        segment_five_total = segment_durations[4]
        picker_button_cursor = (325, 553)
        hold(0.8, cursor=punnett_cursor)
        scroll_up_seconds = 1.0
        scroll_steps = max(1, round(scroll_up_seconds * FPS))
        for step in range(scroll_steps):
            y = int(870 * (1 - (step + 1) / scroll_steps))
            page.evaluate("y => window.scrollTo(0, y)", y)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, punnett_cursor)
            frame_number += 1
            timeline += 1 / FPS
        move_to_picker = 0.75
        move(move_to_picker, punnett_cursor, picker_button_cursor)
        page.locator("#mom-pick").click()
        page.wait_for_timeout(180)
        picker_view_pause = 1.80
        hold(0.35, cursor=picker_button_cursor, click_frames=round(0.35 * FPS))
        hold(picker_view_pause, cursor=picker_button_cursor)
        modal_close_cursor = (960, 95)
        move_to_close = 0.70
        move(move_to_close, picker_button_cursor, modal_close_cursor)
        page.locator("#picker-close").click()
        page.wait_for_timeout(120)
        hold(0.25, cursor=modal_close_cursor, click_frames=round(0.25 * FPS))
        scroll_down_seconds = 1.0
        scroll_steps = max(1, round(scroll_down_seconds * FPS))
        for step in range(scroll_steps):
            y = int(1160 * (step + 1) / scroll_steps)
            page.evaluate("y => window.scrollTo(0, y)", y)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, modal_close_cursor)
            frame_number += 1
            timeline += 1 / FPS
        used = 0.8 + scroll_up_seconds + move_to_picker + 0.35 + picker_view_pause + move_to_close + 0.25 + scroll_down_seconds
        hold(max(0.1, segment_five_total - used), cursor=modal_close_cursor)

        # A clean closing card is appended only if the last spoken line leaves
        # enough room; it functions as the end beat, not a separate narration.
        end_page = context.new_page()
        end_page.goto(f"http://127.0.0.1:{port}/2026-08-08-cattery/video/title.html?scene=end", wait_until="networkidle")
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
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "cattery-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="cattery-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = VIDEO_DIR / "cattery-zh.srt"
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
        "voice": "macOS Tingting, 190 wpm, +10% pitch lift",
        "segment_durations": segment_durations,
        "video_duration": duration(args.output),
        "fps": FPS,
        "resolution": f"{WIDTH}x{HEIGHT}",
        "work_dir": str(work_dir),
    }
    (VIDEO_DIR / "cattery-zh.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
