#!/usr/bin/env python3
"""Render the Chinese Faraday's-Ring story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright
driving the real Faraday's Ring studio through its UI and __demo API.
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
SLUG = "2026-08-29-faradays-ring"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月二十九日。一百九十五年前的今天，一八三一年八月二十九日，伦敦皇家研究院的地下室里，迈克尔·法拉第在一根六英寸的软铁环上绕了两个线圈，把电池往原线圈上一碰——副线圈的电流计指针踢了一下，立刻又回到零点；接着他断开电池，指针朝反方向又踢了一下。电磁感应，就在这个下午被人类抓了个正着。我做了一个叫法拉第铁环的工作室，把这次实验从头再演一遍。",
    "第一课：感应只看变化，不看电流。电池合上之后，原线圈里的电流稳稳地流着，整整两安培——可副线圈的指针纹丝不动，睡着了。因为感应电动势等于负 N 乘以 dΦ 比 dt：磁通不再变化，感应就一分钱不交。法拉第之前的人都在等一根一直动着的指针，只有他注意到：指针只在合闸和断闸的一瞬踢动。而且断闸那一踢，方向和合闸相反——楞次定律在场，感应永远跟你对着干。",
    "第二课：指针数的是磁通，不是新闻。冲击电流计偏转的是电荷，电荷等于 N 二乘 ΔΦ 除以 R 二，跟断得快不快毫无关系。工作室里把断开时间从三毫秒一路拖到五微秒：峰值电压涨了六百倍，可两次踢动的电荷分毫不差——屏幕下方两块阴影的面积一模一样。合闸一踢，断闸反踢一踢，这就是法拉第数磁通的办法。",
    "第三课：铁环的魔法，恰好 µ_r 倍。磁路也有自己的欧姆定律：磁动势 N 一 I 零，推着磁通穿过磁阻 ℛ，而 ℛ 等于 l 除以 µ₀ µ_r A。软铁的 µ_r 是三千，所以同一组线圈套上铁环，电感和互感一起涨三千倍。把铁芯抽走：每次踢动的电荷从六点五毫库仑缩到二点二微库仑，指针根本不会醒——这就是法拉第的险情。断闸那一踢更凶：电压想要 L 乘 I 零除以 t b，电弧把它钳住，副线圈按匝比拿走剩下的。卢姆科夫把副线圈绕到两万匝、八公里长的铜线，四万伏的火花点亮了半个世纪的实验室；一八八七年，赫兹用同样的火花发出了第一道电波——无线电就是这么来的。",
    "第四课：这个环的成年礼。别再踢了，改送交流：磁通自己摆起来，副线圈里就有源源不断的电压。V 等于四点四四乘频率乘匝数乘磁通幅值——这个四点四四不是经验系数，它是 π 乘根号二，精确值；变比就是匝比。一八八六年，美国大巴灵顿，斯坦利替西屋把这只环接上交流电网，第一座商用变压器变电站亮灯，电网从此有了语法。顺带一课：二百二十伏直接怼进五十三匝，磁密冲到二点六特斯拉，越过铁的膝点——所以真变压器都用大铁芯。",
    "物理学讲完了，看一眼账本。汽车点火线圈：六毫亨、四安、十五微秒断开，电弧钳住之后乘上匝比，火花塞上拿到整整两万六千伏——今天每台燃油车都背着一只法拉第环。你的每一只充电器、电磁炉、无线充电板，全都是负 N dΦ dt 的直系后代。奥尔巴尼的亨利先看见，法拉第先发表；从皇家研究院的地下室，到每家每户的插座，一百九十五年。去 dailyslop 点 pages 点 dev 亲手合一次闸。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月二十九日。",
        "一百九十五年前的今天，",
        "一八三一年八月二十九日，",
        "伦敦皇家研究院的地下室里，",
        "迈克尔·法拉第在一根六英寸的软铁环上",
        "绕了两个线圈，",
        "把电池往原线圈上一碰——",
        "副线圈的电流计指针踢了一下，",
        "立刻又回到零点；",
        "接着他断开电池，",
        "指针朝反方向又踢了一下。",
        "电磁感应，就在这个下午",
        "被人类抓了个正着。",
        "我做了一个叫法拉第铁环的工作室，",
        "把这次实验从头再演一遍。",
    ],
    [
        "第一课：感应只看变化，不看电流。",
        "电池合上之后，",
        "原线圈里的电流稳稳地流着，整整两安培——",
        "可副线圈的指针纹丝不动，睡着了。",
        "因为感应电动势 = −N·dΦ/dt：",
        "磁通不再变化，感应就一分钱不交。",
        "法拉第之前的人都在等一根",
        "一直动着的指针，",
        "只有他注意到：",
        "指针只在合闸和断闸的一瞬踢动。",
        "而且断闸那一踢，方向和合闸相反——",
        "楞次定律在场，感应永远跟你对着干。",
    ],
    [
        "第二课：指针数的是磁通，不是新闻。",
        "冲击电流计偏转的是电荷，",
        "q = N₂ΔΦ / R₂，",
        "跟断得快不快毫无关系。",
        "工作室里把断开时间从三毫秒",
        "一路拖到五微秒：",
        "峰值电压涨了六百倍，",
        "可两次踢动的电荷分毫不差——",
        "屏幕下方两块阴影的面积一模一样。",
        "合闸一踢，断闸反踢一踢，",
        "这就是法拉第数磁通的办法。",
    ],
    [
        "第三课：铁环的魔法，恰好 µ_r 倍。",
        "磁路也有自己的欧姆定律：",
        "磁动势 N₁I₀ 推着磁通穿过磁阻 ℛ，",
        "ℛ = l / (µ₀·µ_r·A)。",
        "软铁的 µ_r 是三千，",
        "同一组线圈套上铁环，",
        "电感和互感一起涨三千倍。",
        "把铁芯抽走：",
        "每次踢动的电荷从 6.5 mC",
        "缩到 2.2 µC，指针根本不会醒——",
        "这就是法拉第的险情。",
        "断闸那一踢更凶：",
        "电压想要 L·I₀/t_b，电弧把它钳住，",
        "副线圈按匝比拿走剩下的。",
        "卢姆科夫把副线圈绕到两万匝、",
        "八公里长的铜线，",
        "四万伏的火花点亮了半个世纪的实验室；",
        "一八八七年，赫兹用同样的火花",
        "发出了第一道电波——",
        "无线电就是这么来的。",
    ],
    [
        "第四课：这个环的成年礼。",
        "别再踢了，改送交流：",
        "磁通自己摆起来，",
        "副线圈里就有源源不断的电压。",
        "V = 4.44·f·N·Φ̂——",
        "这个四点四四不是经验系数，",
        "它是 π√2，精确值；变比就是匝比。",
        "一八八六年，美国大巴灵顿，",
        "斯坦利替西屋把这只环接上交流电网，",
        "第一座商用变压器变电站亮灯，",
        "电网从此有了语法。",
        "顺带一课：220 V 直接怼进五十三匝，",
        "磁密冲到 2.6 T，越过铁的膝点——",
        "所以真变压器都用大铁芯。",
    ],
    [
        "物理学讲完了，看一眼账本。",
        "汽车点火线圈：6 mH、4 A、15 µs 断开，",
        "电弧钳住之后乘上匝比，",
        "火花塞上拿到整整 26 kV——",
        "今天每台燃油车都背着一只法拉第环。",
        "你的每一只充电器、电磁炉、无线充电板，",
        "全都是 −N·dΦ/dt 的直系后代。",
        "奥尔巴尼的亨利先看见，法拉第先发表；",
        "从皇家研究院的地下室，",
        "到每家每户的插座，一百九十五年。",
        "去 dailyslop 点 pages 点 dev 亲手合一次闸。",
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
        color: #94a3b8; background: #0c0a07; border-bottom: 1px solid #3d3325;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #3d3325; border-radius: 7px; background: #171208; color: #f2e8d5;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #d4a437; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-29-faradays-ring</span><span class="badge">Faraday\\'s Ring · Induction · 29 Aug 1831</span>';
      document.body.appendChild(bar);
    }""")


def add_caption_overlay(page) -> None:
    page.add_style_tag(content="""
      #video-caption {
        position: fixed; left: 50%; bottom: 28px; z-index: 2147483646;
        transform: translateX(-50%); max-width: 1200px; width: max-content;
        padding: 10px 22px 12px; border-radius: 8px;
        color: #f2e8d5; background: rgba(9, 7, 5, 0.88);
        box-shadow: 0 4px 24px rgba(0,0,0,.6);
        border: 1px solid rgba(212, 164, 55, 0.45);
        text-align: center; white-space: pre-wrap;
        font: 26px/1.4 -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", "STHeiti", sans-serif;
        letter-spacing: .02em;
        text-shadow: 0 0 12px rgba(212, 164, 55, 0.3);
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

        # --- Segment 0: title card, then the first kick ---
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
        page.evaluate("window.__demo.loadPreset('ring1831')")
        page.evaluate("window.__demo.scrollToBench()")
        time.sleep(0.4)

        app0 = seg0_frames_total - title_frames
        make_at = int(app0 * 0.30)
        break_at = int(app0 * 0.74)
        for i in range(app0):
            if i == make_at:
                page.evaluate("window.__demo.setSwitch('closed')")   # the kick
            elif i == break_at:
                page.evaluate("window.__demo.setSwitch('open')")     # the spark
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 1: steady current, sleeping needle, Lenz's reverse kick ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadPreset('ring1831')")
        page.evaluate("window.__demo.scrollToBench()")
        time.sleep(0.3)
        make_at = int(seg1_frames * 0.16)
        break_at = int(seg1_frames * 0.80)
        for i in range(seg1_frames):
            if i == make_at:
                page.evaluate("window.__demo.setSwitch('closed')")
            elif i == break_at:
                page.evaluate("window.__demo.setSwitch('open')")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 2: flux counting — sweep the break time, charge holds ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadPreset('ring1831')")
        page.evaluate("window.__demo.setTab('kick')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        tb_moves = [
            (0.16, "window.__demo.setRing('tbUs', 3000)"),
            (0.40, "window.__demo.setRing('tbUs', 60)"),
            (0.62, "window.__demo.setRing('tbUs', 5)"),
            (0.84, "window.__demo.setRing('tbUs', 800)"),
        ]
        for i in range(seg2_frames):
            for at, call in tb_moves:
                if i == int(seg2_frames * at):
                    page.evaluate(call)
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 3: iron's µ_r, the near-miss, then the Ruhmkorff spike ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadPreset('ring1831')")
        page.evaluate("window.__demo.setTab('core')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        mu_moves = [
            (0.12, "window.__demo.setRing('muR', 1)"),
            (0.34, "window.__demo.setRing('muR', 3000)"),
        ]
        ruhmk_at = int(seg3_frames * 0.56)
        for i in range(seg3_frames):
            for at, call in mu_moves:
                if i == int(seg3_frames * at):
                    page.evaluate(call)
            if i == ruhmk_at:
                page.evaluate("window.__demo.loadPreset('ruhmkorff')")
                page.evaluate("window.__demo.setTab('kick')")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 4: the transformer — AC, 4.44, and the knee ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.loadPreset('ring1831')")
        page.evaluate("window.__demo.setDrive('ac')")
        page.evaluate("window.__demo.setTab('ac')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        ac_moves = [
            (0.22, "window.__demo.setRing('ac', {V1: 8})"),
            (0.48, "window.__demo.setRing('ac', {V1: 12})"),
            (0.72, "window.__demo.setRing('ac', {V1: 4.5})"),
        ]
        for i in range(seg4_frames):
            for at, call in ac_moves:
                if i == int(seg4_frames * at):
                    page.evaluate(call)
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 5: the ledger, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        hist_frames = seg5_frames - end_frames

        page.evaluate("window.__demo.loadPreset('ring1831')")
        page.evaluate("window.__demo.setTab('hist')")
        page.evaluate("window.__demo.scrollToTabs()")
        time.sleep(0.3)
        hist_top = page.evaluate("(document.querySelector('.tabs-card').getBoundingClientRect().top + window.scrollY)")
        hist_bottom = page.evaluate("Math.min(document.body.scrollHeight - window.innerHeight, document.querySelector('.tabs-card').getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40)")
        for i in range(hist_frames):
            frac = smoothstep((i / hist_frames - 0.2) / 0.65)
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
    temp_mp4 = work_dir / "faradays-ring.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Faraday's Ring video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "faradays-ring.mp4")
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
        with tempfile.TemporaryDirectory(prefix="faradays-ring-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "faradays-ring.srt"
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
