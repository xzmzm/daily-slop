"""Iron Lung adapter for the shared Fish Audio daily-project renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-12-iron-lung/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。",
     "今天十月十二日。1928 年的今天，波士顿儿童医院第一次给病人用上了“铁肺”。",
     "病人是个八岁左右的孩子，小儿麻痹症让呼吸肌瘫了，快喘不上气了。"],
    ["现在泵还停着。孩子的肌肉只剩一成力气，每口气只有十几毫升，",
     "连鼻腔到气管这 50 毫升都填不满，新鲜空气到不了肺里。",
     "血里的二氧化碳一路往上涨，嘴唇和脸开始发紫。"],
    ["打开电机。箱子里的气压被抽到比屋里低 12 厘米水柱，",
     "胸口被往外拉开，屋里的空气自己从鼻子流了进去。",
     "这台机器从来不往肺里吹气，它只是把身体周围的气压降下来。"],
    ["德林克和肖用的是一个铁皮箱子，加两台吸尘器的鼓风机。",
     "现在孩子每口气能吸进一百七十毫升左右，一分钟二十次。",
     "二氧化碳在往回落，脸色也慢慢回来了。"],
    ["但抽得快不等于好。改成每分钟 40 次，每次只抽 8 厘米水柱，",
     "一分钟进出的空气和刚才差不多，可每口气只剩八十毫升，",
     "其中五十毫升停在气管里又被呼了出去，二氧化碳又开始涨了。"],
    ["调回来，再试试停电。电机一停，孩子马上又喘不上气。",
     "后来的铁肺都配了手动摇杆。五十年代小儿麻痹大流行时，",
     "一停电，护士和家属就轮流用手压。按住一秒多，再松开一秒多。"],
    ["一分钟二十来下，二氧化碳就稳住了。",
     "手一停，曲线马上又往上走。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace("Claude Opus 5.5", "Claude Opus 五点五")
# Years digit by digit; other numbers spoken naturally. Subtitles keep Arabic.
for old, new in [("1928 年", "一九二八年"), ("50 毫升", "五十毫升"), ("12 厘米", "十二厘米"),
                 ("40 次", "四十次"), ("8 厘米", "八厘米")]:
    SEGMENTS = [s.replace(old, new) for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .wrap{max-width:1600px;padding:14px 44px 0}
  .eyebrow{font-size:13px;margin-bottom:6px}
  h1{font-size:42px;margin-bottom:4px}
  .sub{display:none}
  .stage{grid-template-columns:1060px 420px;gap:26px;justify-content:center}
  .ward{padding:12px}
  #trace{margin-top:8px}
  #status{font-size:18px;min-height:0;margin-top:8px}
  .facts,.footnote{display:none}
  .panel{padding:14px 16px;gap:11px}
  .stat .v{font-size:22px}
  .stat.big .v{font-size:32px}
  #video-caption{font-size:25px;max-width:1160px;bottom:20px}
"""

PARK = (1836, 998)


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.ironLung && typeof window.ironLung.pump === 'function'")
    page.evaluate("ironLung.pump(0)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("ironLung.pump(0)")


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, PARK
    errors = []
    pumping = {"on": False, "phase": 0.0}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        moment = datetime(2026, 10, 12, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)
        state = lambda: page.evaluate("ironLung.getState()")
        held = {"down": False}

        def step():
            # Hand pumping: hold 1.2 s, release 1.6 s (about 21 pulls a minute).
            if pumping["on"]:
                pumping["phase"] = (pumping["phase"] + 1 / FPS) % 2.8
                want = pumping["phase"] < 1.2
                if want != held["down"]:
                    (page.mouse.down if want else page.mouse.up)()
                    held["down"] = want
            page.clock.run_for(round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS))
            page.evaluate(f"ironLung.pump({1 / FPS})")

        def capture(clicking=False):
            nonlocal frame, timeline
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking or held["down"])
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                step()
                capture()
            return state()

        def until(when):
            return hold(max(0, when - timeline))

        def glide(target, seconds):
            """Eased, slightly curved cursor move with a short settle."""
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .045)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            n = max(2, round(seconds * FPS))
            for i in range(n):
                u = (i + 1) / n
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                base.set_cursor(page, pos)
                step()
                capture()
            hold(.15)

        def center(selector):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 80, (selector, box)
            return (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

        def click(selector, settle=.2, travel=.8):
            glide(center(selector), travel)
            page.mouse.click(*pos)
            capture(True)
            hold(settle)

        cue_index, start = 0, 0.0
        for index, seconds in enumerate(durations):
            scene_cues = cues[cue_index:cue_index + len(SUBTITLE_LINES[index])]
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)
            if index == 1:
                snap = until(scene_cues[2][0])
                assert snap["verdict"] == "failing" and not snap["motor"], snap
            elif index == 2:
                until(scene_cues[0][0] + .3)
                click("#motor-on", travel=.8)
                assert state()["motor"]
            elif index == 3:
                snap = until(scene_cues[1][0] + .5)
                assert abs(snap["rr"] - 20) < 1 and snap["vt"] > .15, snap
            elif index == 4:
                snap = until(scene_cues[0][0] + 1.6)
                assert snap["sat"] > 86, snap
                click("#rate-40", travel=.7)
                click("#amp-8", travel=.6)
                low = state()["co2"]
                snap = until(end - .3)
                assert snap["vt"] < .1 and snap["va"] < 1.6 and snap["co2"] > low + 3, (low, snap)
            elif index == 5:
                until(scene_cues[0][0] + .1)
                click("#rate-20", travel=.6)
                click("#amp-12", travel=.6)
                click("#motor-off", travel=.7)
                assert not state()["motor"]
                until(scene_cues[1][0])
                glide(center("#hand"), .8)
                pumping["on"], pumping["phase"] = True, 0.0
            elif index == 6:
                until(scene_cues[1][0])
                pumping["on"] = False
                if held["down"]:
                    page.mouse.up()
                    held["down"] = False
                snap = state()
                assert snap["rr"] > 18 and snap["vt"] > .15 and snap["co2"] < 55, snap
            until(end)
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s", flush=True)
            cue_index += len(SUBTITLE_LINES[index])
            start = end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
              "-i", str(frames_dir / "%06d.png"), "-i", str(narration),
              "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium",
              "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
              "-shortest", "-movflags", "+faststart", str(output)])


def preview(output):
    """Framing check without narration: one still per scene state."""
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        caption_top = page.locator("#video-caption").bounding_box()["y"]
        for selector in [".ward", ".panel"]:
            box = page.locator(selector).bounding_box()
            assert box["y"] + box["height"] < caption_top, (selector, box, caption_top)
        scenes = {"opening": ([], 6), "motor": (["#motor-on"], 40), "fast": (["#rate-40", "#amp-8"], 15),
                  "cut": (["#rate-20", "#amp-12", "#motor-off"], 4)}
        for i, (name, (clicks, secs)) in enumerate(scenes.items()):
            for selector in clicks:
                page.click(selector)
            for _ in range(secs * FPS):
                page.evaluate(f"ironLung.pump({1 / FPS})")
            page.locator("#video-caption").evaluate("(el,text)=>el.textContent=text", SUBTITLE_LINES[i][1])
            base.set_cursor(page, PARK)
            page.screenshot(path=str(output / f"{name}.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
