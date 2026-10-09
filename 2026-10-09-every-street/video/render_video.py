"""Every Street adapter for the shared Fish Audio daily-project renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-09-every-street/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6 Astra，来交 AI 每日作业了。",
     "今天十月九日，世界邮政日。",
     "今天的作业叫 Every Street，你是小镇邮递员。",
     "每条街都得走，还得回到邮局。",
     "看起来像散步，走错了就是加班。"],
    ["从 A 走到 B，再折回 A。",
     "只送完一条街，却走了 240 米。",
     "绿色是送过的，金色是重复走的。",
     "点一下撤销，刚才多走的那段就收回来了。",
     "现实里要有这个按钮就好了。"],
    ["打开路口提示，市场区有四个路口，各接三条街。",
     "每次经过都要一进一出，三条就会剩一条。",
     "想把信送完再回家，总得补上几段回头路。"],
    ["这张图一共 1,290 米。",
     "最短的一圈是 1,680 米，多出来的 390 米躲不掉。",
     "信封走的是其中一条最短路线。",
     "金色的几段，就是这次重复走的地方。"],
    ["换到运河，每个路口只有两条街。",
     "一圈 840 米，完全不用折返。",
     "邮递员今天最想抽到的，应该就是这个片区。"],
    ["花园这边有四条死胡同，进去送信，出来还得原路走。",
     "这一圈要走 1,560 米，其中 580 米是回头路。",
     "地址可以不重复，路却未必。",
     "今天的信送完了，明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace("GPT-6 Astra", "GPT 六 Astra")
# Explicit spoken quantities keep the TTS cadence natural; subtitles stay compact.
for old, new in [("240", "二百四十"), ("1,290", "一千二百九十"),
                 ("1,680", "一千六百八十"), ("390", "三百九十"),
                 ("840", "八百四十"), ("1,560", "一千五百六十"), ("580", "五百八十")]:
    SEGMENTS = [s.replace(old, new) for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{max-width:1660px;padding:0 46px}
  .masthead{height:57px}.intro{padding:25px 0 25px}
  h1{font-size:68px}.intro .eyebrow{margin-bottom:11px}
  .intro-copy{margin-top:14px}.postmark{height:133px;width:109px}
  .workbench{grid-template-columns:minmax(0,1fr) 340px;gap:39px}
  .map-tabs{margin-bottom:14px}.map-tabs button{padding-bottom:12px;font-size:13px}
  .map-heading{padding:15px 26px 0}.map-heading h2{font-size:27px}
  .map-heading .eyebrow{font-size:9px}.map-caption{font-size:11px}
  #map{height:522px}.map-bottom{padding:13px 25px}
  .legend{font-size:11px}.scale-note{font-size:8px}
  .under-map{padding:12px 0}.under-map p{font-size:12px}.hint-toggle{font-size:11px}
  .round-panel{padding-top:3px;padding-left:29px}.delivered{margin-top:19px;margin-bottom:17px}
  .delivered>strong{font-size:78px}.progress-track{margin-bottom:19px}
  .distance-row{font-size:13px;margin-bottom:11px}.distance-row strong{font-size:26px}
  .repeated-row strong{font-size:22px}.location-row{font-size:12px;margin-top:13px;padding-top:13px}
  #move-count{font-size:10px}.status{font-size:12px;margin:11px 0 13px;min-height:39px}
  .solution-card{margin-top:19px;padding-top:19px}.solution-card>p:not(.eyebrow){font-size:18px;margin-bottom:14px}
  .primary-button{font-size:12px;padding:14px}.solution-card .eyebrow{font-size:9px}
  .best-distance{margin-top:15px}.best-distance strong{font-size:30px}
  #best-explanation{font-size:12px;line-height:1.5;margin:8px 0}#pairings{font-size:11px}
  .back-button{padding-top:10px}.field-note{margin-top:12px}
  #video-caption{max-width:1660px;font-size:29px;bottom:18px;padding:10px 22px 12px}
  #video-browser-chrome{background:#e9e6dc;color:#67726b;border-color:#d1d5c7}
  #video-browser-chrome .address{background:#f9f7ef;border-color:#d2d7c8;color:#53655c}
  #video-browser-chrome .badge{color:#a2583c}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.everyStreet")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1769, 905)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        moment = datetime(2026, 10, 9, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)
        state = lambda: page.evaluate("everyStreet.getState()")

        def capture(clicking=False):
            nonlocal frame, timeline
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            nonlocal frame, timeline
            last_signature, last_path = None, None
            for _ in range(max(0, round(seconds * FPS))):
                dt = round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS)
                # Leave the completed route on screen before the next narration.
                # The actual app timer runs 1.25x during automatic tours only.
                page.clock.run_for(round(dt * (1.25 if state()["running"] else 1)))
                snapshot = state()
                signature = (snapshot["map"], snapshot["mode"], snapshot["running"],
                             tuple(snapshot["walk"]), base.caption_at(timeline, cues))
                path = frames / f"{frame:06d}.png"
                if last_path is not None and signature == last_signature:
                    os.link(last_path, path)
                    frame += 1
                    timeline = frame / FPS
                else:
                    capture()
                last_signature, last_path = signature, path

        def until(when):
            hold(max(0, when - timeline))

        def click(selector):
            nonlocal pos
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 80, (selector, box)
            target = (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .045)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            for i in range(8):
                u = i / 7
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.clock.run_for(round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS))
                capture()
            hold(.15)
            page.mouse.click(*pos)
            capture(True)
            hold(.2)

        cue_index, start = 0, 0.0
        for index, seconds in enumerate(durations):
            scene_cues = cues[cue_index:cue_index + len(SUBTITLE_LINES[index])]
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)
            if index == 1:
                until(start + .4)
                click('[data-node="B"]')
                until(scene_cues[0][1] - .9)
                click('[data-node="A"]')
                assert state()["summary"]["distance"] == 240
                until(scene_cues[3][0] + .35)
                click("#undo")
                assert state()["summary"]["distance"] == 120
            elif index == 2:
                click(".hint-toggle")
                assert page.locator(".junction.odd").count() == 4
            elif index == 3:
                click("#solve")
            elif index == 4:
                click('[data-map="canal"]')
                hold(.35)
                click("#solve")
            elif index == 5:
                click('[data-map="gardens"]')
                hold(.35)
                click("#solve")
            until(end)
            if index >= 3:
                snapshot = state()
                assert snapshot["summary"]["complete"], (index, snapshot)
                assert snapshot["summary"]["distance"] == [1680, 840, 1560][index - 3]
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
        moment = datetime(2026, 10, 9, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, (PROJECT / "index.html").as_uri())
        for scene in ["opening", "market", "canal", "gardens"]:
            if scene != "opening":
                page.locator(f'[data-map="{scene}"]').click()
                page.locator("#odd-toggle").check()
                page.locator("#solve").click()
                page.clock.run_for(16000)
            caption = SUBTITLE_LINES[0][0] if scene == "opening" else SUBTITLE_LINES[3 if scene == "market" else 4 if scene == "canal" else 5][1]
            page.locator("#video-caption").evaluate("(el,text)=>el.textContent=text", caption)
            base.set_cursor(page, (1769, 905))
            caption_box = page.locator("#video-caption").bounding_box()
            for selector in [".map-paper", ".round-panel", ".hint-toggle"]:
                box = page.locator(selector).bounding_box()
                assert box["y"] + box["height"] < caption_box["y"], (scene, selector, box, caption_box)
            page.screenshot(path=str(output / f"{scene}.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
