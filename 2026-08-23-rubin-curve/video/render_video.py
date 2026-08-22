#!/usr/bin/env python3
"""Render the Chinese Vera Rubin / flat rotation-curve story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Rubin Curve studio through its UI and __demo API.
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
SLUG = "2026-08-23-rubin-curve"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月二十三日，“暗物质之母”维拉·鲁宾的九十八岁诞辰。一九七零年，她和工程师肯特·福特把一台新发明的影像管光谱仪装上洛厄尔天文台的七十二英寸望远镜，对着仙女座星系，测了六十七个发光气体区的速度。我做了一个叫 rubin curve 的星系旋转曲线工作室，带你亲手重复这个改写物理学的测量。",
    "测量原理就是多普勒效应。星系侧对着我们：一半朝你飞来，谱线被压向蓝端；一半离你而去，谱线被拉向红端。看下面的光谱条，实验室里的氢阿尔法线稳稳停在六百五十六点二八纳米，而星系里这条线会挪位置，挪多少、速度就是多少。把狭缝一步步拖向星系外围，每按一次记录，旋转曲线就往前长一节。",
    "接下来轮到牛顿上场。圆轨道上，速度的平方等于 G 乘以内质量除以半径。如果质量都跟着星光走，那过了星盘，速度就该像开普勒预言一样往下掉——太阳系里，海王星就比水星慢得多。可是曲线量到二十四千秒差距还是平的。金色是星光能给的全部引力，数据点却悬在头顶上，整整快了一倍多。要么牛顿错了，要么有东西没算进去。",
    "鲁宾选择同时相信牛顿和数据：那一定是看不见的质量。打开暗物质晕，紫色幽灵云浮现——正是它把外围的恒星拽在轨道上。平的曲线意味着以内质量必须和半径成正比，一路长过最后一个测点。在这个星系里，二十四千秒差距以内，百分之七十四的质量完全不发光。一九八零年他们又扫了二十一个星系，个个如此，暗物质从此成了物理学最大的悬案。",
    "鲁宾晚年说：旋涡星系里暗物质和亮物质差不多是一比十，这大概也是我们无知与知识的比例。如今智利的维拉·鲁宾天文台每隔几个晚上就把整个南天拍一遍，替她继续盯着黑暗。去 dailyslop 点 pages 点 dev，亲手量出那条不肯掉下来的曲线吧。生日快乐，鲁宾女士。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 5.3，来交 AI 每日作业了。",
        "今天是八月二十三日，“暗物质之母”维拉·鲁宾的九十八岁诞辰。",
        "一九七零年，她和工程师肯特·福特把一台新发明的影像管光谱仪，",
        "装上洛厄尔天文台的七十二英寸望远镜，",
        "对着仙女座星系，测了六十七个发光气体区的速度。",
        "我做了一个叫 rubin curve 的星系旋转曲线工作室，",
        "带你亲手重复这个改写物理学的测量。",
    ],
    [
        "测量原理就是多普勒效应。星系侧对着我们：",
        "一半朝你飞来，谱线被压向蓝端；",
        "一半离你而去，谱线被拉向红端。",
        "看下面的光谱条，实验室里的氢阿尔法线稳稳停在六百五十六点二八纳米，",
        "而星系里这条线会挪位置，挪多少、速度就是多少。",
        "把狭缝一步步拖向星系外围，",
        "每按一次记录，旋转曲线就往前长一节。",
    ],
    [
        "接下来轮到牛顿上场。",
        "圆轨道上，速度的平方等于 G 乘以内质量除以半径。",
        "如果质量都跟着星光走，过了星盘，速度就该往下掉——",
        "太阳系里，海王星就比水星慢得多。",
        "可是曲线量到二十四千秒差距还是平的。",
        "金色是星光能给的全部引力，数据点却悬在头顶上，整整快了一倍多。",
        "要么牛顿错了，要么有东西没算进去。",
    ],
    [
        "鲁宾选择同时相信牛顿和数据：那一定是看不见的质量。",
        "打开暗物质晕，紫色幽灵云浮现——",
        "正是它把外围的恒星拽在轨道上。",
        "平的曲线意味着以内质量必须和半径成正比，一路长过最后一个测点。",
        "在这个星系里，二十四千秒差距以内，",
        "百分之七十四的质量完全不发光。",
        "一九八零年他们又扫了二十一个星系，个个如此，",
        "暗物质从此成了物理学最大的悬案。",
    ],
    [
        "鲁宾晚年说：旋涡星系里暗物质和亮物质差不多是一比十，",
        "这大概也是我们无知与知识的比例。",
        "如今智利的维拉·鲁宾天文台每隔几个晚上就把整个南天拍一遍，",
        "替她继续盯着黑暗。",
        "去 dailyslop 点 pages 点 dev，",
        "亲手量出那条不肯掉下来的曲线吧。",
        "生日快乐，鲁宾女士。",
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
      #video-browser-chrome .badge { color: #a78bfa; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-23-rubin-curve</span><span class="badge">M31 · 1970</span>';
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

        # Segment 0: Title Card -> App: Rubin & Ford 1970 setup
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
        page.evaluate("window.__demo.loadScenario('m31-1970')")
        time.sleep(0.3)

        app_intro_frames = int(round((seg0_duration - title_duration + SILENCE_BETWEEN) * FPS))
        for f in range(app_intro_frames):
            if f == app_intro_frames // 4:
                page.evaluate("window.__demo.setSlit(6.5)")
            elif f == app_intro_frames // 2:
                page.evaluate("window.__demo.setSlit(12)")
                page.evaluate("window.__demo.measure()")
            elif f == (app_intro_frames * 3) // 4:
                page.evaluate("window.__demo.setSlit(19)")
                page.evaluate("window.__demo.measure()")
            capture_frame(page)

        # Segment 1: Doppler method — sweep the curve point by point
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        sweep_start = seg1_frames // 5
        for f in range(seg1_frames):
            if f == sweep_start:
                # fire-and-forget: the app animates the slit and records points itself
                page.evaluate("() => { window.__demo.sweep(); }")
            capture_frame(page)

        # Segment 2: Newton vs data — visible-mass prediction falls, points stay flat
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadScenario('visible-fails')")
        page.evaluate("window.__demo.setKepler(true)")
        time.sleep(0.2)
        for f in range(seg2_frames):
            if f == (seg2_frames * 3) // 5:
                # switch to the spectro view so the gap annotation is front and center
                page.evaluate("window.__demo.setMode('orbits')")
            capture_frame(page)

        # Segment 3: reveal the halo — ghost cloud + gold fit
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadScenario('reveal-halo')")
        page.evaluate("window.__demo.setKepler(false)")
        time.sleep(0.2)
        for f in range(seg3_frames):
            capture_frame(page)

        # Segment 4: outro — app then end card
        seg4_total_duration = durations[4] + SILENCE_TAIL
        seg4_frames = int(round(seg4_total_duration * FPS))
        app_frames = int(round(seg4_frames * 0.55))
        end_frames = seg4_frames - app_frames

        for f in range(app_frames):
            if f == app_frames // 2:
                page.evaluate("window.__demo.setGhost(false)")
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
    temp_mp4 = work_dir / "rubin-curve.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Vera Rubin rotation-curve video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "rubin-curve.mp4")
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
        with tempfile.TemporaryDirectory(prefix="rubin-curve-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "rubin-curve.srt"
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
