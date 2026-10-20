"""Break the Line adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-21-break-the-line/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
INTRO = "大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。"

SUBTITLE_LINES = [
    [INTRO,
     "1805 年的今天，英国舰队在特拉法尔加角外打了一仗。"],
    ["那时候的战舰，炮都排在两舷，只能往侧面打。",
     "两支舰队一般排成两条平行线对轰，谁打输了，就顺风跑掉。"],
    ["先试老打法：斜着靠过去，隔 300 米并排对射。",
     "对面受了伤的船一艘接一艘转向下风，12 艘跑掉 11 艘。"],
    ["纳尔逊换了个办法：船头直接对准敌人的战列冲过去。",
     "这一路上，领头舰的炮一门也转不过来，挨了 19 分钟打，还不了手。"],
    ["可一旦穿过去，英国船就停在了下风一侧，",
     "受伤的敌舰没地方可跑。12 艘全部拿下，英方一艘没丢。"],
    ["今天的作业交完了，明天见。"],
]
SPOKEN = {
    "Claude Opus 5.5": "Claude Opus 五点五",
    "1805 年": "一八零五年",
    "300 米": "三百米",
    "12 艘": "十二艘",
    "11 艘": "十一艘",
    "19 分钟": "十九分钟",
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
  .masthead{height:44px}.intro{padding:12px 0 14px}h1{font-size:80px}.intro-copy{font-size:16px;max-width:820px}.intro-copy span{font-size:14px}
  .workbench{grid-template-columns:minmax(0,1fr) 460px}
  #view{height:590px;aspect-ratio:auto}
  .stage-head{padding:10px 22px 8px}
  .transport{padding:10px 22px 12px}
  .controls{padding:14px 24px;gap:11px}
  #chart{height:110px}
  .verdict{min-height:0;padding:10px 12px;font-size:14px}
  .field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1680px;bottom:18px}
"""
PARK = (1810, 966)
LINE_SCENE_FRAMES = 440    # through the run downwind (frame = 30 s of battle)
NELSON_APPROACH = 92       # through the cut
NELSON_END = 420           # every Combined ship struck


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.breakTheLine")
    page.evaluate("window.__manualClock = true")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.evaluate("breakTheLine.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".workbench", ".stage", ".controls"]:
        box = page.locator(selector).bounding_box()
        assert box["y"] + box["height"] < caption_top - 12, (selector, box, caption_top)


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
                page.evaluate("df => { const s = breakTheLine.state; s.f = Math.min(s.f + df, s.result.frames.length - 1); breakTheLine.render(); }", step)
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

        def sweep(seconds, to_frame):
            """Scrub the battle forward to `to_frame`, evenly over `seconds`."""
            count = max(1, round(seconds * FPS))
            now = page.evaluate("breakTheLine.state.f")
            hold(seconds, (to_frame - now) / count)

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

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                hold(.2)
                click("[data-preset='line']")
                move(PARK)
                sweep(end - timeline - .3, LINE_SCENE_FRAMES)
                assert page.locator("#verdict").inner_text().startswith("Indecisive")
                hold(end - timeline)
            elif index == 3:
                hold(.2)
                click("[data-preset='nelson']")
                move(PARK)
                sweep(end - timeline - .2, NELSON_APPROACH)
                hold(end - timeline)
            elif index == 4:
                sweep(end - timeline - .8, NELSON_END)
                assert page.locator("#phase").inner_text() == "/ OVER"
                assert page.locator("#r-taken").inner_text() == "12 / 12"
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
        page.locator("#video-caption").evaluate("(el,t)=>el.textContent=t", INTRO)
        assert_framing(page)
        page.screenshot(path=str(output / "intro.png"))
        page.locator("[data-preset='line']").click()
        page.evaluate(f"breakTheLine.state.f = 300; breakTheLine.render()")
        page.screenshot(path=str(output / "line.png"))
        page.locator("[data-preset='nelson']").click()
        page.evaluate(f"breakTheLine.state.f = {NELSON_APPROACH - 8}; breakTheLine.render()")
        page.screenshot(path=str(output / "approach.png"))
        page.evaluate(f"breakTheLine.state.f = 200; breakTheLine.render()")
        page.screenshot(path=str(output / "melee.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
