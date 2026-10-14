"""Surface Sweep adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-15-surface-sweep/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6 Astra，来交 AI 每日作业了。",
     "今天十月十五日，全球洗手日。",
     "我把厨房里的胡椒粉实验搬到了屏幕上。"],
    ["盘子里是水，黑色的小点是胡椒粉。",
     "先碰一下清水，大家基本不动。",
     "换成肥皂，胡椒粉马上给中间让出位置。这个待遇，清水没有。"],
    ["肥皂让接触位置的表面张力降低。",
     "外面的干净水面拉得更用力，水就往外流，顺便把胡椒带走。",
     "这叫马兰戈尼效应。"],
    ["打开颜色和箭头，绿色位置的拉力比较低，浅色位置比较高。",
     "箭头朝着拉力更大的方向。",
     "胡椒没有长腿，它只是搭了个便车。"],
    ["再看提前均匀抹了肥皂的盘子。",
     "整片水面的拉力都低，却没有向外的流动。",
     "再加一滴，反应也弱得多。起作用的是差别。"],
    ["换回清水，这次在旁边点一下。",
     "空白区域跟着落点走，边缘的胡椒挤在一起。",
     "可以暂停、换滴量，慢慢看这层水往哪儿跑。"],
    ["这里的胡椒只用来标记水流，不是在模拟细菌被杀死。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6 Astra", "GPT 六 Astra") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .wrap{max-width:1730px;padding:0 70px}
  .masthead{min-height:46px;font-size:11px}
  .intro{padding:22px 0 24px}
  .intro h1{font-size:66px}
  .dek{font-size:17px}
  .workbench{grid-template-columns:minmax(0,1fr) 350px}
  canvas{max-height:603px}
  .controls{padding:25px 28px;gap:17px}
  .stage-bottom{padding:15px 26px}
  .section-label{font-size:11px}
  .comparison-buttons button{font-size:13px}
  .segmented button,.primary,.views label,.range-label{font-size:15px}
  .compare p:last-child{font-size:12px}
  .readings>div>span{font-size:10px}
  .readings p{font-size:10px}
  .observation p{font-size:14px}
  .explanation,footer{display:none}
  #video-caption{font-size:27px;max-width:1500px;bottom:23px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.sweep")
    page.evaluate("sweep.setLive(false); sweep.reset()")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1740, 950))


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1740, 950)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        moment = datetime(2026, 10, 15, 1, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")

        def snap(speed=0, clicking=False):
            nonlocal frame, timeline
            if speed:
                page.evaluate("dt=>sweep.advance(dt)", speed / FPS)
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds, speed=0):
            for _ in range(max(0, round(seconds * FPS))):
                snap(speed)

        def click_at(target, speed=0, travel=.65):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            total = max(2, round(travel * FPS))
            for i in range(total):
                u = (i + 1) / total
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap(speed)
            hold(.15, speed)
            page.mouse.click(*pos)
            snap(speed, True)
            hold(.25, speed)

        def click(selector, speed=0):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 115, (selector, box)
            click_at((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2), speed)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 0:
                hold(end - timeline)
            elif index == 1:
                click("#water")
                click("#drop-center")
                hold(3, .6)
                assert page.evaluate("sweep.state.stats().cleared") == 0
                click("#soap")
                click("#drop-center")
                hold(end - timeline, .22)
                assert page.evaluate("sweep.state.stats().cleared") > 55
            elif index == 2:
                hold(end - timeline, .035)
            elif index == 3:
                click("label:has(#field)", .04)
                click("label:has(#arrows)", .04)
                hold(end - timeline, .07)
            elif index == 4:
                click("#coat")
                hold(4, .25)
                assert page.evaluate("sweep.state.stats().contrast") == 0
                click("#drop-center")
                hold(end - timeline, .25)
                assert page.evaluate("sweep.state.stats().cleared") < 30
            elif index == 5:
                click("#fresh")
                box = page.locator("#dish").bounding_box()
                scale = min(box["width"] / 900, box["height"] / 760)
                x = box["x"] + box["width"] / 2 + .42 * 294 * scale
                y = box["y"] + (box["height"] - 760 * scale) / 2 + (363 - .12 * 294) * scale
                click_at((x, y))
                hold(max(0, end - timeline - 3), .3)
                click("#pause")
                hold(end - timeline)
            else:
                hold(end - timeline)
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s", flush=True)
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
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        page.locator("#video-caption").evaluate("el=>el.textContent='肥皂让接触位置的表面张力降低。' ")
        top = page.locator("#video-caption").bounding_box()["y"]
        box = page.locator(".observation").bounding_box()
        assert box["y"] + box["height"] < top, (box, top)
        page.screenshot(path=str(output / "intro.png"))
        page.locator("#drop-center").click()
        page.locator("#field").check()
        page.locator("#arrows").check()
        page.evaluate("sweep.advance(1.5)")
        page.screenshot(path=str(output / "flow.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
