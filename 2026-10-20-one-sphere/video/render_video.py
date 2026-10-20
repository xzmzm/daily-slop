"""One Sphere adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-20-one-sphere/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
INTRO = "大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。"

SUBTITLE_LINES = [
    [INTRO,
     "1973 年的今天，悉尼歌剧院正式开幕。"],
    ["1957 年，伍重凭一张草图赢下设计竞赛，",
     "屋顶像一组帆，可接下来好几年，没人算得出它该怎么造。"],
    ["他最后的办法是：十片屋顶壳，全从同一个球上切下来。",
     "这个球的半径是 75 米。"],
    ["点一下，壳片一片接一片离开球面，",
     "落到台基上，就是歌剧院屋顶的样子。"],
    ["切回 1957 年的自由造型，肋拱一下子变成了彩色。",
     "每根弯得都不一样，两千多段预制件要八百多种曲线。"],
    ["换回球面方案，这片壳的所有肋拱叠在一起，只剩一条线，",
     "一种弯度用遍整个屋顶。"],
    ["今天的作业交完了，明天见。"],
]
SPOKEN = {
    "Claude Opus 5.5": "Claude Opus 五点五",
    "1973 年": "一九七三年",
    "1957 年": "一九五七年",
    "75 米": "七十五米",
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
  .masthead{height:44px}.intro{padding:12px 0 14px}h1{font-size:80px}.intro-copy{font-size:17px;max-width:760px}.intro-copy span{font-size:14px}
  .workbench{grid-template-columns:minmax(0,1fr) 460px}
  #view{height:600px;aspect-ratio:auto}
  .stage-head{padding:10px 22px 0}
  .transport{padding:10px 22px 12px}
  .controls{padding:14px 24px;gap:12px}
  #ribs{height:170px}
  .verdict{min-height:0;padding:10px 12px;font-size:15px}
  .field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1680px;bottom:18px}
"""
PARK = (1810, 966)


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.oneSphere")
    page.evaluate("window.__manualClock = true")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.evaluate("oneSphere.render()")


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

        def snap(animate=0, clicking=False, turn=0):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if animate:
                page.evaluate("dt => oneSphere.advance(dt)", animate)
                revision += 1
            if turn:
                page.evaluate("d => { oneSphere.state.yaw += d; oneSphere.render(); }", turn)
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

        def hold(seconds, animate=0, turn=0):
            for _ in range(max(0, round(seconds * FPS))):
                snap(animate, turn=turn)

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

        def split(index):
            weights = [len(line.replace(" ", "")) for line in SUBTITLE_LINES[index]]
            return weights[0] / sum(weights)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                # the sphere turns slowly while the narration names it
                frames_left = round((end - timeline) * FPS)
                hold(end - timeline, turn=40 / max(1, frames_left))
            elif index == 3:
                click("#play")
                span = end - timeline - .4
                hold(span, 5.05 / (span * FPS))
                hold(end - timeline)
                assert not page.evaluate("oneSphere.state.playing")
                assert page.locator("#where").inner_text() == "/ ON THE PODIUM"
            elif index == 4:
                hold(.3)
                click("[data-mode='free']")
                assert int(page.locator("#r-curves").inner_text().replace(",", "")) > 300
                hold(end - timeline)
            elif index == 5:
                hold(.3)
                click("[data-mode='sphere']")
                assert page.locator("#r-curves").inner_text() == "1"
                hold(start + seconds * split(index) - timeline)
                move(PARK)
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
        page.locator("#play").click()
        page.evaluate("oneSphere.advance(2.5)")
        page.screenshot(path=str(output / "transit.png"))
        page.evaluate("oneSphere.advance(3)")
        page.locator("[data-mode='free']").click()
        page.screenshot(path=str(output / "free.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
