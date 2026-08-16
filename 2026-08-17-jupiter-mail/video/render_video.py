#!/usr/bin/env python3
"""Render the Chinese jupiter-mail story video from local browser captures and TTS.

The video is intentionally reproducible without an API key. It uses the macOS
Tingting voice, and Playwright to capture the real jupiter-mail UI while the
mail balloon is cast off from Lafayette, ballast-climbed up the Ekman wind
ladder, steered back onto the Crawfordsville bearing, and landed with the
trail rope out — ending on the delivery verdict.
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
SLUG = "2026-08-17-jupiter-mail"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月十七日，气球航空邮政日。一八五九年的今天，飞行员约翰·怀斯驾驶“木星号”气球，从印第安纳的拉斐特起飞，邮包里锁着美国第一批航空邮件：一百二十三封信，目的地纽约。我做了一个叫 jupiter-mail 的小游戏，让你亲手飞这一趟。",
    "规则只有一句话：气球没有舵，高度就是你的舵。低空的风被地面摩擦拖慢，还向左偏；爬得越高，风越向右转、越快——这就是气象学里的埃克曼螺线。右边这把风梯，就是你的方向盘：贴地飞，风往东南；爬到一千三百米，风就转向正南。想飞哪个航向，就爬到对应的高度去等它。罗盘上那段绿弧，就是今天你能压住的全部航向。",
    "但每一次转向都要花钱：放气才能下降，氢气放了就回不来；抛沙袋才能爬升，沙袋一共只有二十个。氢气还会从布缝里慢慢漏——账本上每一克都记着去向。看轨迹：先被低空的风带偏，爬上风梯之后，一点一点压回正南航向，朝克劳福兹维尔去了。",
    "快到了。先放出怀斯本人的发明——拖地绳。绳子拖在地上，一边帮你刹车，一边自动托住高度。再放一点气，让她轻轻坐下来。触地速度两米五每秒以内，邮袋完好，交给站长。剩下的路，火车替她走完。",
    "历史上怀斯飞了一个多小时，落在克劳福兹维尔，邮件再坐火车去纽约——第一次航空邮件，其实是气球加火车一起完成的。今天的风往哪吹，看你爬多高。去飞你自己的那一趟吧。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月十七日，气球航空邮政日。",
        "一八五九年的今天，飞行员约翰·怀斯驾驶“木星号”气球，",
        "从印第安纳的拉斐特起飞，",
        "邮包里锁着美国第一批航空邮件：一百二十三封信，目的地纽约。",
        "我做了一个叫 jupiter-mail 的小游戏，让你亲手飞这一趟。",
    ],
    [
        "规则只有一句话：气球没有舵，高度就是你的舵。",
        "低空的风被地面摩擦拖慢，还向左偏；",
        "爬得越高，风越向右转、越快——这就是气象学里的埃克曼螺线。",
        "右边这把风梯，就是你的方向盘：",
        "贴地飞，风往东南；爬到一千三百米，风就转向正南。",
        "想飞哪个航向，就爬到对应的高度去等它。",
        "罗盘上那段绿弧，就是今天你能压住的全部航向。",
    ],
    [
        "但每一次转向都要花钱：",
        "放气才能下降，氢气放了就回不来；",
        "抛沙袋才能爬升，沙袋一共只有二十个。",
        "氢气还会从布缝里慢慢漏——账本上每一克都记着去向。",
        "看轨迹：先被低空的风带偏，",
        "爬上风梯之后，一点一点压回正南航向，朝克劳福兹维尔去了。",
    ],
    [
        "快到了。先放出怀斯本人的发明——拖地绳。",
        "绳子拖在地上，一边帮你刹车，一边自动托住高度。",
        "再放一点气，让她轻轻坐下来。",
        "触地速度两米五每秒以内，邮袋完好，交给站长。",
        "剩下的路，火车替她走完。",
    ],
    [
        "历史上怀斯飞了一个多小时，落在克劳福兹维尔，",
        "邮件再坐火车去纽约——",
        "第一次航空邮件，其实是气球加火车一起完成的。",
        "今天的风往哪吹，看你爬多高。",
        "去飞你自己的那一趟吧。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-17-jupiter-mail</span><span class="badge">LIVE DEMO</span>';
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
        border: 2px solid #b0472a; border-radius: 50%; opacity: 0;
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

        def fly(seconds: float, rate: float,
                cursor: tuple[float, float] | None = None) -> None:
            """Advance the autopilot deterministically, one frame each."""
            nonlocal frame_number, timeline
            frames = max(1, round(seconds * FPS))
            for _ in range(frames):
                page.evaluate(
                    "(dt) => window.__demo.navStep(dt, { dtStep: dt })", rate / FPS)
                capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, cursor)
                frame_number += 1
                timeline += 1 / FPS

        def jump(sim_seconds: float) -> None:
            """Skip flight time without capturing (hidden by the narration cut)."""
            page.evaluate("(s) => window.__demo.navStep(s)", sim_seconds)

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

        # ── Segment 2: cast off, climb, the ladder is the steering wheel ──
        seg2 = segment_durations[1] + SILENCE_BETWEEN
        launch = btn_center(page, "launchBtn")
        move(0.7, parked, (launch["x"], launch["y"]))
        used = 0.7
        page.evaluate("() => window.__demo.launch()")
        hold(0.4, cursor=(launch["x"], launch["y"]), click_frames=round(0.4 * FPS))
        used += 0.4
        # a real bag drop to show the one-way wallet
        bag = btn_center(page, "ballastBtn")
        move(0.6, (launch["x"], launch["y"]), (bag["x"], bag["y"]))
        used += 0.6
        page.evaluate("() => window.__demo.dropBag()")
        hold(0.35, cursor=(bag["x"], bag["y"]), click_frames=round(0.35 * FPS))
        used += 0.35
        # point at the ladder/compass while she climbs at 6×
        ladder = page.evaluate(
            """() => { const r = document.getElementById('ladder').getBoundingClientRect();
                 return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }""")
        move(0.6, (bag["x"], bag["y"]), (ladder["x"], ladder["y"]))
        used += 0.6
        fly(max(0.2, seg2 - used), 6, cursor=(ladder["x"], ladder["y"]))

        # ── Segment 3: the cruise, track bends back south (cut + 20×) ────
        seg3 = segment_durations[2] + SILENCE_BETWEEN
        jump(900)                                    # hours pass between cuts
        # rope button gets pointed at while the wallets drain
        rope = btn_center(page, "ropeBtn")
        move(0.6, (ladder["x"], ladder["y"]), (rope["x"], rope["y"]))
        used = 0.6
        fly(max(0.2, seg3 - used), 20, cursor=(rope["x"], rope["y"]))

        # ── Segment 4: arrival — rope, valve, touchdown, verdict ──────────
        seg4 = segment_durations[3] + SILENCE_BETWEEN
        t_now = page.evaluate("() => window.__demo.state().t")
        jump(max(0.0, 4560 - t_now))                 # cut to just before arrival
        move(0.6, (rope["x"], rope["y"]), parked)
        used = 0.6
        # the rope goes out (real click; autopilot would arm it anyway)
        move(0.6, parked, (rope["x"], rope["y"]))
        used += 0.6
        page.evaluate("() => window.__demo.setRope(true)")
        hold(0.35, cursor=(rope["x"], rope["y"]), click_frames=round(0.35 * FPS))
        used += 0.35
        # descend and land at 12×; on touchdown the verdict appears on its own
        remaining = max(0.2, seg4 - used)
        frames = max(1, round(remaining * FPS))
        for _ in range(frames):
            page.evaluate("(dt) => window.__demo.navStep(dt, { dtStep: dt })", 12 / FPS)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues,
                    (rope["x"], rope["y"]))
            frame_number += 1
            timeline += 1 / FPS
        page.wait_for_timeout(250)

        # ── Segment 5: the verdict, then the end card ─────────────────────
        seg5 = segment_durations[4]
        hold(max(0.2, seg5 - 1.6), cursor=None)

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
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "jupiter-mail-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="jupiter-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = VIDEO_DIR / "jupiter-mail-zh.srt"
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
    (VIDEO_DIR / "jupiter-mail-zh.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
