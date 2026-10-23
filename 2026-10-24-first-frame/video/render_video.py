"""First Frame adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-24-first-frame/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。", "今天十月二十四日，给地球拍张证件照。"],
    ["1946 年的今天，一台装在 V-2 火箭上的相机，在大约一百零五公里高处，拍到了第一张来自太空的地球照片。", "八十年后的今天，做了一台可以调高度和镜头的相机。云是画的，地球的弧度是算的。"],
    ["先降到客机的一万米。地平线看起来挺平，打开橙色参考线，才发现两边微微往下掉。", "参考线贴着中间的地平线，弯下去的部分更容易认出来。"],
    ["回到一百零五公里。已经到了太空边缘，地球还是装不进镜头。", "右下的数字是视线到地平线的直线距离，大约一千一百六十一公里。"],
    ["只换镜头，不动相机。窄镜头裁出一小块，曲线显得平一些。", "再换成广角，两边收进来，弧度也明显了。这里用的是直线投影，没有鱼眼效果。"],
    ["再升到三万五千多公里。现在终于能把整颗地球放进画面了。", "高度决定你能看多远，镜头决定你把多少风景塞进照片。保存这一张，今天作业交完，明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("1946 年", "一九四六年") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
main{max-width:1750px;padding:0 44px}header{height:42px}.intro{padding:24px 0}h1{font-size:100px}
.workspace{grid-template-columns:minmax(0,1fr) 340px}.film{max-width:1150px}canvas{max-height:none}
.readings{padding:18px 0;margin-top:18px}.readings strong{font-size:32px}.readings .observation p{font-size:18px}
aside{padding:0 10px}.panel-heading{padding:0 0 8px}.presets{margin:14px 0 15px}.presets button{padding:11px}.lens{padding:12px 0 16px}#guide,#save{padding:12px}.camera-note{font-size:10px}input[type=range]{margin:12px 0 5px}
.intro{padding:19px 0}h1{font-size:90px}.readings strong{margin-top:5px}.readings{padding:14px 0;margin-top:15px}
details,footer{display:none}#video-caption{font-size:30px;bottom:17px;max-width:1770px}
"""

def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.firstFrame")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING · PROCEDURAL VIEW'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 970))
    page.evaluate("firstFrame.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".workspace", ".readings"]:
        box = page.locator(selector).bounding_box()
        assert box["y"] + box["height"] < caption_top - 10, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, (1810, 980), 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)

        def snap(step=0, clicking=False):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if step:
                page.evaluate("dt => firstFrame.render()", step)
                revision += 1
            key = (revision, base.caption_at(timeline, cues), pos, clicking)
            output = frames / f"{frame:06d}.png"
            if key == cache_key:
                shutil.copyfile(last_frame, output)
            else:
                base.capture(page, output, timeline, cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1
            timeline = frame / FPS

        def hold(seconds, simulated=0):
            count = max(0, round(seconds * FPS))
            for _ in range(count):
                snap(simulated / count if count else 0)

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend, (start[1] + target[1]) / 2 + dx / distance * bend)
            count = round(.6 * FPS)
            for i in range(count):
                u = (i + 1) / count
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0], v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap()
            hold(.15)

        def click(selector):
            nonlocal revision
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 115, (selector, box)
            move((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            hold(.2)

        def lens(value):
            nonlocal revision
            selector = "#fov"
            box = page.locator(selector).bounding_box()
            move((box["x"] + box["width"] * (value - 30) / 90, box["y"] + box["height"] / 2))
            page.locator(selector).focus()
            page.keyboard.press("Home")
            for _ in range(value - 30):
                page.keyboard.press("ArrowRight")
            revision += 1
            snap(clicking=True)
            hold(.3)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index in [0, 1]:
                hold(end - timeline)
            elif index == 2:
                click('[data-alt="10"]')
                click("#guide")
                hold(end - timeline)
            elif index == 3:
                click('[data-alt="105"]')
                hold(end - timeline)
            elif index == 4:
                lens(30)
                hold(min(4, (end - timeline) * .4))
                lens(120)
                hold(end - timeline)
            else:
                click('[data-alt="35786"]')
                click("#guide")
                hold(end - timeline)
            assert timeline <= end + .3, (index, timeline, end)
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s", flush=True)
            start = end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
              "-i", str(frames_dir / "%06d.png"), "-i", str(narration), "-map", "0:v:0", "-map", "1:a:0",
              "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
              "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(output)])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)
        page.screenshot(path=str(output / "intro.png"))
        page.locator('[data-alt="35786"]').click()
        page.screenshot(path=str(output / "high.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
