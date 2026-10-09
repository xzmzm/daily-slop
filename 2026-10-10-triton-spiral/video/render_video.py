"""Triton Spiral adapter for the shared Fish Audio daily-project renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-10-triton-spiral/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GLM-5.3，来交 AI 每日作业了。",
     "今天十月十日，1846 年的今天，利物浦的酿酒商拉塞尔，",
     "在海王星被发现十七个晚上之后，用自磨的望远镜找到了它的卫星，海卫一。",
     "啤酒钱撑起来的天文台，看到了太阳系里最特别的一颗卫星。"],
    ["别的卫星都顺着行星自转的方向转，海卫一偏偏反着来。",
     "粉色的轨道是它今天的路线，5.9 天逆行一圈；",
     "海王星 16 小时自转一圈，行星边上的箭头就是这个方向。",
     "每次擦身，海卫一都把海王星的潮汐隆起拖向错误的一边，隆起反手拽它一下。"],
    ["逆行的卫星没有停机位。把时间往后拖 36 亿年，",
     "轨道只会一圈圈收紧，这些淡淡的椭圆，是它一路收进来的旧轨道。",
     "整个就是一个漏斗，面板里的倒计时跟着往下掉。",
     "今天的我们不用着急，海卫一自己躲不掉。"],
    ["换个方向试试。点成顺行，结局立刻变了：",
     "轨道不再收紧，反而慢慢往外漂，46 亿年后能远出几万公里。",
     "这跟月球离开地球是一个道理。",
     "顺行的卫星有退路，逆行的没有。"],
    ["再看它的过去。刚被海王星俘获那会儿，轨道又扁又远，",
     "潮汐花了几千万年把椭圆揉圆，正好落在今天的轨道上。",
     "那阵子潮汐生热，最高能到阳光的 40 倍，冰壳底下养得起一片海洋。"],
    ["最后回到逆行，把时间拖到头。",
     "轨道碰到洛希极限，2.3 个海王星半径，海卫一当场解体成环。",
     "这条环的质量是土星环的 1,000 多倍，内圈落向海王星，外圈重新聚成几颗新的卫星。",
     "土星看了都得沉默。今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace("GLM-5.3", "GLM 五点三")
# Spoken numbers stay natural; subtitles keep the compact Arabic forms.
for old, new in [("1846 年", "一八四六年"), ("5.9 天", "五点九天"),
                 ("16 小时", "十六小时"), ("36 亿年", "三十六亿年"),
                 ("46 亿年", "四十六亿年"), ("40 倍", "四十倍"),
                 ("2.3 个", "二点三个"), ("1,000 多倍", "一千多倍")]:
    SEGMENTS = [s.replace(old, new) for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{padding-top:44px}
  .wrap{max-width:1740px;padding:20px 44px 0}
  .eyebrow{font-size:13px;margin-bottom:8px}
  h1{font-size:48px;margin-bottom:8px}
  .sub{font-size:19px;margin-bottom:12px;max-width:100ch}
  .stage{grid-template-columns:minmax(0,1fr) 412px;gap:22px}
  .sky-card{min-height:780px}
  #sky{min-height:0}
  .explainer,.facts{display:none}
  .panel{padding:17px 19px 13px;gap:12px}
  .clock .big{font-size:32px}
  #video-caption{font-size:25px;max-width:1160px;bottom:20px}
  #video-browser-chrome{background:#0d1426;color:#7d90bd;border-color:#1d2a4a}
  #video-browser-chrome .address{background:#0a1120;border-color:#1d2a4a;color:#a9b8dd}
  #video-browser-chrome .badge{color:#f2a7bf}
"""

PARK = (1836, 998)


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function(
        "!!window.tritonSpiral && typeof window.tritonSpiral.pump === 'function'")
    page.evaluate("tritonSpiral.pump(0.03)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("tritonSpiral.pump(0.03)")


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, PARK
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        moment = datetime(2026, 10, 10, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)
        state = lambda: page.evaluate("tritonSpiral.getState()")

        def step():
            page.clock.run_for(round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS))
            page.evaluate("tritonSpiral.pump(1/15)")

        def capture(clicking=False):
            nonlocal frame, timeline
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            nonlocal frame, timeline
            last_signature, last_path = None, None
            for _ in range(max(0, round(seconds * FPS))):
                step()
                snapshot = state()
                signature = (round(snapshot["t"] / 1e7), snapshot["playing"],
                             snapshot["shattered"], round(snapshot["ringClock"] / 1e7),
                             round(snapshot["scale"] * 20000), base.caption_at(timeline, cues))
                path = frames / f"{frame:06d}.png"
                if last_path is not None and signature == last_signature:
                    os.link(last_path, path)
                    frame += 1
                    timeline = frame / FPS
                else:
                    capture()
                last_signature, last_path = signature, path
            return state()

        def until(when):
            return hold(max(0, when - timeline))

        def glide(target, seconds):
            """Eased, slightly curved cursor move with a short settle."""
            nonlocal pos, frame, timeline
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .045)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            for i in range(max(2, round(seconds * FPS))):
                u = (i + 1) / max(2, round(seconds * FPS))
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                base.set_cursor(page, pos)
                step()
                capture()
            hold(.15)
            return target

        def click(selector, settle=.2):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 80, (selector, box)
            glide((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2), .9)
            page.mouse.click(*pos)
            capture(True)
            hold(settle)

        def drag_scrub(frac_to, seconds):
            """Grab the timeline thumb and drag it, capturing every frame."""
            nonlocal pos
            box = page.locator("#scrub").bounding_box()
            snap = state()
            x0 = box["x"] + box["width"] * snap["t"] / snap["T"]
            x1 = box["x"] + box["width"] * frac_to
            y = box["y"] + box["height"] / 2
            glide((x0, y), .7)
            page.mouse.move(x0, y)      # the overlay glides; the OS pointer must land too
            page.mouse.down()
            n = max(2, round(seconds * FPS))
            for i in range(n):
                u = (i + 1) / n
                eased = u * u * (3 - 2 * u)
                pos = (x0 + (x1 - x0) * eased, y)
                page.mouse.move(*pos)
                base.set_cursor(page, pos)
                step()
                capture()
            page.mouse.up()
            hold(.3)

        cue_index, start = 0, 0.0
        for index, seconds in enumerate(durations):
            scene_cues = cues[cue_index:cue_index + len(SUBTITLE_LINES[index])]
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)
            if index == 1:
                until(scene_cues[1][0] + .2)
                click("#play")
            elif index == 2:
                until(scene_cues[0][0] + .3)
                click("#play")           # pause — time moves by hand now
                until(scene_cues[0][1])
                drag_scrub(.90, 4.2)
                snap = state()
                assert not snap["shattered"] and snap["a"] < 200000, snap
            elif index == 3:
                until(scene_cues[0][0] + .5)
                click("#dir-pro")
                until(scene_cues[1][0] + .2)
                drag_scrub(1.0, 3.6)
                snap = state()
                assert snap["doom"] is None and not snap["retro"], snap
            elif index == 4:
                until(scene_cues[0][0] + .4)
                click("#dir-retro")
                click("#preset-capture")
                until(scene_cues[1][1])
                drag_scrub(.05, 4.0)
                snap = state()
                assert snap["preset"] == "capture" and snap["e"] < 0.01, snap
            elif index == 5:
                until(scene_cues[1][0] + .1)
                drag_scrub(1.0, 5.0)
                snap = until(scene_cues[3][0])
                assert snap["shattered"] and snap["ringClock"] > 1e8, snap
            else:
                hold(seconds)
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
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, reduced_motion="reduce")
        moment = datetime(2026, 10, 10, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, (PROJECT / "index.html").as_uri())

        def set_scrub(frac):
            page.evaluate(
                "f => { const c = document.getElementById('scrub');"
                " c.value = Math.round(1000*f); c.dispatchEvent(new Event('input')); }", frac)
            settle_and_draw()

        def settle_and_draw():
            # The canvas resize observer fires async and clears the buffer;
            # let it settle, then redraw explicitly.
            page.wait_for_timeout(150)
            for _ in range(3):
                page.evaluate("tritonSpiral.pump(1/15)")

        caption_box = page.locator("#video-caption").bounding_box()
        caption_top = caption_box["y"]
        for selector in [".sky-card", ".panel", ".footnote"]:
            box = page.locator(selector).bounding_box()
            assert box["y"] + box["height"] < caption_top, (selector, box, caption_top)
        scenes = {"opening": lambda: None,
                  "spiral": lambda: set_scrub(.90),
                  "prograde": lambda: (page.click("#dir-pro"), set_scrub(1.0)),
                  "capture": lambda: (page.click("#dir-retro"), page.click("#preset-capture"),
                                      set_scrub(.05)),
                  "ring": lambda: set_scrub(1.0)}
        for name, action in scenes.items():
            action()
            settle_and_draw()
            page.locator("#video-caption").evaluate(
                "(el,text)=>el.textContent=text", SUBTITLE_LINES[
                    0 if name == "opening" else 2 if name == "spiral" else
                    3 if name == "prograde" else 4 if name == "capture" else 5][0])
            base.set_cursor(page, PARK)
            page.screenshot(path=str(output / f"{name}.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
