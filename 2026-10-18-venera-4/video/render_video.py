"""Venera 4 adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-18-venera-4/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 Claude Sonnet 5.5，来交 AI 每日作业了。",
     "今天十月十八日，做了个叫『最后一次读数』的小实验。"],
    ["1967 年的今天，苏联的金星 4 号在降落伞下一路报数，",
     "最后停在二十二个大气压。莫斯科说，它到了地面。"],
    ["下降大约九十三分钟，气压从零点七五升到二十二，",
     "温度从五十二度升到二百六十二度。信号就在这里断了。"],
    ["气压和温度能算出高度差，这一段大约三十一公里，改不了。",
     "唯一不知道的，是最后一次读数离地面多高。"],
    ["第二天水手 5 号飞过，数据说零点七二个大气压在地面上五十八公里。",
     "可金星 4 号的高度计，开头只报了二十六公里。"],
    ["这种雷达有周期性的模糊，读数可能多出三十几公里。",
     "勾上它，再把最后读数抬到二十七公里，两条线就对上了。"],
    ["所以它多半是在二十七公里的高空被压坏的，",
     "下面还有一百多个大气压。今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines).replace("Claude Sonnet 5.5", "Claude Sonnet 五点五").replace("1967 年", "一九六七年").replace("水手 5 号", "水手五号").replace("金星 4 号", "金星四号") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{max-width:1830px;padding:0 55px}
  .masthead{height:44px}.intro{padding:14px 0 16px}.intro h1{font-size:84px}.intro-copy{font-size:18px}.intro-copy span{font-size:14px}
  .workbench{grid-template-columns:minmax(0,1fr) 420px}
  #chart{height:560px}#chart text{font-size:17px}
  .stage-head{padding:12px 22px 0}
  .transport{padding:10px 22px 12px}
  .controls{padding:16px 24px;gap:14px}.h-read output{font-size:52px}.ground strong{font-size:34px}
  .verdict{min-height:0;padding:10px 12px;font-size:14px}.caveat{display:none}
  .observation,.field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1680px;bottom:18px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.venera")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 966))
    page.evaluate("venera.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".workbench", ".stage", ".controls"]:
        box = page.locator(selector).bounding_box()
        assert box["y"] + box["height"] < caption_top - 12, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, (1810, 966), 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 Claude Sonnet 5.5，来交 AI 每日作业了。'")
        assert_framing(page)

        def snap(animate=0, clicking=False):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if animate:
                page.evaluate("dt => venera.advance(dt)", animate)
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

        def hold(seconds, animate=0):
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
                click("#play")
                page.evaluate("venera.state.playing=false")
                span = end - timeline - .8
                hold(span, 12.3 / (span * FPS))
                hold(end - timeline)
                assert page.evaluate("venera.state.lost")
            elif index == 3:
                hold(end - timeline)
            elif index == 4:
                assert page.evaluate("venera.getStats().verdict") == "split"
                hold(end - timeline)
            elif index == 5:
                weights = [len(line.replace(" ", "")) for line in SUBTITLE_LINES[index]]
                switch_at = start + seconds * weights[0] / sum(weights)
                hold(switch_at - timeline - .8)
                click("#alias")
                assert page.evaluate("venera.state.alias")
                hold(.8)
                click('[data-h="27"]')
                assert page.evaluate("venera.getStats().verdict") == "agree"
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
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 Claude Sonnet 5.5，来交 AI 每日作业了。'")
        assert_framing(page)
        page.screenshot(path=str(output / "intro.png"))
        page.locator('[data-h="27"]').click()
        page.evaluate("venera.seek(93)")
        page.screenshot(path=str(output / "lost.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
