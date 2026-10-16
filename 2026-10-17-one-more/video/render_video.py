"""One More adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-17-one-more/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。",
     "今天十月十七日，做了个叫『再来一个』的小实验。"],
    ["1956 年的今天，英国的卡尔德霍尔核电站正式启用。",
     "链式反应要稳住，平均每一代得刚好补上上一代。"],
    ["这里把事情缩小了。每个中子，要么留下两个后继，要么一个都没有。",
     "这个一，指的是平均数，可不是保证书。"],
    ["这条撑到了最后，六十四条里却只剩六条。",
     "换一条，第二代就断了。",
     "运气可不会照着虚线走。"],
    ["调到零点八，平均越来越少。",
     "调到一点二，平均越来越多。",
     "不过涨的是平均数，有些链还是会消失。"],
    ["开头换成三十二个中子，再把平均调回一，起伏相对就小了。",
     "再抽一批，路线又不一样。",
     "开头的人手多一点，曲线没那么任性。"],
    ["虚线是数学给的预期，绿色是这六十四次的平均。",
     "它们常常接近，但不必重合。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("1956 年", "一九五六年") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  :root{--canvas-font-scale:1.4}
  .page{max-width:1830px;padding:0 55px}
  .masthead{height:48px;font-size:12px}.masthead a{font-size:13px}
  .intro{padding:20px 0 24px}.intro .eyebrow{font-size:12px}
  .intro h1{font-size:114px}.intro-copy{font-size:23px;max-width:570px}
  .intro-copy>span{font-size:15px}
  .workbench{grid-template-columns:minmax(0,1fr) 370px;height:640px;min-height:640px}
  .tree-heading{font-size:12px;padding:21px 28px 0}
  .tree-wrap{height:288px;flex-shrink:0}
  .chain-picker{gap:13px}.chain-picker button{width:34px;height:30px;font-size:18px}
  .sampling{left:28px;bottom:10px;font-size:10px}
  .chart-heading{font-size:12px;padding:15px 28px 0}
  .legend{gap:18px;font-size:10px}#chart{height:180px;min-height:180px}
  .transport{padding:16px 28px 18px;gap:22px}
  .play{font-size:17px;min-width:130px}.play span{font-size:13px}
  .scrubber label{font-size:11px;margin-bottom:13px}
  input[type=range]{height:5px}input[type=range]::-webkit-slider-thumb{height:20px;width:16px}
  #step{width:38px;height:34px;font-size:14px}
  .controls{padding:25px 30px 24px;gap:23px}
  .average label,.control-label{font-size:11px}
  .k-reading{margin:7px 0}.k-reading output{font-size:90px}.k-reading>span{font-size:37px}
  .regime{font-size:10px;min-height:31px}.ticks{font-size:10px}
  .presets{margin-top:16px}.presets button{font-size:15px;padding:9px 0}
  .source-buttons{margin-top:10px}.source-buttons button{font-size:14px;padding:11px 0}
  .readings{padding:14px 0}.readings>div>span{font-size:9px}
  .readings strong{font-size:39px}.readings small{font-size:13px}
  .reroll{font-size:17px;padding:12px 14px}.batch{font-size:11px}
  .rule{font-size:13px!important;line-height:1.6}
  .observation{padding:19px 0;gap:28px;min-height:77px}
  .observation>.eyebrow{font-size:12px}.observation p{font-size:17px;max-width:1220px}
  .generation-note{font-size:10px}.field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1680px;bottom:18px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.oneMore")
    page.evaluate("oneMore.setLive(false)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 966))
    page.evaluate("oneMore.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".workbench", ".stage", ".observation"]:
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
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)

        def snap(animate=False, clicking=False):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if animate:
                changed = page.evaluate("""dt => {
                  const before=oneMore.state.generation;oneMore.advance(dt);
                  return before!==oneMore.state.generation;
                }""", 1 / FPS)
                if changed:
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
                click("#play")
                hold(5.9, True)
                stats = page.evaluate("oneMore.getStats()")
                assert stats["generation"] == 24 and stats["population"] == 16 and stats["surviving"] == 6, stats
                hold(end - timeline)
            elif index == 3:
                weights = [len(line.replace(" ", "")) for line in SUBTITLE_LINES[index]]
                switch_at = start + seconds * weights[0] / sum(weights)
                hold(switch_at - timeline - .8)
                click("#next")
                stats = page.evaluate("oneMore.getStats()")
                assert stats["population"] == 0 and stats["counts"][2] == 0, stats
                hold(end - timeline)
            elif index == 4:
                click('[data-k="0.8"]')
                assert page.evaluate("oneMore.getStats().expected") < .01
                hold(2.0)
                click("#previous")
                click('[data-k="1.2"]')
                assert page.evaluate("oneMore.getStats().expected") > 79
                hold(end - timeline)
            elif index == 5:
                click('[data-source="32"]')
                click('[data-k="1"]')
                assert page.evaluate("oneMore.getStats().expected") == 32
                hold(2.3)
                click("#reroll")
                assert page.evaluate("oneMore.state.batch") == 2
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
        page.locator('[data-k="1.2"]').click()
        page.locator('[data-source="32"]').click()
        page.locator("#generation").fill("24")
        page.screenshot(path=str(output / "grow.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
