#!/usr/bin/env python3
"""Render the Chinese WEAF-660 story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright
driving the real WEAF 660 studio through its UI and __demo API.
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
SLUG = "2026-08-28-weaf-660"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月二十八日。一百零四年前的今天下午，一九二二年八月二十八日五点一刻，纽约 WEAF 电台播出了公认的第一条付费广播广告：电话公司 AT&T，把十分钟播出时间卖给了昆斯伯罗地产公司——五十美元，布莱克韦尔先生对着话筒，推销杰克逊高地的「霍桑庭院」公寓。电话公司给这门生意起的名字很直白：收费广播，把播出时间当长途电话卖。我做了一个叫 WEAF 660 的工作室，把这条广告背后的物理学重新开播。",
    "第一课：怎么把声音驮在电波上。人耳听不见六十六万赫兹的载波，所以让载波的振幅跟着声音起伏：s(t) 等于 A 乘以括号一加 m 倍 cos ω_m t，再乘 cos ω_c t。一条三角恒等式把它拆成恰好三条谱线：载波，加上下两个边带，各高 A·m/2。调幅度拉到一，边带恰好拿走三分之一的功率——载波那三分之二，一个比特的信息都不带。再往上拖就越调制：包络翻相、频谱开花、邻台遭殃。所以广播台的铁律：m 不许超过一。",
    "第二课：一九二二年的听众怎么收下它。天线、线圈、可变电容，方铅矿上弯一根猫须。谐振频率 f0 等于 2π 分之一乘根号 LC：二百五十微亨的线圈想把六百六十千赫调到峰，电容恰好二百三十三皮法，正好落在标准可变电容行程的正中间。Q 值一百零四，带宽六千四百赫，一个台刚好塞进去；偏二十千赫的邻台只被压到负十六分贝——单回路天生爱串台，再补一级才太平。检波是猫须二极管加 RC 负载：平方律检出的声音，自带四分之 m 的二次谐波失真；RC 太小，载波纹波钻进耳机；太大，又追不上包络最陡的下坡。教科书条件写在卡上：RC 不超过根号下一减 m 方，除以 m 乘 ω_m。",
    "第三课：白天与黑夜。这条广告播在下午五点一刻，大白天：D 层把天波吞得干干净净，只剩贴地爬行的地波，场强按一比距离衰减，稳稳当当。入夜之后 D 层消失，一百公里高的 E 层把天波弹回地面，两路电波在收音机里相加：场强是根号下，Eg 平方加 Es 平方，加二倍 Eg Es 乘 cos φ。幅度相等、相位相反，场强归零——深夜广播忽大忽小的选择性衰落，就是两条路在打架。波长四百五十四米：半个波长的路程差，就是一次从波峰到深谷的摆动。",
    "物理学讲完了，账本更精彩。到十月，WEAF 的收费广播累计卖出五百五十美元——恰好十一条「霍桑级」广告。电台第一次要回答「到底谁在听」，收听率调查就从这个缺口里长出来。四年之后，AT&T 把 WEAF 卖给 RCA，它成了 NBC 红网的种子；一九四六年改叫 WNBC；一九八八年，六百六十千赫移交体育台 WFAN——这个频率今天还在播音，从卖公寓到播橄榄球，一百零四年没下过班。",
    "当年，五十美元买十分钟：每分钟五美元，每秒八美分。今天超级碗一条三十秒广告七百万美元，每分钟贵了三百万倍——而这一切，始于一个下午、一位地产公司经理，和一支对着方铅矿弯下腰的猫须。去 dailyslop 点 pages 点 dev 亲自调台。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月二十八日。",
        "一百零四年前的今天下午，",
        "一九二二年八月二十八日五点一刻，",
        "纽约 WEAF 电台播出了",
        "公认的第一条付费广播广告：",
        "电话公司 AT&T 把十分钟播出时间，",
        "卖给了昆斯伯罗地产公司——五十美元，",
        "布莱克韦尔先生对着话筒，",
        "推销杰克逊高地的「霍桑庭院」公寓。",
        "电话公司给这门生意起的名字很直白：收费广播，",
        "把播出时间当长途电话卖。",
        "我做了一个叫 WEAF 660 的工作室，",
        "把这条广告背后的物理学重新开播。",
    ],
    [
        "第一课：怎么把声音驮在电波上。",
        "人耳听不见六十六万赫兹的载波，",
        "所以让载波的振幅跟着声音起伏：",
        "s(t) = A(1 + m·cos ω_m t)·cos ω_c t。",
        "一条三角恒等式把它拆成恰好三条谱线：",
        "载波，加上下两个边带，各高 A·m/2。",
        "调幅度拉到一，",
        "边带恰好拿走三分之一的功率——",
        "载波那三分之二，一个比特的信息都不带。",
        "再往上拖就越调制：",
        "包络翻相、频谱开花、邻台遭殃。",
        "所以广播台的铁律：m 不许超过一。",
    ],
    [
        "第二课：一九二二年的听众怎么收下它。",
        "天线、线圈、可变电容，方铅矿上弯一根猫须。",
        "谐振频率 f₀ = 1/(2π√LC)：",
        "二百五十微亨的线圈想把六百六十千赫调到峰，",
        "电容恰好二百三十三皮法，",
        "正好落在标准可变电容行程的正中间。",
        "Q 值一百零四，带宽六千四百赫，",
        "一个台刚好塞进去；",
        "偏二十千赫的邻台只被压到负十六分贝——",
        "单回路天生爱串台，再补一级才太平。",
        "检波是猫须二极管加 RC 负载：",
        "平方律检出的声音，自带 m/4 的二次谐波失真；",
        "RC 太小，载波纹波钻进耳机；",
        "太大，又追不上包络最陡的下坡。",
        "教科书条件：RC ≤ √(1−m²)/(m·ω_m)。",
    ],
    [
        "第三课：白天与黑夜。",
        "这条广告播在下午五点一刻，大白天：",
        "D 层把天波吞得干干净净，",
        "只剩贴地爬行的地波，",
        "场强按 1/距离 衰减，稳稳当当。",
        "入夜之后 D 层消失，",
        "一百公里高的 E 层把天波弹回地面，",
        "两路电波在收音机里相加：",
        "场强 = √(E_g² + E_s² + 2·E_g·E_s·cos φ)。",
        "幅度相等、相位相反，场强归零——",
        "深夜广播忽大忽小的选择性衰落，",
        "就是两条路在打架。",
        "波长四百五十四米：",
        "半个波长的路程差，就是一次从波峰到深谷的摆动。",
    ],
    [
        "物理学讲完了，账本更精彩。",
        "到十月，WEAF 的收费广播累计卖出五百五十美元——",
        "恰好十一条「霍桑级」广告。",
        "电台第一次要回答「到底谁在听」，",
        "收听率调查就从这个缺口里长出来。",
        "四年之后，AT&T 把 WEAF 卖给 RCA，",
        "它成了 NBC 红网的种子；",
        "一九四六年改叫 WNBC；",
        "一九八八年，六百六十千赫移交体育台 WFAN——",
        "这个频率今天还在播音，",
        "从卖公寓到播橄榄球，一百零四年没下过班。",
    ],
    [
        "当年，五十美元买十分钟：",
        "每分钟五美元，每秒八美分。",
        "今天超级碗一条三十秒广告七百万美元，",
        "每分钟贵了三百万倍——",
        "而这一切，始于一个下午、一位地产公司经理，",
        "和一支对着方铅矿弯下腰的猫须。",
        "去 dailyslop 点 pages 点 dev 亲自调台。",
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
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-28-weaf-660</span><span class="badge">WEAF 660 · First Ad · 28 Aug 1922</span>';
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

        # --- Segment 0: title card, then the transmitter goes on air ---
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
        page.evaluate("window.__demo.loadPreset('air')")
        page.evaluate("window.__demo.scrollToScope()")
        time.sleep(0.4)

        app0 = seg0_frames_total - title_frames
        off_at = int(app0 * 0.30)
        on_at = int(app0 * 0.42)
        for i in range(app0):
            if i == off_at:
                page.evaluate("window.__demo.setOnAir(false)")  # dead air…
            elif i == on_at:
                page.evaluate("window.__demo.setOnAir(true)")   # …and we're back
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 1: the AM identity, full modulation, then splatter ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        m_moves = [
            (0.22, "window.__demo.setTx('m', 1.0)"),
            (0.45, "window.__demo.setTx('m', 1.35)"),
            (0.72, "window.__demo.setTx('m', 0.85)"),
        ]
        for i in range(seg1_frames):
            for at, call in m_moves:
                if i == int(seg1_frames * at):
                    page.evaluate(call)
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 2: the crystal set — hunt for WEAF, then the RC seesaw ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('rx')")
        page.evaluate("window.__demo.scrollToRx()")
        time.sleep(0.2)

        def cap_at(k: float) -> float:
            # sweep off-station, past the neighbours, and home onto 232.6 pF
            if k < 0.18:
                return 232.6 + (300.0 - 232.6) * smoothstep(k / 0.18)
            if k < 0.34:
                return 300.0 + (195.0 - 300.0) * smoothstep((k - 0.18) / 0.16)
            if k < 0.48:
                return 195.0 + (232.6 - 195.0) * smoothstep((k - 0.34) / 0.14)
            return 232.6

        rc_moves = [
            (0.56, "window.__demo.setRx('loadRCuS', 8)"),
            (0.68, "window.__demo.setRx('loadRCuS', 260)"),
            (0.82, "window.__demo.setRx('loadRCuS', 60)"),
        ]
        for i in range(seg2_frames):
            k = i / seg2_frames
            page.evaluate(f"window.__demo.setRx('capPf', {cap_at(k):.1f})")
            for at, call in rc_moves:
                if i == int(seg2_frames * at):
                    page.evaluate(call)
            if i == int(seg2_frames * 0.90):
                page.evaluate("window.__demo.setRx('stages', 2)")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 3: day into night, the two-ray fade ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setRx('stages', 1)")
        page.evaluate("window.__demo.setTab('prop')")
        page.evaluate("window.__demo.setProp('night', false)")
        page.evaluate("window.__demo.scrollToRx()")
        time.sleep(0.2)
        prop_moves = [
            (0.16, "window.__demo.setProp('distKm', 90)"),
            (0.36, "window.__demo.setProp('night', true)"),
            (0.48, "window.__demo.setProp('skyAmp', 0.95)"),
            (0.70, "window.__demo.setProp('distKm', 45)"),
        ]
        for i in range(seg3_frames):
            for at, call in prop_moves:
                if i == int(seg3_frames * at):
                    page.evaluate(call)
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 4: the ledger and the century of 660 ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('hist')")
        page.evaluate("window.__demo.scrollToRx()")
        time.sleep(0.2)
        hist_top = page.evaluate("(document.querySelector('.tabs-card').getBoundingClientRect().top + window.scrollY)")
        hist_bottom = page.evaluate("Math.min(document.body.scrollHeight - window.innerHeight, document.querySelector('.tabs-card').getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40)")
        for i in range(seg4_frames):
            frac = smoothstep((i / seg4_frames - 0.25) / 0.6)
            page.evaluate(f"window.scrollTo(0, {hist_top + (hist_bottom - hist_top) * frac:.0f})")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 5: back at the dial, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        app_frames = seg5_frames - end_frames

        page.evaluate("window.__demo.setTab('rx')")
        page.evaluate("window.__demo.loadPreset('air')")
        page.evaluate("window.__demo.scrollToRx()")
        time.sleep(0.3)
        for i in range(app_frames):
            if i == int(app_frames * 0.55):
                page.evaluate("window.__demo.tuneToWeaf()")
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
    temp_mp4 = work_dir / "weaf-660.mp4"

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
    parser = argparse.ArgumentParser(description="Render the WEAF 660 video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "weaf-660.mp4")
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
        with tempfile.TemporaryDirectory(prefix="weaf-660-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "weaf-660.srt"
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
