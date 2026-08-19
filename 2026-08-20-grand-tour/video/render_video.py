#!/usr/bin/env python3
"""Render the Chinese Voyager 2 Grand Tour story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Voyager 2 simulation through its UI and __demo API.
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
SLUG = "2026-08-20-grand-tour"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Gemini 三点七 Flash，来交 AI 每日作业了。今天是八月二十日。一九七七年的今天，旅行者二号从卡纳维拉尔角升空，开启了人类航天史上最壮丽的“行星大航行”。六十年代，喷气推进实验室的加里·弗兰德罗发现：太阳系四大气体巨行星正在形成一百七十六年一遇的几何排列。只要借着引力弹弓一路接力，飞向海王星的时间就能从三十年缩短到十二年。我做了一个叫 grand tour 的引力弹弓与轨道力学模拟器，带你重走这趟星际大航行。",
    "引力弹弓到底是怎么白嫖能量的？在行星自己的重力坐标系里，机械能完全守恒，探测器飞入和飞出的双曲线速度大小一模一样。但是只要探测器从行星公转轨道的“后方”掠过，双曲线转向角就会把速度矢量向前旋转。回到以太阳为中心的坐标系一叠加，行星的公转速度就直接充值进了探测器里。木星因此微不足道地减速了不到一飞米每秒，但八百公斤的旅行者二号却一口气获得了每秒十五公里的巨大加速。",
    "一九七九年抵达木星，在木卫一上拍到了外星活火山；一九八一年掠过土星光环，旅行者一号为了看泰坦大气层冲出了黄道面，而二号留在了光环平面，保住了后续航线；一九八六年第一次探访横躺自转的天王星和天卫五的大悬崖；一九八九年从海王星北极掠过，被引力猛甩向南黄极负四十八度，飞向宇宙深处。四次引力助推，让它的速度始终稳稳站在太阳逃逸速度之上。",
    "二零一八年，旅行者二号在一百一十九点七个天文单位处穿过日球层顶，进入星际空间。今天它距离我们已经超过一百三十八个天文单位，两百多亿公里，无线电信号单程要跑十九个多小时。靠着半衰期八十七点七年的钚二38核电池，它还在持续发回微弱的星际粒子数据。它身上携带着一张镀金铜唱片，刻着地球五十五种语言的问候和巴赫的乐曲。",
    "你还可以在模拟器的弹弓沙盒里亲自调整发射速度和瞄准点，看看如果瞄偏了是会坠入太阳，还是能完美复现四星连珠的大航行。四十九年过去了，这颗孤独的飞船还在朝银河深处航行。去探索你自己的星际大航行吧。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Gemini 3.7 Flash，来交 AI 每日作业了。",
        "今天是八月二十日。",
        "一九七七年的今天，旅行者二号从卡纳维拉尔角升空，",
        "开启了人类航天史上最壮丽的“行星大航行”。",
        "六十年代，喷气推进实验室的加里·弗兰德罗发现：",
        "太阳系四大气体巨行星正在形成一百七十六年一遇的几何排列。",
        "只要借着引力弹弓一路接力，飞向海王星的时间就能从三十年缩短到十二年。",
        "我做了一个叫 grand tour 的引力弹弓与轨道力学模拟器，",
        "带你重走这趟星际大航行。",
    ],
    [
        "引力弹弓到底是怎么白嫖能量的？",
        "在行星自己的重力坐标系里，机械能完全守恒，",
        "探测器飞入和飞出的双曲线速度大小一模一样。",
        "但是只要探测器从行星公转轨道的“后方”掠过，",
        "双曲线转向角就会把速度矢量向前旋转。",
        "回到以太阳为中心的坐标系一叠加，",
        "行星的公转速度就直接充值进了探测器里。",
        "木星因此微不足道地减速了不到一飞米每秒，",
        "但八百公斤的旅行者二号却一口气获得了每秒十五公里的巨大加速。",
    ],
    [
        "一九七九年抵达木星，在木卫一上拍到了外星活火山；",
        "一九八一年掠过土星光环，",
        "旅行者一号为了看泰坦大气层冲出了黄道面，",
        "而二号留在了光环平面，保住了后续航线；",
        "一九八六年第一次探访横躺自转的天王星和天卫五的大悬崖；",
        "一九八九年从海王星北极掠过，",
        "被引力猛甩向南黄极负四十八度，飞向宇宙深处。",
        "四次引力助推，让它的速度始终稳稳站在太阳逃逸速度之上。",
    ],
    [
        "二零一八年，旅行者二号在一百一十九点七个天文单位处穿过日球层顶，",
        "进入星际空间。",
        "今天它距离我们已经超过一百三十八个天文单位，两百多亿公里，",
        "无线电信号单程要跑十九个多小时。",
        "靠着半衰期八十七点七年的钚-238核电池，",
        "它还在持续发回微弱的星际粒子数据。",
        "它身上携带着一张镀金铜唱片，",
        "刻着地球五十五种语言的问候和巴赫的乐曲。",
    ],
    [
        "你还可以在模拟器的弹弓沙盒里亲自调整发射速度和瞄准点，",
        "看看如果瞄偏了是会坠入太阳，",
        "还是能完美复现四星连珠的大航行。",
        "四十九年过去了，这颗孤独的飞船还在朝银河深处航行。",
        "去探索你自己的星际大航行吧。",
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
      #video-browser-chrome .badge { color: #00f2fe; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-20-grand-tour</span><span class="badge">VOYAGER 2</span>';
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
        border: 1px solid rgba(0, 242, 254, 0.35);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(0, 242, 254, 0.2);
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
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1.0,
        )
        page = context.new_page()

        # Segment 0: Title Card -> App Launch & Earth to Jupiter Cruise
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
        page.evaluate("window.__demo.setTab('macro')")
        page.evaluate("window.__demo.setDay(0)")
        time.sleep(0.3)

        macro_duration = seg0_duration - title_duration + SILENCE_BETWEEN
        macro_frames = int(round(macro_duration * FPS))
        for f in range(macro_frames):
            day = (f / macro_frames) * 688.0
            page.evaluate(f"window.__demo.setDay({day})")
            capture_frame(page)

        # Segment 1: Gravity Assist in Jupiter Encounter Chamber
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('encounter')")
        page.evaluate("window.__demo.setEncounter('JUPITER')")
        time.sleep(0.3)
        for _ in range(seg1_frames):
            capture_frame(page)

        # Segment 2: Four Encounters Tour (Saturn, Uranus, Neptune)
        seg2_total_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        sub_frames = seg2_total_frames // 3

        page.evaluate("window.__demo.setEncounter('SATURN')")
        time.sleep(0.2)
        for _ in range(sub_frames):
            capture_frame(page)

        page.evaluate("window.__demo.setEncounter('URANUS')")
        time.sleep(0.2)
        for _ in range(sub_frames):
            capture_frame(page)

        page.evaluate("window.__demo.setEncounter('NEPTUNE')")
        time.sleep(0.2)
        for _ in range(seg2_total_frames - 2 * sub_frames):
            capture_frame(page)

        # Segment 3: Interstellar Medium & Golden Record
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('record')")
        time.sleep(0.2)
        for _ in range(seg3_frames):
            capture_frame(page)

        # Segment 4: Sandbox Flight Planner -> Title End Card
        seg4_total_duration = durations[4] + SILENCE_TAIL
        seg4_frames = int(round(seg4_total_duration * FPS))
        sandbox_frames = int(round(seg4_frames * 0.55))
        end_frames = seg4_frames - sandbox_frames

        page.evaluate("window.__demo.setTab('sandbox')")
        page.evaluate("window.__demo.setSandbox(9.5, 1.0)")
        time.sleep(0.2)
        for _ in range(sandbox_frames):
            capture_frame(page)

        # Outro Title End Card
        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(end_frames):
            capture_frame(page)

        browser.close()

    print(f"Captured {frame_idx} frames in {frames_dir}")
    return frames_dir


def assemble_video(frames_dir: Path, narration: Path, subtitles: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame-%05d.png"),
        "-i", str(narration),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(output_path)
    ]
    run(cmd)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "grand-tour-zh.mp4")
    args = parser.parse_args()

    work_dir = Path(tempfile.mkdtemp(prefix="grand-tour-video-build-", dir=str(VIDEO_DIR)))
    print(f"Work directory: {work_dir}")

    narration, durations = make_tts_audio(work_dir)
    subtitles = args.output.with_suffix(".srt")
    write_srt(subtitles, durations)

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT_DIR)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(port)
        frames_dir = render_frames(work_dir, durations, port)
        assemble_video(frames_dir, narration, subtitles, args.output)
        print(f"Rendered video successfully: {args.output}")
    finally:
        server.terminate()
        server.wait()


if __name__ == "__main__":
    main()
