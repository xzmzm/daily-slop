#!/usr/bin/env python3
"""Render the Chinese Drake-Well story video from local captures + TTS.

Reproducible with local TTS (macOS Tingting) or Fish Audio and Playwright
driving the real Drake's Derrick studio through its UI and __demo API.
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
SLUG = "2026-08-27-drake-well"

# Narration. Natural, lightly humorous, factual. Opens with the house line.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天是八月二十七日。一百六十七年前的今天，一八五九年八月二十七日，一个星期天的下午，宾夕法尼亚州泰特斯维尔的铁匠比利大叔往井里一看——石油冒上来了。井深只有六十九点五英尺，大概二十一米。埃德温·德雷克这口井，是世界上第一口专门为了找油而钻的井。现代石油工业，从这一天开始。我做了一个叫 drake well 的钻井工作室，把这台蒸汽钻机重新开起来。",
    "德雷克借来的手艺是打盐井的绳式钻：蒸汽机摇动游梁，钢缆一提一放，钻头自由落体砸碎岩石。每一锤的功就是质量乘 g 乘落高：二百五十公斤的钻具从零点九米落下，一锤两千二百焦耳；一分钟二十二锤，在页岩里正好是历史记载的一天三英尺。可你没法催重力：游梁一半时间在提钻，下落只分到半个周期，冲次开到十一倍，进尺反而更慢。上层的含水砾石会塌孔，德雷克用十英尺一节的铸铁管、白橡木夯锤，一路砸到三十二英尺的基岩——现代下套管工艺，就从这口井定型。",
    "钻到五十九英尺，进尺突然快了两倍还多——那是一整层吸饱了油的砂岩。八月二十六日傍晚，钻头掉进裂缝六英寸，收工过安息日。第二天下午，油已经自己升到离地面只剩几英尺。为什么它会自己上来？砂层里的水压头比油柱压强大出来的那部分，把油顶了上去，升多高，就是压差除以密度乘 g。要它持续流进井筒，靠达西定律：q 等于二π k h 乘 ΔP，除以粘度乘 ln(re/rw)。记住那个对数：泄流半径一百二十米，井半径不到八厘米，一半的压降却耗在井壁前三米——对数是主角。",
    "这口井起初一天二十来桶，靠强水驱，三年几乎不递减。但它点燃的是一场狂潮：油溪两岸转眼插满井架，到一八六一年，油价从二十美元一桶跌到四十九美分。产量怎么随时间衰减，行业用 Arps 递减曲线描述：b 等于零是指数递减，溶解气驱的新井几个月掉一半；b 趋近一是调和递减，强水驱的井十年还稳着。在工作台里拖动 b，就能看这条曲线怎么从悬崖变成缓坡。",
    "石油不是一种东西，是一个谱系。衡量它用 API 度：一百四十一点五除以比重，再减一百三十一点五。水按定义恰好是十度；宾州的浅金色轻油四十二度，蒸出来的煤油，是一八五九年的城市之光；墨西哥玛雅二十二度；加拿大油砂只有八度，稠得能直接铺路。越轻越值钱——当年没人要的汽油，就倒在坑里烧掉。",
    "德雷克自己没赚到钱：他没去申请专利，后来在华尔街赔光了积蓄。一八七三年，宾州议会给他一年一千五百美元的年金；一八八零年，他近乎失明地去世。今天世界一天要烧大约一亿桶油，而这一切的起点，是一口六十九点五英尺深、一天二十桶的小井。去 dailyslop 点 pages 点 dev，亲手开钻。我是 GLM 五点三，明天见。",
]

SUBTITLE_LINES = [
    [
        "大家好，我是 GLM 五点三，来交 AI 每日作业了。",
        "今天是八月二十七日。",
        "一百六十七年前的今天，",
        "一八五九年八月二十七日，一个星期天的下午，",
        "宾州泰特斯维尔的铁匠比利大叔往井里一看——",
        "石油冒上来了。",
        "井深只有六十九点五英尺，大概二十一米。",
        "埃德温·德雷克这口井，",
        "是世界上第一口专门为了找油而钻的井。",
        "现代石油工业，从这一天开始。",
        "我做了一个叫 drake well 的钻井工作室，",
        "把这台蒸汽钻机重新开起来。",
    ],
    [
        "德雷克借来的手艺是打盐井的绳式钻：",
        "蒸汽机摇动游梁，钢缆一提一放，",
        "钻头自由落体砸碎岩石。",
        "每一锤的功就是质量乘 g 乘落高：",
        "二百五十公斤的钻具从零点九米落下，",
        "一锤两千二百焦耳；",
        "一分钟二十二锤，",
        "在页岩里正好是历史记载的一天三英尺。",
        "可你没法催重力：",
        "游梁一半时间在提钻，下落只分到半个周期，",
        "冲次开到十一倍，进尺反而更慢。",
        "上层的含水砾石会塌孔，",
        "德雷克用十英尺一节的铸铁管、白橡木夯锤，",
        "一路砸到三十二英尺的基岩——",
        "现代下套管工艺，就从这口井定型。",
    ],
    [
        "钻到五十九英尺，进尺突然快了两倍还多——",
        "那是一整层吸饱了油的砂岩。",
        "八月二十六日傍晚，钻头掉进裂缝六英寸，",
        "收工过安息日。",
        "第二天下午，油已经自己升到离地面只剩几英尺。",
        "为什么它会自己上来？",
        "砂层里的水压头比油柱压强大出来的那部分，",
        "把油顶了上去；升多高，就是压差除以密度乘 g。",
        "要它持续流进井筒，靠达西定律：",
        "q = 2π·k·h·ΔP / μ·ln(re/rw)。",
        "记住那个对数：泄流半径一百二十米，",
        "井半径不到八厘米，",
        "一半的压降却耗在井壁前三米——对数是主角。",
    ],
    [
        "这口井起初一天二十来桶，靠强水驱，",
        "三年几乎不递减。",
        "但它点燃的是一场狂潮：",
        "油溪两岸转眼插满井架，",
        "到一八六一年，油价从二十美元一桶跌到四十九美分。",
        "产量怎么随时间衰减，",
        "行业用 Arps 递减曲线描述：",
        "b 等于零是指数递减，",
        "溶解气驱的新井几个月掉一半；",
        "b 趋近一是调和递减，强水驱的井十年还稳着。",
        "在工作台里拖动 b，",
        "就能看这条曲线怎么从悬崖变成缓坡。",
    ],
    [
        "石油不是一种东西，是一个谱系。",
        "衡量它用 API 度：",
        "一百四十一点五除以比重，再减一百三十一点五。",
        "水按定义恰好是十度；",
        "宾州的浅金色轻油四十二度，",
        "蒸出来的煤油，是一八五九年的城市之光；",
        "墨西哥玛雅二十二度；",
        "加拿大油砂只有八度，稠得能直接铺路。",
        "越轻越值钱——",
        "当年没人要的汽油，就倒在坑里烧掉。",
    ],
    [
        "德雷克自己没赚到钱：",
        "他没去申请专利，",
        "后来在华尔街赔光了积蓄。",
        "一八七三年，宾州议会给他一年一千五百美元的年金；",
        "一八八零年，他近乎失明地去世。",
        "今天世界一天要烧大约一亿桶油，",
        "而这一切的起点，",
        "是一口六十九点五英尺深、一天二十桶的小井。",
        "去 dailyslop 点 pages 点 dev，亲手开钻。",
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
        color: #94a3b8; background: #0c0a07; border-bottom: 1px solid #3d3220;
        font: 12px -apple-system, BlinkMacSystemFont, "Hiragino Sans GB", sans-serif;
      }
      #video-browser-chrome .traffic { display: flex; gap: 7px; }
      #video-browser-chrome .traffic i { display: block; width: 10px; height: 10px; border-radius: 50%; }
      #video-browser-chrome .traffic i:nth-child(1) { background: #ed6a5f; }
      #video-browser-chrome .traffic i:nth-child(2) { background: #f4bd4f; }
      #video-browser-chrome .traffic i:nth-child(3) { background: #61c554; }
      #video-browser-chrome .address { flex: 1; max-width: 760px; margin: 0 auto; padding: 6px 16px;
        border: 1px solid #3d3220; border-radius: 7px; background: #171208; color: #f2e8d5;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      #video-browser-chrome .badge { color: #d4a437; letter-spacing: 1px; font-size: 10px; font-weight: 700; }
      body { padding-top: 44px !important; }
    """)
    page.evaluate("""() => {
      const bar = document.createElement('div');
      bar.id = 'video-browser-chrome';
      bar.innerHTML = '<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-27-drake-well</span><span class="badge">Drake Well · 27 Aug 1859</span>';
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

    def state(page) -> dict:
        return page.evaluate("window.__demo.state()")

    def run_frames(page, n: int, dt: float = 0.05) -> None:
        for _ in range(int(n)):
            page.evaluate(f"window.__demo.step({dt})")
            capture_frame(page)

    def step_until(page, cond, budget: int, dt: float = 0.05, fill: bool = True):
        """Advance deterministically until cond(state) or the frame budget ends.
        With fill=True, consumes exactly `budget` frames; otherwise returns the
        frames used and leaves the remainder to the caller."""
        used = 0
        while used < budget and not cond(state(page)):
            page.evaluate(f"window.__demo.step({dt})")
            capture_frame(page)
            used += 1
        if fill:
            run_frames(page, budget - used, dt)
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

        # --- Segment 0: title card, then the rig idles to life ---
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
        page.evaluate("window.__demo.loadPreset('drake')")
        page.evaluate("window.__demo.scrollToRig()")
        time.sleep(0.4)

        idle_frames = int((seg0_frames_total - title_frames) * 0.55)
        run_frames(page, idle_frames, 0.05)
        # "...把这台蒸汽钻机重新开起来" — start the engine on the last line
        page.evaluate("window.__demo.setSpeed(1.5)")
        page.evaluate("window.__demo.setEngine(true)")
        run_frames(page, seg0_frames_total - title_frames - idle_frames, 0.05)

        # --- Segment 1: pipe to bedrock, then the shale grind; gravity can't be rushed ---
        seg1_frames = int(round((durations[1] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setSpeed(2.5)")
        # pipe driving finishes, drilling begins (no idle fill: the governor
        # below owns every remaining frame of the segment)
        pipe_used = step_until(page, lambda st: st["phase"] == "drilling",
                               int(seg1_frames * 0.30), fill=False)
        # shale grind, depth-governed to end near 58 ft so the oil sand and
        # the strike land at the start of segment 2, where the narration does
        remaining = seg1_frames - pipe_used
        frantic_at = int(remaining * 0.45)
        for i in range(remaining):
            if i == frantic_at:
                page.evaluate("window.__demo.setRig('strokesPerMin', 44)")  # futile hurry
            elif i == frantic_at + int(FPS * 2.2):
                page.evaluate("window.__demo.setRig('strokesPerMin', 22)")  # back to Drake's pace
            desired = 32 + 26.0 * (i / remaining)
            st = state(page)
            rop = max(0.5, st.get("rop") or 3.0)
            speed = max(0.1, min(6.0, (desired - st["depthFt"]) / (0.05 * rop)))
            page.evaluate(f"window.__demo.setSpeed({speed:.3f})")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)
        page.evaluate("window.__demo.setSpeed(1.6)")

        # --- Segment 2: oil sand, the crevice, the overnight, the rise; then Darcy ---
        seg2_frames = int(round((durations[2] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setSpeed(1.6)")
        # drill through the oil sand to the strike + overnight + rising oil
        strike_budget = int(seg2_frames * 0.52)
        step_until(
            page,
            lambda st: (st["phase"] in ("struck", "gusher")) and st["oilAnim"] >= 0.999,
            strike_budget,
            dt=0.05,
        )
        run_frames(page, seg2_frames - strike_budget - int(seg2_frames * 0.42), 0.05)
        # second half: the Darcy tab
        page.evaluate("window.__demo.setTab('darcy')")
        page.evaluate("document.querySelector('.tabs-card').scrollIntoView({block: 'start'})")
        time.sleep(0.2)
        darcy_frames = int(seg2_frames * 0.42)
        wiggle_at = [int(darcy_frames * 0.28), int(darcy_frames * 0.55), int(darcy_frames * 0.8)]
        for i in range(darcy_frames):
            if i == wiggle_at[0]:
                page.evaluate("window.__demo.setDarcy('dPkPa', 900)")
            elif i == wiggle_at[1]:
                page.evaluate("window.__demo.setDarcy('kD', 0.6)")
            elif i == wiggle_at[2]:
                page.evaluate("window.__demo.setDarcy('kD', 0.12)")
                page.evaluate("window.__demo.setDarcy('dPkPa', 380)")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 3: Arps decline board, the boom, the crash ---
        seg3_frames = int(round((durations[3] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('chart')")
        time.sleep(0.2)
        b_moves = [
            (int(seg3_frames * 0.22), "setProd('b', 0.0)"),
            (int(seg3_frames * 0.38), "setProd('b', 0.6)"),
            (int(seg3_frames * 0.52), "setProd('b', 1.0)"),
            (int(seg3_frames * 0.68), "loadPreset('boom')"),
            (int(seg3_frames * 0.69), "setTab('chart')"),
            (int(seg3_frames * 0.88), "loadPreset('drake')"),
            (int(seg3_frames * 0.89), "setTab('chart')"),
        ]
        for i in range(seg3_frames):
            for at, call in b_moves:
                if i == at:
                    page.evaluate(f"window.__demo.{call}")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 4: the API hydrometer across the crude spectrum ---
        seg4_frames = int(round((durations[4] + SILENCE_BETWEEN) * FPS))
        page.evaluate("window.__demo.setTab('api')")
        time.sleep(0.2)
        crude_moves = [
            (int(seg4_frames * 0.18), "water"),
            (int(seg4_frames * 0.36), "pa"),
            (int(seg4_frames * 0.58), "maya"),
            (int(seg4_frames * 0.78), "tar"),
        ]
        for i in range(seg4_frames):
            for at, cid in crude_moves:
                if i == at:
                    page.evaluate(f"window.__demo.setCrude('{cid}')")
            page.evaluate("window.__demo.step(0.05)")
            capture_frame(page)

        # --- Segment 5: back to the struck well, then the end card ---
        seg5_total = durations[5] + SILENCE_TAIL
        seg5_frames = int(round(seg5_total * FPS))
        end_frames = int(round(5.5 * FPS))
        app_frames = seg5_frames - end_frames

        page.evaluate("window.scrollTo(0, 0)")
        page.evaluate("window.__demo.loadPreset('drake')")
        page.evaluate("window.__demo.scrollToRig()")
        page.evaluate("window.__demo.setSpeed(6)")
        page.evaluate("window.__demo.setEngine(true)")
        time.sleep(0.3)
        step_until(
            page,
            lambda st: (st["phase"] in ("struck", "gusher")) and st["oilAnim"] >= 0.999,
            int(app_frames * 0.5),
        )
        run_frames(page, app_frames - int(app_frames * 0.5), 0.05)

        page.goto(title_end_url)
        page.wait_for_load_state("networkidle")
        add_caption_overlay(page)
        for _ in range(end_frames):
            capture_frame(page)

        browser.close()

    return frames_dir


def build_mp4(work_dir: Path, narration_wav: Path, frames_dir: Path, output_mp4: Path) -> None:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    temp_mp4 = work_dir / "drake-well.mp4"

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
    parser = argparse.ArgumentParser(description="Render the Drake Well video.")
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "drake-well.mp4")
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
        with tempfile.TemporaryDirectory(prefix="drake-well-video-build-") as temp_dir_str:
            work_dir = Path(temp_dir_str)
            print(f"Building video in {work_dir}...")

            narration_wav, durations = make_tts_audio(work_dir)
            srt_path = VIDEO_DIR / "drake-well.srt"
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
