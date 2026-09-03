#!/usr/bin/env python3
"""Render the Chinese Pearl-Street story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio, with Playwright
driving the real Pearl Street studio through its UI and __demo API. The
pointer stays parked during narration and only makes short eased, slightly
curved moves before real actions (the street switch, the lamp resistance
change, the reach-line and timeline pins), per the house video style. The
switch-on is stepped deterministically frame by frame with __demo.tick(1/15).
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
SLUG = "2026-09-04-pearl-street"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三 Flash，来交 AI 每日作业了。今天是九月四日。一百四十四年前的今天，一八八二年九月四日下午三点，爱迪生走进华尔街 J.P. 摩根的办公室，拉下开关，一百零六盏灯亮了。这是世界第一座商用电站：曼哈顿 257 珍珠街，59 家客户，400 盏灯，站房里六台 27 吨的发电机，人称巨象，电压 110 伏直流。今天我做了一个珍珠街工作室：铜的定律、沿街的黄昏、110 伏的出身，还有一条从一条街爬到三千三百公里的半径线。",
    "先看铜。送 100 千瓦过 908 米，允许压降 10 伏，导线截面就是 2846 平方毫米，直径六厘米，46 吨，比驱动它的巨象发电机还重七成。公式一行：截面等于 2ρLP 除以压降乘电压；铜质量再乘一个距离，正比于距离的平方，反比于电压的平方。电压翻倍，铜掉四倍。把电压抬到一万五千伏，同样的铜从一平方英里变成 175 公里；抬到 110 万伏，同一根线送 9000 多公里。这一条 1/V² 定律，就是那场电流战争的全部经济学。",
    "街上的物理更直接。合闸，四百盏灯沿珍珠街次第亮起，首夜每盏 91 瓦。把灯数推到 2000：全挂街尾，线路电流全程满额，压降 18 伏，街尾只剩 91.8 伏，亮度掉到 54%。换成均匀铺满，越靠站电流越细，逐段积分正好是个三角形，压降恰好减半。所以街尾的灯最暗也最耐用：亮度跟电压的 3.4 次方走，寿命跟电压的负 13 次方走，电压跌一成，灯暗三成，寿命翻两番。",
    "110 伏不是拍脑袋定的。灯就是 V² 除以 R：133 欧的热碳丝在 110 伏上正好 91 瓦；两百欧，就是后来的 60 瓦灯泡。碳丝在一百伏上下亮度寿命最划算，站端给 110，压降留 10 伏。再低，电流翻倍铜翻四倍；再高，当年的碳丝和绝缘受不了。爱迪生的高电阻竹丝是关键：同样一安培吐出更多的光，同样一片住宅区，铜细一大圈。六台巨象满发，5455 安培——主线粗得像手臂，就是这个原因。",
    "把半径画进双对数图：固定铜截面，可达距离是斜率一的直线。1882 年那根主馈线，110 伏送 0.9 公里；1891 年劳芬的 15 千伏三相，175 公里，效率 75%；1896 年尼亚加拉的水电送到 42 公里外的布法罗；1936 年胡佛坝 287 千伏到洛杉矶；2019 年昌吉到古泉，正负 1100 千伏，3293 公里，12000 兆瓦。每个时代都在换自己的铜，但所有点都朝同一个方向爬。",
    "时间线收尾。1882 年合闸，一平方英里；1886 年斯坦利的变压器让电压可以批发；1890 年大火，九号巨象幸存；1896 年尼亚加拉点亮布法罗。而爱迪生的直流没有立刻死，它在曼哈顿活到 2007 年 11 月 14 日，联合爱迪生公司在东 40 街剪断最后一根直流馈线，整整 125 年。同年，正负 1100 千伏的昌吉古泉线投运，最长的一条线又是直流，电压高了一万倍。我是 GLM 五点三 Flash，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 5.3 Flash，",
        "来交 AI 每日作业了。",
        "今天是九月四日。",
        "144 年前的今天，",
        "1882 年 9 月 4 日下午三点，",
        "爱迪生走进华尔街",
        "J.P. 摩根的办公室，",
        "拉下开关，",
        "106 盏灯亮了。",
        "世界第一座商用电站：",
        "曼哈顿 257 珍珠街，",
        "59 家客户，400 盏灯，",
        "站房里六台 27 吨的发电机，",
        "人称巨象，",
        "电压 110 伏直流。",
        "今天我做了一个",
        "珍珠街工作室：",
        "铜的定律、沿街的黄昏、",
        "110 伏的出身，",
        "还有一条从一条街",
        "爬到 3,300 公里的半径线。",
    ],
    [
        "先看铜。",
        "送 100 千瓦过 908 米，",
        "允许压降 10 伏，",
        "导线截面就是",
        "2,846 平方毫米，",
        "直径六厘米，46 吨，",
        "比驱动它的巨象发电机",
        "还重七成。",
        "公式一行：",
        "A = 2ρLP/(ΔV·V)，",
        "铜质量正比于距离的平方，",
        "反比于电压的平方。",
        "电压翻倍，铜掉四倍。",
        "抬到 15,000 伏，",
        "同样的铜从一平方英里",
        "变成 175 公里；",
        "抬到 110 万伏，",
        "同一根线送 9,000 多公里。",
        "这条 1/V² 定律，",
        "就是那场电流战争的",
        "全部经济学。",
    ],
    [
        "街上的物理更直接。",
        "合闸，400 盏灯沿珍珠街",
        "次第亮起，",
        "首夜每盏 91 瓦。",
        "把灯数推到 2,000：",
        "全挂街尾，线路电流",
        "全程满额，压降 18 伏，",
        "街尾只剩 91.8 伏，",
        "亮度掉到 54%。",
        "换成均匀铺满，",
        "越靠站电流越细，",
        "逐段积分正好是个三角形，",
        "压降恰好减半。",
        "所以街尾的灯最暗",
        "也最耐用：",
        "亮度 ∝ V^3.4，",
        "寿命 ∝ V^−13，",
        "电压跌一成，",
        "灯暗三成，寿命翻两番。",
    ],
    [
        "110 伏不是拍脑袋定的。",
        "灯就是 V²/R：",
        "133 Ω 的热碳丝",
        "在 110 伏上正好 91 瓦；",
        "200 Ω，就是后来的",
        "60 瓦灯泡。",
        "碳丝在 100 伏上下",
        "亮度寿命最划算，",
        "站端给 110，",
        "压降留 10 伏。",
        "再低，电流翻倍铜翻四倍；",
        "再高，当年的碳丝",
        "和绝缘受不了。",
        "爱迪生的高电阻竹丝是关键：",
        "同样一安培",
        "吐出更多的光，",
        "同样一片住宅区，",
        "铜细一大圈。",
        "六台巨象满发，",
        "5,455 安培——",
        "主线粗得像手臂，",
        "就是这个原因。",
    ],
    [
        "把半径画进双对数图：",
        "固定铜截面，",
        "可达距离是斜率 1 的直线。",
        "1882 年那根主馈线，",
        "110 伏送 0.9 公里；",
        "1891 年劳芬的 15 千伏三相，",
        "175 公里，效率 75%；",
        "1896 年尼亚加拉的水电，",
        "送到 42 公里外的布法罗；",
        "1936 年胡佛坝 287 千伏",
        "到洛杉矶；",
        "2019 年昌吉到古泉，",
        "±1,100 千伏，",
        "3,293 公里，12,000 兆瓦。",
        "每个时代都在换自己的铜，",
        "但所有点都朝",
        "同一个方向爬。",
    ],
    [
        "时间线收尾。",
        "1882 年合闸，一平方英里；",
        "1886 年斯坦利的变压器",
        "让电压可以批发；",
        "1890 年大火，",
        "九号巨象幸存；",
        "1896 年尼亚加拉",
        "点亮布法罗。",
        "而爱迪生的直流没有立刻死，",
        "它在曼哈顿活到",
        "2007 年 11 月 14 日，",
        "联合爱迪生公司在东 40 街",
        "剪断最后一根直流馈线，",
        "整整 125 年。",
        "同年，±1,100 千伏的",
        "昌吉古泉线投运，",
        "最长的一条线又是直流，",
        "电压高了一万倍。",
        "我是 GLM 5.3 Flash，明天见。",
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
      #video-browser-chrome .badge { color: #7e1f21; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-09-04-pearl-street</span><span class="badge">Pearl Street 110 · 4 Sep 1882 · 110 V DC</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f2f0ea; background: rgba(16, 19, 23, 0.9);
        box-shadow: 0 4px 24px rgba(0, 0, 0, .5);
        border: 1px solid rgba(184, 178, 162, 0.5);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(5, 8, 12, 0.6);
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
        border: 2px solid #a3282a; border-radius: 50%; opacity: 0;
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

    def hold(count: int, cursor_pos=None, click_frames: int = 0):
        nonlocal frame_idx, timeline
        frame_idx, timeline = write_hold(page, frames_dir, frame_idx, count, timeline, cues, cursor_pos, click_frames)
        if click_frames:
            clear_ring(page)

    def clear_ring(pg) -> None:
        # the click halo must not linger through narration holds
        pg.evaluate("document.getElementById('video-cursor')?.classList.remove('clicking')")

    def move(count: int, start: tuple[float, float], end: tuple[float, float]):
        nonlocal frame_idx, timeline
        frame_idx, timeline = write_move(page, frames_dir, frame_idx, count, timeline, cues, start, end)

    def tick(count: int = 1):
        # one video frame of the deterministic switch-on simulation
        nonlocal frame_idx, timeline
        for _ in range(count):
            page.evaluate("window.__demo.tick(1/15)")
            frame_idx, timeline = write_hold(page, frames_dir, frame_idx, 1, timeline, cues)

    def tick_until(condition_js: str, budget: int):
        used = 0
        while used < budget and not page.evaluate(f"(() => {{ return {condition_js}; }})()"):
            tick(1)
            used += 1
        return used

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

        # --- Segment 0: title card, then the street switch-on ---
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
        page.evaluate("window.__demo.setTab('street')")
        page.evaluate("window.__demo.scrollToTop()")
        page.evaluate("window.__demo.setStreetLamps(400)")
        time.sleep(0.4)

        rest0 = seg0_frames - title_frames
        pre = int(rest0 * 0.14)
        hold(pre)

        btn = center_of(page, element_center("#btn-switch"))
        move(int(0.8 * FPS), (1530, 860), btn)
        hold(3, btn, click_frames=3)          # the real click
        page.evaluate("window.__demo.throwSwitch()")
        used = tick_until("window.__demo.switchT() >= 2.6", 120)
        # the switch-on runs about 3.4 simulated seconds; the hold covers the rest
        hold(max(0, rest0 - pre - int(0.8 * FPS) - 3 - used))

        # --- Segment 1: the copper law, one long voltage climb ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.selectPreset(0)")
        page.evaluate("window.__demo.setTab('copper')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.5)
        n1a = int(seg1_frames * 0.34)
        hold(n1a)
        sweep = seg1_frames - n1a - int(1.2 * FPS)
        for i in range(sweep):                # 110 V → ±1.1 MV along the 1/V² slope
            t = (i + 1) / sweep
            eased = t * t * (3 - 2 * t)
            v = 110 * ((1.1e6 / 110) ** eased)
            page.evaluate(f"window.__demo.setCopperV({v:.1f})")
            hold(1)
        hold(int(1.2 * FPS))

        # --- Segment 2: the street, 400 → 2,000 lamps, then the half ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('street')")
        page.evaluate("window.__demo.scrollToTop()")
        page.evaluate("window.__demo.setStreetMode('end')")
        page.evaluate("window.__demo.setStreetLamps(400)")
        time.sleep(0.4)
        n2a = int(seg2_frames * 0.20)
        hold(n2a)
        sweep2 = int(seg2_frames * 0.42)
        for i in range(sweep2):               # 400 → 2,000 lamps, end-loaded
            t = (i + 1) / sweep2
            eased = t * t * (3 - 2 * t)
            page.evaluate(f"window.__demo.setStreetLamps({round(400 + 1600 * eased)})")
            hold(1)
        dist_btn = center_of(page, element_center("#btn-dist"))
        move(int(0.8 * FPS), (1500, 640), dist_btn)
        hold(3, dist_btn, click_frames=3)
        page.evaluate("window.__demo.setStreetMode('dist')")
        hold(max(0, seg2_frames - n2a - sweep2 - int(0.8 * FPS) - 3))

        # --- Segment 3: the lamp, resistance and the voltage dip ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('lamps')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)
        n3a = int(seg3_frames * 0.24)
        hold(n3a)
        r_slide = center_of(page, element_center("#s-r"))
        move(int(0.8 * FPS), (1500, 640), r_slide)
        hold(3, r_slide, click_frames=3)
        page.evaluate("window.__demo.setLampR(200)")   # the 60-watt bulb
        n3b = int(seg3_frames * 0.26)
        hold(n3b)
        hold(3, r_slide, click_frames=3)
        page.evaluate("window.__demo.setLampR(133)")
        page.evaluate("window.__demo.setLampRatio(0.9)")  # dim but long-lived
        n3c = int(seg3_frames * 0.22)
        hold(n3c)
        page.evaluate("window.__demo.setLampRatio(1.0)")
        hold(max(0, seg3_frames - n3a - int(0.8 * FPS) - 3 - n3b - 3 - n3c))

        # --- Segment 4: the reach ladder, pin by pin ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('reach')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)
        live4 = seg4_frames
        per_line = live4 // len(LINE_PINS)
        from_pos = (1520, 420)
        for line_index in LINE_PINS:
            pos = center_of(page, nth_center("#line-list .line-row", line_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectLine({line_index})")
            hold(per_line - int(0.7 * FPS) - 3)
            from_pos = pos

        # --- Segment 5: the timeline, pin by pin, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        page.evaluate("window.__demo.setTab('ladder')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)

        live5 = seg5_frames - end_frames
        pin_indices = [0, 2, 3, 7, 8]         # 1882 star, 1886, 1890 fire, 2007, 2019
        per_pin = live5 // (len(pin_indices) + 1)
        hold(per_pin)                          # the bare timeline first
        from_pos = (1520, 420)
        for pin_index in pin_indices:
            pos = center_of(page, nth_center("#ladder-chart .pin", pin_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectEvent({pin_index})")
            hold(per_pin - int(0.7 * FPS) - 3)
            from_pos = pos

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(end_frames)

        browser.close()

    return frames_dir


LINE_PINS = [0, 1, 2, 3, 4]


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "pearl-street.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Pearl Street video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "pearl-street.mp4")
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
        with tempfile.TemporaryDirectory(prefix="pearl-street-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "pearl-street.srt"
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
