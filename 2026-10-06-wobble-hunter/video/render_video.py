"""Wobble Hunter adapter for the shared Fish Audio / 哈基米 video workflow."""
import argparse
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-06-wobble-hunter/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GLM-5.3，来交 AI 每日作业了。今天十月六日。",
     "1995 年的今天，两位瑞士天文学家在佛罗伦萨宣布：飞马座 51 旁边，有一颗行星。",
     "这是第一颗确认围绕类太阳恒星的系外行星。",
     "今天的作业，就是把他们的找法复现一遍。"],
    ["行星和恒星其实绕着共同的质心转。",
     "这颗行星只有木星的一半重，却贴着恒星跑，4.23 天就转完一圈，",
     "硬是把恒星拽出每秒 56 米的晃动，速度相当于一辆自行车。",
     "恒星朝我们扑过来，光谱线偏蓝；退着走，就偏红。",
     "行星一点影子都看不到，我们量的一直是恒星的摇晃。"],
    ["下面这条起伏的曲线，就是量出来的视向速度。",
     "当年的光谱仪精度大约每秒 13 米，信号是它的四倍多，",
     "一个星期的观测就藏不住了。",
     "右下角的尺子对照了历代仪器：每秒 56 米，放在 1995 年已经足够响亮。"],
    ["换几个行星试试。把我们自己的木星放过去，周期拉到将近十二年，",
     "幅度掉到每秒 12 米，想画满一个完整波形，得在望远镜前守上十年。",
     "再换成地球，只剩 9 厘米每秒，比今天最好的仪器还小，",
     "类地行星难找，就难在这里。",
     "最后把轨道倾角压平，让行星正对着我们转：行星还在跑，信号却消失了。",
     "所以速度法给出的质量，永远只是下限。"],
    ["这颗贴着恒星烤着的木星，当时几乎没人信。",
     "一周之后，另一组天文学家确认了它，",
     "24 年后的诺贝尔物理学奖也落在这里。",
     "31 年过去，人类找到的行星超过五千颗，而第一颗，就是这么晃出来的。明天见。"],
]
# Spoken years use individual Chinese digits; subtitles retain Arabic years.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天十月六日。"
    "一九九五年的今天，两位瑞士天文学家在佛罗伦萨宣布：飞马座五十一旁边，有一颗行星。"
    "这是第一颗确认围绕类太阳恒星的系外行星。今天的作业，就是把他们的找法复现一遍。",
    "行星和恒星其实绕着共同的质心转。这颗行星只有木星的一半重，却贴着恒星跑，"
    "四点二三天就转完一圈，硬是把恒星拽出每秒五十六米的晃动，速度相当于一辆自行车。"
    "恒星朝我们扑过来，光谱线偏蓝；退着走，就偏红。"
    "行星一点影子都看不到，我们量的一直是恒星的摇晃。",
    "下面这条起伏的曲线，就是量出来的视向速度。当年的光谱仪精度大约每秒十三米，"
    "信号是它的四倍多，一个星期的观测就藏不住了。"
    "右下角的尺子对照了历代仪器：每秒五十六米，放在一九九五年已经足够响亮。",
    "换几个行星试试。把我们自己的木星放过去，周期拉到将近十二年，幅度掉到每秒十二米，"
    "想画满一个完整波形，得在望远镜前守上十年。再换成地球，只剩九厘米每秒，"
    "比今天最好的仪器还小，类地行星难找，就难在这里。"
    "最后把轨道倾角压平，让行星正对着我们转：行星还在跑，信号却消失了。"
    "所以速度法给出的质量，永远只是下限。",
    "这颗贴着恒星烤着的木星，当时几乎没人信。一周之后，另一组天文学家确认了它，"
    "二十四年后的诺贝尔物理学奖也落在这里。三十一年过去，人类找到的行星超过五千颗，"
    "而第一颗，就是这么晃出来的。明天见。",
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{padding-bottom:130px}
  .masthead{height:44px}
  .intro{padding:14px 0 16px}
  .eyebrow{margin-bottom:6px}
  h1{font-size:64px}
  .intro-copy{font-size:19px}
  .intro-copy span{margin-top:8px}
  #sky{max-height:300px}
  .slider-group{margin:8px 0 2px}
  .slider-group input{margin:14px 0 6px}
  .range-labels{display:none}
  .system-help{display:none}
  .presets{margin-top:10px}
  .presets button{padding:8px 10px 7px}
  #spectrum{max-height:112px}
  .chart-wrap{margin-top:10px}
  #chart{height:190px}
  .readouts{margin-top:10px}
  .chip{padding:6px 10px 5px}
  .transport{margin-top:10px}
  .detect-panel{padding:12px 28px 8px}
  .verdict{padding:14px 2px}
  .context,footer{display:none}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.wobbleHunter")
    page.evaluate("wobbleHunter.useManualClock()")
    page.evaluate("wobbleHunter.set({preset:'discovery',inclDeg:90,playing:true,speed:2,time:0})")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate(
        "(el,text)=>el.textContent=text", URL
    )
    page.locator("#video-browser-chrome .badge").evaluate(
        "el=>el.textContent='LOCAL RECORDING'"
    )
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("window.scrollTo(0,0)")


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1790, 850)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1
        )
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)

        def state():
            return page.evaluate("wobbleHunter.getState()")

        def capture(clicking=False):
            nonlocal frame, timeline
            page.evaluate("dt=>wobbleHunter.tick(dt)", 1 / FPS)
            base.capture(
                page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking
            )
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = math.hypot(dx, dy)
            bend = min(18.0, distance * 0.045)
            control = (
                (start[0] + target[0]) / 2 - dy / max(1, distance) * bend,
                (start[1] + target[1]) / 2 + dx / max(1, distance) * bend,
            )
            for step in range(7):
                u = step / 6
                e = u * u * (3 - 2 * u)
                v = 1 - e
                pos = (
                    v*v*start[0] + 2*v*e*control[0] + e*e*target[0],
                    v*v*start[1] + 2*v*e*control[1] + e*e*target[1],
                )
                capture()
            hold(0.16)

        def click(selector, fraction=0.5, key=None):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 120, selector
            move((box["x"] + box["width"] * fraction, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            capture(True)
            if key:
                page.keyboard.press(key)
                capture()
            hold(0.2)

        def scroll_to(target):
            start = page.evaluate("window.scrollY")

            def eased(u):
                return u * u * (3 - 2 * u)

            for step in range(9):
                u = (step + 1) / 9
                page.evaluate(f"window.scrollTo(0,{start + (target - start) * eased(u):.1f})")
                capture()

        meter_scroll = page.evaluate(
            "document.documentElement.scrollHeight - window.innerHeight"
        )

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (
                SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL
            )
            if index == 2:
                scroll_to(meter_scroll)
            elif index == 3:
                scroll_to(0)
                click("#preset-jupiter")
                assert abs(state()["massMJ"] - 1) < 1e-9
                assert state()["time"] > 0
                click("#speed-year")
                assert state()["speed"] == 365.25
                click("#preset-earth")
                assert state()["massMJ"] < 0.01
                click("#preset-discovery")
                assert abs(state()["massMJ"] - 0.46) < 1e-9
                click("#incl", fraction=0.5, key="Home")
                assert state()["inclDeg"] == 0, state()["inclDeg"]
            elif index == 4:
                click("#incl", fraction=0.5, key="End")
                assert state()["inclDeg"] == 90, state()["inclDeg"]
            hold(max(0, end - timeline))
            assert timeline <= end + 1 / FPS, (index, timeline, end)
            print(
                f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s",
                flush=True,
            )
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
        "-i", str(frames_dir / "%06d.png"), "-i", str(narration),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium",
        "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart", str(output),
    ])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    print("Video framing previews:", output, flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        scrolled = page.evaluate(
            "document.documentElement.scrollHeight - window.innerHeight"
        )
        for name, caption, incl, scroll in [
            ("opening", SUBTITLE_LINES[0][1], 90, 0),
            ("meter", SUBTITLE_LINES[2][3], 90, scrolled),
            ("tilted", SUBTITLE_LINES[3][5], 8, scrolled),
        ]:
            page.evaluate(f"wobbleHunter.set({{inclDeg:{incl}}})")
            page.evaluate(f"window.scrollTo(0,{scroll})")
            page.locator("#video-caption").evaluate(
                "(el,text)=>el.textContent=text", caption
            )
            base.set_cursor(page, (1790, 850))
            page.screenshot(path=str(output / f"{name}.png"))
            caption_top = page.locator("#video-caption").bounding_box()["y"]
            for selector in ("#sky", "#chart") if scroll == 0 else ("#meter", ".verdict"):
                box = page.locator(selector).bounding_box()
                assert box and box["y"] + box["height"] < caption_top, (
                    selector, box, caption_top)
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
