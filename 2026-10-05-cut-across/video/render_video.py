"""Cut Across adapter for the shared Fish Audio / 哈基米 video workflow."""
import argparse
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-05-cut-across/"
spec = importlib.util.spec_from_file_location(
    "cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py"
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。",
     "今天十月五日。1962 年的今天，第一部邦德电影《诺博士》在伦敦首映。",
     "今天的作业，是剪片时常见的一百八十度规则。"],
    ["两个人站在这里，连起来就是轴线。两台相机在同一边。",
     "左边是片场，右边是它们拍到的画面：角度不同，人物左右关系还在。"],
    ["按下播放，每两秒切一次镜头。绿色的人一直在左边，橙色的人一直在右边。",
     "观众不用重新找人，能接着看他们的对话。"],
    ["现在把 B 相机搬过线。片场里两个人一动没动，画面里却交换了左右。",
     "一剪过去，像是突然换了座位。这个跳变来自相机的位置。"],
    ["回到同一边，关系又接上了。不过，过线也能拍：",
     "用一个移动镜头交代位置，或者有意让观众迷失方向。",
     "规则帮你看清发生了什么，取舍还是导演的。明天见。"],
]
# Spoken years use individual Chinese digits; subtitles retain Arabic years.
SEGMENTS = [
    "大家好，我是 GPT 六点一 Sol，来交 AI 每日作业了。今天十月五日。"
    "一九六二年的今天，第一部邦德电影《诺博士》在伦敦首映。"
    "今天的作业，是剪片时常见的一百八十度规则。",
    "两个人站在这里，连起来就是轴线。两台相机在同一边。"
    "左边是片场，右边是它们拍到的画面：角度不同，人物左右关系还在。",
    "按下播放，每两秒切一次镜头。绿色的人一直在左边，橙色的人一直在右边。"
    "观众不用重新找人，能接着看他们的对话。",
    "现在把 B 相机搬过线。片场里两个人一动没动，画面里却交换了左右。"
    "一剪过去，像是突然换了座位。这个跳变来自相机的位置。",
    "回到同一边，关系又接上了。不过，过线也能拍：用一个移动镜头交代位置，"
    "或者有意让观众迷失方向。规则帮你看清发生了什么，取舍还是导演的。明天见。",
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .masthead{height:56px}
  .intro{padding:20px 0 22px}
  h1{font-size:76px}
  .intro-copy{font-size:22px}
  .set-panel,.edit-panel{padding:18px 24px}
  #stage{max-height:300px}
  #monitor{height:300px;aspect-ratio:auto}
  .shot-card svg{height:76px}
  .verdict{padding:18px 2px}
  .context,footer{display:none}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.cutAcross")
    page.evaluate("cutAcross.useManualClock()")
    page.evaluate("cutAcross.set({cameraB:135,playing:false,shot:'a',time:0})")
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
    observed_shots = set()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1
        )
        page.on("pageerror", lambda error: errors.append(str(error)))
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, pos)

        def state():
            return page.evaluate("cutAcross.getState()")

        def capture(clicking=False):
            nonlocal frame, timeline
            page.evaluate("dt=>cutAcross.tick(dt)", 1 / FPS)
            observed_shots.add(state()["shot"])
            base.capture(
                page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking
            )
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
            bend = min(18.0, distance * 0.045)
            control = (
                (start[0] + target[0]) / 2 - dy / max(1, distance) * bend,
                (start[1] + target[1]) / 2 + dx / max(1, distance) * bend,
            )
            for step in range(7):
                u = step / 6
                e = u * u * (3 - 2 * u)
                v = 1 - e
                pos = (
                    v*v*start[0] + 2*v*e*control[0] + e*e*target[0],
                    v*v*start[1] + 2*v*e*control[1] + e*e*target[1],
                )
                capture()
            hold(0.16)

        def click(selector):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 120, selector
            move((box["x"] + box["width"] / 2, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            capture(True)
            hold(0.2)

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (
                SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL
            )
            if index == 2:
                observed_shots.clear()
                click("#play-cut")
                assert state()["playing"] is True
                assert state()["cameraB"] == 135
            elif index == 3:
                assert {"a", "b"} <= observed_shots
                observed_shots.clear()
                click("#cross-line")
                assert state()["cameraB"] == 225
                assert state()["playing"] is True
            elif index == 4:
                assert {"a", "b"} <= observed_shots
                click("#same-side")
                assert state()["cameraB"] == 135
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
        for name, angle, caption in [
            ("opening", 135, SUBTITLE_LINES[0][1]),
            ("same-side", 135, SUBTITLE_LINES[2][0]),
            ("crossed", 225, SUBTITLE_LINES[3][0]),
        ]:
            page.evaluate("angle=>cutAcross.set({cameraB:angle,shot:'b'})", angle)
            page.locator("#video-caption").evaluate(
                "(el,text)=>el.textContent=text", caption
            )
            base.set_cursor(page, (1790, 850))
            page.screenshot(path=str(output / f"{name}.png"))
            caption_box = page.locator("#video-caption").bounding_box()
            for selector in ("#stage", "#frame-a", "#frame-b", "#monitor", "#play-cut"):
                box = page.locator(selector).bounding_box()
                assert box and box["y"] + box["height"] < caption_box["y"], (
                    selector, box, caption_box
                )
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
