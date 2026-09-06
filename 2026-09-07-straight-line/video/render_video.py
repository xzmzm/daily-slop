#!/usr/bin/env python3
"""Render the Chinese Straight-Line-1927 story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio, with Playwright
driving the real straight-line studio through its UI and __demo API. The
pointer stays parked during narration and only makes short eased, slightly
curved moves before real actions (the 90° slide turn, the interlace checkbox,
the bandwidth presets, the tint knob, the B&W toggle, the timeline pins),
per the house video style. The scan bench and the color bars are stepped
deterministically frame by frame with __demo.tick(1/15).
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
SLUG = "2026-09-07-straight-line"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
# Years are spelled as spoken digits (一九二七年, never 1927 年) so the TTS
# reads them digit by digit; subtitles keep Arabic numerals. Non-year
# quantities (4.2 兆赫, 82 纳秒, 108 帧) stay ordinary numbers.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月七日。九十九年前的今晚，一九二七年 9 月 7 日，旧金山绿街 202 号，21 岁的法恩斯沃斯把一块涂黑的玻璃片插到强光前面，玻璃中间只刻着一道直线。隔壁房间的萤光屏亮起一条颤动的线，姐夫加德纳把玻璃片转了 90°，线跟着立了起来——人类第一张全电子电视图像。今天做一个电视工作室：扫描、带宽、彩色，加一条时间线。",
    "图像不是整幅发过去的，是一行一行犁过去的。法恩斯沃斯 14 岁跟在犁后面试着走直垄，忽然明白电视也该这样：一垄一垄，往返盖满整块田。左边是玻璃片，右边是萤光屏，中间是这一行的电流：先同步，再消隐，然后是亮度。行数拉到 525，眼睛其实只拿到七成，0.7 这个折扣叫 Kell 因子。隔行扫描一场隔一行，60 场其实只有 30 帧。",
    "带宽是行数的平方。行数翻倍，竖直密一倍，每行还要多装一倍的黑白竖线，带宽就得翻四倍。贝尔德 30 行的整幅画面 9.2 千赫，塞进中波电台的声音频道就行；美国 525 行要 4.2 兆赫；数字 1080p 每秒两亿像素，148.5 兆赫。机械电视就死在这条曲线上：30 行时一个像素 37 微秒，硒光电池勉强跟得上；525 行只剩 82 纳秒，差三个数量级。圆盘有极限，电子束没有惯性。",
    "一九五三年，难题是一亿台黑白电视机已经在客厅里了。NTSC 的办法：亮度照原样发，黑白机只看它；颜色骑在一个挑好的副载波上，227.5 个行周期，奇半整数，彩色点阵逐行反转，眼睛自动把它平均掉。声音保持 286 个行周期，整数，安静。整条链全是精确分数：4.5 兆赫除以 286 是行频，帧率被拽成 29.97，副载波恰好是 315 除以 88 兆赫。代价记到今天：时码每小时要丢 108 帧。拧色调旋钮，六个色矢量整体转，亮度阶梯一动不动——黑白机根本不知道发生了什么。",
    "时间线走一遍。一八八四年，尼普科夫的圆盘专利；一九二六年，贝尔德的 30 行转盘；一九二七年，一条直线；一九二八年，美元符号；一九三五年，化学老师托尔曼想起那块黑板，优先权判给法恩斯沃斯；一九三六年，BBC 405 行开播；一九三九年，RCA 低头取得授权；一九四一年，525 行标准；一九五三年，兼容彩色；一九六九年，六亿人看登月；二零零九年，模拟关机，距那条直线八十二年。",
    "收个尾。法恩斯沃斯赢了专利、输了钱包，一九六九年看登月直播时只说，这一切都值了。从一条直线到六亿人同一块屏，中间就是行数、带宽，和几个漂亮的分数。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 5.3，",
        "来交 AI 每日作业了。",
        "今天是九月七日。",
        "99 年前的今晚，",
        "1927 年 9 月 7 日，",
        "旧金山绿街 202 号，",
        "21 岁的法恩斯沃斯",
        "把一块涂黑的玻璃片",
        "插到强光前面，",
        "玻璃中间只刻着",
        "一道直线。",
        "隔壁房间的萤光屏",
        "亮起一条颤动的线，",
        "姐夫加德纳",
        "把玻璃片转了 90°，",
        "线跟着立了起来",
        "——人类第一张",
        "全电子电视图像。",
        "今天做一个电视工作室：",
        "扫描、带宽、彩色，",
        "加一条时间线。",
    ],
    [
        "图像不是整幅发过去的，",
        "是一行一行犁过去的。",
        "法恩斯沃斯 14 岁",
        "跟在犁后面试着走直垄，",
        "忽然明白电视也该这样：",
        "一垄一垄，",
        "往返盖满整块田。",
        "左边是玻璃片，",
        "右边是萤光屏，",
        "中间是这一行的电流：",
        "先同步，再消隐，",
        "然后是亮度。",
        "行数拉到 525，",
        "眼睛其实只拿到七成，",
        "0.7 这个折扣",
        "叫 Kell 因子。",
        "隔行扫描一场隔一行，",
        "60 场其实只有 30 帧。",
    ],
    [
        "带宽是行数的平方。",
        "行数翻倍，竖直密一倍，",
        "每行还要多装一倍的",
        "黑白竖线，",
        "带宽就得翻四倍。",
        "贝尔德 30 行的",
        "整幅画面 9.2 千赫，",
        "塞进中波电台的",
        "声音频道就行；",
        "美国 525 行要 4.2 兆赫；",
        "数字 1080p",
        "每秒两亿像素，",
        "148.5 兆赫。",
        "机械电视就死在",
        "这条曲线上：",
        "30 行时一个像素 37 微秒，",
        "硒光电池勉强跟得上；",
        "525 行只剩 82 纳秒，",
        "差三个数量级。",
        "圆盘有极限，",
        "电子束没有惯性。",
    ],
    [
        "1953 年，难题是",
        "一亿台黑白电视机",
        "已经在客厅里了。",
        "NTSC 的办法：",
        "亮度照原样发，",
        "黑白机只看它；",
        "颜色骑在一个",
        "挑好的副载波上，",
        "227.5 个行周期，",
        "奇半整数，",
        "彩色点阵逐行反转，",
        "眼睛自动把它平均掉。",
        "声音保持 286 个行周期，",
        "整数，安静。",
        "整条链全是精确分数：",
        "4.5 兆赫除以 286 是行频，",
        "帧率被拽成 29.97，",
        "副载波恰好是",
        "315 除以 88 兆赫。",
        "代价记到今天：",
        "时码每小时要丢 108 帧。",
        "拧色调旋钮，",
        "六个色矢量整体转，",
        "亮度阶梯一动不动",
        "——黑白机根本不知道",
        "发生了什么。",
    ],
    [
        "时间线走一遍。",
        "1884 年，尼普科夫的",
        "圆盘专利；",
        "1926 年，贝尔德的",
        "30 行转盘；",
        "1927 年，一条直线；",
        "1928 年，美元符号；",
        "1935 年，化学老师",
        "托尔曼想起那块黑板，",
        "优先权判给法恩斯沃斯；",
        "1936 年，BBC 405 行开播；",
        "1939 年，RCA 低头",
        "取得授权；",
        "1941 年，525 行标准；",
        "1953 年，兼容彩色；",
        "1969 年，六亿人看登月；",
        "2009 年，模拟关机，",
        "距那条直线八十二年。",
    ],
    [
        "收个尾。",
        "法恩斯沃斯赢了专利、",
        "输了钱包，",
        "1969 年看登月直播时",
        "只说，这一切都值了。",
        "从一条直线到",
        "六亿人同一块屏，",
        "中间就是行数、带宽，",
        "和几个漂亮的分数。",
        "我是 GLM 5.3，明天见。",
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
            return int(sock.getname()[1])


def add_browser_chrome(page) -> None:
    page.add_style_tag(content="""
      #video-browser-chrome {
        position: fixed; inset: 0 0 auto 0; height: 44px; z-index: 2147483647;
        display: flex; align-items: center; gap: 13px; padding: 0 17px;
        color: #555c66; background: #f2f0ea; border-bottom: 1px solid #b8b2a2;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #b8b2a2; border-radius: 7px; background: #faf9f5; color: #555c66;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #1f6e46; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-09-07-straight-line</span><span class="badge">Straight Line · 7 Sep 1927 · 一条直线</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f2edda; background: rgba(11, 20, 31, 0.9);
        box-shadow: 0 4px 24px rgba(0, 0, 0, .5);
        border: 1px solid rgba(179, 172, 147, 0.5);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(3, 8, 14, 0.6);
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
        transform: translate(-3px, -3px); opacity: 0;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,.65));
      }
      #video-cursor svg { display: block; width: 24px; height: 30px; }
      #video-cursor .click-ring {
        position: absolute; left: 4px; top: 4px; width: 17px; height: 17px;
        border: 2px solid #35a06a; border-radius: 50%; opacity: 0;
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


def capture(page, path: Path, when: float, cues: list[tuple[float, float, str]],
            cursor: tuple[float, float] | None = None, clicking: bool = False) -> None:
    page.evaluate("""text => {
      const node = document.getElementById('video-caption');
      if (node) node.textContent = text;
    }""", caption_at(when, cues))
    if cursor is not None or clicking:
        set_cursor(page, cursor, clicking)
    page.screenshot(path=str(path))


def write_hold(page, frames_dir: Path, frame_number: int, count: int,
               timeline: float, cues: list[tuple[float, float, str]],
               cursor: tuple[float, float] | None = None,
               click_frames: int = 0, tick: bool = False) -> tuple[int, float]:
    for index in range(count):
        if tick:
            page.evaluate("window.__demo.tick(1/15)")
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


def center_of(page, js: str) -> tuple[float, float]:
    return tuple(page.evaluate(f"(() => {{ {js} }})()"))  # type: ignore[return-value]


def element_center(selector: str) -> str:
    return (f"const el = document.querySelector('{selector}');"
            f" const r = el ? el.getBoundingClientRect() : {{x: 960, y: 540, width: 0, height: 0}};"
            f" return [r.x + r.width / 2, r.y + r.height / 2];")


def nth_center(selector: str, index: int) -> str:
    return (f"const els = document.querySelectorAll('{selector}');"
            f" const r = els[{index}].getBoundingClientRect();"
            f" return [r.x + r.width / 2, r.y + r.height / 2];")


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

    def hold(count: int, cursor_pos=None, click_frames: int = 0, tick: bool = False):
        nonlocal frame_idx, timeline
        frame_idx, timeline = write_hold(page, frames_dir, frame_idx, count, timeline, cues,
                                         cursor_pos, click_frames, tick)
        if click_frames:
            clear_ring(page)

    def clear_ring(pg) -> None:
        # the click halo must not linger through narration holds
        pg.evaluate("document.getElementById('video-cursor')?.classList.remove('clicking')")

    def move(count: int, start: tuple[float, float], end: tuple[float, float]):
        nonlocal frame_idx, timeline
        frame_idx, timeline = write_move(page, frames_dir, frame_idx, count, timeline, cues, start, end)

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

        # --- Segment 0: title card, then the bench; Cliff turns the slide ---
        seg0_frames = int(round((durations[0] + SILENCE_BETWEEN) * FPS))
        title_frames = int(round(5.0 * FPS))

        page.goto(title_intro_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(title_frames)

        page.goto(app_url)
        page.wait_for_load_state("networkidle")
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)
        page.evaluate("window.__demo.setVideoMode(true)")
        page.evaluate("window.__demo.setTab('scan')")
        page.evaluate("window.__demo.setLines(60)")
        page.evaluate("window.__demo.setFps(12.5)")
        time.sleep(0.4)

        pre = int(seg0_frames * 0.55)
        hold(pre, cursor_pos=(1560, 870), tick=True)
        btn = center_of(page, element_center("#btn-turn"))
        move(int(0.8 * FPS), (1560, 870), btn)
        hold(3, btn, click_frames=3, tick=True)         # the real click — the 90° moment
        page.evaluate("window.__demo.turnSlide()")
        hold(seg0_frames - pre - int(0.8 * FPS) - 3, tick=True)

        # --- Segment 1: the furrow — sweep 30 → 525, then interlace ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setLines(30)")
        n1a = int(seg1_frames * 0.14)
        hold(n1a, tick=True)
        steps = [30, 45, 60, 90, 120, 180, 240, 320, 405, 525]
        sweep = int(seg1_frames * 0.42)
        for i in range(sweep):
            page.evaluate(f"window.__demo.setLines({steps[min(len(steps) - 1, int((i + 1) / sweep * len(steps)))]})")
            hold(1, tick=True)
        hold(int(seg1_frames * 0.12), tick=True)
        cbx = center_of(page, element_center("#c-interlace"))
        move(int(0.7 * FPS), (1500, 430), cbx)
        hold(3, cbx, click_frames=3, tick=True)
        page.evaluate("window.__demo.setInterlace(true)")
        hold(max(0, seg1_frames - n1a - sweep - int(seg1_frames * 0.12) - int(0.7 * FPS) - 3), tick=True)

        # --- Segment 2: the square law — sweep lines, visit the standards ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('band')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.3)
        n2a = int(seg2_frames * 0.10)
        hold(n2a)
        sweep2 = int(seg2_frames * 0.30)
        for i in range(sweep2):                          # 30 → 1125 along the N² curve
            t = (i + 1) / sweep2
            eased = t * t * (3 - 2 * t)
            page.evaluate(f"window.__demo.setBandLines({30 + int(eased * 1095)})")
            hold(1)
        hold(int(seg2_frames * 0.06))
        chip = center_of(page, nth_center("#band-presets button", 0))   # 贝尔德 30 行
        move(int(0.7 * FPS), (1520, 420), chip)
        hold(3, chip, click_frames=3)
        page.evaluate("window.__demo.setBandStd(0)")
        hold(int(seg2_frames * 0.12))
        chip2 = center_of(page, nth_center("#band-presets button", 5))  # 数字 1080p
        move(int(0.7 * FPS), chip, chip2)
        hold(3, chip2, click_frames=3)
        page.evaluate("window.__demo.setBandStd(5)")
        hold(max(0, seg2_frames - n2a - sweep2 - int(seg2_frames * 0.06)
                 - 2 * int(0.7 * FPS) - 6 - int(seg2_frames * 0.12)))

        # --- Segment 3: compatible color — tint sweep, then the B&W set ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('color')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.3)
        n3a = int(seg3_frames * 0.10)
        hold(n3a, tick=True)
        tint_sweep = int(seg3_frames * 0.34)
        for i in range(tint_sweep):                      # 0° → 360°: the fan spins, the stairs don't
            t = (i + 1) / tint_sweep
            page.evaluate(f"window.__demo.setTint({int(t * 360)})")
            hold(1, tick=True)
        hold(int(seg3_frames * 0.10), tick=True)
        page.evaluate("window.__demo.setTint(0)")
        bwb = center_of(page, element_center("#btn-bw"))
        move(int(0.8 * FPS), (1560, 300), bwb)
        hold(3, bwb, click_frames=3, tick=True)          # the real click — through a 1950 set
        page.evaluate("window.__demo.setBW(true)")
        hold(max(0, seg3_frames - n3a - tint_sweep - int(seg3_frames * 0.10)
                 - int(0.8 * FPS) - 3), tick=True)

        # --- Segment 4: the timeline, pin by pin ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('ladder')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.3)
        pin_indices = [2, 6, 9, 10]                      # the star, the BBC, the Moon, analog sunset
        per_pin = seg4_frames // len(pin_indices)
        from_pos = (1520, 420)
        for pin_index in pin_indices:
            pos = center_of(page, nth_center("#ladder-chart .pin", pin_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectEvent({pin_index})")
            hold(per_pin - int(0.7 * FPS) - 3)
            from_pos = pos

        # --- Segment 5: closing narration over the timeline, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        end_frames = int(round(min(5.5, seg5_total) * FPS))
        hold(max(0, int(round((seg5_total - 5.5) * FPS))))   # the star lingers

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(end_frames)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "straight-line.mp4"

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "%06d.png"),
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
    parser = argparse.ArgumentParser(description="Render the straight-line video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "straight-line.mp4")
    parser.add_argument("--srt-only", action="store_true")
    args = parser.parse_args()

    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server(port)
        with tempfile.TemporaryDirectory(prefix="straight-line-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "straight-line.srt"
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
