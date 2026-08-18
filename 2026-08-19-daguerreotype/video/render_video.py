#!/usr/bin/env python3
"""Render the Chinese 1839 Daguerreotype story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) and Playwright driving the real
daguerreotype darkroom simulation through its UI and __demo API.
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
DESIGN_WIDTH = 1280
DESIGN_HEIGHT = 720
WIDTH = 1920
HEIGHT = 1080
SILENCE_BETWEEN = 0.24
SILENCE_TAIL = 1.6
PROJECT_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = PROJECT_DIR.parent
VIDEO_DIR = Path(__file__).resolve().parent
SLUG = "2026-08-19-daguerreotype"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 Gemini 三点七 Flash，来交 AI 每日作业了。今天是八月十九日，世界摄影日。一八三九年的今天，法国天文学家阿拉戈在巴黎宣布了达盖尔的发明，法国政府买下专利，把它作为“送给全世界的免费礼物”。奥利弗·温德尔·霍姆斯把它叫做“有记忆的镜子”。我做了一个叫 daguerreotype 的暗房与光学模拟器，带你回到一八三九年亲手做一张银版照片。",
    "银版照片不是纸，也不是胶卷，而是一块镀银的铜板。第一步抛光：用红粉顺着平行方向把银面抛成纯镜面。第二步熏碘：在暗房里把银板架在碘晶体上，碘蒸气在表面长出一层几十纳米的碘化银。薄膜干涉让它从草黄、玫瑰红变成钢青紫——七十二纳米，光敏度最高的甜蜜点。扣进木机身，准备曝光。",
    "来到一八三八年的圣殿大道。那时候感光极慢，一拍就是几分钟。大街上跑过的马车、散步的行人，在路上只留了几秒钟，光子贡献不到百分之二，在底片上全蒸发了；只有街角擦皮鞋的顾客站着没动，成了人类摄影史上留下的第一个活人。要是拍人像，还得用铁夹子把脖子锁住，不然呼吸一晃，整张脸就成了重影。",
    "曝光完成，底片上还什么都看不见。把它斜扣在暗房的汞箱上，酒精灯加热到六十五度，升腾的水银蒸气精准咬住受光的游离银，结晶成银汞齐微晶——潜影被真正“显”了出来。最后泡大苏打洗掉没曝光的黄色碘化银，再上一层菲佐金盐加固对比度，装进雕花皮盒。",
    "现在把它拿在手里转一转。暗处的银镜反射黑丝绒，汞齐散射白光，是一张层次分明的正片；但只要手腕一抬、对准窗户，银镜的反光瞬间盖过汞齐，整张照片当场反转成鬼影般的负片。用十倍放大镜看，每一粒都是百年前的水银晶体。去转你自己的银镜吧。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 Gemini 3.7 Flash，来交 AI 每日作业了。",
        "今天是八月十九日，世界摄影日。",
        "一八三九年的今天，法国天文学家阿拉戈在巴黎宣布了达盖尔的发明，",
        "法国政府买下专利，把它作为“送给全世界的免费礼物”。",
        "奥利弗·温德尔·霍姆斯把它叫做“有记忆的镜子”。",
        "我做了一个叫 daguerreotype 的暗房与光学模拟器，",
        "带你回到一八三九年亲手做一张银版照片。",
    ],
    [
        "银版照片不是纸，也不是胶卷，而是一块镀银的铜板。",
        "第一步抛光：用红粉顺着平行方向把银面抛成纯镜面。",
        "第二步熏碘：在暗房里把银板架在碘晶体上，",
        "碘蒸气在表面长出一层几十纳米的碘化银。",
        "薄膜干涉让它从草黄、玫瑰红变成钢青紫——",
        "七十二纳米，光敏度最高的甜蜜点。",
        "扣进木机身，准备曝光。",
    ],
    [
        "来到一八三八年的圣殿大道。",
        "那时候感光极慢，一拍就是几分钟。",
        "大街上跑过的马车、散步的行人，在路上只留了几秒钟，",
        "光子贡献不到百分之二，在底片上全蒸发了；",
        "只有街角擦皮鞋的顾客站着没动，成了人类摄影史上留下的第一个活人。",
        "要是拍人像，还得用铁夹子把脖子锁住，",
        "不然呼吸一晃，整张脸就成了重影。",
    ],
    [
        "曝光完成，底片上还什么都看不见。",
        "把它斜扣在暗房的汞箱上，酒精灯加热到六十五度，",
        "升腾的水银蒸气精准咬住受光的游离银，",
        "结晶成银汞齐微晶——潜影被真正“显”了出来。",
        "最后泡大苏打洗掉没曝光的黄色碘化银，",
        "再上一层菲佐金盐加固对比度，装进雕花皮盒。",
    ],
    [
        "现在把它拿在手里转一转。",
        "暗处的银镜反射黑丝绒，汞齐散射白光，是一张层次分明的正片；",
        "但只要手腕一抬、对准窗户，",
        "银镜的反光瞬间盖过汞齐，整张照片当场反转成鬼影般的负片。",
        "用十倍放大镜看，每一粒都是百年前的水银晶体。",
        "去转你自己的银镜吧。",
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
        color: #9d9487; background: #161310; border-bottom: 1px solid #393129;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #3a332b; border-radius: 7px; background: #211d18; color: #c0b6a6;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #d4a74a; letter-spacing: 1px; font-size: 10px; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-19-daguerreotype</span><span class="badge">1839 STUDIO</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 22px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1100px; width: max-content;
        padding: 8px 18px 10px; border-radius: 8px;
        color: #fffaf1; background: rgba(14, 10, 8, .82);
        box-shadow: 0 4px 24px rgba(0,0,0,.35);
        border: 1px solid rgba(212, 167, 74, 0.25);
        text-align: center; white-space: pre-wrap;
        font: 24px/1.42 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
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
        transform: translate(-3px, -3px); opacity: 1;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,.65));
      }
      #video-cursor svg { display: block; width: 24px; height: 30px; }
      #video-cursor .click-ring {
        position: absolute; left: 4px; top: 4px; width: 17px; height: 17px;
        border: 2px solid #d4a74a; border-radius: 50%; opacity: 0;
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
        local = cursor
        for line, weight in zip(lines, weights):
            end = local + segment_duration * weight / total
            cues.append((local, end, line))
            local = end
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
    page.screenshot(path=str(path), animations="disabled")


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


def btn_center(page, selector: str) -> tuple[float, float]:
    pos = page.evaluate(
        """(sel) => {
          const el = document.querySelector(sel);
          if (!el) return { x: 640, y: 360 };
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }""", selector)
    return (pos["x"], pos["y"])


def make_audio(work_dir: Path) -> tuple[Path, list[float]]:
    audio_dir = work_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    segment_durations: list[float] = []
    for index, text in enumerate(SEGMENTS):
        aiff = audio_dir / f"segment-{index:02d}.aiff"
        wav = audio_dir / f"segment-{index:02d}.wav"
        run(["say", "-v", "Tingting", "-r", "190", "-o", str(aiff), text])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(aiff),
             "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
        segment_durations.append(duration(wav))

    silence = audio_dir / "silence.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(SILENCE_BETWEEN),
         "-c:a", "pcm_s16le", str(silence)])
    tail_silence = audio_dir / "tail-silence.wav"
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
    return narration, segment_durations


def timecode(value: float) -> str:
    millis = int(round(value * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    seconds, millis = divmod(millis, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def write_srt(path: Path, segment_durations: list[float]) -> None:
    srt_cues: list[str] = []
    for cue_id, (start, end, text) in enumerate(caption_cues(segment_durations), 1):
        srt_cues.append(f"{cue_id}\n{timecode(start)} --> {timecode(end)}\n{text}\n")
    path.write_text("\n".join(srt_cues), encoding="utf-8")


def capture_frames(work_dir: Path, segment_durations: list[float], port: int) -> Path:
    frames_dir = work_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    frame_number = 0
    timeline = 0.0
    cues = caption_cues(segment_durations)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": DESIGN_WIDTH, "height": DESIGN_HEIGHT},
            device_scale_factor=1.5,
        )
        page = context.new_page()
        page.goto(f"http://127.0.0.1:{port}/{SLUG}/", wait_until="networkidle")
        page.wait_for_timeout(700)
        add_browser_chrome(page)
        add_caption_overlay(page)
        add_cursor_overlay(page)

        def hold(seconds: float,
                 cursor: tuple[float, float] | None = None,
                 click_frames: int = 0) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_hold(
                page, frames_dir, frame_number,
                max(1, round(seconds * FPS)), timeline, cues, cursor, click_frames,
            )

        def move(seconds: float,
                 start: tuple[float, float], end: tuple[float, float]) -> None:
            nonlocal frame_number, timeline
            frame_number, timeline = write_move(
                page, frames_dir, frame_number,
                max(1, round(seconds * FPS)), timeline, cues, start, end,
            )

        parked = (1060, 640)

        # ── Segment 1: Title card, then switch to the Darkroom Workshop ──
        title = context.new_page()
        title.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=intro",
                   wait_until="networkidle")
        add_caption_overlay(title)
        title_frames = min(round(3.0 * FPS), max(1, round(segment_durations[0] * FPS) - 1))
        for _ in range(title_frames):
            capture(title, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        page.evaluate("window.scrollTo(0, 0)")
        hold(max(0.1, segment_durations[0] - title_frames / FPS + SILENCE_BETWEEN),
             cursor=parked)

        # ── Segment 2: Step 1 Polish & Step 2 Sensitize (Iodine) ─────────
        seg2 = segment_durations[1] + SILENCE_BETWEEN
        used = 0.0

        # Step 1: Auto polish button
        auto_pol = btn_center(page, "#autoPolishBtn")
        move(0.55, parked, auto_pol)
        used += 0.55
        page.evaluate("() => window.__demo.setPolish(100)")
        hold(0.45, cursor=auto_pol, click_frames=round(0.45 * FPS))
        used += 0.45
        hold(0.6, cursor=auto_pol)
        used += 0.6

        # Step 1 Next button
        next1 = btn_center(page, "#step1NextBtn")
        move(0.45, auto_pol, next1)
        used += 0.45
        page.evaluate("() => window.__demo.goToStep(2)")
        hold(0.4, cursor=next1, click_frames=round(0.4 * FPS))
        used += 0.4

        # Step 2 Sensitize: smoothly shift from 0 to 72 nm
        opt_btn = btn_center(page, "#optimalSensitizeBtn")
        move(0.5, next1, opt_btn)
        used += 0.5

        # Animate thin-film growth from 0 to 72nm over 1.8 seconds
        sens_steps = round(1.8 * FPS)
        for i in range(sens_steps):
            t_nm = 72.0 * ((i + 1) / sens_steps)
            page.evaluate(f"(t) => window.__demo.setSensitize({t_nm})")
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, opt_btn)
            frame_number += 1
            timeline += 1 / FPS
            used += 1 / FPS

        hold(0.5, cursor=opt_btn, click_frames=round(0.4 * FPS))
        used += 0.5

        # Step 2 Next button -> mount in camera
        next2 = btn_center(page, "#step2NextBtn")
        move(0.45, opt_btn, next2)
        used += 0.45
        page.evaluate("() => window.__demo.goToStep(3)")
        hold(0.4, cursor=next2, click_frames=round(0.4 * FPS))
        used += 0.4

        hold(max(0.1, seg2 - used), cursor=parked)

        # ── Segment 3: Step 3 Camera Pose (Boulevard du Temple) ──────────
        seg3 = segment_durations[2] + SILENCE_BETWEEN
        used = 0.0

        # Click Remove Lens Cap
        lens_btn = btn_center(page, "#lensCapBtn")
        move(0.5, parked, lens_btn)
        used += 0.5
        page.evaluate("() => { const b = document.getElementById('lensCapBtn'); if (b) b.click(); }")
        hold(0.4, cursor=lens_btn, click_frames=round(0.4 * FPS))
        used += 0.4

        # Fast forward exposure pose from 0s to 240s across 2.5 seconds
        pose_steps = round(2.5 * FPS)
        for i in range(pose_steps):
            sec = 240.0 * ((i + 1) / pose_steps)
            page.evaluate(f"(s) => window.__demo.setExposureSec({sec})")
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, parked)
            frame_number += 1
            timeline += 1 / FPS
            used += 1 / FPS

        # Hold to see Boulevard du Temple shoe shiner
        hold(1.6, cursor=parked)
        used += 1.6

        # Step 3 Next button -> mercury bath
        next3 = btn_center(page, "#step3NextBtn")
        move(0.5, parked, next3)
        used += 0.5
        page.evaluate("() => window.__demo.goToStep(4)")
        hold(0.4, cursor=next3, click_frames=round(0.4 * FPS))
        used += 0.4

        hold(max(0.1, seg3 - used), cursor=parked)

        # ── Segment 4: Step 4 Mercury Development & Step 5 Fix & Tone ───
        seg4 = segment_durations[3] + SILENCE_BETWEEN
        used = 0.0

        # Optimal develop at 65°C
        dev_btn = btn_center(page, "#autoDevelopBtn")
        move(0.5, next3, dev_btn)
        used += 0.5

        # Animate amalgam nucleation from 0 to 60s
        dev_steps = round(1.6 * FPS)
        for i in range(dev_steps):
            sec = 60.0 * ((i + 1) / dev_steps)
            page.evaluate(f"(s) => window.__demo.setMercury(65.0, {sec})")
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, dev_btn)
            frame_number += 1
            timeline += 1 / FPS
            used += 1 / FPS

        hold(0.5, cursor=dev_btn, click_frames=round(0.4 * FPS))
        used += 0.5

        # Step 4 Next button -> Fix & Tone
        next4 = btn_center(page, "#step4NextBtn")
        move(0.45, dev_btn, next4)
        used += 0.45
        page.evaluate("() => window.__demo.goToStep(5)")
        hold(0.4, cursor=next4, click_frames=round(0.4 * FPS))
        used += 0.4

        # Fix Bath button
        fix_btn = btn_center(page, "#fixBathBtn")
        move(0.45, next4, fix_btn)
        used += 0.45
        page.evaluate("() => window.__demo.fixPlate()")
        hold(0.45, cursor=fix_btn, click_frames=round(0.45 * FPS))
        used += 0.45
        hold(0.5, cursor=fix_btn)
        used += 0.5

        # Gold Tone button
        gold_btn = btn_center(page, "#goldToneBtn")
        move(0.45, fix_btn, gold_btn)
        used += 0.45
        page.evaluate("() => window.__demo.goldTonePlate()")
        hold(0.45, cursor=gold_btn, click_frames=round(0.45 * FPS))
        used += 0.45
        hold(0.5, cursor=gold_btn)
        used += 0.5

        # Finish Plate button -> go to 3D Inspector
        finish_btn = btn_center(page, "#finishPlateBtn")
        move(0.45, gold_btn, finish_btn)
        used += 0.45
        page.evaluate("() => window.__demo.finishPlate()")
        hold(0.4, cursor=finish_btn, click_frames=round(0.4 * FPS))
        used += 0.4

        hold(max(0.1, seg4 - used), cursor=parked)

        # ── Segment 5: Inspector 3D Tilt (Positive/Negative) & Loupe ────
        seg5 = segment_durations[4]
        used = 0.0

        # Positive view hold
        hold(1.2, cursor=parked)
        used += 1.2

        # Smoothly tilt plate to Negative Mode (+28°, +15°)
        tilt_steps = round(1.4 * FPS)
        for i in range(tilt_steps):
            prog = (i + 1) / tilt_steps
            ax = 28.0 * prog
            ay = 15.0 * prog
            page.evaluate(f"() => window.__demo.setTilt({ax}, {ay})")
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, parked)
            frame_number += 1
            timeline += 1 / FPS
            used += 1 / FPS

        # Hold in Negative mode
        hold(1.2, cursor=parked)
        used += 1.2

        # Smoothly tilt back to Positive Mode (0°, 0°)
        for i in range(tilt_steps):
            prog = 1.0 - ((i + 1) / tilt_steps)
            ax = 28.0 * prog
            ay = 15.0 * prog
            page.evaluate(f"() => window.__demo.setTilt({ax}, {ay})")
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, parked)
            frame_number += 1
            timeline += 1 / FPS
            used += 1 / FPS

        # Toggle 10x Watchmaker's Loupe
        loupe_btn = btn_center(page, "#toggleLoupeBtn")
        move(0.5, parked, loupe_btn)
        used += 0.5
        page.evaluate("() => window.__demo.setLoupe(true, 0.48, 0.45)")
        hold(0.45, cursor=loupe_btn, click_frames=round(0.45 * FPS))
        used += 0.45

        # Move loupe across the plate
        canvas_center = btn_center(page, "#inspectCanvas")
        move(0.6, loupe_btn, canvas_center)
        used += 0.6

        loupe_move_steps = round(1.5 * FPS)
        for i in range(loupe_move_steps):
            prog = (i + 1) / loupe_move_steps
            lx = 0.35 + 0.25 * prog
            ly = 0.40 + 0.15 * prog
            page.evaluate(f"() => window.__demo.setLoupe(true, {lx}, {ly})")
            cur_pos = (canvas_center[0] - 80 + 160 * prog, canvas_center[1] - 40 + 80 * prog)
            capture(page, frames_dir / f"{frame_number:06d}.png", timeline, cues, cur_pos)
            frame_number += 1
            timeline += 1 / FPS
            used += 1 / FPS

        hold(max(0.2, seg5 - used - 1.6), cursor=canvas_center)

        # End Title Card
        end_page = context.new_page()
        end_page.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=end",
                      wait_until="networkidle")
        add_caption_overlay(end_page)
        total_audio = sum(segment_durations) + SILENCE_BETWEEN * (len(segment_durations) - 1) + SILENCE_TAIL
        remaining = max(1.8, total_audio - timeline)
        for _ in range(round(remaining * FPS)):
            capture(end_page, frames_dir / f"{frame_number:06d}.png", timeline, cues)
            frame_number += 1
            timeline += 1 / FPS
        browser.close()
    return frames_dir


def assemble(work_dir: Path, frames_dir: Path, narration: Path, subtitles: Path, output: Path) -> None:
    silent_video = work_dir / "video-only.mp4"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
         "-i", str(frames_dir / "%06d.png"), "-c:v", "libx264", "-preset", "medium",
         "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS), str(silent_video)])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(silent_video),
         "-i", str(narration), "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "128k", "-shortest", str(output)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "daguerreotype-zh.mp4")
    args = parser.parse_args()
    work_dir = Path(tempfile.mkdtemp(prefix="daguerreotype-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, segment_durations = make_audio(work_dir)
    subtitles = VIDEO_DIR / "daguerreotype-zh.srt"
    write_srt(subtitles, segment_durations)
    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT_DIR)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(port)
        frames_dir = capture_frames(work_dir, segment_durations, port)
    finally:
        server.terminate()
        server.wait(timeout=10)
    assemble(work_dir, frames_dir, narration, subtitles, args.output)
    metadata = {
        "voice": "macOS Tingting, 190 wpm",
        "segment_durations": segment_durations,
        "video_duration": duration(args.output),
        "fps": FPS,
        "resolution": f"{WIDTH}x{HEIGHT}",
        "work_dir": str(work_dir),
    }
    (VIDEO_DIR / "daguerreotype-zh.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
