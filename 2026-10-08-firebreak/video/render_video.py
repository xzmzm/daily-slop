"""Firebreak adapter for the shared Fish Audio / 哈基米 video workflow."""
import argparse
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-08-firebreak/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = (
    base.free_port, base.wait_for_server, base.duration)
write_srt = base.write_srt

# The break line cut ahead of the fire during segment 2 (grid cells),
# one gunpowder charge per second while the cursor walks down the line.
BREAK_LINE = [(17, 27), (19, 25), (21, 23), (23, 21), (25, 19)]
WIND_DRAG_AT_DESTROYED = 500     # segment 3: pull the slider 32 -> 45 mph
RAIN_AT_ELAPSED = 6.0            # segment 4: click the rain, then hold

SUBTITLE_LINES = [
    ["大家好，我是 GLM-5.3，来交 AI 每日作业了。今天十月八日。",
     "155 年前的今晚，芝加哥起了一场大火。",
     "传说是牛踢翻了灯笼，其实是记者编的，1893 年他自己承认了。",
     "真正的帮凶是天气：一整个夏天的干旱，加上西南方向的大风。"],
    ["点火之后就看出风的立场：顺风，火一头扎向东北；顶风，它原地打转。",
     "我在火头前面用火药炸出一条隔离带，直着烧过来的火，到这里确实断了粮。",
     "可火星不走地面，它们被热气卷上天，直接落在隔离带后面。",
     "刚才有一炮还把旁边的房子点着了——这不算事故，当年的消防队也一样。"],
    ["芝加哥河就在前面，河对岸就是市中心。河宽三个街区，火焰过不去，火星过得去。",
     "右边这张图是火屑的落点分布：风速 32 英里时，绝大多数火星都能飞过河。",
     "把风速拉到 45 英里，大半个城区都在射程里。",
     "火烧到这个规模，连风都开始听它的了。"],
    ["真正让这场火停下来的，不是人力，是周一深夜的一场雨。",
     "到这一刻，这张图上烧掉的，差不多六成城市。",
     "真实的那一晚：3.3 平方英里，17,500 栋楼，十万人无家可归。"],
    ["同一晚，同一个锋面，威斯康星州的佩什蒂戈烧得更彻底，1500 多人没能等到天亮。",
     "那才是美国历史上最致命的火灾，只是没有芝加哥的名气。",
     "每年十月的防火周，就定在这两天。今天的作业交完了，明天见。"],
]
# Spoken years use individual Chinese digits; subtitles keep Arabic years.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天十月八日。"
    "一百五十五年前的今晚，芝加哥起了一场大火。"
    "传说是一头牛踢翻了灯笼，其实那是记者编的，一八九三年他自己承认了。"
    "真正的帮凶是天气：一整个夏天的干旱，加上西南方向吹来的大风。",
    "点火之后就看出风的立场：顺着风，火一头扎向东北；顶着风，它原地打转。"
    "我在火头前面用火药炸出一条隔离带，直着烧过来的火，到这里确实断了粮。"
    "可火星不走地面，它们被热气卷上天，直接落在隔离带后面。"
    "刚才有一炮还把旁边的房子点着了——这不算事故，当年的消防队也一样。",
    "芝加哥河就在前面，河对岸就是市中心。河宽三个街区，火焰过不去，火星过得去。"
    "右边这张图是火屑的落点分布：风速三十二英里的时候，绝大多数火星都能飞过河。"
    "把风速拉到四十五英里，大半个城区都在射程里。火烧到这个规模，连风都开始听它的了。",
    "真正让这场火停下来的，不是人力，是周一深夜的一场雨。"
    "到这一刻，这张图上烧掉的，差不多六成城市。"
    "真实的那一晚：三点三平方英里，一万七千五百栋楼，十万人无家可归。",
    "同一晚，同一个锋面，威斯康星州的佩什蒂戈烧得更彻底，一千五百多人没能等到天亮。"
    "那才是美国历史上最致命的火灾，只是没有芝加哥的名气。"
    "所以每年十月的防火周，就定在这两天。今天的作业交完了，明天见。",
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES

RECORDING_CSS = """
  body{padding-bottom:130px}
  .masthead{height:44px}
  .intro{padding:10px 0 12px}
  .eyebrow{margin-bottom:4px}
  h1{font-size:54px}
  .intro-copy{font-size:16px}
  .intro-copy span{margin-top:6px;font-size:11px}
  .city-panel{padding:14px 18px 12px}
  .wind-panel{padding:14px 18px 12px}
  #city-canvas{height:560px;width:auto;max-width:100%;margin:0 auto;display:block}
  .chip{min-width:88px;padding:6px 9px 5px}
  .chip b{font-size:12px;margin-top:3px}
  .readout{margin-top:9px;gap:7px}
  .transport{margin-top:9px}
  .transport button{padding:8px 10px 7px}
  .legend{margin-top:8px}
  .panel-note{display:none}
  .wind-note{margin-top:8px}
  #ember-canvas{margin-top:8px}
  .context,footer{display:none}
  .verdict{margin-top:9px;padding:9px 14px}
  .verdict p{font-size:12px}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.firebreak")
    page.evaluate("firebreak.useManualClock()")
    page.evaluate("firebreak.set({windSpeed:32, windDir:45, speed:1})")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate(
        "(el,text)=>el.textContent=text", URL
    )
    page.locator("#video-browser-chrome .badge").evaluate(
        "el=>el.textContent='LOCAL RECORDING'"
    )
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("window.scrollTo(0,0)")


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1790, 850)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1
        )
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)

        def state():
            return page.evaluate("firebreak.getState()")

        def capture(clicking=False, rate=1.0):
            nonlocal frame, timeline
            page.evaluate("dt=>firebreak.tick(dt)", rate / FPS)
            base.capture(
                page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking
            )
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target, frames_count=7):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = math.hypot(dx, dy)
            bend = min(18.0, distance * 0.045)
            control = (
                (start[0] + target[0]) / 2 - dy / max(1, distance) * bend,
                (start[1] + target[1]) / 2 + dx / max(1, distance) * bend,
            )
            for step in range(frames_count):
                u = step / (frames_count - 1)
                e = u * u * (3 - 2 * u)
                v = 1 - e
                pos = (
                    v*v*start[0] + 2*v*e*control[0] + e*e*target[0],
                    v*v*start[1] + 2*v*e*control[1] + e*e*target[1],
                )
                capture()
            hold(0.14)

        def cell_px(cx, cy):
            box = page.locator("#city-canvas").bounding_box()
            return (
                box["x"] + (cx + 0.5) / 64 * box["width"],
                box["y"] + (cy + 0.5) / 44 * box["height"],
            )

        def click(selector, fraction=0.5):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 120, selector
            move((box["x"] + box["width"] * fraction, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            capture(True)
            hold(0.2)

        def drag_slider(selector, from_value, to_value, steps=9):
            box = page.locator(selector).bounding_box()
            y = box["y"] + box["height"] / 2
            x0 = box["x"] + box["width"] * from_value
            x1 = box["x"] + box["width"] * to_value
            move((x0, y))
            page.mouse.move(x0, y)          # the real pointer, not the overlay
            page.mouse.down()
            for step in range(steps):
                u = step / (steps - 1)
                page.mouse.move(x0 + (x1 - x0) * (u * u * (3 - 2 * u)), y)
                capture()
            page.mouse.up()
            capture(True)
            hold(0.2)

        end = 0
        for index, seconds in enumerate(durations):
            seg_start = frame
            end += seconds + (
                SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL
            )
            if index == 0:
                hold(2.0)
                click("#ignite")
                assert state()["phase"] == "burning"
            elif index == 1:
                # one charge per second down the break line, cursor leading
                for k, (cx, cy) in enumerate(BREAK_LINE):
                    while frame - seg_start < (k + 2) * FPS:
                        capture()
                    move(cell_px(cx, cy))
                    result = page.evaluate(
                        "([x, y]) => firebreak.blast(x, y)", [cx, cy]
                    )
                    assert result["ok"] and result["cleared"] > 0, result
                    capture(True)
                    hold(0.3)
                assert state()["blasts"] == len(BREAK_LINE)
                assert state()["backfires"] >= 1, "expected a backfire on camera"
                pos = (1790, 850)
                move(pos, frames_count=5)
            elif index == 2:
                dragged = False
                while frame - seg_start < seconds * FPS * 0.9:
                    capture(rate=1.0 if not dragged else 1 / 3)
                    if not dragged and state()["destroyed"] >= WIND_DRAG_AT_DESTROYED:
                        drag_slider("#wind-speed", 32 / 50, 0.905)
                        page.evaluate("firebreak.set({windSpeed:45})")
                        capture()
                        dragged = True
                assert dragged and state()["windSpeed"] == 45, state()["windSpeed"]
                assert state()["emberCrossP"] > 0.84
            elif index == 3:
                rained = False
                while frame - seg_start < seconds * FPS:
                    elapsed = (frame - seg_start) / FPS
                    if not rained and elapsed >= RAIN_AT_ELAPSED:
                        click("#rain")
                        assert state()["phase"] == "ended"
                        assert state()["rained"] is True
                        assert page.locator("#verdict").is_visible()
                        rained = True
                    capture()
                assert rained
                s = state()
                assert s["percent"] > 0.35, s["percent"]
                title = page.locator("#verdict-title").inner_text()
                assert title == "CHICAGO BURNS.", title
            hold(max(0, end - timeline))
            assert timeline <= end + 1 / FPS, (index, timeline, end)
            print(
                f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s",
                flush=True,
            )
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
        "-i", str(frames_dir / "%06d.png"), "-i", str(narration),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium",
        "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart", str(output),
    ])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    print("Video framing previews:", output, flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        page.locator("#video-caption").evaluate(
            "(el,text)=>el.textContent=text", SUBTITLE_LINES[0][1]
        )
        base.set_cursor(page, (1790, 850))
        page.screenshot(path=str(output / "opening.png"))

        # break scene: light it, run to segment-2 cadence, cut the line
        page.evaluate("firebreak.ignite()")
        for _ in range(255):
            page.evaluate("dt=>firebreak.tick(dt)", 1 / FPS)
        for cx, cy in BREAK_LINE:
            page.evaluate("([x, y]) => firebreak.blast(x, y)", [cx, cy])
            for _ in range(15):
                page.evaluate("dt=>firebreak.tick(dt)", 1 / FPS)
        page.evaluate("dt=>{for(let i=0;i<60;i++) firebreak.tick(dt)}", 1 / FPS)
        page.locator("#video-caption").evaluate(
            "(el,text)=>el.textContent=text", SUBTITLE_LINES[1][2]
        )
        base.set_cursor(page, cell_of(page, *BREAK_LINE[2]))
        page.screenshot(path=str(output / "break.png"))

        # verdict scene: rain after the long burn
        page.evaluate("dt=>{for(let i=0;i<2200;i++) firebreak.tick(dt)}", 1 / FPS)
        page.evaluate("firebreak.rainNow()")
        page.locator("#video-caption").evaluate(
            "(el,text)=>el.textContent=text", SUBTITLE_LINES[3][2]
        )
        base.set_cursor(page, (1790, 850))
        page.screenshot(path=str(output / "verdict.png"))
        caption_top = page.locator("#video-caption").bounding_box()["y"]
        for selector in ["#city-canvas", "#verdict", "#rain"]:
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < caption_top, (
                selector, box, caption_top)
        browser.close()


def cell_of(page, cx, cy):
    box = page.locator("#city-canvas").bounding_box()
    return (
        box["x"] + (cx + 0.5) / 64 * box["width"],
        box["y"] + (cy + 0.5) / 44 * box["height"],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
