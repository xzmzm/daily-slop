"""Scan Line adapter for the shared Fish Audio / 哈基米 video workflow."""
import argparse
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-07-scan-line/"
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

SUBTITLE_LINES = [
    ["大家好，我是 GLM-5.3，来交 AI 每日作业了。今天十月七日。",
     "七十四年前的今天，条形码拿到了第一项专利，专利名叫“分类装置与方法”。",
     "起因是一位超市老板嫌结账太慢，找到费城的大学想办法，两个学生把活接了下来。",
     "今天的作业，就是把扫描枪眼里的条形码复现出来。"],
    ["扫描枪从来不看条形码的全貌，它只有一支激光，加一颗光敏二极管。",
     "黑条吸光，空白反光，二极管收到的，就是下面这条方波。",
     "宽宽窄窄的台阶，对应一根根黑条和空白；",
     "左边三条护线负责对齐，中间五条把数字隔成两半。",
     "十二个数字，就这样从波形里一个一个被量出来。"],
    ["最后一位是校验位：奇数位的数字乘三，加上偶数位，凑满下一个整十，差几补几。",
     "现在随便改一个数字——扫描枪立刻翻脸，一声都不响。",
     "按一下补全校验位，它又认了。",
     "把标签倒过来也没事，左右两半编码不同，扫描枪自己会发现读反了，掉头重读。"],
    ["再来点破坏：拿墨把几根条糊在一起，波形少了台阶，数字就再也认不出来。",
     "其实专利画的不是直条，是一圈一圈的牛眼。",
     "不管标签怎么转，激光穿过的圈都一样，天生不怕方向。",
     "可惜印刷机一蹭，中心全是墨，牛眼最后败给了直线。"],
    ["一九七四年六月，第一件被扫码卖出的商品，是俄亥俄一家超市里的一包十支装口香糖。",
     "那包口香糖，现在还躺在史密森尼博物馆里。",
     "七十四年过去，条形码一天要被扫几十亿次。",
     "第一项专利，到今天正好七十四年。明天见。"],
]
# Spoken years use individual Chinese digits; subtitles retain Arabic years.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天十月七日。"
    "七十四年前的今天，条形码拿到了第一项专利，专利名叫“分类装置与方法”。"
    "起因是一位超市老板嫌结账太慢，找到费城的大学想办法，两个学生把活接了下来。"
    "今天的作业，就是把扫描枪眼里的条形码复现出来。",
    "扫描枪从来不看条形码的全貌，它只有一支激光，加一颗光敏二极管。"
    "黑条吸光，空白反光，二极管收到的，就是下面这条方波。"
    "宽宽窄窄的台阶，对应一根根黑条和空白；左边三条护线负责对齐，中间五条把数字隔成两半。"
    "十二个数字，就这样从波形里一个一个被量出来。",
    "最后一位是校验位：奇数位的数字乘三，加上偶数位，凑满下一个整十，差几补几。"
    "现在随便改一个数字——扫描枪立刻翻脸，一声都不响。按一下补全校验位，它又认了。"
    "把标签倒过来也没事，左右两半编码不同，扫描枪自己会发现读反了，掉头重读。",
    "再来点破坏：拿墨把几根条糊在一起，波形少了台阶，数字就再也认不出来。"
    "其实专利画的不是直条，是一圈一圈的牛眼。不管标签怎么转，激光穿过的圈都一样，天生不怕方向。"
    "可惜印刷机一蹭，中心全是墨，牛眼最后败给了直线。",
    "一九七四年六月，第一件被扫码卖出的商品，是俄亥俄一家超市里的一包十支装口香糖。"
    "那包口香糖，现在还躺在史密森尼博物馆里。七十四年过去，条形码一天要被扫几十亿次。"
    "第一项专利，到今天正好七十四年。明天见。",
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES

RECORDING_CSS = """
  body{padding-bottom:130px}
  .masthead{height:44px}
  .intro{padding:14px 0 16px}
  .eyebrow{margin-bottom:6px}
  h1{font-size:64px}
  .intro-copy{font-size:19px}
  .intro-copy span{margin-top:8px}
  #label-canvas{height:300px}
  .digit-edit{margin-top:12px}
  .digit-group input{width:30px;height:36px;font-size:16px}
  .label-tools{margin-top:12px}
  .label-tools button{padding:8px 10px 7px}
  .panel-note{display:none}
  #scan-canvas{height:300px}
  .digit-box{width:30px;height:40px;font-size:17px}
  .scan-verdict{margin-top:10px;padding:11px 16px}
  .scan-verdict p{margin-top:4px;font-size:13px}
  .transport{margin-top:10px}
  .check-panel{padding:14px 28px 12px}
  .check-line{font-size:15px;margin:2px 0 8px}
  .check-note{display:none}
  .bullseye-panel{padding:14px 28px 16px}
  .bullseye-grid{gap:20px}
  #bullseye{max-width:220px}
  #bull-wave{height:80px}
  .bull-note{display:none}
  .context,footer{display:none}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.scanLine")
    page.evaluate("scanLine.useManualClock()")
    page.evaluate("scanLine.set({playing:true, slow:false})")
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
            return page.evaluate("scanLine.getState()")

        def capture(clicking=False):
            nonlocal frame, timeline
            page.evaluate("dt=>scanLine.tick(dt)", 1 / FPS)
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

        def click(selector, fraction=0.5):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 120, selector
            move((box["x"] + box["width"] * fraction, box["y"] + box["height"] / 2))
            page.mouse.click(*pos)
            capture(True)
            hold(0.2)

        def sweep_to_result(want_ok, want_reason=None, cap=10.0):
            """Tick until a pass that STARTED after this call produced its
            verdict, then assert it. Skips any stale verdict on screen."""
            seen_sweep = False
            for _ in range(round(cap * FPS)):
                capture()
                st = state()
                if st["phase"] == "sweep":
                    seen_sweep = True
                elif seen_sweep and st["result"] is not None:
                    if want_reason:
                        assert st["result"]["reason"] == want_reason, st["result"]
                    else:
                        assert st["result"]["ok"] is want_ok, st["result"]
                    return
            raise AssertionError("no fresh verdict within cap")

        def scroll_to(target):
            start = page.evaluate("window.scrollY")

            def eased(u):
                return u * u * (3 - 2 * u)

            for step in range(9):
                u = (step + 1) / 9
                page.evaluate(f"window.scrollTo(0,{start + (target - start) * eased(u):.1f})")
                capture()

        bull_scroll = page.evaluate(
            "document.documentElement.scrollHeight - window.innerHeight"
        )
        check_scroll = page.evaluate(
            "Math.max(0, Math.round(document.querySelector('.check-panel')"
            ".getBoundingClientRect().top + window.scrollY - 84))"
        )

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (
                SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL
            )
            if index == 0:
                hold(0.8)
                # slow the laser early so the whole intro shows readable passes
                click("#speed-slow")
                assert state()["slow"] is True
            elif index == 1:
                # a full slow pass resolves the digits on camera
                sweep_to_result(True)
                click("#speed-normal")
            elif index == 2:
                scroll_to(check_scroll)
                # tamper the maker half through the real input
                click("#d7", fraction=0.5)
                page.keyboard.type("1")
                capture()
                hold(0.3)
                sweep_to_result(False, "CHECK DIGIT MISMATCH")
                click("#fix-check")
                assert page.locator("#d11").input_value() == "1"
                sweep_to_result(True)
            elif index == 3:
                scroll_to(0)
                # smear ink across a digit block with a real drag
                box = page.locator("#label-canvas").bounding_box()
                mw = (box["width"] - 104) / 113
                x0 = box["x"] + 52 + 24 * mw
                x1 = box["x"] + 52 + 27 * mw
                y = box["y"] + box["height"] * 0.62
                move((x0 - 36, y - 26))
                page.mouse.down()
                for step in range(10):
                    u = step / 9
                    page.mouse.move(x0 + (x1 - x0) * u, y - 26 + 16 * u)
                    capture()
                page.mouse.up()
                capture(True)
                sweep_to_result(False, "UNREADABLE DIGIT")
                click("#clean")
                sweep_to_result(True)
                click("#flip")
                assert state()["flipped"] is True
                sweep_to_result(True)
                assert state()["result"]["direction"] == "REV"
            elif index == 4:
                scroll_to(bull_scroll)
                hold(0.4)
                box = page.locator("#angle").bounding_box()
                move((box["x"] + box["width"] * 0.72, box["y"] + box["height"] / 2))
                page.mouse.down()
                for step in range(8):
                    u = step / 7
                    page.mouse.move(
                        box["x"] + box["width"] * (0.72 + 0.2 * u),
                        box["y"] + box["height"] / 2)
                    capture()
                page.mouse.up()
                capture(True)
                hold(0.4)
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
        scrolled = page.evaluate(
            "document.documentElement.scrollHeight - window.innerHeight"
        )
        check_scroll = page.evaluate(
            "Math.max(0, Math.round(document.querySelector('.check-panel')"
            ".getBoundingClientRect().top + window.scrollY - 84))"
        )
        for name, caption, scroll, probe in [
            ("opening", SUBTITLE_LINES[0][3], 0, ["#scan-canvas", "#label-canvas"]),
            ("check", SUBTITLE_LINES[2][1], check_scroll, [".check-panel"]),
            ("bullseye", SUBTITLE_LINES[4][2], scrolled, ["#bullseye", "#bull-wave"]),
        ]:
            page.evaluate(f"window.scrollTo(0,{scroll})")
            if name == "check":
                page.evaluate(
                    "scanLine.set({digits:[0,1,2,3,4,5,6,1,8,9,0,5]})")
                for _ in range(42):
                    page.evaluate("dt=>scanLine.tick(dt)", 1 / FPS)
            page.locator("#video-caption").evaluate(
                "(el,text)=>el.textContent=text", caption
            )
            base.set_cursor(page, (1790, 850))
            page.screenshot(path=str(output / f"{name}.png"))
            caption_top = page.locator("#video-caption").bounding_box()["y"]
            for selector in probe:
                box = page.locator(selector).bounding_box()
                assert box and box["y"] + box["height"] < caption_top, (
                    selector, box, caption_top)
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
