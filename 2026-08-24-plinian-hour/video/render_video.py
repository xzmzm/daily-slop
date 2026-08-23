#!/usr/bin/env python3
"""Render the Chinese Vesuvius 79 AD / Plinian-column story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright driving the real
Plinian Hour studio through its UI and __demo API.
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
SLUG = "2026-08-24-plinian-hour"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Ox Alpha，来交 AI 每日作业了。今天是八月二十四日。公元七十九年的今天下午一点左右，维苏威火山在沉睡几百年后突然开口，不到二十个小时，庞贝、赫库兰尼姆和斯塔比亚三座罗马城市被彻底从地图上抹掉。老普林尼为救人驶向火山，死在斯塔比亚海滩；十七岁的小普林尼在三十公里外的米塞努姆目睹全程，写下人类第一份火山观测报告，喷发柱最壮观的一类喷发，从此就叫普林尼式。我做了一个叫 plinian hour 的火山工作室，把这十九个小时放进物理引擎重演一遍。",
    "喷发柱凭什么能长到三十五公里高？答案是浮力。火山口射流以每秒两百六十米的速度冲出，混合物里九成五是岩石碎屑，密度接近空气的四倍，按理说应该像炮弹一样掉回来。但射流一路卷吸空气稀释自己，密度降到低于大气的那一刻，整根柱子变成热气球，冲过对流层顶，在平流层里撑开一把伞状云。我用的公式是教科书级的四次方根标度：柱高等于三十三公里，乘以质量流量比的四分之一次方。",
    "但柱子有生死线。把岩浆温度滑块拉冷：出口混合物变重，弹道高度够不到浮力翻转高度，整根喷发柱当场坍塌，变成贴地狂奔的火山碎屑流。右边的坍塌余量条就是这条线：历史上的喷发只比临界点高出三百四十米，几乎在刀尖上跳舞。夜里岩浆切换到灰白相，喷发柱开始间歇性坍塌——庞贝的死刑，就是这时候签下来的。",
    "风决定谁先挨打。当天高空西风把喷发柱往东南方向吹，浮石顺风流走：粗颗粒沉得快，落在火山脚下；细灰的终端速度只有每秒几毫米，能飘出上百公里。沉积厚度随距离指数衰减，这是皮尔一九八九年的经典结论。地图上的等厚线像鸡蛋一样朝东南拉长：庞贝埋了两米多厚的浮石，而上风向的赫库兰尼姆只落了几厘米细灰。不过先别羡慕它，两座城的死刑都不是这个判的。",
    "凌晨一点零七分，第一股涌浪扫过赫库兰尼姆：每秒几十米、几百度的密度流，三分钟跑完六公里，城里人当场殉难。我的箱形模型给出一条铁律：涌浪能跑多远，只看坍塌体积。十四亿立方米，刚好够到赫库兰尼姆；二十二亿，才翻得过庞贝的城墙。六点四十七分，涌浪沿萨尔诺河冲进斯塔比亚，老普林尼死在这里；七点四十一分，第六股涌浪翻墙而入，庞贝陷落。",
    "小普林尼写道：黑暗散去，一切仿佛被火烧尽，又像被灰烬埋葬。今天维苏威还在打盹，那不勒斯湾的三百万人依然住在山坡上。去 dailyslop 点 pages 点 dev，亲手把这根柱子推过临界点，看看风替谁挡了刀。我是 Ox Alpha，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Ox Alpha，来交 AI 每日作业了。",
        "今天是八月二十四日。",
        "公元七十九年的今天下午一点左右，",
        "维苏威火山在沉睡几百年后突然开口，",
        "不到二十个小时，庞贝、赫库兰尼姆和斯塔比亚",
        "三座罗马城市被彻底从地图上抹掉。",
        "老普林尼为救人驶向火山，死在斯塔比亚海滩；",
        "十七岁的小普林尼在三十公里外的米塞努姆目睹全程，",
        "写下人类第一份火山观测报告，",
        "喷发柱最壮观的一类喷发，从此就叫普林尼式。",
        "我做了一个叫 plinian hour 的火山工作室，",
        "把这十九个小时放进物理引擎重演一遍。",
    ],
    [
        "喷发柱凭什么能长到三十五公里高？答案是浮力。",
        "火山口射流以每秒两百六十米的速度冲出，",
        "混合物里九成五是岩石碎屑，密度接近空气的四倍，",
        "按理说应该像炮弹一样掉回来。",
        "但射流一路卷吸空气稀释自己，",
        "密度降到低于大气的那一刻，整根柱子变成热气球，",
        "冲过对流层顶，在平流层里撑开一把伞状云。",
        "我用的公式是教科书级的四次方根标度：",
        "柱高等于三十三公里，乘以质量流量比的四分之一次方。",
    ],
    [
        "但柱子有生死线。",
        "把岩浆温度滑块拉冷：出口混合物变重，",
        "弹道高度够不到浮力翻转高度，",
        "整根喷发柱当场坍塌，变成贴地狂奔的火山碎屑流。",
        "右边的坍塌余量条就是这条线：",
        "历史上的喷发只比临界点高出三百四十米，",
        "几乎在刀尖上跳舞。",
        "夜里岩浆切换到灰白相，喷发柱开始间歇性坍塌——",
        "庞贝的死刑，就是这时候签下来的。",
    ],
    [
        "风决定谁先挨打。",
        "当天高空西风把喷发柱往东南方向吹，浮石顺风流走：",
        "粗颗粒沉得快，落在火山脚下；",
        "细灰的终端速度只有每秒几毫米，能飘出上百公里。",
        "沉积厚度随距离指数衰减，",
        "这是皮尔一九八九年的经典结论。",
        "地图上的等厚线像鸡蛋一样朝东南拉长：",
        "庞贝埋了两米多厚的浮石，",
        "而上风向的赫库兰尼姆只落了几厘米细灰。",
        "不过先别羡慕它，两座城的死刑都不是这个判的。",
    ],
    [
        "凌晨一点零七分，第一股涌浪扫过赫库兰尼姆：",
        "每秒几十米、几百度的密度流，三分钟跑完六公里，",
        "城里人当场殉难。",
        "我的箱形模型给出一条铁律：涌浪能跑多远，只看坍塌体积。",
        "十四亿立方米，刚好够到赫库兰尼姆；",
        "二十二亿，才翻得过庞贝的城墙。",
        "六点四十七分，涌浪沿萨尔诺河冲进斯塔比亚，",
        "老普林尼死在这里；",
        "七点四十一分，第六股涌浪翻墙而入，庞贝陷落。",
    ],
    [
        "小普林尼写道：黑暗散去，一切仿佛被火烧尽，",
        "又像被灰烬埋葬。",
        "今天维苏威还在打盹，",
        "那不勒斯湾的三百万人依然住在山坡上。",
        "去 dailyslop 点 pages 点 dev，",
        "亲手把这根柱子推过临界点，看看风替谁挡了刀。",
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
      #video-browser-chrome .badge { color: #ff9a5c; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-24-plinian-hour</span><span class="badge">Vesuvius · 79 AD</span>';
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
        border: 1px solid rgba(255, 122, 60, 0.45);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(255, 122, 60, 0.3);
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

        # Segment 0: Title Card -> App: the eruption opens at 1 PM
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
        page.evaluate("window.__demo.loadScenario('historical')")
        page.evaluate("window.__demo.setTime(0.15)")
        time.sleep(0.3)

        app_intro_frames = int(round((seg0_duration - title_duration + SILENCE_BETWEEN) * FPS))
        for f in range(app_intro_frames):
            if f % 12 == 0 and state_ok(page):
                page.evaluate(f"window.__demo.setTime({0.15 + f * 0.012:.3f})")
            capture_frame(page)

        # Segment 1: the column physics — ramp the jet, watch the column grow
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        for f in range(seg1_frames):
            if f == seg1_frames // 6:
                page.evaluate("window.__demo.setTime(2.0)")
                page.evaluate("window.__demo.setJet(300, 1050)")
            elif f == seg1_frames // 3:
                page.evaluate("window.__demo.setJet(340, 1100)")
            elif f == seg1_frames // 2:
                page.evaluate("window.__demo.setJet(260, 1000)")
            capture_frame(page)

        # Segment 2: the collapse threshold — cold jet dies, history dances on the edge
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTime(8.0)")
        for f in range(seg2_frames):
            if f == seg2_frames // 5:
                page.evaluate("window.__demo.loadScenario('cold')")
            elif f == seg2_frames // 2:
                page.evaluate("window.__demo.setTime(13.8)")
            elif f == (seg2_frames * 4) // 5:
                page.evaluate("window.__demo.loadScenario('historical')")
                page.evaluate("window.__demo.setTime(8.0)")
            capture_frame(page)

        # Segment 3: wind and fallout — the isomass lobe stretches over Pompeii
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setView('map')")
        page.evaluate("window.__demo.setTime(2.5)")
        for f in range(seg3_frames):
            if f == seg3_frames // 6:
                page.evaluate("window.__demo.setWind(9)")
            elif f == seg3_frames // 3:
                page.evaluate("window.__demo.setTime(7.0)")
            elif f == seg3_frames // 2:
                page.evaluate("window.__demo.setWind(12)")
                page.evaluate("window.__demo.setTime(11.0)")
            elif f == (seg3_frames * 4) // 5:
                page.evaluate("window.__demo.setWind(6)")
                page.evaluate("window.__demo.setTime(11.5)")
            capture_frame(page)

        # Segment 4: the night of collapse — surge by surge
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        for f in range(seg4_frames):
            if f == seg4_frames // 8:
                page.evaluate("window.__demo.setTime(12.05)")
            elif f == seg4_frames // 4:
                page.evaluate("window.__demo.setTime(12.35)")
            elif f == (seg4_frames * 7) // 16:
                page.evaluate("window.__demo.setTime(17.9)")
            elif f == seg4_frames // 2:
                page.evaluate("window.__demo.setTime(18.15)")
            elif f == (seg4_frames * 5) // 8:
                page.evaluate("window.__demo.setTime(18.8)")
            elif f == (seg4_frames * 3) // 4:
                page.evaluate("window.__demo.setTime(18.85)")
            capture_frame(page)

        # Segment 5: outro — dawn in the app, then end card
        seg5_total_duration = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total_duration * FPS))
        app_frames = int(round(seg5_frames * 0.5))
        end_frames = seg5_frames - app_frames

        page.evaluate("window.__demo.setView('section')")
        page.evaluate("window.__demo.setTime(19.2)")
        for f in range(app_frames):
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
    temp_mp4 = work_dir / "plinian-hour.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Vesuvius 79 AD Plinian-column video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "plinian-hour.mp4")
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
        with tempfile.TemporaryDirectory(prefix="plinian-hour-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "plinian-hour.srt"
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
