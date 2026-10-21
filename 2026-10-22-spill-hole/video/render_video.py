"""Spill Hole adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-22-spill-hole/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。", "今天十月二十二日，给降落伞剪个洞。"],
    ["1797 年的今天，加纳林从巴黎上空的气球下，带着吊篮落了地。", "人下来了，伞却晃得厉害。空气从伞边挤出去，左右并不听指挥。"],
    ["先不剪。两顶一样大的伞，挂着一样重的篮子，连晃动都重合。", "这趟下落加速播放，橙色和绿色几乎分不开。"],
    ["右边剪开百分之六的面积。空气多了一个向上的出口。", "在这个小模型里，晃动的均方根少了百分之八十三，终端速度增加百分之六。"],
    ["洞开到百分之二十，右边稳多了，也先到地面。", "终端速度到了每秒六点二五米。少晃一点，可不等于落得更慢。"],
    ["拖动回放，就能比较同一时刻两边的高度。", "这里从撑开的伞开始，下降一百二十米。它演示的是取舍，不是复原当年的飞行。"],
    ["真实的伞，还得看形状、材料和吊绳。这里的晃动参数是为了看清现象调的。", "今天的作业交完了。伞上有洞，也有它的用处。明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("1797 年", "一七九七年") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
main{max-width:1840px;padding:0 45px}header{height:40px;font-size:11px}
.intro{padding:14px 0}h1{font-size:80px}.intro .eyebrow{margin-bottom:10px}
.lede p{font-size:30px}.lede>span{font-size:16px}.bench{grid-template-columns:minmax(0,1fr) 390px}
#sky{height:390px}aside{padding:23px 27px}.eyebrow{font-size:11px}.vent-label{font-size:28px}.vent-label output{font-size:72px}
.lane-labels{font-size:12px}.lane-labels small{font-size:13px}.presets button{font-size:14px;min-height:40px}
.hint{font-size:13px;margin:10px 0}.readings{padding:12px 0}.chart-title{margin:16px 0 6px}.readings span{font-size:10px}.readings strong{font-size:31px}.readings small{font-size:13px}
.model-note{font-size:11px;margin-top:10px}#chart{height:82px}.transport{padding:15px 25px}#play{font-size:15px}.transport label{font-size:10px}
.observation{padding:18px 0}.observation p{font-size:21px}.notes,footer{display:none}
#video-caption{font-size:29px;max-width:1750px;bottom:18px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.spillHole")
    page.evaluate("spillHole.setLive(false)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING · ACCELERATED REPLAY'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 966))
    page.evaluate("spillHole.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".bench", ".observation"]:
        box = page.locator(selector).bounding_box()
        assert box["y"] + box["height"] < caption_top - 12, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, (1810, 966), 0
    cache_key, last_frame = None, None
    rate = 2.0
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)

        def snap(animate=False, clicking=False):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if animate:
                page.evaluate("dt => spillHole.advance(dt)", rate / FPS)
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

        def hold(seconds, animate=False):
            for _ in range(max(0, round(seconds * FPS))):
                snap(animate)

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
            if index in [0, 1]:
                hold(end - timeline)
            elif index == 2:
                click('[data-vent="0"]')
                click("#reset")
                click("#play")
                rate = 30 / max(.1, end - timeline)
                hold(end - timeline, True)
            elif index == 3:
                click('[data-vent="6"]')
                click("#reset")
                click("#play")
                rate = 30 / max(.1, end - timeline)
                hold(end - timeline, True)
            elif index == 4:
                click('[data-vent="20"]')
                click("#reset")
                click("#play")
                rate = 30 / max(.1, end - timeline)
                hold(end - timeline, True)
            elif index == 5:
                click('[data-vent="6"]')
                box = page.locator("#time").bounding_box()
                move((box["x"] + box["width"] * .54, box["y"] + box["height"] / 2))
                page.mouse.click(*pos)
                revision += 1
                snap(clicking=True)
                assert 14 < page.evaluate("spillHole.state.time") < 18
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
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)
        page.screenshot(path=str(output / "intro.png"))
        page.locator('[data-vent="20"]').click()
        page.locator("#time").fill("18")
        page.screenshot(path=str(output / "big-vent.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
