"""Glamorous Glennis adapter for the shared Fish Audio daily-project renderer."""
import argparse
import importlib.util
import math
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-14-glamorous-glennis/"
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
     "今天十月十四日。1947 年的今天，查克·耶格尔开着橙色的贝尔 X-1，",
     "第一次在平飞中超过了声速。"],
    ["X-1 不自己起飞，它挂在 B-29 的弹舱下面，被带到两万英尺再松开。",
     "松开的那一刻它就在往下掉，得赶紧点火。",
     "火箭有四个燃烧室，每个只能开或关，四个全开，不到三分钟就烧干。"],
    ["为什么要爬到四万多英尺？声速只看气温。",
     "海平面上是每小时 761 英里；三万六千英尺以上，气温停在零下 56 度，",
     "声速降到 660 英里。空气也只剩五分之一，阻力那堵墙矮了一大截。"],
    ["麻烦出在马赫 0.94 附近。激波落到水平尾翼上，",
     "升降舵只剩一成多的效力，机头还被往下压。",
     "四天前那次飞行，耶格尔就在这里丢了俯仰控制。"],
    ["办法早就装在飞机上：整片水平安定面可以动。",
     "一点一点调配平，升降舵不灵了，机头照样抬得住。",
     "右边亮着的「trim up」，就是这个动作。"],
    ["过了马赫 1，压力波追不上机头，叠成一个锥。",
     "座舱里的马赫表在 0.965 卡了一下，然后直接甩出刻度。",
     "地面听到一声闷雷。最后的数据是马赫 1.06，每小时七百英里左右，",
     "超声速一共二十来秒。"],
    ["那天耶格尔的肋骨还裂着两根，关舱门靠的是一截扫帚把。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
# Years digit by digit in the spoken track; subtitles keep Arabic numerals.
SPOKEN = [
    ("Claude Opus 5.5", "Claude Opus 五点五"), ("1947 年", "一九四七年"),
    ("X-1", "X一"), ("B-29", "B二十九"), ("761 英里", "七百六十一英里"),
    ("零下 56 度", "零下五十六度"), ("660 英里", "六百六十英里"),
    ("马赫 0.94", "马赫零点九四"), ("0.965", "零点九六五"), ("马赫 1.06", "马赫一点零六"),
    ("马赫 1，", "马赫一，"), ("「trim up」", "trim up 按钮"),
]
for old, new in SPOKEN:
    SEGMENTS = [s.replace(old, new) for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .wrap{max-width:1800px;padding:10px 44px 0}
  .eyebrow{font-size:12px;margin-bottom:2px}
  h1{font-size:34px;margin-bottom:8px}
  .sub,.facts,.footnote,.keys,#loglines{display:none}
  .stage{grid-template-columns:1090px 400px;gap:22px;justify-content:center}
  .ward{padding:10px}
  #trace{margin-top:8px}
  #status{margin-top:6px;font-size:15px;min-height:2.4em}
  .panel{padding:12px 14px;gap:10px}
  #video-caption{font-size:25px;max-width:1240px;bottom:18px}
"""

PARK = (1800, 1000)
SEED = 19471014


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.glennis")
    page.evaluate(f"glennis.setLive(false); glennis.newFlight({SEED}); glennis.refresh()")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)


# Predict when the autopilot will cross each milestone, from the live state.
PREDICT_JS = """() => {
  const X = window.X1, s = glennis.state;
  const r = X.create({ seed: 77 });
  for (const k of Object.keys(s)) if (k !== 'rand' && k !== 'events') r[k] = JSON.parse(JSON.stringify(s[k]));
  let mem = {}, out = {}, peak = 0, peakT = 0;
  while (r.phase === 'flying' && r.t < s.t + 900) {
    mem = X.autopilot(r, mem);
    X.step(r, 1 / 60);
    if (out.m86 == null && r.mach >= 0.86) out.m86 = r.t;
    if (out.m95 == null && r.mach >= 0.95) out.m95 = r.t;
    if (out.m985 == null && r.mach >= 0.985) out.m985 = r.t;
    if (r.mach > peak) { peak = r.mach; peakT = r.t; }
  }
  out.peak = peakT; out.end = r.t;
  return out;
}"""


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline = 0, 0.0
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        moment = datetime(2026, 10, 14, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        pos = PARK

        def snap(clicking=False):
            nonlocal frame, timeline
            page.evaluate("glennis.refresh()")
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def glide(target, seconds, sim_dt=0.0):
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
                if sim_dt:
                    page.evaluate(f"glennis.step({sim_dt})")
                snap()
            hold(.15, sim_dt)

        def hold(seconds, sim_dt=0.0):
            for _ in range(max(1, round(seconds * FPS))):
                if sim_dt:
                    page.evaluate(f"glennis.step({sim_dt})")
                snap()

        def center(selector):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 70, (selector, box)
            return (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

        def click(selector, sim_dt, settle=.4, travel=.8):
            glide(center(selector), travel, sim_dt)
            page.mouse.click(*pos)
            snap(True)
            hold(settle, sim_dt)

        def park(seconds, sim_dt):
            glide(PARK, seconds, sim_dt)

        def state(expr="glennis.state"):
            return page.evaluate(f"(() => {{ const s = {expr}; return {{t: s.t, mach: s.mach, phase: s.phase, h: s.h, levelSuper: s.levelSuper, outcome: s.outcome}}; }})()")

        def advance(target_t, seconds):
            """Spread sim time so the flight lands on target_t at the scene end."""
            total = max(1, round(seconds * FPS))
            for done in range(total):
                remain = total - done
                dt = max(0.002, (target_t - state()["t"]) / remain)
                page.evaluate(f"glennis.step({dt})")
                snap()

        marks = {}
        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 0:
                # hanging off the B-29, just released
                hold(end - timeline, sim_dt=.02)
            elif index == 1:
                # light two chambers by hand, then hand it to the profile
                hold(1.6, sim_dt=.03)
                click("#chambers button[data-c='0']", .03, settle=.5)
                click("#chambers button[data-c='1']", .03, settle=.5, travel=.5)
                click("#auto", .04, settle=.4, travel=.7)
                park(.9, .1)
                page.evaluate("glennis.setAutopilot(true)")
                marks = page.evaluate(PREDICT_JS)
                advance(min(marks["m86"] * .3, 70), max(.5, end - timeline))
            elif index == 2:
                # the climb into the stratosphere
                advance(marks["m86"], end - timeline)
            elif index == 3:
                # shock on the tail
                advance(marks["m95"], end - timeline)
            elif index == 4:
                # trim holds the nose
                advance(marks["m985"], end - timeline)
            elif index == 5:
                # through: cone, needle off the scale
                advance(marks["peak"] + 4, end - timeline)
                s = state()
                assert s["levelSuper"] > 0, s
            else:
                remain = end - timeline
                advance(marks["end"] + 1, remain * .55)
                while state()["phase"] == "flying":
                    page.evaluate("glennis.step(0.5)")
                    snap()
                s = state()
                assert s["outcome"] == "supersonic", s
                hold(max(0.1, end - timeline))
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s "
                  f"(sim t={state()['t']:.0f}s, M={state()['mach']:.3f})", flush=True)
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
    """Framing check without narration: stills from a full autopilot flight."""
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        page.goto((PROJECT / "index.html").as_uri())
        page.wait_for_function("!!window.glennis")
        page.evaluate(f"glennis.setLive(false); glennis.newFlight({SEED})")
        base.add_browser_chrome(page)
        base.add_caption_overlay(page)
        page.add_style_tag(content=RECORDING_CSS)
        page.evaluate("document.getElementById('video-caption').textContent='字幕位置检查 · caption framing check'")
        caption_top = page.locator("#video-caption").bounding_box()["y"]
        for selector in [".ward", ".panel"]:
            box = page.locator(selector).bounding_box()
            assert box["y"] + box["height"] < caption_top, (selector, box, caption_top)
        page.evaluate("glennis.refresh()")
        page.screenshot(path=str(output / "drop.png"))
        page.evaluate("glennis.setAutopilot(true)")
        for name, until in [("transonic", "s.mach >= 0.95"), ("super", "s.levelSuper > 6"), ("done", "s.phase !== 'flying'")]:
            page.evaluate(f"(() => {{ const s = glennis.state; let g = 0; while (!({until}) && g++ < 20000) glennis.step(1/20); glennis.refresh(); }})()")
            page.screenshot(path=str(output / f"{name}.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
