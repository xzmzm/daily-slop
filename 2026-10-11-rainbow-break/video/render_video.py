"""Rainbow Break adapter for the shared Fish Audio daily-project renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-11-rainbow-break/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。",
     "今天十月十一日。1950 年的今天，美国联邦通信委员会选定了 CBS 的彩色电视标准。",
     "这套方案很直接：信号还是黑白的，颜色靠屏幕前一个转盘来上。"],
    ["放慢一百二十倍看，屏幕其实一次只亮一种颜色，红、绿、蓝轮流来。",
     "下面这个转盘上有六块滤色片，每分钟转 1440 圈，",
     "每秒 144 场，三场凑一幅彩色画面。眼睛分不过来，就把它们混成了一张。"],
    ["回到正常速度，把场频降到每秒 48 场。",
     "白色不再纯白，颜色在闪，球边上的彩边也宽了三倍。",
     "拉到 360 场，彩边几乎看不见了。CBS 用的是 144。"],
    ["盯着屏幕不动，球的两边各镶着一道彩边。",
     "摄像机先拍红、再拍绿、再拍蓝，三张本来就不是同一时刻拍的。",
     "换成眼睛跟着球走：球立刻干净了，色条、字和地板却全裂成了彩虹。"],
    ["真正的麻烦在这儿。把这个信号接到家里那台普通黑白电视上，",
     "它每秒要 15750 行，CBS 发的是 29160 行，扫描锁不住，什么也看不到。",
     "当时美国家里已经有好几百万台黑白电视。"],
    ["CBS 的彩色节目 1951 年 6 月开播，四个月后彩电停产，节目也停了。",
     "1953 年，兼容黑白电视的方案成了新标准。",
     "转盘后来进了单片投影仪：一帧拆成三场，眼睛一跟，连球带背景一起花。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace("Claude Opus 5.5", "Claude Opus 五点五")
# Years digit by digit; other numbers spoken naturally. Subtitles keep Arabic.
for old, new in [("1950 年", "一九五零年"), ("1951 年 6 月", "一九五一年六月"),
                 ("1953 年", "一九五三年"), ("1440 圈", "一千四百四十圈"),
                 ("144 场", "一百四十四场"), ("48 场", "四十八场"),
                 ("360 场", "三百六十场"), ("用的是 144", "用的是一百四十四"),
                 ("15750 行", "一万五千七百五十行"), ("29160 行", "两万九千一百六十行")]:
    SEGMENTS = [s.replace(old, new) for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .wrap{max-width:1500px;padding:16px 44px 0}
  .eyebrow{font-size:13px;margin-bottom:6px}
  h1{font-size:44px;margin-bottom:4px}
  .sub{font-size:17px;margin-bottom:12px;max-width:none}
  .stage{grid-template-columns:820px 440px;gap:28px;justify-content:center}
  .tv-card{padding:16px}
  .tv-foot{margin-top:10px}
  #status{font-size:18px;min-height:0}
  .facts,.footnote{display:none}
  .panel{padding:16px 18px;gap:13px}
  .stat .v{font-size:24px}
  .stat.big .v{font-size:34px}
  .seg button,.chips button,#play{font-size:15px}
  #video-caption{font-size:25px;max-width:1160px;bottom:20px}
  #video-browser-chrome{background:#140e0a;color:#a08a70;border-color:#3c2d21}
  #video-browser-chrome .address{background:#1d150f;border-color:#3c2d21;color:#d9c7aa}
  #video-browser-chrome .badge{color:#f0b35a}
"""

PARK = (1836, 998)


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function(
        "!!window.rainbowBreak && typeof window.rainbowBreak.pump === 'function'")
    page.evaluate("rainbowBreak.pump(0)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("rainbowBreak.pump(0)")


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, PARK
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        moment = datetime(2026, 10, 11, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)
        state = lambda: page.evaluate("rainbowBreak.getState()")

        def step():
            page.clock.run_for(round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS))
            page.evaluate(f"rainbowBreak.pump({1 / FPS})")

        def capture(clicking=False):
            nonlocal frame, timeline
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                step()
                capture()
            return state()

        def until(when):
            return hold(max(0, when - timeline))

        def glide(target, seconds):
            """Eased, slightly curved cursor move with a short settle."""
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .045)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            n = max(2, round(seconds * FPS))
            for i in range(n):
                u = (i + 1) / n
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                base.set_cursor(page, pos)
                step()
                capture()
            hold(.15)

        def click(selector, settle=.2, travel=.8):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 80, (selector, box)
            glide((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2), travel)
            page.mouse.click(*pos)
            capture(True)
            hold(settle)

        cue_index, start = 0, 0.0
        for index, seconds in enumerate(durations):
            scene_cues = cues[cue_index:cue_index + len(SUBTITLE_LINES[index])]
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)
            if index == 1:
                until(scene_cues[0][0] + .1)
                click("#speed-slow", travel=.7)
                snap = state()
                assert snap["scale"] < 1, snap
            elif index == 2:
                until(scene_cues[0][0] + .1)
                click("#speed-1", travel=.6)
                click("#rate-48", travel=.6)
                assert state()["rate"] == 48
                until(scene_cues[2][0] + .1)
                click("#rate-360", travel=.5)
                until(scene_cues[2][1] - 1.2)
                click("#rate-144", travel=.5)
            elif index == 3:
                snap = until(scene_cues[1][0])
                assert snap["fringes"]["ball"] > 5 and snap["fringes"]["bg"] == 0, snap
                until(scene_cues[2][0] + .2)
                click("#gaze-follow", travel=.7)
                snap = state()
                assert snap["fringes"]["ball"] == 0 and snap["fringes"]["bg"] > 5, snap
            elif index == 4:
                until(scene_cues[0][0] + 1.0)
                click("#set-bw", travel=.8)
                assert state()["receiver"] == "bw"
            elif index == 5:
                until(scene_cues[0][0] + .5)
                click("#set-color", travel=.6)
                until(scene_cues[2][0] + .3)
                click("#source-frame", travel=.7)
                snap = state()
                assert snap["fringes"]["ball"] > 5 and snap["fringes"]["bg"] > 5, snap
            until(end)
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s", flush=True)
            cue_index += len(SUBTITLE_LINES[index])
            start = end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
              "-i", str(frames_dir / "%06d.png"), "-i", str(narration),
              "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium",
              "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
              "-shortest", "-movflags", "+faststart", str(output)])


def preview(output):
    """Framing check without narration: one still per scene state."""
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        caption_top = page.locator("#video-caption").bounding_box()["y"]
        for selector in [".tv-card", ".panel"]:
            box = page.locator(selector).bounding_box()
            assert box["y"] + box["height"] < caption_top, (selector, box, caption_top)
        scenes = {"opening": [], "slow": ["#speed-slow"], "rate48": ["#speed-1", "#rate-48"],
                  "follow": ["#rate-144", "#gaze-follow"], "bw": ["#set-bw"],
                  "dlp": ["#set-color", "#source-frame"]}
        for i, (name, clicks) in enumerate(scenes.items()):
            for selector in clicks:
                page.click(selector)
            for _ in range(8):
                page.evaluate(f"rainbowBreak.pump({1 / FPS})")
            page.locator("#video-caption").evaluate("(el,text)=>el.textContent=text", SUBTITLE_LINES[i][1])
            base.set_cursor(page, PARK)
            page.screenshot(path=str(output / f"{name}.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
