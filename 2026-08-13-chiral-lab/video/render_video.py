#!/usr/bin/env python3
"""Render the Chinese chiral-lab story video from local browser captures and TTS.

The video is intentionally reproducible without an API key. It uses the macOS
Tingting voice, a small pitch lift for a playful tone, and Playwright to capture
the real chiral-lab UI while the mirror image is dragged, snapped, and flipped.
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
SLUG = "2026-08-13-chiral-lab"

# Narration. Natural, lightly humorous, factual. Opens with the mandated line.
SEGMENTS = [
    "大家好，我是 GLM 五点二，来交 AI 每日作业了。今天是八月十三日，国际左撇子日。我做了一个叫 chiral-lab 的小工具，玩的是手性——也就是为什么左手和右手互为镜像，却怎么转都重合不到一起。",
    "道理其实只有一行。镜面反射的行列式是负一，任何旋转的行列式都是正一。反射之后再旋转，行列式永远是负一，永远变不回正一的单位变换。所以再怎么转，也抵消不了一次镜像——这就是手性的全部秘密。",
    "随便挑一个物体：手、螺旋、分子、贝壳都行。紫色的是原件，青色的是它的镜像。拖动青色那个，试着把它转得和紫色重合。看下面这条尺：你现在的误差，能转到的极限，还有允许翻转一次时的零。按下 show best turn，就到了极限——可还是差那么一点。",
    "勾上允许一次翻转，两个立刻完美重合——这是手腕永远做不出的那一个动作。再换个扁的字母 F：在二维里，怎么转都对不上；切到三维，翻个面就重合了。手性，取决于你被允许怎么动。",
    "世界大多是单侧的：大约一成的人是左撇子，大约九成的蜗牛壳朝同一个方向卷，几乎所有的氨基酸都是左旋的。当年沙利度胺出事，就是因为两个镜像体，一个治病，一个致畸。去玩吧，亲手感受一下行列式。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点二，来交 AI 每日作业了。",
        "今天是八月十三日，国际左撇子日。",
        "我做了一个叫 chiral-lab 的小工具，",
        "玩的是手性——也就是为什么左手和右手互为镜像，",
        "却怎么转都重合不到一起。",
    ],
    [
        "道理其实只有一行。",
        "镜面反射的行列式是负一，任何旋转的行列式都是正一。",
        "反射之后再旋转，行列式永远是负一，",
        "永远变不回正一的单位变换。",
        "所以再怎么转，也抵消不了一次镜像——",
        "这就是手性的全部秘密。",
    ],
    [
        "随便挑一个物体：手、螺旋、分子、贝壳都行。",
        "紫色的是原件，青色的是它的镜像。",
        "拖动青色那个，试着把它转得和紫色重合。",
        "看下面这条尺：你现在的误差，能转到的极限，",
        "还有允许翻转一次时的零。",
        "按下 show best turn，就到了极限——可还是差那么一点。",
    ],
    [
        "勾上允许一次翻转，",
        "两个立刻完美重合——",
        "这是手腕永远做不出的那一个动作。",
        "再换个扁的字母 F：",
        "在二维里，怎么转都对不上；",
        "切到三维，翻个面就重合了。",
        "手性，取决于你被允许怎么动。",
    ],
    [
        "世界大多是单侧的：",
        "大约一成的人是左撇子，",
        "大约九成的蜗牛壳朝同一个方向卷，",
        "几乎所有的氨基酸都是左旋的。",
        "当年沙利度胺出事，就是因为两个镜像体，",
        "一个治病，一个致畸。",
        "去玩吧，亲手感受一下行列式。",
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
        color: #9498b6; background: #11121d; border-bottom: 1px solid #272a3e;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #2c3046; border-radius: 7px; background: #1d2030; color: #aab0d0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #54e3e0; letter-spacing: 1px; font-size: 10px; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-13-chiral-lab</span><span class="badge">LIVE DEMO</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 22px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1100px; width: max-content;
        padding: 8px 18px 10px; border-radius: 8px;
        color: #fffaf1; background: rgba(8, 9, 15, .80);
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
        border: 2px solid #54e3e0; border-radius: 50%; opacity: 0;
        transform: translate(-50%, -50%) scale(.55);
      }
      #video-cursor.clicking .click-ring { opacity: .95; transform: translate(-50%, -50%) scale(1); }
    """)
    page.evaluate("""() => {
      const node = document.createElement('div');
      node.id = 'video-cursor';
      node.innerHTML = '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M2 1 L2 23 L8 18 L12 28 L16 26 L12 17 L22 17 Z" fill="#fffaf1" stroke="#11121d" stroke-width="2" stroke-linejoin="round"/></svg><span class="click-ring"></span>';
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


def center_of(page, selector: str) -> tuple[float, float]:
    """Live viewport-centre of an element — robust to layout/scroll changes."""
    box = page.locator(selector).first.bounding_box()
    if not box:
        raise RuntimeError(f"element not found for cursor target: {selector}")
    return (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


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


def write_drag(page, frames_dir: Path, frame_number: int, count: int,
               timeline: float, cues: list[tuple[float, float, str]],
               start: tuple[float, float], end: tuple[float, float]) -> tuple[int, float]:
    """A real Playwright mouse drag on the stage: the app turns the enantiomer
    in response, the overlay cursor follows the pointer, and a frame is captured
    each tick. Eased so the mirror slows into its rest orientation."""
    count = max(2, count)
    page.mouse.move(start[0], start[1])
    page.mouse.down()
    for index in range(count):
        progress = index / max(1, count - 1)
        eased = progress * progress * (3 - 2 * progress)
        x = start[0] + (end[0] - start[0]) * eased
        y = start[1] + (end[1] - start[1]) * eased
        page.mouse.move(x, y)
        capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, (x, y), False)
        frame_number += 1
        timeline += 1 / FPS
    page.mouse.up()
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


def click_at(page, selector: str) -> None:
    """Click an element via Playwright. The page animates via requestAnimationFrame
    so we skip actionability checks (force=True); the overlay cursor is placed by
    the caller's move()+hold()."""
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
        page.goto(f"http://127.0.0.1:{port}/{SLUG}/", wait_until="networkidle")
        page.wait_for_timeout(1200)
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

        def drag(seconds: float,
                 start: tuple[float, float],
                 end: tuple[float, float]) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_drag(
                page, frames_dir, frame_number, max(2, round(seconds * FPS)),
                timeline, cues, start, end,
            )

        parked = (470, 380)               # over the stage, off-centre
        proof_target = ".proof-card"
        stage_center = center_of(page, "#stage")
        best_target = "#bestBtn"
        flip_target = "#allowFlip"
        f_target = '.obj[data-key="F"]'
        plane2d_target = "#plane2d"
        meter_target = ".meter-track"

        # ── Segment 1: title card, then the hand + its mirror. ────────────
        title = context.new_page()
        title.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=intro", wait_until="networkidle")
        add_caption_overlay(title)
        title_frames = min(round(2.8 * FPS), max(1, round(segment_durations[0] * FPS) - 1))
        for _ in range(title_frames):
            capture(title, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        page.evaluate("window.scrollTo(0, 0)")
        set_cursor(page, parked, False)
        intro_total = max(0.1, segment_durations[0] - title_frames / FPS + SILENCE_BETWEEN)
        hold(intro_total, cursor=parked)

        # ── Segment 2: the determinant proof card. ────────────────────────
        page.evaluate("window.scrollTo(0, 0)")
        proof_center = center_of(page, proof_target + " h2")
        seg2_total = segment_durations[1] + SILENCE_BETWEEN
        pan = min(0.9, seg2_total * 0.16)
        move(pan, parked, proof_center)
        hold(max(0.4, seg2_total - pan - 0.3), cursor=proof_center)

        # ── Segment 3: drag the mirror, then show the best-turn floor. ────
        page.evaluate("window.scrollTo(0, 0)")
        seg3_total = segment_durations[2] + SILENCE_BETWEEN
        # drift cursor back near the stage, then do a real two-leg drag so the
        # cyan enantiomer visibly turns under the pointer.
        move(0.5, proof_center, stage_center)
        drag_start = (stage_center[0] - 90, stage_center[1] - 30)
        drag_mid = (stage_center[0] + 120, stage_center[1] + 40)
        drag_end = (stage_center[0] + 40, stage_center[1] + 110)
        set_cursor(page, stage_center, False)
        move(0.25, stage_center, drag_start)
        drag(1.1, drag_start, drag_mid)
        drag(1.0, drag_mid, drag_end)
        # now snap to the closest any turn can get (the Kabsch floor).
        best_center = center_of(page, best_target)
        move(0.6, drag_end, best_center)
        hold(0.18, cursor=best_center)
        click_at(page, best_target)
        page.wait_for_timeout(150)
        hold(0.45, cursor=best_center, click_frames=round(0.45 * FPS))
        meter_center = center_of(page, meter_target)
        move(0.6, best_center, meter_center)
        used3 = 0.5 + 0.25 + 1.1 + 1.0 + 0.6 + 0.18 + 0.45 + 0.6
        hold(max(0.5, seg3_total - used3), cursor=meter_center)

        # ── Segment 4: allow one reflection (snap!), then flat F 2D vs 3D. ─
        page.evaluate("window.scrollTo(0, 0)")
        seg4_total = segment_durations[3] + SILENCE_BETWEEN
        flip_center = center_of(page, flip_target)
        move(0.6, meter_center, flip_center)
        hold(0.18, cursor=flip_center)
        click_at(page, flip_target)               # → enantiomer snaps onto original
        page.wait_for_timeout(150)
        hold(0.55, cursor=flip_center, click_frames=round(0.55 * FPS))
        # switch to the flat F, far enough into the segment that the flip landed.
        f_center = center_of(page, f_target)
        move(0.7, flip_center, f_center)
        hold(0.18, cursor=f_center)
        click_at(page, f_target)
        page.wait_for_timeout(150)
        hold(0.40, cursor=f_center, click_frames=round(0.40 * FPS))
        # 2D mode on → best turn leaves a big residual (flat F is chiral in 2D).
        plane_center = center_of(page, plane2d_target)
        move(0.5, f_center, plane_center)
        hold(0.16, cursor=plane_center)
        click_at(page, plane2d_target)
        page.wait_for_timeout(120)
        hold(0.30, cursor=plane_center, click_frames=round(0.30 * FPS))
        bc = center_of(page, best_target)
        move(0.5, plane_center, bc)
        click_at(page, best_target)
        page.wait_for_timeout(150)
        used4 = 0.6 + 0.18 + 0.55 + 0.7 + 0.18 + 0.40 + 0.5 + 0.16 + 0.30 + 0.5
        hold(max(0.4, seg4_total - used4), cursor=bc)

        # ── Segment 5: the census card, then the closing card. ────────────
        seg5_total = segment_durations[4]
        page.evaluate("document.querySelector('.census-card').scrollIntoView({block:'center'})")
        page.wait_for_timeout(250)
        census_center = center_of(page, ".census-card")
        set_cursor(page, bc, False)
        move(min(0.9, seg5_total * 0.16), bc, census_center)
        hold(max(0.6, seg5_total - 0.9 - 0.3), cursor=census_center)

        # closing card
        end_page = context.new_page()
        end_page.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=end", wait_until="networkidle")
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
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "chiral-lab-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="chiral-lab-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = VIDEO_DIR / "chiral-lab-zh.srt"
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
    (VIDEO_DIR / "chiral-lab-zh.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
