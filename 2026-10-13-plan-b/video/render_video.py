"""Plan B adapter for the shared Fish Audio daily-project renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-13-plan-b/"
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
     "今天十月十三日。2010 年的今天，智利圣何塞矿的最后一名矿工升井，",
     "33 个人，在六百多米深的岩层下面活了 69 天。"],
    ["8 月 5 日塌方，33 个人退到 622 米深的避难所。",
     "第 17 天，一根勘探钻孔把纸条带上来：我们都在避难所，33 人。",
     "接着是三台钻机的竞赛：A 计划、B 计划、C 计划，",
     "谁先打进那个房间，谁就是救命井。"],
    ["岩层里有两段硬岩，钻头磨得飞快。钻头一坏，",
     "就得把几百米钻杆全部提出来换，井越深，这一趟越久。",
     "还有偏斜：打歪十几米，就从房间旁边擦过去。",
     "C 计划的石油钻机打得最快，偏偏最容易跑偏。",
     "看好钻头寿命，必要时打开纠斜。"],
    ["玩得好，B 计划 10 月 9 日上午贯通，和真实历史同一天。",
     "之后三天，把孔扩到 66 厘米，顶部 56 米下钢套管。",
     "座舱是海军造的凤凰二号，54 厘米粗，",
     "带轮子、氧气和通话，一个人一趟。"],
    ["13 日凌晨开始上人。下面快不了：束带、检查、交代，",
     "最弱的先走，工长压阵。",
     "上升速度你定，但太快要照顾坐舱人的神经；",
     "卡住的时候按住倒车，退开再走。"],
    ["真实的那晚，00:11 第一个人上来，21:55 工长乌尔苏亚最后一个上来，",
     "33 人，不到 22 小时。",
     "凤凰二号来回跑了 39 趟，差不多 50 公里。"],
    ["69 天，33 个人，全回来了。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines) for lines in SUBTITLE_LINES]
SEGMENTS = [s.replace("GLM-5.3", "GLM 五点三") for s in SEGMENTS]
# Years digit by digit in the spoken track; subtitles keep Arabic numerals.
SPOKEN = [
    ("2010 年", "二零一零年"), ("8 月 5 日", "八月五日"), ("69 天", "六十九天"),
    ("622 米", "六百二十二米"), ("第 17 天", "第十七天"), ("33 人", "三十三人"),
    ("33 个人", "三十三个人"), ("10 月 9 日", "十月九日"),
    ("66 厘米", "六十六厘米"), ("56 米", "五十六米"), ("54 厘米", "五十四厘米"),
    ("13 日", "十三日"), ("00:11", "零点十一分"), ("21:55", "晚上九点五十五分"),
    ("不到 22 小时", "不到二十二小时"), ("39 趟", "三十九趟"), ("50 公里", "五十公里"),
]
for old, new in SPOKEN:
    SEGMENTS = [s.replace(old, new) for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .wrap{max-width:1760px;padding:12px 44px 0}
  .eyebrow{font-size:12px;margin-bottom:4px}
  h1{font-size:36px;margin-bottom:6px}
  .sub{display:none}
  .stage{grid-template-columns:1080px 400px;gap:22px;justify-content:center}
  .ward{padding:10px}
  #scene{border-radius:10px}
  #status{margin-top:6px;font-size:15px;min-height:2.4em}
  #loglines{font-size:11.5px;min-height:3.4em}
  .facts,.footnote{display:none}
  .panel{padding:12px 14px;gap:9px}
  .rig{padding:8px 10px;gap:5px}
  .stat .v{font-size:20px}
  .stat.big .v{font-size:26px}
  #video-caption{font-size:25px;max-width:1160px;bottom:18px}
"""

PARK = (1780, 1010)
SEED = 20101013


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.planB")
    page.evaluate(f"planB.newGame({SEED})")
    page.evaluate("planB.setLive(false)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,text)=>el.textContent=text", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)


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
        moment = datetime(2026, 10, 13, 6, tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page, f"http://127.0.0.1:{port}/{PROJECT.name}/")
        base.set_cursor(page, PARK)
        pos = PARK

        def glide(target, seconds):
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
                snap()
            hold(.15)

        def snap(clicking=False):
            nonlocal frame, timeline
            base.capture(page, frames / f"{frame:06d}.png", timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds, step_hours=0.0):
            for _ in range(max(1, round(seconds * FPS))):
                if step_hours:
                    page.evaluate(f"planB.step({step_hours})")
                snap()

        def center(selector):
            box = page.locator(selector).bounding_box()
            assert box and box["y"] + box["height"] < HEIGHT - 70, (selector, box)
            return (box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

        def click(selector, settle=.4, travel=.8):
            glide(center(selector), travel)
            page.mouse.click(*pos)
            snap(True)
            hold(settle)

        def state():
            return page.evaluate("planB.state")

        def autopilot():
            page.evaluate("""() => {
              const s = planB.state, M = window.Mine;
              for (const k of ['A','B','C']) {
                const p = s.plans[k];
                if (p.state==='drill' && p.bit < 0.3) M.changeBit(s, k);
              }
            }""")

        def advance(target_t, seconds, on_frame=None):
            """Spread game time so the sim lands on target_t at the scene end."""
            total = round(seconds * FPS)
            done = 0
            while done < total:
                if on_frame and on_frame():
                    return
                remain = max(1, total - done)
                dt = max(0.0005, (target_t - state()["t"]) / remain)
                autopilot()
                page.evaluate(f"planB.step({dt})")
                snap()
                done += 1

        cue_index, start = 0, 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)

            if index == 0:
                # intro over the quiet mountain, the first days of drilling
                hold(seconds + SILENCE_BETWEEN, step_hours=.05)
            elif index == 1:
                # the race: Aug 30 to C spudding in
                advance(1075, seconds + SILENCE_BETWEEN)
            elif index == 2:
                # bit management and steering, clicked when the moment comes
                clicked = set()

                def maybe_click():
                    s = state()
                    if "bit" not in clicked and s["plans"]["B"]["state"] == "drill" and s["plans"]["B"]["bit"] < 0.3:
                        click("#b-change", settle=.3, travel=.7)
                        clicked.add("bit")
                        return False
                    if "steer" not in clicked and s["plans"]["C"]["dev"] > 5:
                        click("#c-steer", settle=.3, travel=.7)
                        clicked.add("steer")
                        return False
                    return False

                advance(1546, seconds + SILENCE_BETWEEN, on_frame=maybe_click)
                assert "bit" in clicked, "no bit change shown"
                assert "steer" in clicked, "no steer shown"
            elif index == 3:
                # ride to breakthrough, hold the banner, then the ream
                guard = 0
                while state()["phase"] == "drill" and guard < 900:
                    autopilot()
                    page.evaluate("planB.step(1.0)")
                    snap()
                    guard += 1
                s = state()
                assert s["winner"] == "B" and s["t"] < 1560, (s["winner"], s["t"])
                hold(min(3.5, max(.1, end - timeline)))
                while state()["phase"] == "ream" and state()["reamLeft"] > 30:
                    page.evaluate("planB.step(0.35)")
                    snap()
                hold(max(0.1, end - timeline), step_hours=.02)
            elif index == 4:
                # the lift: descent, gear choice, a snag worked with reverse
                while state()["phase"] == "ream" or \
                        (state()["rescue"] and state()["rescue"]["sub"] == "tests"):
                    page.evaluate("planB.step(0.5)")
                    snap()
                hold(1.2, step_hours=.0045)
                click("#gear button[data-gear=push]", settle=.3, travel=.7)
                forced = False
                while timeline < end - .5:
                    r = state()["rescue"]
                    if not forced and r and r["sub"] == "ascend" and not r["snagged"] and r["pos"] > 120:
                        page.evaluate("planB.state.rescue.snagAt = planB.state.rescue.pos - 25")
                        forced = True
                    if r and r["snagged"]:
                        glide(center("#reverse"), .7)
                        page.mouse.down()
                        while state()["rescue"]["snagged"]:
                            page.evaluate("planB.step(0.00019)")
                            snap()
                        page.mouse.up()
                        hold(.3, step_hours=.00019)
                        continue
                    page.evaluate("planB.step(0.0045)")
                    snap()
                assert forced, "no snag shown"
            elif index == 5:
                # timelapse to the last men
                page.evaluate("planB.setReverse(true)")
                while state()["phase"] != "done":
                    page.evaluate("planB.step(0.12)")
                    snap()
                s = state()
                assert s["rescue"]["upCount"] == 33
                hold(max(0.1, end - timeline))
            else:
                hold(max(0.1, end - timeline))
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
    """Framing check without narration: one still per phase."""
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        setup(page, (PROJECT / "index.html").as_uri())
        for selector in [".ward", ".panel"]:
            box = page.locator(selector).bounding_box()
            caption_top = page.locator("#video-caption").bounding_box()["y"]
            assert box["y"] + box["height"] < caption_top, (selector, box, caption_top)
        page.evaluate("""() => {
          const M = window.Mine; let guard = 0;
          while (planB.state.phase === 'drill' && guard++ < 4000) {
            for (const k of ['A','B','C']) {
              const p = planB.state.plans[k];
              if (p.state==='drill' && p.bit < 0.3) M.changeBit(planB.state,k);
            }
            planB.step(2);
          }
        }""")
        page.evaluate("planB.step(2)")
        page.screenshot(path=str(output / "drill.png"))
        while page.evaluate("planB.state.phase") == "ream":
            page.evaluate("planB.step(6)")
        page.screenshot(path=str(output / "ream.png"))
        page.evaluate("""() => {
          const M = window.Mine; let guard = 0;
          while (planB.state.phase !== 'done' && guard++ < 2000000) {
            M.step(planB.state, 1/20, { reverse: planB.state.rescue && planB.state.rescue.snagged });
          }
          planB.draw(); planB.updatePanel();
        }""")
        page.screenshot(path=str(output / "done.png"))
        browser.close()
    print("Video framing previews:", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", type=Path, required=True)
    preview(parser.parse_args().preview)
