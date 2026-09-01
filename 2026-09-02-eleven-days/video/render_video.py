#!/usr/bin/env python3
"""Render the Chinese Eleven-Days story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio, with Playwright
driving the real Eleven Days studio through its UI and __demo API. The
pointer stays parked during narration and only makes short eased, slightly
curved moves before real clicks (next-morning tear, quiz answer, timeline
pins), per the house video style.
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
SLUG = "2026-09-02-eleven-days"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是九月二日。二百七十四年前的今晚，大英帝国还在用凯撒定下的旧历。星期三，九月二号，是他们写下的最后一个儒略历日期；第二天早上太阳照常升起，日历却直接翻到了九月十四号，星期四。中间的十一个日期，从九月三号到十三号，被一部法律整体删除。那一夜没有人少睡一分钟，少掉的只是十一个数字。今天我做了一个「失踪的十一天」工作室：儒略历的病根、教皇的手术、康威的口算星期法，还有复活节背后的月轮，全在五个房间里。",
    "病根在两千一百年前。凯撒的历一年三百六十五又四分之一天，比回归年长出十一分十四秒。别小看这十一分钟：春分每过一百二十八年，就在日历上提前一天。公元三二五年，尼西亚会议把春分钉在三月二十一号；到一五八二年，它已经溜到三月十一号。教皇格里高利十三世开了两刀：先删十天，十月四号星期四睡下去，十月十五号星期五醒来；再改闰年——四年一闰、百年不闰、四百年再闰，四百年只闰九十七次。改完之后，三千三百年才差一天。",
    "英国是新教国家，对教皇的历法硬是观望了一百七十年。一七零零年，儒略历多闰了一次，两历差距从十天涨到十一天，所以英国删的是十一天，不是十天。这个差距有个一行公式：年份除以一百取整，减去年份除以四百取整，再减二。代入一五八二年，十五减三减二，等于十；代入一七五二年，十七减四减二，等于十一；代入今年，二十减五减二，十三天。到二一零零年它会变成十四——那年二月二十九号，儒略历还会再闰一次，格里历不会。",
    "日期断了，星期没断。七天一轮的星期从古代一路排到今天，一次都没乱过：一七五二年九月二号是星期三，它的第二天九月十四号就是星期四。星期几还有个口算办法，数学家康威的末日算法：每个世纪一个锚日，两千年代是星期二；年份后两位加上它的四分之一，落到锚日上，就是今年的「末日」。二零二六年，二十六加六，星期二加四，等于星期六——所以今年的四月四号、六月六号、八月八号，全是星期六。九月二号差四格，星期三，和二百七十四年前同名同姓。",
    "这一切最初都是为了复活节。公元三二五年的规则：春分后第一个满月之后的第一个星期日。月亮这边，教会用一个十九年的默冬轮：十九个回归年，约等于二百三十五个朔望月，每一轮只差两小时零五分。西方换上了格里高利的新齿轮，东方还在转儒略的旧齿轮，所以今年西方四月五号过节，东方四月十二号，差的那一周大半是十三天的历差。二零二五年和二零二八年，两套齿轮会咬到同一天。",
    "这十一天到今天还活着。英国的纳税年从四月六号开始：旧岁首三月二十五号，加一七五二年的十一天，再加一八零零年的一天。东正教的圣诞节过的是儒略历十二月二十五号，落在民用历一月七号。俄国的十月革命，其实发生在十一月七号。瑞典一七一二年甚至补出过一天二月三十号。时间线上每一枚图钉点开，那次换历的前后都由引擎当场算出。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，",
        "来交 AI 每日作业了。",
        "今天是九月二日。",
        "二百七十四年前的今晚，",
        "大英帝国还在用凯撒定下的旧历。",
        "星期三，9 月 2 号，",
        "是他们写下的最后一个儒略历日期；",
        "第二天早上太阳照常升起，",
        "日历却直接翻到了",
        "9 月 14 号，星期四。",
        "中间的十一个日期，",
        "从 9 月 3 号到 13 号，",
        "被一部法律整体删除。",
        "那一夜没有人少睡一分钟，",
        "少掉的只是十一个数字。",
        "今天我做了一个「失踪的十一天」工作室：",
        "儒略历的病根、教皇的手术、",
        "康威的口算星期法，",
        "还有复活节背后的月轮，",
        "全在五个房间里。",
    ],
    [
        "病根在两千一百年前。",
        "凯撒的历一年 365 又 1/4 天，",
        "比回归年长出 11 分 14 秒。",
        "别小看这十一分钟：",
        "春分每过 128 年，",
        "就在日历上提前一天。",
        "公元 325 年，尼西亚会议",
        "把春分钉在 3 月 21 号；",
        "到 1582 年，",
        "它已经溜到 3 月 11 号。",
        "教皇格里高利十三世开了两刀：",
        "先删十天，",
        "10 月 4 号星期四睡下去，",
        "10 月 15 号星期五醒来；",
        "再改闰年——",
        "四年一闰、百年不闰、",
        "四百年再闰，",
        "四百年只闰 97 次。",
        "改完之后，",
        "3,300 年才差一天。",
    ],
    [
        "英国是新教国家，",
        "对教皇的历法硬是观望了 170 年。",
        "1700 年，儒略历多闰了一次，",
        "两历差距从 10 天涨到 11 天",
        "——所以英国删的是 11 天，不是 10 天。",
        "这个差距有个一行公式：",
        "年份除以一百取整，",
        "减去年份除以四百取整，再减二。",
        "代入 1582 年，15 − 3 − 2 = 10；",
        "代入 1752 年，17 − 4 − 2 = 11；",
        "代入今年，20 − 5 − 2 = 13 天。",
        "到 2100 年它会变成 14",
        "——那年 2 月 29 号，",
        "儒略历还会再闰一次，格里历不会。",
    ],
    [
        "日期断了，星期没断。",
        "七天一轮的星期",
        "从古代一路排到今天，一次都没乱过：",
        "1752 年 9 月 2 号是星期三，",
        "它的第二天 9 月 14 号",
        "就是星期四。",
        "星期几还有个口算办法，",
        "数学家康威的末日算法：",
        "每个世纪一个锚日，",
        "两千年代是星期二；",
        "年份后两位加上它的四分之一，",
        "落到锚日上，就是今年的「末日」。",
        "2026 年，26 + 6，",
        "星期二加四，等于星期六",
        "——所以今年的 4 月 4 号、",
        "6 月 6 号、8 月 8 号，全是星期六。",
        "9 月 2 号差四格，星期三，",
        "和二百七十四年前同名同姓。",
    ],
    [
        "这一切最初都是为了复活节。",
        "公元 325 年的规则：",
        "春分后第一个满月之后",
        "的第一个星期日。",
        "月亮这边，教会用一个",
        "十九年的默冬轮：",
        "19 个回归年 ≈ 235 个朔望月，",
        "每一轮只差 2 小时零 5 分。",
        "西方换上了格里高利的新齿轮，",
        "东方还在转儒略的旧齿轮，",
        "所以今年西方 4 月 5 号过节，",
        "东方 4 月 12 号，",
        "差的那一周大半是 13 天的历差。",
        "2025 年和 2028 年，",
        "两套齿轮会咬到同一天。",
    ],
    [
        "这十一天到今天还活着。",
        "英国的纳税年从 4 月 6 号开始：",
        "旧岁首 3 月 25 号，",
        "加 1752 年的 11 天，",
        "再加 1800 年的 1 天。",
        "东正教的圣诞节",
        "过的是儒略历 12 月 25 号，",
        "落在民用历 1 月 7 号。",
        "俄国的十月革命，",
        "其实发生在 11 月 7 号。",
        "瑞典 1712 年",
        "甚至补出过一天 2 月 30 号。",
        "时间线上每一枚图钉点开，",
        "那次换历的前后",
        "都由引擎当场算出。",
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
        color: #6b5c3e; background: #efe5c9; border-bottom: 1px solid #c9b891;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #c9b891; border-radius: 7px; background: #f8f1dd; color: #5a4a30;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #7e1f21; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-09-02-eleven-days</span><span class="badge">Eleven Days · 2 Sep 1752 · +11</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f3ead0; background: rgba(43, 33, 19, 0.9);
        box-shadow: 0 4px 24px rgba(0, 0, 0, .5);
        border: 1px solid rgba(185, 166, 121, 0.5);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(20, 14, 5, 0.6);
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


def pin_center(index: int) -> str:
    return (f"const els = document.querySelectorAll('.timeline .pin');"
            f" const r = els[{index}].getBoundingClientRect();"
            f" return [r.x + r.width / 2, r.y + r.height / 2];")


def quiz_choice_center() -> str:
    return ("const truth = Number(document.getElementById('quiz-q').dataset.truth);"
            " const kids = [...document.getElementById('quiz-choices').querySelectorAll('button')];"
            " const el = kids.find(b => ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'].indexOf(b.textContent) === truth);"
            " const r = (el || kids[0]).getBoundingClientRect();"
            " return [r.x + r.width / 2, r.y + r.height / 2];")


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

        # --- Segment 0: title card, then the night itself (live tear-off) ---
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
        page.evaluate("window.__demo.setTab('jump')")
        page.evaluate("window.__demo.resetWall()")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)

        rest0 = seg0_frames - title_frames
        before = int(rest0 * 0.42)
        hold(before)

        btn = center_of(page, element_center("#btn-morning"))
        move(int(0.9 * FPS), (1530, 860), btn)
        hold(3, btn, click_frames=3)          # the real click
        page.evaluate("window.__demo.tear()")
        tear = int(3.6 * FPS)                  # eleven ghost pages flutter off
        hold(tear)
        after0 = rest0 - before - int(0.9 * FPS) - 3 - tear
        hold(max(0, after0))                   # Thursday the 14th

        # --- Segment 1: the drift chart, Nicaea → the reform ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('drift')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.5)
        n1a = int(seg1_frames * 0.34)
        for i in range(n1a):                  # the slider glides 325 → 1582
            year = int(325 + (1582 - 325) * (i + 1) / n1a)
            page.evaluate(f"window.__demo.setDriftYear({year})")
            hold(1)
        n1b = seg1_frames - n1a
        for i in range(n1b):                  # → 1752 → today
            year = int(1582 + (2026 - 1582) * (i + 1) / n1b)
            page.evaluate(f"window.__demo.setDriftYear({year})")
            hold(1)

        # --- Segment 2: the gap formula, 11 → 13 → 14 ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        n2a = int(seg2_frames * 0.38)
        hold(n2a)
        for i in range(seg2_frames - n2a):    # 2026 → 2100, the 14th day appears
            year = int(2026 + (2100 - 2026) * (i + 1) / (seg2_frames - n2a))
            page.evaluate(f"window.__demo.setDriftYear({year})")
            hold(1)

        # --- Segment 3: Conway's doomsday, then the quiz ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('doomsday')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)
        n3a = int(seg3_frames * 0.26)
        page.evaluate("window.__demo.setDate(2026, 4, 4)")
        hold(n3a)
        page.evaluate("window.__demo.setDate(2026, 9, 2)")
        n3b = int(seg3_frames * 0.42)
        hold(n3b)

        page.evaluate("window.__demo.quizNew()")
        time.sleep(0.2)
        quiz_rest = seg3_frames - n3a - n3b
        n3q = int(quiz_rest * 0.45)
        hold(n3q)
        target = center_of(page, quiz_choice_center())
        move(int(0.8 * FPS), (1500, 700), target)
        hold(3, target, click_frames=2)
        page.evaluate("window.__demo.quizSolve()")
        hold(max(0, quiz_rest - n3q - int(0.8 * FPS) - 3))

        # --- Segment 4: the computus gears, 2026 then the 2025 coincidence ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('computus')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)
        n4a = int(seg4_frames * 0.55)
        hold(n4a)
        page.evaluate("window.__demo.setEasterYear(2025)")
        hold(seg4_frames - n4a)

        # --- Segment 5: the fossils timeline, pin by pin, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        page.evaluate("window.__demo.setTab('fossils')")
        page.evaluate("window.__demo.scrollToTop()")
        time.sleep(0.4)

        live5 = seg5_frames - end_frames
        pin_indices = [0, 3, 7, 8]             # Spain 1582, Britain 1752, Russia 1918, Greece 1923
        per_pin = live5 // (len(pin_indices) + 1)
        hold(per_pin)                          # the bare timeline first
        from_pos = (1650, 620)
        for pin_index in pin_indices:
            pos = center_of(page, pin_center(pin_index))
            move(int(0.7 * FPS), from_pos, pos)
            hold(3, pos, click_frames=3)
            page.evaluate(f"window.__demo.selectAdoption({pin_index})")
            hold(per_pin - int(0.7 * FPS) - 3)
            from_pos = pos

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        hold(end_frames)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "eleven-days.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Eleven Days video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "eleven-days.mp4")
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
        with tempfile.TemporaryDirectory(prefix="eleven-days-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "eleven-days.srt"
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
