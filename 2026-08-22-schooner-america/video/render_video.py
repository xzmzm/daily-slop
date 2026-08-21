#!/usr/bin/env python3
"""Render the Chinese 1851 Schooner America story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Schooner America simulation through its UI and __demo API.
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
WIDTH = 1920
HEIGHT = 1080
SILENCE_BETWEEN = 0.24
SILENCE_TAIL = 1.6
PROJECT_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = PROJECT_DIR.parent
VIDEO_DIR = Path(__file__).resolve().parent
SLUG = "2026-08-22-schooner-america"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Gemini 三点七 Flash，来交 AI 每日作业了。今天是八月二十二日。一百七十五年前的一八五一年今天，英国皇家游艇中队在怀特岛举办了一场五十三英里的环岛帆船赛，也就是美洲杯帆船赛的前身。当时大英帝国的十四艘顶尖快艇志在必得，而来自大西洋彼岸的只有一艘黑色的美国双桅帆船——美洲号。我做了一个叫 schooner america 的帆船气动与水动力学模拟器，带你看看一百七十五年前这艘传奇帆船是如何用划时代的物理设计改写航海历史的。",
    "当时英国船厂推崇数百年的造船圣经叫“鳕鱼头、鲭鱼尾”，也就是船头圆钝粗大、最大船宽靠前。这种船在顺风时很稳，但一遇到迎风切浪，巨大的首波阻力就会随船速四次方暴增，形成一道不可逾越的“兴波阻力墙”。而设计师乔治·斯蒂尔斯采用了当时极富争议的“波浪线理论”，给美洲号造了一个修长内凹的空心船首，将最大船宽后移到船身百分之五十五处。这种空心船首像锋利的刀片一样切开怀特岛的风浪，极大地降低了兴波阻力系数。",
    "不仅船体领先，美洲号的帆布也是降维打击。英国快艇使用的是传统亚麻帆布，受风后会被吹成松垮沉重的大肚囊，产生巨大的寄生阻力与横向倾侧力，导致迎风最大夹角只能勉强达到四十八度以上。而美洲号使用了美国马萨诸塞州机器精织的紧密平织棉帆布，在高风压下依然能保持平整优美的高升力机翼剖面。在模拟器里你可以看到，平整的棉帆拥有极高的升阻比，让美洲号在逆风时能压到三十八度极限顶风航行。",
    "帆船在水上的实际航速由极坐标性能图 Polar Diagram 和对风航速 VMG 决定。在模拟器右侧的极坐标图上，你可以实时观察到美洲号与英国极速快艇极坐标包络线的对比。当两艘船都在逆风抢风航行时，美洲号不仅航速更快，而且迎风角更小，切线上的最佳上风对风航速 VMG 高达八节以上，在每一次换舷调向中都在成倍拉开距离。",
    "当美洲号以领先十八分钟的压倒性优势率先冲过考斯终点线时，在皇家蒸汽游艇上观战的维多利亚女王问身旁的信号长：“第二名是谁？”信号长留下了那句载入史册的回答：“陛下，没有第二名。”一百七十五年过去了，这台模拟器把十九世纪帆船巅峰的空气动力学流线、开尔文首波与极坐标航速真实呈现在你眼前。去亲自掌舵这艘无敌传奇吧。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Gemini 3.7 Flash，来交 AI 每日作业了。",
        "今天是八月二十二日。",
        "一百七十五年前的一八五一年今天，",
        "英国皇家游艇中队在怀特岛举办了一场五十三英里的环岛帆船赛，",
        "也就是美洲杯帆船赛的前身。",
        "当时大英帝国的十四艘顶尖快艇志在必得，",
        "而来自大西洋彼岸的只有一艘黑色的美国双桅帆船——美洲号。",
        "我做了一个叫 schooner america 的帆船气动与水动力学模拟器，",
        "带你看看一百七十五年前这艘传奇帆船是如何改写航海历史的。",
    ],
    [
        "当时英国船厂推崇数百年的造船圣经叫“鳕鱼头、鲭鱼尾”，",
        "也就是船头圆钝粗大、最大船宽靠前。",
        "这种船在顺风时很稳，但一遇到迎风切浪，",
        "巨大的首波阻力就会随船速四次方暴增，",
        "形成一道不可逾越的“兴波阻力墙”。",
        "而设计师乔治·斯蒂尔斯采用了当时极富争议的“波浪线理论”，",
        "给美洲号造了一个修长内凹的空心船首，",
        "将最大船宽后移到船身百分之五十五处。",
        "这种空心船首像锋利的刀片一样切开风浪，极大地降低了兴波阻力。",
    ],
    [
        "不仅船体领先，美洲号的帆布也是降维打击。",
        "英国快艇使用的是传统亚麻帆布，",
        "受风后会被吹成松垮沉重的大肚囊，产生巨大的寄生阻力与横向倾侧力，",
        "导致迎风最大夹角只能勉强达到四十八度以上。",
        "而美洲号使用了机器精织的紧密平织棉帆布，",
        "在高风压下依然能保持平整优美的高升力机翼剖面。",
        "在模拟器里你可以看到，平整的棉帆拥有极高的升阻比，",
        "让美洲号在逆风时能压到三十八度极限顶风航行。",
    ],
    [
        "帆船在水上的实际航速由极坐标性能图与对风航速 VMG 决定。",
        "在模拟器右侧的极坐标图上，",
        "你可以实时观察到美洲号与英国极速快艇极坐标包络线的对比。",
        "当两艘船都在逆风抢风航行时，",
        "美洲号不仅航速更快，而且迎风角更小，",
        "切线上的最佳上风对风航速 VMG 高达八节以上，",
        "在每一次换舷调向中都在成倍拉开距离。",
    ],
    [
        "当美洲号以领先十八分钟的压倒性优势率先冲过考斯终点线时，",
        "在皇家游艇上观战的维多利亚女王问身旁的信号长：“第二名是谁？”",
        "信号长留下了那句载入史册的回答：“陛下，没有第二名。”",
        "一百七十五年过去了，这台模拟器把十九世纪帆船巅峰的空气动力学流线、",
        "开尔文首波与极坐标航速真实呈现在你眼前。",
        "去亲自掌舵这艘无敌传奇吧。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-22-schooner-america</span><span class="badge">AMERICA 1851</span>';
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

    narration = work_dir / "narration.wav"
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

        # Segment 0: Title Card -> App Launch & 1851 Regatta Start
        seg0_duration = durations[0]
        title_duration = 5.0
        title_frames = int(round(title_duration * FPS))

        page.goto(title_intro_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(title_frames):
            capture_frame(page)

        # Transition to app
        page.goto(app_url)
        page.wait_for_load_state("networkidle")
        add_browser_chrome(page)
        add_caption_overlay(page)
        page.evaluate("window.__demo.loadScenario('historic-1851')")
        time.sleep(0.3)

        app_intro_duration = seg0_duration - title_duration + SILENCE_BETWEEN
        app_intro_frames = int(round(app_intro_duration * FPS))
        for f in range(app_intro_frames):
            if f == app_intro_frames // 3:
                page.evaluate("window.__demo.setRudder(5.0)")
            elif f == (app_intro_frames * 2) // 3:
                page.evaluate("window.__demo.setRudder(0.0)")
            capture_frame(page)

        # Segment 1: Wave Line Hollow Bow vs Cod's Head Duel
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        half1 = seg1_frames // 2
        page.evaluate("window.__demo.loadScenario('bow-wave-duel')")
        time.sleep(0.2)
        for f in range(seg1_frames):
            if f == half1:
                # Switch back to America to show the clean hollow bow wave
                page.evaluate("window.__demo.setHull('america')")
            capture_frame(page)

        # Segment 2: Flat Cotton Canvas vs Baggy Flax Stall Lab
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        half2 = seg2_frames // 2
        page.evaluate("window.__demo.loadScenario('sail-stall-lab')")
        time.sleep(0.2)
        for f in range(seg2_frames):
            if f == half2:
                # Switch to America with flat cotton auto-trim
                page.evaluate("window.__demo.loadScenario('upwind-beat')")
            capture_frame(page)

        # Segment 3: Polar Velocity Diagram & Upwind VMG
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadScenario('beam-reach')")
        time.sleep(0.2)
        half3 = seg3_frames // 2
        for f in range(seg3_frames):
            if f == half3:
                # Steer upwind to highlight optimal VMG tangent
                page.evaluate("window.__demo.loadScenario('upwind-beat')")
            capture_frame(page)

        # Segment 4: Historic Victory & Outro Card
        seg4_total_duration = durations[4] + SILENCE_TAIL
        seg4_frames = int(round(seg4_total_duration * FPS))
        sprint_frames = int(round(seg4_frames * 0.55))
        end_frames = seg4_frames - sprint_frames

        page.evaluate("window.__demo.loadScenario('beam-reach')")
        time.sleep(0.2)
        for f in range(sprint_frames):
            capture_frame(page)

        # Outro Title Card
        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(end_frames):
            capture_frame(page)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "schooner-america.mp4"

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
    parser = argparse.ArgumentParser(description="Render the 1851 Schooner America video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "schooner-america.mp4")
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
        with tempfile.TemporaryDirectory(prefix="schooner-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "schooner-america.srt"
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
