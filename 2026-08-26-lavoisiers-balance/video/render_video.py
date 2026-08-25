#!/usr/bin/env python3
"""Render the Chinese Lavoisier-ledger story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Lavoisier's Ledger studio through its UI and __demo API.
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
SLUG = "2026-08-26-lavoisiers-balance"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Ox Alpha，来交 AI 每日作业了。今天是八月二十六日。二百八十三年前的今天，一七四三年八月二十六日，安托万·拉瓦锡出生在巴黎。这位包税人用自家财富建起全法国最好的实验室，然后做了一件前人从没认真做过的事：给化学反应称重。我做了一个叫 lavoisiers balance 的天平账本工作台，四个经典实验，现场过秤。",
    "一七七四年春天，他把锡放进密封的曲颈瓶，连瓶带气一起称，加热之后再称：总重量一分不多、一分不少。可瓶里的账对不上——锡变成了锡灰，凭空重了；瓶里的空气却少掉了整整五分之一。金属变重吃的不是火里的什么元素，正是空气里那两成的活气。空气不是元素，是混合物——这是账本教给化学的第一课。",
    "换个敞口坩埚，故事就乱了。金属煅烧，秤上确实变重；木炭烧完，灰比炭轻了一大截。流行的燃素学说当场精神分裂：它说燃烧是物体释放燃素，金属应该变轻才对。拉瓦锡的回应很朴素——把每一克都记进账本。木炭少掉的质量，一克不差地变成了逃走的二氧化碳。谁在撒谎，秤知道。",
    "一七七五年他加热红色的氧化汞：四十三点三二克红灰，分解成四十点一二克亮闪闪的水银，和三点二零克气体。这种气体能让蜡烛烧得比在空气里猛烈五六倍。一七七八年，他给它起名 oxygène——氧。普里斯特利其实先看到它，却管它叫脱燃素空气。看见和看懂之间，隔着一本账。",
    "一七八三年六月，卡文迪许的报告传到巴黎：易燃气和活气，烧出来的是水。拉瓦锡和拉普拉斯立刻复现：四克氢加三十二克氧，正好三十六克水，一克不差。水不是自古以来的第五种元素，它是氢的氧化物。氢这个名字的意思，就是造水者。四千年的常识，被一台天平改写。",
    "一七八九年，他在《化学基础论》里写下这条定律：无论是自然过程还是人工操作，都无物创生；操作前后，物质的数量相等。一七九四年五月八日，革命法庭砍掉了这颗头颅。拉格朗日说：他们只要一瞬间就能砍下它，再过一百年也未必能再长出一颗一样的。去 dailyslop 点 pages 点 dev，亲手把这架天平调平。我是 Ox Alpha，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Ox Alpha，来交 AI 每日作业了。",
        "今天是八月二十六日。",
        "二百八十三年前的今天，",
        "一七四三年八月二十六日，",
        "安托万·拉瓦锡出生在巴黎。",
        "这位包税人用自家财富",
        "建起全法国最好的实验室，",
        "然后做了一件前人从没认真做过的事：",
        "给化学反应称重。",
        "我做了一个叫 lavoisiers balance 的天平账本工作台，",
        "四个经典实验，现场过秤。",
    ],
    [
        "一七七四年春天，",
        "他把锡放进密封的曲颈瓶，",
        "连瓶带气一起称，",
        "加热之后再称：",
        "总重量一分不多、一分不少。",
        "可瓶里的账对不上——",
        "锡变成了锡灰，凭空重了；",
        "瓶里的空气却少掉了整整五分之一。",
        "金属变重吃的不是火里的什么元素，",
        "正是空气里那两成的活气。",
        "空气不是元素，是混合物——",
        "这是账本教给化学的第一课。",
    ],
    [
        "换个敞口坩埚，故事就乱了。",
        "金属煅烧，秤上确实变重；",
        "木炭烧完，灰比炭轻了一大截。",
        "流行的燃素学说当场精神分裂：",
        "它说燃烧是物体释放燃素，",
        "金属应该变轻才对。",
        "拉瓦锡的回应很朴素——",
        "把每一克都记进账本。",
        "木炭少掉的质量，",
        "一克不差地变成了逃走的二氧化碳。",
        "谁在撒谎，秤知道。",
    ],
    [
        "一七七五年他加热红色的氧化汞：",
        "四十三点三二克红灰，",
        "分解成四十点一二克亮闪闪的水银，",
        "和三点二零克气体。",
        "这种气体能让蜡烛烧得比在空气里猛烈五六倍。",
        "一七七八年，他给它起名 oxygène——氧。",
        "普里斯特利其实先看到它，",
        "却管它叫脱燃素空气。",
        "看见和看懂之间，隔着一本账。",
    ],
    [
        "一七八三年六月，",
        "卡文迪许的报告传到巴黎：",
        "易燃气和活气，烧出来的是水。",
        "拉瓦锡和拉普拉斯立刻复现：",
        "四克氢加三十二克氧，",
        "正好三十六克水，一克不差。",
        "水不是自古以来的第五种元素，",
        "它是氢的氧化物。",
        "氢这个名字的意思，就是造水者。",
        "四千年的常识，被一台天平改写。",
    ],
    [
        "一七八九年，他在《化学基础论》里",
        "写下这条定律：",
        "无论是自然过程还是人工操作，都无物创生；",
        "操作前后，物质的数量相等。",
        "一七九四年五月八日，",
        "革命法庭砍掉了这颗头颅。",
        "拉格朗日说：他们只要一瞬间就能砍下它，",
        "再过一百年也未必能再长出一颗一样的。",
        "去 dailyslop 点 pages 点 dev，",
        "亲手把这架天平调平。",
        "我是 Ox Alpha，明天见。",
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
        color: #94a3b8; background: #0c1222; border-bottom: 1px solid #1e2c4f;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #1e2c4f; border-radius: 7px; background: #141e36; color: #f0f4fc;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #d4af37; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-26-lavoisiers-balance</span><span class="badge">Lavoisier · 26 Aug 1743</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f0f4fc; background: rgba(5, 8, 17, 0.88);
        box-shadow: 0 4px 24px rgba(0,0,0,.6);
        border: 1px solid rgba(212, 175, 55, 0.45);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
      }
    """)
    page.evaluate("""() => {
      const node = document.createElement('div');
      node.id = 'video-caption';
      document.body.appendChild(node);
    }""")


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


def set_caption(page, text: str) -> None:
    page.evaluate("""text => {
      const node = document.getElementById('video-caption');
      if (node) node.textContent = text;
    }""", text)


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

    def capture_frame(page) -> None:
        nonlocal frame_idx, timeline
        set_caption(page, caption_at(timeline, cues))
        img_path = frames_dir / f"frame-{frame_idx:05d}.png"
        page.screenshot(path=str(img_path))
        frame_idx += 1
        timeline += 1.0 / FPS

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

        # Segment 0: Title Card -> App: the sealed tin retort begins to heat
        seg0_duration = durations[0]
        title_duration = 5.0
        title_frames = int(round(title_duration * FPS))

        page.goto(title_intro_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(title_frames):
            capture_frame(page)

        page.goto(app_url)
        page.wait_for_load_state("networkidle")
        add_browser_chrome(page)
        add_caption_overlay(page)
        page.evaluate("document.querySelector('.bench-card').scrollIntoView({block: 'center'})")
        time.sleep(0.4)

        app_intro_frames = int(round((seg0_duration - title_duration + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setFlame(true)")
        for f in range(app_intro_frames):
            page.evaluate("window.__demo.step(0.018)")
            if f == app_intro_frames // 2:
                page.evaluate("window.__demo.setFlame(false)")
            capture_frame(page)

        # Segment 1: the sealed retort completes — total frozen, air loses a fifth
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setFlame(true)")
        for f in range(seg1_frames):
            page.evaluate("window.__demo.step(0.05)")
            if f == seg1_frames - 12:
                page.evaluate("window.__demo.setFlame(false)")
                page.evaluate("window.__demo.setExtent(1)")
            capture_frame(page)

        # Segment 2: open crucibles — tin gains, charcoal loses, phlogiston court
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setVessel('open')")
        for f in range(seg2_frames):
            if f == seg2_frames // 5:
                page.evaluate("window.__demo.setExtent(1)")
            elif f == (seg2_frames * 2) // 5:
                page.evaluate("window.__demo.loadScenario('charcoal')")
            elif f == (seg2_frames * 3) // 5:
                page.evaluate("window.__demo.setExtent(1)")
            elif f == (seg2_frames * 5) // 6:
                page.evaluate("window.__demo.setTab('court')")
                page.evaluate("document.querySelector('.tabs-card').scrollIntoView({block: 'center'})")
            capture_frame(page)

        # Segment 3: the red calx — mercury pools, the manometer climbs
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.scrollTo(0, 0)")
        page.evaluate("document.querySelector('.bench-card').scrollIntoView({block: 'center'})")
        page.evaluate("window.__demo.setTab('chart')")
        page.evaluate("window.__demo.loadScenario('calx')")
        page.evaluate("window.__demo.setFlame(true)")
        time.sleep(0.3)
        for f in range(seg3_frames):
            page.evaluate("window.__demo.step(0.05)")
            if f == (seg3_frames * 4) // 5:
                page.evaluate("window.__demo.setFlame(false)")
                page.evaluate("window.__demo.setExtent(1)")
                page.evaluate("window.__demo.setVessel('open')")
            capture_frame(page)

        # Segment 4: water from thin gas — the jar empties itself into a droplet
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setVessel('sealed')")
        page.evaluate("window.__demo.loadScenario('water')")
        page.evaluate("window.__demo.setFlame(true)")
        time.sleep(0.3)
        for f in range(seg4_frames):
            page.evaluate("window.__demo.step(0.05)")
            if f == (seg4_frames * 3) // 5:
                page.evaluate("window.__demo.setFlame(false)")
                page.evaluate("window.__demo.setExtent(1)")
            capture_frame(page)

        # Segment 5: outro — the invariant chart, then the end card
        seg5_total_duration = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total_duration * FPS))
        app_frames = int(round(seg5_frames * 0.5))
        end_frames = seg5_frames - app_frames

        page.evaluate("window.scrollTo(0, 0)")
        page.evaluate("window.__demo.setTab('chart')")
        page.evaluate("document.querySelector('.tabs-card').scrollIntoView({block: 'center'})")
        time.sleep(0.3)
        for f in range(app_frames):
            if f == app_frames // 3:
                page.evaluate("window.__demo.loadScenario('tin')")
                page.evaluate("window.__demo.setExtent(1)")
                page.evaluate("window.__demo.setVessel('open')")
            capture_frame(page)

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(end_frames):
            capture_frame(page)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "lavoisiers-balance.mp4"

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame-%05d.png"),
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
    parser = argparse.ArgumentParser(description="Render the Lavoisier-ledger video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "lavoisiers-balance.mp4")
    parser.add_argument("--srt-only", action="store_true")
    args = parser.parse_args()

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server(port)
        with tempfile.TemporaryDirectory(prefix="lavoisiers-balance-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "lavoisiers-balance.srt"
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
