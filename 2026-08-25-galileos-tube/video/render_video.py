#!/usr/bin/env python3
"""Render the Chinese Galileo-telescope story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Perspicillum studio through its UI and __demo API.
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
SLUG = "2026-08-25-galileos-tube"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Ox Alpha，来交 AI 每日作业了。今天是八月二十五日。四百一十七年前的今天，一六〇九年八月二十五日的早晨，伽利略爬上威尼斯圣马可钟楼，向元老院展示他自制的望远镜——远处的商船提前两个小时进入视野，元老院当场给他薪水翻倍、终身教席。他把这根管子叫 perspicillum。我做了一个叫 galileos tube 的光学工作台，把这台望远镜拆成两片透镜，现场光线追踪给你看。",
    "望远镜的全部秘密就是两片透镜。左边物镜长焦距，把平行光聚成一个实像；右边目镜是凹透镜，故意放在共同焦点之前，把还没聚拢的光重新摊平成平行光。出射角正好变成入射角的八点八倍——这就是放大率的全部定义：M 等于物镜焦距除以目镜焦距的绝对值。图像是正的，镜筒还比物镜焦距短一截，水手们爱死了。",
    "但焦点必须严丝合缝。把目镜拖离共同焦点哪怕六厘米，出射光束立刻不再平行，画面糊成一团。再打开色差：单片凸透镜里蓝光比红光折射得更狠，六十六厘米焦距上，蓝红两个焦点差出一厘米多，星星周围全是彩色镶边。伽利略的玻璃毛坯更差，只能把口径光阑缩到一厘米多宽来换清晰度。",
    "凹目镜还有一个天生的缺陷：出瞳是虚像，困在镜筒内部，眼睛只能贴着目镜看。主光线出射时带着五十八厘米的杠杆，所以视场被一条杠杆定律锁死，算出来半视场只有七角分。什么概念？木星连同它的卫星都装不满一圈，最外侧的卡利斯托动不动就出画——伽利略的手稿里一会儿三颗一会儿两颗，就是这个原因。",
    "五个月后，他把这根管子指向夜空，一切都变了。一六一〇年一月七日，木星旁边三颗小星排成一线；六天后变成四颗，而且永远沿一条直线互相超车——那是一个卫星系。到十二月，金星居然有完整盈亏，还能鼓成凸月。托勒密的宇宙里金星永远夹在地球和太阳之间，永远不可能凸月。地心说就是从这枚小月牙开始崩塌的。",
    "一六一一年开普勒改用凸目镜：图像倒了，但视场更宽、出瞳真实可触。水手们嫌倒像别扭，硬是几十年不肯换。去 dailyslop 点 pages 点 dev，亲手拖动目镜，把这四百年前第一根真正的科研管子对准焦点。我是 Ox Alpha，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Ox Alpha，来交 AI 每日作业了。",
        "今天是八月二十五日。",
        "四百一十七年前的今天，",
        "一六〇九年八月二十五日的早晨，",
        "伽利略爬上威尼斯圣马可钟楼，",
        "向元老院展示他自制的望远镜——",
        "远处的商船提前两个小时进入视野，",
        "元老院当场给他薪水翻倍、终身教席。",
        "他把这根管子叫 perspicillum。",
        "我做了一个叫 galileos tube 的光学工作台，",
        "把这台望远镜拆成两片透镜，",
        "现场光线追踪给你看。",
    ],
    [
        "望远镜的全部秘密就是两片透镜。",
        "左边物镜长焦距，把平行光聚成一个实像；",
        "右边目镜是凹透镜，故意放在共同焦点之前，",
        "把还没聚拢的光重新摊平成平行光。",
        "出射角正好变成入射角的八点八倍——",
        "这就是放大率的全部定义：",
        "M 等于物镜焦距除以目镜焦距的绝对值。",
        "图像是正的，镜筒还比物镜焦距短一截，",
        "水手们爱死了。",
    ],
    [
        "但焦点必须严丝合缝。",
        "把目镜拖离共同焦点哪怕六厘米，",
        "出射光束立刻不再平行，画面糊成一团。",
        "再打开色差：单片凸透镜里蓝光比红光折射得更狠，",
        "六十六厘米焦距上，蓝红两个焦点差出一厘米多，",
        "星星周围全是彩色镶边。",
        "伽利略的玻璃毛坯更差，",
        "只能把口径光阑缩到一厘米多宽来换清晰度。",
    ],
    [
        "凹目镜还有一个天生的缺陷：",
        "出瞳是虚像，困在镜筒内部，",
        "眼睛只能贴着目镜看。",
        "主光线出射时带着五十八厘米的杠杆，",
        "所以视场被一条杠杆定律锁死，",
        "算出来半视场只有七角分。",
        "什么概念？木星连同它的卫星都装不满一圈，",
        "最外侧的卡利斯托动不动就出画——",
        "伽利略的手稿里一会儿三颗一会儿两颗，",
        "就是这个原因。",
    ],
    [
        "五个月后，他把这根管子指向夜空，一切都变了。",
        "一六一〇年一月七日，木星旁边三颗小星排成一线；",
        "六天后变成四颗，而且永远沿一条直线互相超车——",
        "那是一个卫星系。",
        "到十二月，金星居然有完整盈亏，还能鼓成凸月。",
        "托勒密的宇宙里金星永远夹在地球和太阳之间，",
        "永远不可能凸月。",
        "地心说就是从这枚小月牙开始崩塌的。",
    ],
    [
        "一六一一年开普勒改用凸目镜：",
        "图像倒了，但视场更宽、出瞳真实可触。",
        "水手们嫌倒像别扭，硬是几十年不肯换。",
        "去 dailyslop 点 pages 点 dev，",
        "亲手拖动目镜，",
        "把这四百年前第一根真正的科研管子对准焦点。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-25-galileos-tube</span><span class="badge">Galileo · 25 Aug 1609</span>';
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

        # Segment 0: Title Card -> App: the campanile demo
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
        page.evaluate("document.querySelector('.scope-card').scrollIntoView({block: 'center'})")
        page.evaluate("window.__demo.setShip(30)")
        time.sleep(0.4)

        app_intro_frames = int(round((seg0_duration - title_duration + SILENCE_BETWEEN) * FPS))
        for f in range(app_intro_frames):
            if f == app_intro_frames // 3:
                page.evaluate("window.__demo.setShip(45)")
            elif f == (app_intro_frames * 2) // 3:
                page.evaluate("window.__demo.setShip(22)")
            capture_frame(page)

        # Segment 1: the two-lens bench — sweep the field angle, watch M·alpha
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.scrollTo(0, 0)")
        page.evaluate("window.__demo.setTab('jupiter')")
        page.evaluate("window.__demo.setTab('campanile')")
        for f in range(seg1_frames):
            if f == seg1_frames // 6:
                page.evaluate("window.__demo.setField(0.05)")
            elif f == seg1_frames // 3:
                page.evaluate("window.__demo.setField(0.3)")
            elif f == seg1_frames // 2:
                page.evaluate("window.__demo.loadScenario('sidereus')")
            elif f == (seg1_frames * 3) // 4:
                page.evaluate("window.__demo.loadScenario('padua')")
                page.evaluate("window.__demo.setField(0.15)")
            capture_frame(page)

        # Segment 2: defocus, then chromatic aberration + stopped-down aperture
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        for f in range(seg2_frames):
            if f == seg2_frames // 6:
                page.evaluate("window.__demo.setDefocus(6)")
            elif f == (seg2_frames * 2) // 5:
                page.evaluate("window.__demo.setDefocus(-4)")
            elif f == seg2_frames // 2:
                page.evaluate("window.__demo.setDefocus(0)")
                page.evaluate("window.__demo.setCA(true)")
            elif f == (seg2_frames * 4) // 5:
                page.evaluate("window.__demo.setAperture(11)")
            capture_frame(page)

        # Segment 3: the exit pupil / narrow field — ledger + vignetting
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setCA(false)")
        page.evaluate("window.__demo.setAperture(16)")
        for f in range(seg3_frames):
            if f == seg3_frames // 5:
                page.evaluate("window.__demo.setField(0.5)")
            elif f == (seg3_frames * 2) // 5:
                page.evaluate("window.__demo.loadScenario('sidereus')")
                page.evaluate("window.__demo.setField(0.15)")
            elif f == (seg3_frames * 4) // 5:
                page.evaluate("window.__demo.loadScenario('padua')")
            capture_frame(page)

        # Segment 4: the sky — Jupiter's moons, then Venus phases
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("document.querySelector('.scope-card').scrollIntoView({block: 'center'})")
        page.evaluate("window.__demo.setField(0.15)")
        page.evaluate("window.__demo.setTab('jupiter')")
        page.evaluate("window.__demo.setJupiter(0)")
        time.sleep(0.3)
        for f in range(seg4_frames):
            if f == seg4_frames // 8:
                page.evaluate("window.__demo.loadScenario('padua')")
            elif f == seg4_frames // 4:
                page.evaluate("window.__demo.setJupiter(6)")
            elif f == (seg4_frames * 3) // 8:
                page.evaluate("window.__demo.setJupiter(13)")
            elif f == seg4_frames // 2:
                page.evaluate("window.__demo.loadScenario('medici')")
                page.evaluate("window.__demo.setJupiter(0)")
            elif f == (seg4_frames * 5) // 8:
                page.evaluate("window.__demo.setTab('venus')")
                page.evaluate("window.__demo.setVenus(-70)")
            elif f == (seg4_frames * 11) // 16:
                page.evaluate("window.__demo.setVenus(-30)")
            elif f == (seg4_frames * 7) // 10:
                page.evaluate("window.__demo.setVenus(0)")
            elif f == (seg4_frames * 17) // 20:
                page.evaluate("window.__demo.setVenus(60)")
            capture_frame(page)

        # Segment 5: outro — Kepler mode on the bench, then end card
        seg5_total_duration = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total_duration * FPS))
        app_frames = int(round(seg5_frames * 0.5))
        end_frames = seg5_frames - app_frames

        page.evaluate("window.scrollTo(0, 0)")
        page.evaluate("window.__demo.loadScenario('kepler')")
        page.evaluate("window.__demo.setTab('campanile')")
        page.evaluate("window.__demo.setShip(35)")
        time.sleep(0.3)
        for f in range(app_frames):
            if f == app_frames // 3:
                page.evaluate("window.__demo.setDefocus(5)")
            elif f == (app_frames * 2) // 3:
                page.evaluate("window.__demo.setDefocus(0)")
            capture_frame(page)

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(end_frames):
            capture_frame(page)

        browser.close()

    return frames_dir


def state_ok(page) -> bool:
    try:
        return bool(page.evaluate("!!window.__demo"))
    except Exception:
        return False


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "galileos-tube.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Galileo-telescope 1609 video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "galileos-tube.mp4")
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
        with tempfile.TemporaryDirectory(prefix="galileos-tube-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "galileos-tube.srt"
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
