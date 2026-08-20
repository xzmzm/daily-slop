#!/usr/bin/env python3
"""Render the Chinese 1888 Burroughs Adding Machine story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Burroughs simulation through its UI and __demo API.
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
SLUG = "2026-08-21-burroughs-adder"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Gemini 三点七 Flash，来交 AI 每日作业了。今天是八月二十一日。一八八八年的今天，美国发明家威廉·伯罗斯获得了机械计算器的核心专利。十九世纪的银行职员每天要在昏暗的煤气灯下人工心算十几小时的账本，算错一行就要全部重来。伯罗斯自己就因为过度劳累患上了肺结核，于是辞职下决心做出一台绝对精准且能打印纸带的计算机器。我做了一个叫 burroughs adder 的机械计算器与内部剖面模拟器，带你看看一百多年前的机械算力巅峰。",
    "为什么早期的齿轮加法器在银行总是算错？因为人手拉动摇把的力量太不稳定了。脾气急躁的职员猛地一拽，齿轮由于巨大惯性就会“冲过头”，多转一两格，也就是机械学上的“动量过冲”。伯罗斯最绝妙的发明，就是在机器底部装了一个充满蓖麻油的液压阻尼器。活塞上的微孔让油产生与速度成正比的粘滞阻力，不管职员用多大蛮力拉摇把，齿条复位速度都被恒定锁死在安全转速之内。",
    "这台机器的内部运转由精密的“四相机械循环”驱动。第一阶段拉动摇把，扇形齿条向下坠落，直到撞上按下的按键限位销；第二阶段打字锤猛击色带，在纸带上打出数字，同时计数轮与齿条啮合；第三阶段阻尼复位，齿条向上归位带动计数轮向前旋转对应的齿数，经过数字九时触发进位锁扣；第四阶段进位凸轮从右向左依次横扫，把每一位的满十进一像波浪一样平稳推过去。",
    "纯机械结构是怎么打印总账并清零的？如果按下 Total 总计键，啮合时机就会完全反转：计数齿轮在“下冲程”就提前啮合，被齿条倒转倒回到零位挡块，把累加器的数值直接赋给打字锤打出带星号的总额，随后齿轮脱开，寄存器就神奇地完成了一键清零！而在重复加法模式下，按键不会自动弹起，连续拉动摇把就能用机械累加完成四位数乘法。",
    "你还可以在模拟器里把油压阻尼器调到零，亲眼看看不加阻尼时齿轮过冲导致算错账的翻车现场，或者进入慢动作剖面视角，观察每一个齿轮、进位爪和油压活塞的跳动。一百三十八年前的手摇机械，开启了人类自动化计算的大门。去试试这台十九世纪的工业杰作吧。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Gemini 3.7 Flash，来交 AI 每日作业了。",
        "今天是八月二十一日。",
        "一八八八年的今天，美国发明家威廉·伯罗斯获得了机械计算器的核心专利。",
        "十九世纪的银行职员每天要在昏暗的煤气灯下人工心算十几小时的账本，",
        "算错一行就要全部重来。",
        "伯罗斯自己就因为过度劳累患上了肺结核，",
        "于是辞职下决心做出一台绝对精准且能打印纸带的计算机器。",
        "我做了一个叫 burroughs adder 的机械计算器与内部剖面模拟器，",
        "带你看看一百多年前的机械算力巅峰。",
    ],
    [
        "为什么早期的齿轮加法器在银行总是算错？",
        "因为人手拉动摇把的力量太不稳定了。",
        "脾气急躁的职员猛地一拽，齿轮由于巨大惯性就会“冲过头”，",
        "多转一两格，也就是机械学上的“动量过冲”。",
        "伯罗斯最绝妙的发明，",
        "就是在机器底部装了一个充满蓖麻油的液压阻尼器。",
        "活塞上的微孔让油产生与速度成正比的粘滞阻力，",
        "不管职员用多大蛮力拉摇把，",
        "齿条复位速度都被恒定锁死在安全转速之内。",
    ],
    [
        "这台机器的内部运转由精密的“四相机械循环”驱动。",
        "第一阶段拉动摇把，扇形齿条向下坠落，",
        "直到撞上按下的按键限位销；",
        "第二阶段打字锤猛击色带，在纸带上打出数字，",
        "同时计数轮与齿条啮合；",
        "第三阶段阻尼复位，齿条向上归位带动计数轮向前旋转对应的齿数，",
        "经过数字九时触发进位锁扣；",
        "第四阶段进位凸轮从右向左依次横扫，",
        "把每一位的满十进一像波浪一样平稳推过去。",
    ],
    [
        "纯机械结构是怎么打印总账并清零的？",
        "如果按下 Total 总计键，啮合时机就会完全反转：",
        "计数齿轮在“下冲程”就提前啮合，",
        "被齿条倒转倒回到零位挡块，",
        "把累加器的数值直接赋给打字锤打出带星号的总额，",
        "随后齿轮脱开，寄存器就神奇地完成了一键清零！",
        "而在重复加法模式下，按键不会自动弹起，",
        "连续拉动摇把就能用机械累加完成四位数乘法。",
    ],
    [
        "你还可以在模拟器里把油压阻尼器调到零，",
        "亲眼看看不加阻尼时齿轮过冲导致算错账的翻车现场，",
        "或者进入慢动作剖面视角，",
        "观察每一个齿轮、进位爪和油压活塞的跳动。",
        "一百三十八年前的手摇机械，开启了人类自动化计算的大门。",
        "去试试这台十九世纪的工业杰作吧。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-21-burroughs-adder</span><span class="badge">BURROUGHS 1888</span>';
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

        # Segment 0: Title Card -> App Launch & Basic Addition
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
        page.evaluate("window.__demo.setNumber(12550)")
        time.sleep(0.3)

        app_intro_duration = seg0_duration - title_duration + SILENCE_BETWEEN
        app_intro_frames = int(round(app_intro_duration * FPS))
        crank_mid = app_intro_frames // 2
        for f in range(app_intro_frames):
            if f == crank_mid:
                page.evaluate("window.__demo.pullHandle(1.0)")
            capture_frame(page)

        # Segment 1: Dashpot & Inertial Overthrow Lab
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadScenario('dashpot-fail')")
        time.sleep(0.2)
        half1 = seg1_frames // 2
        for f in range(seg1_frames):
            if f == 5:
                page.evaluate("window.__demo.pullHandle(2.2)") # Fast un-damped pull!
            elif f == half1:
                # Restore dashpot viscosity
                page.evaluate("window.__demo.setViscosity(1.0)")
                page.evaluate("window.__demo.setNumber(45000)")
                page.evaluate("window.__demo.pullHandle(1.0)")
            capture_frame(page)

        # Segment 2: Four-Phase Cycle & Cutaway X-Ray Slow-Mo
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setSpeed(0.25)") # Slow-Mo
        page.evaluate("window.__demo.setNumber(760)")
        page.evaluate("window.__demo.pullHandle(1.0)")
        time.sleep(0.2)
        for _ in range(seg2_frames):
            capture_frame(page)

        # Segment 3: Tens-Carry Cascade & Total Clearing
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setSpeed(0.2)")
        page.evaluate("window.__demo.loadScenario('carry-cascade')")
        time.sleep(0.2)
        half3 = seg3_frames // 2
        for f in range(seg3_frames):
            if f == 5:
                page.evaluate("window.__demo.pullHandle(1.0)") # Ripple 99999999 + 1
            elif f == half3:
                # Press Total (*) and clear register
                page.evaluate("window.__demo.setSpeed(0.8)")
                page.evaluate("window.__demo.pressTotal()")
                page.evaluate("window.__demo.pullHandle(1.0)")
            capture_frame(page)

        # Segment 4: Repeat Multiplication & Outro Card
        seg4_total_duration = durations[4] + SILENCE_TAIL
        seg4_frames = int(round(seg4_total_duration * FPS))
        mult_frames = int(round(seg4_frames * 0.55))
        end_frames = seg4_frames - mult_frames

        page.evaluate("window.__demo.setSpeed(1.0)")
        page.evaluate("window.__demo.loadScenario('repeat-mult')")
        time.sleep(0.2)
        pull_interval = mult_frames // 4
        for f in range(mult_frames):
            if f > 0 and f % pull_interval == 0:
                page.evaluate("window.__demo.pullHandle(1.0)")
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
    temp_mp4 = work_dir / "burroughs-adder.mp4"

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
    parser = argparse.ArgumentParser(description="Render the 1888 Burroughs Adding Machine video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "burroughs-adder.mp4")
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
        with tempfile.TemporaryDirectory(prefix="burroughs-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "burroughs-adder.srt"
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
