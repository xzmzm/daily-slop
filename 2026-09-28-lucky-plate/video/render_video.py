"""Lucky-plate adapter for the established cattery Fish Audio video workflow."""
import argparse
import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-28-lucky-plate/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3，来交 AI 每日作业了。', '今天是九月二十八日。', '1928 年的今天，弗莱明度假回到实验室，发现一只培养皿被霉菌污染了。', '换别人多半直接刷掉，他凑近看了一眼：霉菌周围一圈，葡萄球菌全死了。'],
    ['这口皿的运气，是三个巧合叠出来的。', '它没进 35 °C 的孵箱，被忘在长凳上；', '一颗青霉孢子从楼下飘了进来；', '那年八月伦敦反常地凉，霉菌先悄悄长了半个月，细菌几乎没动。', '等天转暖、细菌铺开的时候，青霉素早就渗进琼脂里了。'],
    ['霉菌一边长，一边往外分泌青霉素，在琼脂里形成浓度梯度。', '浓度高过细菌承受线的地方，细菌活不成——清出来的那圈透明，就是抑菌圈。', '圈能有多宽，取决于扩散和降解的平衡，几个毫米，不多不少。'],
    ['重演那两个月：先冷后暖，日期和温度都在跑。', '冷锋那半个月，霉长得慢，但细菌几乎冻结；', '转暖那几天，细菌一下子铺满全皿，唯独霉菌周围让开一圈。', '右边那三条，就是运气的三个前提，一个个亮起来。'],
    ['如果当初这口皿进了孵箱呢？', '拖到 35 °C 重新划线：细菌两天铺满，孢子根本发不了芽，青霉素也停止分泌。', '机会窗口关上，培养皿直接进水槽，历史改写。', '下面那张图是两条生长曲线的交叉点，26.8 °C 上下——霉快还是菌快，全看这条线。'],
    ['还有一个 1928 年的伏笔：', '勾上允许突变，把观察之后的日子继续养下去，', '抑菌圈边上会慢慢长出耐得住药的菌落，把透明圈填回来——病房里的大麻烦，皿上先演了一遍。', '十二年后，弗洛里和钱恩把它提纯成药，救回无数人。', '今天这口皿就交给你了，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
# TTS reads the builder name and years in Chinese; burned-in subtitles above
# keep the plain forms.
SEGMENTS[0] = SEGMENTS[0].replace('GLM-5.3', 'GLM 五点三')
for i, s in enumerate(SEGMENTS):
    SEGMENTS[i] = (s.replace('1928 年', '一九二八年')
                    .replace('35 °C', '三十五度')
                    .replace('26.8 °C', '二十六点八度'))
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  html,body{overflow:hidden !important}
  .masthead{padding:12px 26px 2px}
  h1{font-size:27px}.eyebrow{margin-bottom:3px;font-size:10.5px}
  .intro-copy{display:none}
  main{max-width:1920px;padding:0 20px}
  .studio{grid-template-columns:minmax(0,1fr) 340px;gap:14px;margin-top:6px;align-items:start}
  .bench{padding:16px;border-radius:12px}
  #dish{max-width:640px}
  .plate-label{margin-top:8px;font-size:11.5px}
  .readout-bar{margin-top:10px;gap:8px}
  .ro{padding:4px 10px}.ro output{font-size:17px}.ro em{font-size:10px}
  .ro-verdict{font-size:13px}.ro-verdict output{font-size:13px}
  .event-line{margin-top:6px;min-height:20px;font-size:12.5px}
  .panel{gap:8px}
  .block{padding:6px 11px 8px}h2{margin:0 0 5px;font-size:10px}
  .buttons{gap:5px}button{font-size:12px;padding:4px 9px}
  .seg button{font-size:11px;padding:3px 2px}
  .hint{font-size:10.5px;margin:5px 0 0}
  .luck{gap:3px}.luck li{font-size:12px}
  .check{font-size:12px}
  .ladder{font-size:12px}.ladder td{padding:1.5px 0}
  .legend{gap:8px;margin-top:5px}.chip{font-size:10px}
  .colophon{display:none}
  #video-caption{font-size:28px;bottom:16px;max-width:1500px}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.plate')
    page.evaluate('plate.setAutoplay(false)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    page.add_style_tag(content=RECORDING_CSS)
    base.add_caption_overlay(page)
    page.add_style_tag(content='#video-caption{font-size:28px;max-width:1500px;bottom:16px}')
    base.add_cursor_overlay(page)
    verdict = page.locator('.ro-verdict').bounding_box()
    assert verdict['y'] + verdict['height'] < 1040, verdict


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1790, 960)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.set_cursor(page, pos)

        def capture(clicking=False, days=0.0):
            nonlocal frame, timeline
            if days:
                page.evaluate('plate.tick(%r)' % days)
            base.capture(page, frames/f'{frame:06d}.png', timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            dist = (dx * dx + dy * dy) ** .5 or 1
            bend = min(18.0, dist * .045)
            ctrl = ((start[0] + target[0]) / 2 - dy / dist * bend, (start[1] + target[1]) / 2 + dx / dist * bend)
            for i in range(9):
                t = i / 8; e = t * t * (3 - 2 * t); u = 1 - e
                pos = (u*u*start[0] + 2*u*e*ctrl[0] + e*e*target[0], u*u*start[1] + 2*u*e*ctrl[1] + e*e*target[1])
                capture()
            hold(.25)

        def click(selector, fraction=.5):
            b = page.locator(selector).bounding_box()
            move((b['x'] + b['width'] * fraction, b['y'] + b['height'] / 2))
            page.mouse.click(*pos)
            capture(True); capture(True)
            hold(.25)

        def park():
            move((1790, 960))

        def run_seconds(seconds, per_frame):
            """tick the plate at a steady pace for a fixed wall of narration"""
            for _ in range(max(0, round(seconds * FPS))):
                capture(days=per_frame)

        end = 0
        for index, seconds in enumerate(durations):
            start_timeline = timeline
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            budget = seconds * .82  # narrate over movement, settle at the end
            if index == 0:
                # the finished plate of 28 September, hold and breathe
                hold(seconds * .5)
                move((830, 470)); hold(.8)   # lean toward the halo
                park()
            elif index == 1:
                # restart the summer and ride the cold snap
                click('#btn-replay')
                page.evaluate('plate.setAutoplay(false)')
                run_seconds(budget - 1.2, 19 / max(1, (budget - 1.2) * FPS))
                park()
            elif index == 2:
                # the warm spell: lawn floods, halo already carved
                run_seconds(budget, 39 / (budget * FPS))
                park()
            elif index == 3:
                # rest on the finished plate, point at the three preconditions
                hold(seconds * .3)
                luck = page.locator('.luck').bounding_box()
                move((luck['x'] - 190, luck['y'] + 10)); hold(.9)
                park()
            elif index == 4:
                # wreck the luck: incubator warmth
                click('#btn-restreak')
                page.evaluate('plate.setAutoplay(false)')
                slider = page.locator('#temp').bounding_box()
                move((slider['x'] + slider['width'] * .93, slider['y'] + slider['height'] / 2))
                page.mouse.click(*pos)
                capture(True); capture(True)
                page.evaluate('plate.setAutoplay(false)')
                page.evaluate('plate.setTemp(35)')
                page.evaluate('plate.sim.dropSpore(52, 68)')
                park()
                run_seconds(budget - 3.0, 60 / max(1, (budget - 3.0) * FPS))
                chart = page.locator('#chart').bounding_box()
                move((chart['x'] + chart['width'] * .62, chart['y'] + chart['height'] * .3)); hold(.9)
                park()
            elif index == 5:
                # resistance: back to the observed plate, keep it warm, wait
                page.evaluate('plate.replay()')
                page.evaluate('plate.setAutoplay(false)')
                page.evaluate('plate.skipTo(58)')
                page.evaluate('plate.setTemp(24)')
                run_seconds(seconds * .55, 22 / (seconds * .55 * FPS))
                park()
                hold(seconds * .15)
            hold(max(0, end - timeline))
            state = page.evaluate('({day: plate.sim.day})')
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s (day {state["day"]:.0f})', flush=True)
        final = page.evaluate('({day: plate.sim.day, zone: plate.sim.stats().zoneMm, res: plate.sim.stats().resistantCells, verdict: document.getElementById("ro-verdict").textContent})')
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    print('final state:', final)
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir/'%06d.png'), '-i', str(narration),
              '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
              '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
              '-shortest', '-movflags', '+faststart', str(output)])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT/'index.html').as_uri())
        page.evaluate('plate.replay()')
        page.evaluate('plate.skipTo(16)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[1][3])
        page.screenshot(path=str(output/'coldsnap.png'))
        page.evaluate('plate.skipTo(58)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[0][3])
        page.screenshot(path=str(output/'observe.png'))
        page.evaluate('plate.setTemp(35)')
        page.evaluate('plate.sim.inoculate()')
        page.evaluate('plate.sim.dropSpore(52, 68)')
        page.evaluate('plate.tick(6)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[4][1])
        page.screenshot(path=str(output/'incubator.png'))
        browser.close()
    print('1080p caption/layout previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
