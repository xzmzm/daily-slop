"""Spin Down adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-23-spin-down/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。", "今天十月二十三日，iPod 二十五岁了。"],
    ["2001 年的今天，苹果发布了第一代 iPod，号称能防震二十分钟。", "它能先把音乐存进内存，硬盘停下来，歌照样唱。今天做个小实验。"],
    ["左边一直读硬盘，只留两秒余粮。右边提前存好二十分钟。", "按下播放，右边的硬盘还在睡，内存里的音乐却在往外走。"],
    ["现在让硬盘五分钟都读不出数据。左边两秒后就哑了，右边继续播放。", "五分钟过去，右边还有十三分钟。这里的时间加速了。"],
    ["把内存改成只能放两分钟。同样停读五分钟，后面三分钟就没声了。", "多存一点，能多扛一会儿，可不能永远不读盘。"],
    ["再换回大内存，停读时按下一首。两边一起没声了。", "这次故意选了一首还没存进去的歌。内存里再热闹，也帮不上忙。"],
    ["等读盘恢复，右边很快补满，又能接着睡。图下的细条记录硬盘醒着的时间。", "这里的读盘速度是演示参数，不能拿来算续航。今天作业交完，明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("2001 年", "二零零一年") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
main{max-width:1850px;padding:0 44px}header{height:40px;font-size:12px}
.intro{padding:14px 0 18px}.intro .eyebrow{font-size:13px;margin-bottom:14px}h1{font-size:110px}
.intro-copy{width:400px}.intro-copy p{font-size:32px}.intro-copy>span{font-size:16px;max-width:390px}
.controls{padding:13px 0}.controls button,.controls select{font-size:17px}.controls button{padding:12px 18px}
.experiment-status{font-size:13px;padding:15px 0}.player{padding:23px 28px 20px}
.card-heading .eyebrow{font-size:12px}h2{font-size:31px}.strategy-tag{font-size:11px}
.signal-path{height:155px}.hardware{width:167px}.drive{transform:scale(1.15);margin-left:3px}.component-label,.component-label b{font-size:10px}.component-label{margin-top:17px}
.memory{max-width:210px}.memory-grid{height:78px;gap:5px}.direct .memory-grid{max-width:100px;height:47px}
.output{width:55px;font-size:10px}.equalizer{height:56px}.equalizer i{width:6px}.connector{font-size:25px}.connector span{top:14px}
.card-readings span,.card-readings label{font-size:12px;min-height:25px}.card-readings select{font-size:12px}.card-readings strong{font-size:42px}
.history{margin-top:18px}.history-heading h3{font-size:18px}.history-heading>span{font-size:11px}#history{height:108px;margin-top:8px}.history-caption{font-size:11px}
.observation{font-size:22px;padding-top:15px;min-height:52px}.notes,footer{display:none}
#video-caption{font-size:30px;max-width:1770px;bottom:17px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.spinDown")
    page.evaluate("spinDown.setLive(false)")
    page.locator("#speed option:checked").evaluate("el=>el.textContent='Replay time'")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING · ACCELERATED MODEL'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 980))
    page.evaluate("spinDown.render()")


def assert_framing(page):
    caption_top = page.locator("#video-caption").bounding_box()["y"]
    for selector in [".players", ".history", ".observation"]:
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
                page.evaluate("dt => spinDown.advance(dt)", step)
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

        def select_capacity(value):
            nonlocal revision
            click("#capacity")
            # Headless macOS native popup menus ignore arrow keys. Playwright's
            # select action drives the actual control and dispatches its change event.
            page.keyboard.press("Escape")
            page.locator("#capacity").select_option(str(value))
            assert int(page.locator("#capacity").input_value()) == value
            revision += 1
            hold(.25)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index in [0, 1]:
                hold(end - timeline)
            elif index == 2:
                click("#play")
                hold(end - timeline, simulated=120)
            elif index == 3:
                click("#block")
                hold(min(3.3, (end - timeline) * .5), simulated=300)
                hold(end - timeline)
                assert page.locator("#cached-reserve").inner_text() == "13:00"
                assert page.locator("#direct-silence").inner_text() == "04:58"
            elif index == 4:
                select_capacity(120)
                click("#play")
                click("#block")
                hold(min(1.7, (end - timeline) * .4), simulated=300)
                hold(end - timeline)
                assert page.locator("#cached-silence").inner_text() == "03:00"
            elif index == 5:
                select_capacity(1200)
                click("#play")
                click("#block")
                hold(.4, simulated=3)
                click("#skip")
                hold(end - timeline, simulated=10)
                assert page.locator("#cached-output").inner_text() == "SILENT"
            else:
                remaining = page.evaluate("spinDown.state.outageLeft")
                hold(min(1.8, (end - timeline) * .2), simulated=remaining)
                hold(min(2.8, (end - timeline) * .4), simulated=34)
                hold(end - timeline, simulated=45)
                assert page.locator("#cached-output").inner_text() == "PLAYING"
                assert page.locator("#cached-drive").inner_text() == "ASLEEP"
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
        page.locator("#play").click(); page.locator("#block").click()
        page.evaluate("spinDown.advance(240)")
        page.screenshot(path=str(output / "outage.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
