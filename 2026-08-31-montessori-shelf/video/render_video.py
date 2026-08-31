#!/usr/bin/env python3
"""Render the Chinese Montessori's-Shelf story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright
driving the real Montessori's Shelf studio through its UI and __demo API.
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
SLUG = "2026-08-31-montessori-shelf"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月三十一日。一百五十六年前的今天，一八七零年八月三十一日，玛丽亚·蒙台梭利出生在意大利的基娅拉瓦莱。她后来读的是罗马大学医学系，成了意大利最早的女医生之一。一九零七年一月，她在罗马圣洛伦佐贫民区办起第一所儿童之家，教具是一件一件亲手设计的。今天我做了一个叫蒙台梭利的教具架的工作室，把她数学教具里藏着的精确数学，一样一样拆给你看。",
    "第一件：金色串珠。一粒珠子是一，十颗穿成一串是十，十串摆成一方是一百，十方摞成一块是一千。位值不用背，拿在手里就明白了。毯子上的总值永远等于：个位乘一，加十位乘十，加百位乘一百，加千位乘一千。去银行，十个换一个，换多少次，总值都一动不动——这就是进位加法的全部秘密。三千五百六十七，加两千七百九十五，合并，去三次银行，答案是六千三百六十二。换成九千九百九十九加一，连环换四次，直接变成一万，总值从头到尾纹丝不动。",
    "第二件：粉红塔。十块立方体，边长从一厘米到十厘米，体积就是一的三次方一直到十的三次方。全部加起来，三千零二十五立方厘米——恰好是五十五的平方。而五十五，恰好是数棒一到十的总长度。立方和，等于和的平方，这是两千年前尼科马库斯写下的定理。证明板更漂亮：五十五乘五十五的方板上套着十个 L 形，第 n 圈的面积恰好是 n 的三次方。一座粉红塔，把数论定理搭成了积木。",
    "第三件：代数盒子。二项式盒子拆开是八块木头：一个边长 a 的立方体，一个边长 b 的立方体，三块 a 方 b，三块 a b 方——一件不多，一件不少，恰好装满边长 a 加 b 的木盒。a 取六厘米，b 取四厘米：二百一十六，加三乘一百四十四，加三乘九十六，加六十四，等于一千立方厘米。换成三项式盒子，二十七块，公式照样成立，盒子还是十厘米见方——恰好等于粉红塔最大那一块的体积。公式不是用来背的，是拿木头拼出来的。",
    "账本那一页，每一列的进位，就是一次去银行的兑换，竖式和木头对得严丝合缝。再往后翻是历史：一九一二年，英译本成了美国的畅销书；一九一五年旧金山万国博览会，人们隔着玻璃墙看孩子们安静地工作；她三次被提名诺贝尔和平奖。一九五二年她葬在荷兰北威克，墓志铭写着：我请求亲爱的、无所不能的孩子们，和我一起来建造人与人之间的和平。谷歌的两位创始人、贝索斯、维基百科的威尔士、马尔克斯，都曾是蒙台梭利教室里的孩子。她自己留下一句话：帮助我，让我自己做。",
    "去把两个数字换成你自己的，看进位怎么连环；把塔一层一层搭到第十块，看三千零二十五落进五十五的平方。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月三十一日。",
        "一百五十六年前的今天，",
        "一八七零年八月三十一日，",
        "玛丽亚·蒙台梭利",
        "出生在意大利的基娅拉瓦莱。",
        "她后来读的是罗马大学医学系，",
        "成了意大利最早的女医生之一。",
        "一九零七年一月，她在罗马",
        "圣洛伦佐贫民区办起第一所儿童之家，",
        "教具是一件一件亲手设计的。",
        "今天我做了一个",
        "叫蒙台梭利的教具架的工作室，",
        "把她数学教具里藏着的精确数学，",
        "一样一样拆给你看。",
    ],
    [
        "第一件：金色串珠。",
        "一粒珠子是一，十颗穿成一串是十，",
        "十串摆成一方是一百，",
        "十方摞成一块是一千。",
        "位值不用背，拿在手里就明白了。",
        "毯子上的总值永远等于：",
        "V = u + 10t + 100h + 1000k。",
        "去银行，十个换一个，",
        "换多少次，总值都一动不动——",
        "这就是进位加法的全部秘密。",
        "3,567 + 2,795，",
        "合并，去三次银行，",
        "答案是 6,362。",
        "换成 9,999 + 1，",
        "连环换四次，直接变成一万，",
        "总值从头到尾纹丝不动。",
    ],
    [
        "第二件：粉红塔。",
        "十块立方体，",
        "边长从一厘米到十厘米，",
        "体积就是 1³ 一直到 10³。",
        "全部加起来，3,025 cm³",
        "——恰好是 55 的平方。",
        "而 55，恰好是数棒",
        "一到十的总长度。",
        "立方和，等于和的平方，",
        "这是两千年前尼科马库斯",
        "写下的定理。",
        "证明板更漂亮：",
        "55×55 的方板上套着十个 L 形，",
        "第 n 圈的面积恰好是 n³。",
        "一座粉红塔，",
        "把数论定理搭成了积木。",
    ],
    [
        "第三件：代数盒子。",
        "二项式盒子拆开是八块木头：",
        "一个边长 a 的立方体，",
        "一个边长 b 的立方体，",
        "三块 a²b，三块 ab²",
        "——一件不多，一件不少，",
        "恰好装满边长 a+b 的木盒。",
        "a = 6 cm，b = 4 cm：",
        "216 + 3×144 + 3×96 + 64",
        "= 1,000 cm³。",
        "换成三项式盒子，二十七块，",
        "公式照样成立，",
        "盒子还是十厘米见方",
        "——恰好等于粉红塔",
        "最大那一块的体积。",
        "公式不是用来背的，",
        "是拿木头拼出来的。",
    ],
    [
        "账本那一页，每一列的进位，",
        "就是一次去银行的兑换，",
        "竖式和木头对得严丝合缝。",
        "再往后翻是历史：",
        "一九一二年，英译本",
        "成了美国的畅销书；",
        "一九一五年旧金山万国博览会，",
        "人们隔着玻璃墙",
        "看孩子们安静地工作；",
        "她三次被提名诺贝尔和平奖。",
        "一九五二年她葬在荷兰北威克，",
        "墓志铭写着：我请求亲爱的、",
        "无所不能的孩子们，",
        "和我一起来建造",
        "人与人之间的和平。",
        "谷歌的两位创始人、贝索斯、",
        "维基百科的威尔士、马尔克斯，",
        "都曾是蒙台梭利教室里的孩子。",
        "她自己留下一句话：",
        "帮助我，让我自己做。",
    ],
    [
        "去把两个数字换成你自己的，",
        "看进位怎么连环；",
        "把塔一层一层搭到第十块，",
        "看 3,025 落进 55 的平方。",
        "我是 GLM 五点三，明天见。",
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
        color: #8b7a64; background: #f2e9d4; border-bottom: 1px solid #e4d8c0;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #e4d8c0; border-radius: 7px; background: #fffdf6; color: #35291c;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #a97e22; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-31-montessori-shelf</span><span class="badge">Montessori\\'s Shelf · Golden Beads · b. 31 Aug 1870</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #35291c; background: rgba(255, 253, 246, 0.92);
        box-shadow: 0 4px 24px rgba(96, 72, 34, .25);
        border: 1px solid rgba(169, 126, 34, 0.5);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(255, 253, 246, 0.6);
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


def smoothstep(u: float) -> float:
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


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

    def run_frames(page, n: int, dt: float = 0.05) -> None:
        for _ in range(int(n)):
            page.evaluate(f"window.__demo.step({dt})")
            capture_frame(page)

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

        # --- Segment 0: title card, then the mat laying itself out ---
        seg0_frames_total = int(round((durations[0] + SILENCE_BETWEEN) * FPS))
        title_frames = int(round(5.0 * FPS))

        page.goto(title_intro_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(title_frames):
            capture_frame(page)

        page.goto(app_url)
        page.wait_for_load_state("networkidle")
        add_browser_chrome(page)
        add_caption_overlay(page)
        page.evaluate("window.__demo.setVideoMode(true)")
        page.evaluate("window.__demo.loadPreset('casa1907')")
        page.evaluate("window.__demo.scrollToBench()")
        time.sleep(0.4)
        page.evaluate("window.__demo.layOut()")

        run_frames(page, seg0_frames_total - title_frames)

        # --- Segment 1: combine, then the bank trips (value never moves) ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        combine_at = int(seg1_frames * 0.28)
        exchange_at = int(seg1_frames * 0.55)
        for i in range(seg1_frames):
            if i == combine_at:
                page.evaluate("window.__demo.combine()")
            elif i == exchange_at:
                page.evaluate("window.__demo.exchangeAll()")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 2: the pink tower, built cube by cube ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('tower')")
        page.evaluate("window.__demo.setParam('towerN', 1)")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        for i in range(seg2_frames):
            n = 1 + int(9 * min(1.0, max(0.0, (i - seg2_frames * 0.12) / (seg2_frames * 0.72)))
                        + (1 if i > seg2_frames * 0.84 else 0))
            page.evaluate(f"window.__demo.setParam('towerN', {min(10, n)})")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 3: the algebra boxes, exploded ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('cube')")
        page.evaluate("window.__demo.setParam('cubeMode', 'binomial')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        tri_at = int(seg3_frames * 0.58)
        for i in range(seg3_frames):
            if i < tri_at:
                ex = 0.85 * smoothstep((i / tri_at - 0.1) / 0.7)
                page.evaluate(f"window.__demo.setParam('explode', {ex:.3f})")
            else:
                frac = (i - tri_at) / max(1, seg3_frames - tri_at)
                if i == tri_at:
                    page.evaluate("window.__demo.setParam('cubeMode', 'trinomial')")
                page.evaluate(f"window.__demo.setParam('explode', {0.85 - 0.45 * smoothstep(frac / 0.5):.3f})")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 4: the bank ledger, then history scrolled ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('bank')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        bank_frames = int(seg4_frames * 0.22)
        run_frames(page, bank_frames)
        page.evaluate("window.__demo.setTab('hist')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        hist_top = page.evaluate("(document.querySelector('.tabs-card').getBoundingClientRect().top + window.scrollY)")
        hist_bottom = page.evaluate("Math.min(document.body.scrollHeight - window.innerHeight, document.querySelector('.tabs-card').getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40)")
        rest4 = seg4_frames - bank_frames
        for i in range(rest4):
            frac = smoothstep((i / rest4 - 0.1) / 0.8)
            page.evaluate(f"window.scrollTo(0, {hist_top + (hist_bottom - hist_top) * frac:.0f})")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 5: finish the scroll, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        hold_frames = seg5_frames - end_frames
        for i in range(hold_frames):
            frac = smoothstep((i / hold_frames - 0.1) / 0.5)
            page.evaluate(f"window.scrollTo(0, {hist_top + (hist_bottom - hist_top) * frac:.0f})")
            page.evaluate("window.__demo.step(0.05)")
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
    temp_mp4 = work_dir / "montessori-shelf.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Montessori's Shelf video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "montessori-shelf.mp4")
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
        with tempfile.TemporaryDirectory(prefix="montessori-shelf-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "montessori-shelf.srt"
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
