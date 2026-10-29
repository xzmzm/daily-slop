"""Station Break adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-30-station-break/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
INTRO = "大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。"

SUBTITLE_LINES = [
    [INTRO,
     "1938 年的今天晚上，CBS 电台播了一出广播剧《世界大战》，讲火星人入侵。"],
    ["节目开头说了这是广播剧。可接下来三十多分钟，",
     "全是假的新闻快讯，直到 8 点 40 才再提醒一次。"],
    ["不少人是 8 点 12 分左右从 NBC 换台过来的，正好错过了开头那句。",
     "图里每条线是一个听众，红色是当真了的。换台的人里，81% 当真。"],
    ["要是每十分钟提醒一次呢？还有 15% 的人当真。",
     "8 点 10 分那次太早，换台的人还没到。"],
    ["其实只要一次，放在 8 点 17 分半，",
     "换台的人刚到不久就能听到，当真的降到 8%。"],
    ["第二天报纸说全国大恐慌，后来的研究发现，真被吓到的人少得多。",
     "不过道理没变：提醒只对正在听的人有用。"],
    ["今天的作业交完了，明天见。"],
]
SPOKEN = {
    "Claude Opus 5.5": "Claude Opus 五点五",
    "1938 年": "一九三八年",
    "8 点 40": "八点四十",
    "8 点 12 分": "八点十二分",
    "8 点 10 分": "八点十分",
    "8 点 17 分半": "八点十七分半",
    "81%": "百分之八十一",
    "15%": "百分之十五",
    "8%": "百分之八",
}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken("".join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{max-width:1830px;padding:0 55px}
  .masthead{height:40px}.intro{padding:10px 0 12px}h1{font-size:76px}.intro-copy{font-size:16px;max-width:900px}.intro-copy span{font-size:14px;margin-top:4px}
  .workbench{grid-template-columns:minmax(0,1fr) 440px}
  #view{width:auto;height:610px;margin:0 auto}
  .stage-head{padding:8px 20px 6px}
  .onair{min-height:38px;padding:6px 20px}
  .transport{padding:6px 20px 10px}
  .controls{padding:14px 22px;gap:12px}
  .readout .big strong{font-size:40px}
  .verdict{min-height:0;font-size:14px}
  .field-notes,footer,.hint{display:none}
  #video-caption{font-size:29px;max-width:1680px;bottom:18px}
"""
PARK = (1810, 966)


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.stationBreak")
    page.evaluate("window.__manualClock = true")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.evaluate("stationBreak.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".workbench", ".stage", ".controls"]:
        box = page.locator(selector).bounding_box()
        assert box["y"] + box["height"] < caption_top - 8, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, PARK, 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        page.locator("#video-caption").evaluate("(el,t)=>el.textContent=t", INTRO)
        assert_framing(page)

        def snap(step=0, clicking=False):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if step:
                page.evaluate("dt => { const s = stationBreak.state; s.t = Math.min(60, s.t + dt); stationBreak.render(); }", step)
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

        def hold(seconds, step=0):
            for _ in range(max(0, round(seconds * FPS))):
                snap(step)

        def sweep(seconds, to_minute):
            """Move the broadcast clock to `to_minute`, evenly over `seconds`."""
            count = max(1, round(seconds * FPS))
            now = page.evaluate("stationBreak.state.t")
            hold(seconds, (to_minute - now) / count)

        def set_minute(t):
            nonlocal revision
            page.evaluate("t => { stationBreak.state.t = t; stationBreak.render(); }", t)
            revision += 1

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
            hold(.25)

        def share():
            return page.locator("#r-share").inner_text()

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                set_minute(0)
                sweep(end - timeline - .2, 12)
                hold(end - timeline)
            elif index == 2:
                sweep(end - timeline - .6, 60)
                assert page.locator("#r-dial").inner_text() == "81%"
                hold(end - timeline)
            elif index == 3:
                hold(.2)
                click("[data-preset='every10']")
                move(PARK)
                assert share() == "15%", share()
                hold(end - timeline)
            elif index == 4:
                click("[data-preset='aired']")
                click("#best")
                move(PARK)
                assert share() == "8%", share()
                set_minute(0)
                sweep(end - timeline - .4, 60)
                hold(end - timeline)
            else:
                hold(end - timeline)
            assert timeline <= end + .3, (index, timeline, end)
            print(f"Captured scene {index+1}/{len(durations)} at {timeline:.1f}s", flush=True)
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
        page.locator("#video-caption").evaluate("(el,t)=>el.textContent=t", SUBTITLE_LINES[2][1])
        assert_framing(page)
        page.screenshot(path=str(output / "aired.png"))
        page.locator("[data-preset='every10']").click()
        page.screenshot(path=str(output / "every10.png"))
        page.locator("[data-preset='aired']").click()
        page.locator("#best").click()
        page.evaluate("stationBreak.state.t = 30; stationBreak.render()")
        page.screenshot(path=str(output / "best.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
