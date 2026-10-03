"""Falling forever (Sputnik night, 4 Oct 1957) adapter for the shared
Fish Audio / 哈基米 capture workflow."""
import argparse
import importlib.util
import math
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-04-falling-forever/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GLM 五点三，来交 AI 每日作业了。",
     "今天十月四日。1957 年的今晚，Sputnik 1 上天，太空时代从这一声哔哔开始。",
     "它为什么掉不下来？牛顿三百年前就画好了图。"],
    ["先说这门炮。架在高山顶上，水平打出去。",
     "子弹 1 公里每秒，落在山下不远；6.9 公里每秒的洲际导弹绕过小半个地球，",
     "最后还是砸回地面。每快一点，落点更远，地面弯掉的也更多。"],
    ["7.45 公里每秒，落点绕到 15,000 公里外，只差一步。",
     "7.5 就再也不落了：每一秒都在掉，地面同步弯开，永远差一点。这就是轨道，一圈 90 分钟。",
     "7.62 画出正圆；过了 10.77 的门槛，就干脆离开地球。"],
    ["Sputnik 本体是个 83.6 公斤的抛光球：不带摄像机、不带仪器，",
     "只有一台一瓦的发射机，哔了 22 天。",
     "近地点 215 公里，远地点 939 公里，一圈 96 分钟。过境一次十来分钟，全世界的收音机都收得到。"],
    ["守在 20.005 兆赫上听：飞来音调偏高，溜走音调一路滑低。",
     "这就是多普勒，一头一尾差 900 多赫兹。业余爱好者靠这条滑线算出了轨道，",
     "导航卫星 Transit 就是从这儿来的。打开温度漂移：发射机漂得比多普勒还凶，",
     "可漂移两头乱晃，滑线只往一边走，认得出。"],
    ["1958 年 1 月 4 日，它坠入大气烧掉，从上天到谢幕只有三个月。",
     "只要够快，掉，也可以永远掉下去。",
     "69 年过去，天上几千个人造天体都还在这么掉着。明天见。"],
]
# Spoken track: years digit by digit; other quantities as ordinary numbers.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天十月四日。一九五七年的今晚，斯普特尼克一号上天，"
    "太空时代从这一声哔哔开始。它为什么掉不下来？牛顿三百年前就画好了图。",
    "先说这门炮。架在高山顶上，水平打出去：子弹 1 公里每秒，落在山下不远；"
    "6.9 公里每秒的洲际导弹，弹道绕过小半个地球，最后还是砸回地面。"
    "每快一点，落点就更远一点，地面弯掉的也更多一点。",
    "7.45 公里每秒，落点已经绕到一万五千公里外，只差一步。7.5，它就再也不落了："
    "每一秒都在掉，可地面同步弯开，永远差那么一点。这就是轨道，一圈 90 分钟。"
    "7.62 画出正圆；过了 10.77 的门槛，就干脆离开地球。",
    "斯普特尼克本体，是个 83.6 公斤的抛光球，不带摄像机，不带仪器，只有一台一瓦的发射机，哔了 22 天。"
    "近地点 215 公里，远地点 939 公里，一圈 96 分钟。过境一次十来分钟，全世界的收音机都收得到。",
    "守在 20.005 兆赫上听：卫星飞来，音调偏高；掠过头顶、开始溜走，音调一路滑下去。"
    "这就是多普勒，一头一尾差 900 多赫兹，业余爱好者靠这条滑线算出了它的轨道，"
    "后来的导航卫星 Transit 就是从这儿来的。再打开温度漂移的开关：发射机自己漂得比多普勒还凶，"
    "可漂移两头乱晃，滑线只往一边走，认得出。",
    "一九五八年一月四号，它坠入大气烧掉，从上天到谢幕只有三个月。可它证明了一件事："
    "只要够快，掉，也可以永远掉下去。六十九年过去，天上几千个人造天体，都还在这么掉着。明天见。",
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{background:#0d1119}
  .masthead{max-width:1860px;padding:26px 28px 4px}
  h1{font-size:44px;margin:4px 0 2px}
  .standfirst{font-size:15px;margin:0 0 8px}
  main{max-width:1860px;padding:0 28px 20px}
  .bench{padding:14px 18px 12px;margin:14px 0}
  .bench-head h2{font-size:21px}
  .bench-note{font-size:13px;margin:0 0 10px}
  .controls{flex-basis:360px;padding:12px;gap:8px}
  .speed-read{font-size:34px}
  .verdict{font-size:13px;min-height:36px}
  .readouts{gap:6px 12px}
  .ro{font-size:15px}
  .ro.big{font-size:19px}
  .facts{font-size:11px}
  .footnotes{display:none}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.ffApp")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("ffApp.setSound(false)")          # no WebAudio in the headless capture
    page.evaluate("window.scrollTo(0, 0)")


def capture_frames(work_dir, durations, port):
    frames = work_dir / "frames"
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0., (1790, 850)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)

        def capture(clicking=False):
            nonlocal frame, timeline
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = math.hypot(dx, dy)
            bend = min(18., distance * .045)
            control = ((start[0] + target[0]) / 2 - dy / max(1., distance) * bend,
                       (start[1] + target[1]) / 2 + dx / max(1., distance) * bend)
            for step in range(7):
                u = step / 6
                e = u * u * (3 - 2 * u)
                v = 1 - e
                pos = (v*v*start[0] + 2*v*e*control[0] + e*e*target[0],
                       v*v*start[1] + 2*v*e*control[1] + e*e*target[1])
                capture()
            hold(.16)

        def click(selector):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 120, selector
            move((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            capture(True)
            hold(.2)

        def smooth_scroll(y_target, seconds):
            y0 = page.evaluate("window.scrollY")
            steps = max(2, round(seconds * FPS))
            for step in range(1, steps + 1):
                u = step / steps
                e = u * u * (3 - 2 * u)
                page.evaluate(f"window.scrollTo(0, {round(y0 + (y_target - y0) * e)})")
                capture()

        def sweep_speed(target, seconds):
            # eased programmatic slider sweep; the cursor stays parked
            start = page.evaluate("ffApp.speed()")
            steps = max(2, round(seconds * FPS))
            for step in range(1, steps + 1):
                u = step / steps
                e = u * u * (3 - 2 * u)
                page.evaluate("v=>ffApp.setSpeed(v)", round((start + (target - start) * e) * 100) / 100)
                capture()

        def last_shot():
            return page.evaluate("ffApp.shots().slice(-1)[0]")

        def assert_result(expected, where, **checks):
            shot = last_shot()
            assert shot["result"] == expected, (where, shot)
            for key, (value, eps) in checks.items():
                assert abs(shot[key] - value) <= eps, (where, key, shot[key], value)

        bench2_scroll = page.evaluate(
            "document.getElementById('beep-bench').offsetTop - 16")

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 0:
                hold(max(0, end - timeline))
            elif index == 1:
                smooth_scroll(150, 1.2)
                click('[data-v="1.0"]')
                assert_result("impact", "rifle bullet", downrangeKm=(337, 60))
                hold(seconds * .15)
                click('[data-v="1.6"]')
                assert_result("impact", "V-2", downrangeKm=(545, 80))
                hold(seconds * .15)
                click('[data-v="6.9"]')
                assert_result("impact", "ICBM", downrangeKm=(5581, 150))
                hold(max(0, end - timeline))
            elif index == 2:
                sweep_speed(7.45, seconds * .16)
                click("#fire")
                assert_result("impact", "near-threshold", downrangeKm=(15283, 200))
                hold(seconds * .1)
                sweep_speed(7.5, seconds * .08)
                click("#fire")
                assert_result("orbit", "first orbit", periodMin=(90.3, 0.4), perigeeKm=(95, 6))
                hold(seconds * .16)
                click('[data-v="7.62"]')
                assert_result("orbit", "circular", perigeeKm=(500, 5))
                hold(seconds * .08)
                click('[data-v="11.0"]')
                assert_result("escape", "escape")
                hold(max(0, end - timeline))
            elif index == 3:
                smooth_scroll(bench2_scroll, 2.2)
                hold(.4)
                click("#play")
                assert page.evaluate("ffApp.passInfo().playing") is True
                hold(14)                                      # the 13 s compressed pass
                hold(max(0, end - timeline))
            elif index == 4:
                click("#drift")
                assert page.evaluate("ffApp.passInfo().drift") is True
                click("#play")
                hold(14)                                      # the drifted pass, 13 s + settle
                verdict = page.evaluate("document.getElementById('beep-verdict').textContent")
                assert "Drift on" in verdict, verdict
                hold(max(0, end - timeline))
            elif index == 5:
                smooth_scroll(150, 2.0)
                click("#clear")
                click('[data-v="7.62"]')
                assert_result("orbit", "closing circle", periodMin=(94.4, 0.5))
                move((1790, 850))
                hold(max(0, end - timeline))
            print(f"Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s", flush=True)
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
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        for name, caption in [
            ("cannon", SUBTITLE_LINES[2][1]),
            ("beep", SUBTITLE_LINES[4][0]),
        ]:
            page.locator("#video-caption").evaluate("(el,text)=>el.textContent=text", caption)
            base.set_cursor(page, (1790, 850))
            if name == "cannon":
                page.evaluate("[1.0, 7.45, 7.5, 7.62, 10.77].forEach(v=>{ffApp.setSpeed(v); ffApp.fire()})")
                page.evaluate("window.scrollTo(0, 150)")
            else:
                page.evaluate("window.scrollTo(0, document.getElementById('beep-bench').offsetTop - 16)")
                page.evaluate("ffApp.playPass()")
                page.wait_for_timeout(5600)
            page.screenshot(path=str(output / f"{name}.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
