#!/usr/bin/env python3
"""Render the Chinese waggle-room story video from local browser captures and TTS.

The video is intentionally reproducible without an API key. It uses the macOS
Tingting voice, and Playwright to capture the real waggle-room UI while flowers
are dragged, the sun is slid across the sky, and a recruit round is played.
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
SLUG = "2026-08-15-waggle-room"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月十五日，八月的第三个星期六，世界蜜蜂日。我做了一个叫 waggle-room 的小工具，玩的是蜜蜂的摇摆舞：一只找到花田的工蜂回到漆黑的蜂巢，在垂直的巢脾上跳一段八字舞，就把花田的方向和距离都告诉了同伴。",
    "秘密就一句话：在巢脾上，向上就代表朝着太阳。八字舞中间那条直线的倾角，等于花田偏离太阳的角度；摇尾的时长就是距离——冯·弗里希的卡尼鄂拉蜂，一秒摇摆大约等于一公里，甚至可以数摆动次数，一秒大概十三下。他就靠破译这门语言，拿了一九七三年的诺贝尔奖。",
    "现在拖动花田，舞蹈立刻跟着变。再把太阳从中午滑到傍晚：花没有动，舞却在慢慢转——蜂群用自己的生物钟，自动补偿太阳的移动。换个蜂巢方言，同一片花田就得摇得更久。最后把花拖回家门口，八字舞直接缩成一个圆舞——只剩“很近，值得去”，没有方向。",
    "最好玩的是当跟随蜂。地图一黑，什么都看不见，只能读黑暗里那段舞：角度看刻度，距离掐秒表，然后点出你猜的花田位置。真实的小蜂平均差十几度、两三成距离；我这次点歪了一点，落在了隔壁田里，评级 C。",
    "这门语言是写在基因里的：奥地利的蜂搬到日本，好几代之后还跳着祖先的方言。跟随蜂在黑暗里用触角贴着舞者的腹部“听”舞，后来有人干脆用激光测振仪，从巢脾表面直接读出了摆动。去玩吧，在黑暗里当一回蜜蜂。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月十五日，八月的第三个星期六，世界蜜蜂日。",
        "我做了一个叫 waggle-room 的小工具，",
        "玩的是蜜蜂的摇摆舞：一只找到花田的工蜂",
        "回到漆黑的蜂巢，在垂直的巢脾上跳一段八字舞，",
        "就把花田的方向和距离都告诉了同伴。",
    ],
    [
        "秘密就一句话：在巢脾上，向上就代表朝着太阳。",
        "八字舞中间那条直线的倾角，",
        "等于花田偏离太阳的角度；",
        "摇尾的时长就是距离——",
        "冯·弗里希的卡尼鄂拉蜂，一秒摇摆大约等于一公里，",
        "甚至可以数摆动次数，一秒大概十三下。",
        "他就靠破译这门语言，拿了一九七三年的诺贝尔奖。",
    ],
    [
        "现在拖动花田，舞蹈立刻跟着变。",
        "再把太阳从中午滑到傍晚：花没有动，舞却在慢慢转——",
        "蜂群用自己的生物钟，自动补偿太阳的移动。",
        "换个蜂巢方言，同一片花田就得摇得更久。",
        "最后把花拖回家门口，八字舞直接缩成一个圆舞——",
        "只剩“很近，值得去”，没有方向。",
    ],
    [
        "最好玩的是当跟随蜂。",
        "地图一黑，什么都看不见，只能读黑暗里那段舞：",
        "角度看刻度，距离掐秒表，",
        "然后点出你猜的花田位置。",
        "真实的小蜂平均差十几度、两三成距离；",
        "我这次点歪了一点，落在了隔壁田里，评级 C。",
    ],
    [
        "这门语言是写在基因里的：",
        "奥地利的蜂搬到日本，好几代之后还跳着祖先的方言。",
        "跟随蜂在黑暗里用触角贴着舞者的腹部“听”舞，",
        "后来有人干脆用激光测振仪，",
        "从巢脾表面直接读出了摆动。",
        "去玩吧，在黑暗里当一回蜜蜂。",
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
        pointer-events: none;
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-15-waggle-room</span><span class="badge">LIVE DEMO</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 22px; z-index: 2147483646;
        pointer-events: none;
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
    box = page.locator(selector).first.bounding_box()
    if not box:
        raise RuntimeError(f"element not found for cursor target: {selector}")
    return (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


def canvas_pt(page, x: float, y: float) -> tuple[float, float]:
    """Map a point in the field canvas' 640×340 design space to the screen."""
    box = page.locator("#field").bounding_box()
    return (box["x"] + x / 640 * box["width"], box["y"] + y / 340 * box["height"])


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
    """A real Playwright mouse drag: the app follows the pointer (dragging
    flowers, sliding the sun), the overlay cursor rides along, one frame per
    tick, eased so the gesture settles."""
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


def click_at(page, selector: str) -> None:
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

        def scroll_top() -> None:
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(250)

        def scroll_to(selector: str) -> None:
            page.evaluate(
                "selector => document.querySelector(selector).scrollIntoView({block:'center'})",
                selector,
            )
            page.wait_for_timeout(250)

        parked = (470, 300)                  # over the comb, off-centre
        recipe_target = ".recipe-card h2"
        slider_target = "#timeSlider"
        dialect_target = '.dialect-btn[data-key="ligustica"]'
        game_target = "#gameBtn"
        census_target = ".census-card"

        # ── Segment 1: title card, then the studio. ──────────────────────
        title = context.new_page()
        title.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=intro", wait_until="networkidle")
        add_caption_overlay(title)
        title_frames = min(round(2.8 * FPS), max(1, round(segment_durations[0] * FPS) - 1))
        for _ in range(title_frames):
            capture(title, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        scroll_top()
        set_cursor(page, parked, False)
        intro_total = max(0.1, segment_durations[0] - title_frames / FPS + SILENCE_BETWEEN)
        hold(intro_total, cursor=parked)

        # ── Segment 2: the rule, on the recipe card, back to the comb. ───
        seg2_total = segment_durations[1] + SILENCE_BETWEEN
        scroll_to(recipe_target)
        recipe_center = center_of(page, recipe_target)
        set_cursor(page, parked, False)
        move(min(0.9, seg2_total * 0.16), parked, recipe_center)
        hold(max(1.0, seg2_total * 0.55), cursor=recipe_center)
        scroll_top()
        hold(max(0.5, seg2_total - 0.9 - seg2_total * 0.55), cursor=parked)

        # ── Segment 3: drag flowers, slide the sun, dialect, round dance. ─
        scroll_top()
        seg3_total = segment_durations[2] + SILENCE_BETWEEN
        # 1) drag the flower patch to a clearly different direction
        flower_start = page.evaluate("() => __demo.flowerPx()")
        fs = canvas_pt(page, flower_start["x"], flower_start["y"])
        fe = canvas_pt(page, 221.0, 151.0)          # az 285°, 1.5 km
        move(0.45, parked, fs)
        drag(1.25, fs, fe)
        hold(0.7, cursor=fe)
        # 2) slide the sun from noon toward evening (real slider drag);
        #    the slider lives below the fold, so scroll the controls up first
        scroll_to(".controls")
        sbox = page.locator(slider_target).bounding_box()
        sx0 = sbox["x"] + sbox["width"] * 0.50      # value 12:00
        sy = sbox["y"] + sbox["height"] / 2
        sx1 = sbox["x"] + sbox["width"] * 0.83      # ≈ 16:20
        move(0.45, fe, (sx0, sy))
        drag(1.7, (sx0, sy), (sx1, sy))
        hold(0.7, cursor=(sx1, sy))
        # 3) switch the hive dialect (same card, already in view)
        dialect_center = center_of(page, dialect_target)
        move(0.5, (sx1, sy), dialect_center)
        hold(0.18, cursor=dialect_center)
        click_at(page, dialect_target)
        page.wait_for_timeout(150)
        hold(0.75, cursor=dialect_center, click_frames=round(0.25 * FPS))
        # 4) drag the flowers right onto the hive → round dance
        scroll_top()
        flower_now = page.evaluate("() => __demo.flowerPx()")
        fh = canvas_pt(page, flower_now["x"], flower_now["y"])
        hive_pt = canvas_pt(page, 320.0, 178.0)
        move(0.5, dialect_center, fh)
        drag(1.25, fh, hive_pt)
        used3 = (0.45 + 1.25 + 0.7 + 0.45 + 1.7 + 0.7 + 0.5 + 0.18 + 0.75
                 + 0.5 + 1.25)
        hold(max(0.6, seg3_total - used3 - 0.4), cursor=hive_pt)

        # ── Segment 4: the recruit game. ──────────────────────────────────
        seg4_total = segment_durations[3] + SILENCE_BETWEEN
        scroll_to(".game-card")
        game_center = center_of(page, game_target)
        set_cursor(page, game_center, False)
        move(0.3, game_center, game_center)
        hold(0.15, cursor=game_center)
        click_at(page, game_target)                # → field goes dark
        page.wait_for_timeout(150)
        hold(0.45, cursor=game_center, click_frames=round(0.45 * FPS))
        # watch the comb dance in the dark
        scroll_top()
        set_cursor(page, parked, False)
        hold(max(2.2, seg4_total * 0.22), cursor=parked)
        # then the dark field itself — the cover is the click surface, and it
        # lives below the fold at 720p, so scroll it fully into view
        scroll_to("#fieldWrap")
        set_cursor(page, parked, False)
        hold(max(1.2, seg4_total * 0.14), cursor=parked)
        # decode + click a guess: 30° clockwise off, 1.5× the true distance
        guess_canvas = page.evaluate("""() => {
          // a grade-C guess by construction (30°/50% off, with in-canvas
          // fallbacks that keep the angle error inside the C band)
          const tp = __demo.targetPx();
          const cx = 320, cy = 178;
          const inb = (x, y) => x > 15 && x < 625 && y > 12 && y < 328;
          for (const [da, k] of [[30, 1.5], [30, 1.3], [55, 1.0]]) {
            const vx = tp.x - cx, vy = tp.y - cy;
            const a = da * Math.PI / 180;
            const x = cx + (vx * Math.cos(a) - vy * Math.sin(a)) * k;
            const y = cy + (vx * Math.sin(a) + vy * Math.cos(a)) * k;
            if (inb(x, y)) return { x, y };
          }
          return { x: tp.x, y: tp.y };
        }""")
        gs = canvas_pt(page, guess_canvas["x"], guess_canvas["y"])
        move(0.5, parked, gs)
        hold(0.18, cursor=gs)
        page.mouse.click(gs[0], gs[1])              # → reveal + grade C
        page.wait_for_timeout(150)
        hold(0.8, cursor=gs, click_frames=round(0.3 * FPS))
        scroll_to(".game-card")
        score_center = center_of(page, ".game-card")
        move(0.5, gs, score_center)
        used4 = 0.3 + 0.15 + 0.45 + 0.5 + 0.18 + 0.8 + 0.5
        hold(max(0.6, seg4_total - used4 - max(2.2, seg4_total * 0.22)
                 - max(1.2, seg4_total * 0.14) - 0.4),
             cursor=score_center)

        # ── Segment 5: the census card, then the closing card. ───────────
        seg5_total = segment_durations[4]
        scroll_to(census_target)
        census_center = center_of(page, census_target)
        set_cursor(page, score_center, False)
        move(min(0.9, seg5_total * 0.16), score_center, census_center)
        hold(max(0.6, seg5_total - 0.9 - 0.3), cursor=census_center)

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
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "waggle-room-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="waggle-room-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = args.output.with_suffix(".srt")
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
    args.output.with_suffix(".json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
