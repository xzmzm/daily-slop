"""Form 1040 (1913) adapter for the shared Fish Audio / 哈基米 capture workflow."""
import argparse
import importlib.util
import math
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-03-form-1040/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GLM 五点三，来交 AI 每日作业了。",
     "今天十月三日。1913 年的今天，威尔逊总统签下新关税法，联邦所得税从此定型，1040 表也在这一年出生。",
     "当年它只有一页，罚则倒是写得很清楚。"],
    ["想交税，先得够格：单身 3000 美元起征，夫妻 4000。",
     "工人一年 580 块，教师 700，职员 1200——都差得远。工程师 4000，刚过线，一年交 10 块。",
     "全美国大约只有 2% 的家庭，摸到过这张表。"],
    ["把收入拉到 23,000。3000 到 20,000 的部分收 1%；超过 20,000 的只有 3000 块，这几块加收 1%。",
     "前面 20,000 的税率一分没变——所谓跳档，跳的从来只是超出的那一段。",
     "收入到 50,000，新的那一段改收 2%，一段一段往上摞。"],
    ["顶到一百万。最后一美元交 7 美分，已经是 1913 年的最高档。",
     "可全年摊下来，只掏了 6%。",
     "下一个美元的税率，和整年的税率，是两个数，从来如此。"],
    ["表里还藏着个小机关：3000 的豁免，只从普通税里扣。",
     "20,000 起征的附加税照收不误。切到夫妻，豁免变 4000，省下的只有普通税那 10 块钱。",
     "结婚的甜头，1913 年就这么大。"],
    ["把这位百万富豪搬进今天：收入乘 33，还是同样的日子。",
     "1913 年交 60,020 块；2026 年，要交 1200 多万。",
     "最高档也从 7% 涨到了 37%。1040 表 113 岁了，每年 4 月还在原地等大家。明天见。"],
]
# Spoken track: years digit by digit, quantities in Chinese, 1040 read digit by digit.
SEGMENTS = [
    "大家好，我是 GLM 五点三，来交 AI 每日作业了。今天十月三日。一九一三年的今天，威尔逊总统签下新关税法，"
    "联邦所得税从此定型，一零四零表也在这一年出生。当年它只有一页，罚则倒是写得很清楚。",
    "想交税，先得够格：单身三千美元起征，夫妻四千。工人一年五百八十块，教师七百，职员一千二，都差得远。"
    "工程师四千，刚过线，一年交十块。全美国大约只有百分之二的家庭，摸到过这张表。",
    "把收入拉到两万三。三千到两万的部分收百分之一；超过两万的只有三千块，这几块加收百分之一。"
    "前面两万的税率一分没变，所谓跳档，跳的从来只是超出的那一段。收入到五万，新的一段改收百分之二，一段一段往上摞。",
    "顶到一百万。最后一美元交七美分，已经是一九一三年的最高档；可全年摊下来，只掏了百分之六。"
    "下一个美元的税率，和整年的税率，是两个数，从来如此。",
    "表里还藏着个小机关：三千的豁免，只从普通税里扣。两万起征的附加税照收不误。"
    "切到夫妻，豁免变四千，省下的只有普通税那十块钱。结婚的甜头，一九一三年就这么大。",
    "把这位百万富豪搬进今天：收入乘三十三，还是同样的日子。一九一三年交六万零二十块；二零二六年，要交一千二百多万。"
    "最高档也从百分之七，涨到了百分之三十七。一零四零一百一十三岁了，每年四月还在原地等大家。明天见。",
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{background:#d9cfaf}
  .page{max-width:1860px;padding:12px 26px 8px}
  .masthead{padding:0 0 8px}
  .masthead-rule{margin:0 210px}
  .masthead h1{font-size:42px;margin:8px 0 2px;letter-spacing:3px}
  .masthead h1 .year{font-size:22px}
  .tagline{font-size:14px}
  .authority{font-size:10.5px;margin:2px 0 4px}
  .bench{gap:20px;margin-top:4px}
  .controls{padding:14px 16px}
  .control-heading{font-size:10px;margin:2px 0 8px}
  .income-input{font-size:22px}
  .status-btn{font-size:11px;padding:4px 10px}
  .income-slider{margin:12px 0 2px;height:22px}
  .slider-scale{font-size:10px;margin-bottom:10px}
  .personas{gap:5px}
  .personas button{font-size:11px;padding:6px 9px}
  .quick-facts{gap:6px}
  .quick-facts li{font-size:11px}
  .paper{padding:14px 16px}
  .form-head h2{font-size:18px}
  .form-brand{font-size:9px}
  .form-note{font-size:10.5px}
  .form-lines li{font-size:12px;padding:3.5px 0}
  .num{font-size:13px}
  .big-num{font-size:22px}
  .surtax{font-size:11px}
  .surtax th{font-size:9px}
  .pencil-note{font-size:11px}
  .form-fineprint{font-size:8.5px}
  .ladder{padding:14px 16px}
  .panel-title{font-size:10px;margin-bottom:8px}
  .staircase{height:172px}
  .income-bar{height:40px}
  .rate-value{font-size:26px}
  .rate-sub{font-size:10px}
  .who-sub{font-size:11px}
  .today-btn{font-size:11.5px;padding:7px 0}
  .footnotes{display:none}
  #video-caption{font-size:30px;max-width:1680px;bottom:22px;padding:11px 24px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.form1040")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate("form1040.set({income: 23000, married: false})")
    page.evaluate("form1040.toggleToday(false)")


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

        def sweep(target, seconds):
            # Eased programmatic income sweep, captured frame by frame so the
            # motion and its timeline share the video clock.
            start = page.evaluate("form1040.state().income")
            steps = max(2, round(seconds * FPS))
            for step in range(1, steps + 1):
                u = step / steps
                e = u * u * (3 - 2 * u)
                page.evaluate("v=>form1040.set({income: v})", round(start + (target - start) * e))
                capture()

        def assert_total(expected, where):
            actual = page.evaluate("form1040.state().total")
            assert abs(actual - expected) < 0.01, (where, actual, expected)

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 0:
                hold(max(0, end - timeline))
            elif index == 1:
                click('[data-income="580"]')
                assert_total(0, "factory hand")
                hold(seconds * .18)
                click('[data-income="700"]')
                hold(seconds * .18)
                click('[data-income="1200"]')
                hold(seconds * .18)
                click('[data-income="4000"]')
                assert_total(10, "engineer")
                hold(max(0, end - timeline))
            elif index == 2:
                sweep(23000, seconds * .42)
                assert_total(230, "sweep end")
                hold(seconds * .18)
                sweep(50000, seconds * .16)
                assert_total(770, "at fifty thousand")
                sweep(54000, seconds * .10)
                assert_total(890, "second band lit")
                hold(max(0, end - timeline))
            elif index == 3:
                click('[data-income="1000000"]')
                assert_total(60020, "oil magnate")
                hold(max(0, end - timeline))
            elif index == 4:
                click('[data-income="23000"]')
                assert_total(230, "bank president")
                hold(seconds * .3)
                click("#status-married")
                assert_total(220, "married quirk")
                hold(max(0, end - timeline))
            elif index == 5:
                click("#status-single")  # scene 4 ended married; the magnate files single
                click('[data-income="1000000"]')
                assert_total(60020, "single magnate for the 2026 compare")
                click("#today-toggle")
                assert page.evaluate("form1040.state().todayOpen") is True
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
        for name, opts, caption in [
            ("opening", {"income": 23000}, SUBTITLE_LINES[0][0]),
            ("million", {"income": 1000000, "today": True}, SUBTITLE_LINES[3][0]),
            ("today", {"income": 1000000, "married": False, "today": True}, SUBTITLE_LINES[5][0]),
        ]:
            page.evaluate("opts=>{form1040.set(opts); if (opts.today) form1040.toggleToday(true)}", opts)
            page.locator("#video-caption").evaluate("(el,text)=>el.textContent=text", caption)
            base.set_cursor(page, (1790, 850))
            page.screenshot(path=str(output / f"{name}.png"))
            caption_box = page.locator("#video-caption").bounding_box()
            for selector in (".controls", ".paper", ".ladder"):
                box = page.locator(selector).bounding_box()
                assert box and box["y"] + box["height"] < caption_box["y"], (selector, box, caption_box)
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
