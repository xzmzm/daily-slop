"""Thirty Lines adapter for the shared Fish Audio / 哈基米 capture workflow."""
import argparse
import importlib.util
import math
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-02-thirty-lines/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。",
     "今天十月二日。1925 年的今天，贝尔德在伦敦传出了一张有明暗层次的脸。",
     "这台小电视借了他后来三十孔接收机的办法，像素少，脾气倒不小。"],
    ["一个孔扫一条竖线，三十个孔轮完，才拼出一整张脸。",
     "明暗挤成一路信号，另一头的圆盘再把亮点放回原位。",
     "左边这位比尔是我画的，坐这么久，也没催过片酬。"],
    ["切到单孔，完整的脸就没了，只剩一个亮点在走。",
     "霓虹灯不会替你存照片，是眼睛把连续扫过的光连起来。",
     "这里慢放了十倍；切回视觉记忆，扫过的亮度才会留在屏幕上。"],
    ["换个字母试试。十五条线，细笔画已经糊成一团。",
     "加到六十条，大写字母的轮廓清楚多了，小字还是有点勉强。",
     "早年的电视得给脸打很亮的光，也得请人坐得够近。"],
    ["现在把接收机调快百分之二点五。",
     "发射端每分钟三百转，接收端三百零七点五转。",
     "每扫一圈就多跑一点，眼睛和嘴巴开始串门。转速差一点，脸就认不全了。"],
    ["先锁回来。再错开半圈，两头速度一样，脸却稳定地裂成了两块。",
     "所以光转得一样快还不够，起点也得对齐。",
     "按一下，脸回来了。一百年前的电视调台，比找遥控器费劲多了。明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("1925 年", "一九二五年")
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{max-width:1500px;padding:0 40px}
  .masthead{height:55px}.intro{padding:24px 0 25px}
  h1{font-size:76px}.intro-copy p{font-size:27px}
  .machine{padding:20px 40px 12px;gap:38px}
  .source-frame{width:213px;height:284px}
  .receiver-housing{width:228px;height:284px}
  .scanner #disc{height:304px}
  .station-label{font-size:12px}.small-note{font-size:11px}
  .subject-tabs button,.view-tabs button{font-size:12px}
  .bench-top,.bench-bottom{font-size:12px}
  .bench-scale,.quiet-button{font-size:11px}
  .controls{padding:26px 0 20px;gap:36px}
  .control-heading{font-size:11px}.control-heading span{font-size:10px}
  .control-help{font-size:11px}.sync-actions button{font-size:12px}
  .explanation{font-size:15px;padding:16px 0;min-height:67px}
  .footnotes,footer{display:none}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""

def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.thirtyLines")
    page.evaluate("thirtyLines.useManualClock(); thirtyLines.set({paused:false})")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)

def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0., (1790, 850)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)

        def capture(clicking=False):
            nonlocal frame, timeline
            page.evaluate("dt=>thirtyLines.tick(dt)", 1 / FPS)
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))): capture()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = math.hypot(dx, dy)
            bend = min(18., distance * .045)
            control = ((start[0] + target[0]) / 2 - dy / max(1, distance) * bend,
                       (start[1] + target[1]) / 2 + dx / max(1, distance) * bend)
            for step in range(7):
                u = step / 6
                e = u * u * (3 - 2 * u)
                v = 1 - e
                pos = (v*v*start[0] + 2*v*e*control[0] + e*e*target[0],
                       v*v*start[1] + 2*v*e*control[1] + e*e*target[1])
                capture()
            hold(.16)

        def click(selector):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 120, selector
            move((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            capture(True)
            hold(.2)

        def phase_half_turn():
            nonlocal pos
            box = page.locator("#phase").bounding_box()
            start = (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            move(start)
            page.mouse.move(*pos)
            page.mouse.down()
            for step in range(1, 10):
                u = step / 9
                e = u*u*(3-2*u)
                pos = (start[0] + (box["width"] / 2 - 1) * e, start[1])
                page.mouse.move(*pos)
                capture()
            page.mouse.up()
            hold(.2)
            assert page.evaluate("thirtyLines.getState().phase") == 180

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 0:
                hold(max(0, end - timeline))
            elif index == 1:
                hold(max(0, end - timeline))
            elif index == 2:
                click("#slit")
                hold(seconds * .65)
                click("#memory")
                hold(max(0, end - timeline))
            elif index == 3:
                click('[data-subject="type"]')
                click('[data-lines="15"]')
                hold(seconds * .30)
                click('[data-lines="60"]')
                hold(max(0, end - timeline - 1.5))
                click('[data-subject="bill"]')
                click('[data-lines="30"]')
                hold(max(0, end - timeline))
            elif index == 4:
                click("#break-sync")
                hold(max(0, end - timeline))
                assert page.evaluate("thirtyLines.getState().drift") == 2.5
            elif index == 5:
                click("#lock")
                phase_half_turn()
                hold(seconds * .52)
                click("#lock")
                hold(max(0, end - timeline))
                assert page.evaluate("thirtyLines.getState().phase") == 0
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s", flush=True)
        browser.close()
    if errors: raise RuntimeError(str(errors))
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
        for name, options, caption in [
            ("opening", {}, SUBTITLE_LINES[0][0]),
            ("slit", {"view": "slit"}, SUBTITLE_LINES[2][0]),
            ("phase", {"view": "memory", "phase": 180}, SUBTITLE_LINES[5][0]),
        ]:
            page.evaluate("opts=>thirtyLines.set(opts)", options)
            page.evaluate("thirtyLines.tick(1)")
            page.locator("#video-caption").evaluate("(el,text)=>el.textContent=text", caption)
            base.set_cursor(page, (1790, 850))
            page.screenshot(path=str(output / f"{name}.png"))
            caption_box = page.locator("#video-caption").bounding_box()
            for selector in (".controls", ".receiver-housing", "#disc"):
                box = page.locator(selector).bounding_box()
                assert box["y"] + box["height"] < caption_box["y"], (selector, box, caption_box)
        browser.close()
    print("Video framing previews:", output)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
