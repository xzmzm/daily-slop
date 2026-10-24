"""Twice at One adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-25-twice-at-one/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。", "今天十月二十五日，伦敦有两个凌晨一点半。约人见面，最好问清楚是哪一个。"],
    ["英国今天结束夏令时。凌晨两点，时钟拨回一点。", "橙色走过的一段，绿色还要再走一次。钟面重复了，时间可没倒流。"],
    ["先选第一个一点半。右边写着 BST，比世界协调时快一小时。", "所以这一刻，UTC 是零点半，吉隆坡是早上八点半。"],
    ["再点第二个一点半。大钟没变，下面却已经过去六十分钟。", "这次是 GMT，UTC 也到了一点半。吉隆坡的人，早餐可能都吃完了。"],
    ["把滑块放到接缝前。一点五十九分，下一分钟又是一点整。", "底下的 UTC 一直向前走，只有伦敦的钟面回头了。"],
    ["等到两点半，重复的那一段终于走完。", "要把某个瞬间说清楚，日期和钟点还不够，加上时区偏移才稳妥。今天作业交完，明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("1946 年", "一九四六年") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
main{max-width:1750px;padding:0 40px}header{height:42px}.intro{padding:22px 0}h1{font-size:94px}.eyebrow{margin-bottom:10px}
.workspace{grid-template-columns:minmax(0,1fr) 310px}.instrument{padding:18px 30px 18px 0}.clock-row{padding:17px 0 0}#clock{font-size:112px}.dial{max-width:none;margin:4px 0}svg{height:255px;width:100%}
aside{padding:18px 0 12px 24px}h2{font-size:32px;margin:12px 0}.choices{margin:14px 0}.choices button{padding:12px}.aside-foot{margin-top:12px}.transport{margin-top:18px}.readings{padding:18px 0}.readings strong{font-size:27px}.readings p{font-size:15px}footer{display:none}#video-caption{font-size:30px;bottom:17px;max-width:1770px}
"""

def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.twiceAtOne")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING · LONDON CLOCK CHANGE'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 970))
    page.evaluate("twiceAtOne.render()")


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
                page.evaluate("dt => twiceAtOne.render()", step)
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

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index in [0, 1]:
                hold(end - timeline)
            elif index == 2:
                click("#first")
                hold(end - timeline)
            elif index == 3:
                click("#second")
                hold(end - timeline)
            elif index == 4:
                # Use the real range keyboard controls, then deterministic time
                # steps so capture speed cannot change the clock demonstration.
                box = page.locator("#time").bounding_box()
                move((box["x"] + box["width"] * 59 / 180, box["y"] + box["height"] / 2))
                page.locator("#time").focus()
                page.keyboard.press("Home")
                for _ in range(59):
                    page.keyboard.press("ArrowRight")
                revision += 1
                snap(clicking=True)
                hold(2)
                for m in [60, 61, 62]:
                    page.evaluate("m=>twiceAtOne.select(m)", m)
                    revision += 1
                    hold(1.4)
                hold(end - timeline)
            else:
                page.locator("#time").focus()
                page.keyboard.press("End")
                for _ in range(30):
                    page.keyboard.press("ArrowLeft")
                revision += 1
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
        page.locator("#second").click()
        page.screenshot(path=str(output / "second.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
