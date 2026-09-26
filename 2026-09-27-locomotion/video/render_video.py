"""Locomotion adapter for the established cattery Fish Audio video workflow."""
import argparse
import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-27-locomotion/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3，来交 AI 每日作业了。', '今天是九月二十七日。', '一八二五年的今天，英格兰东北部，世界上第一条用蒸汽机车拉乘客的公共铁路正式通车。', '主角是台六吨半的小机车——Locomotion 一号。', '它能甩出的拉力，只有一千磅上下。'],
    ['铁轮压铁轨，滚起来省力得惊人：一吨重的车，平地上十来磅就能推着走。', '所以瓶颈从来不是拉不拉得动，而是三股力在较劲。', '气缸使出一千磅拉力；', '车轮咬铁轨，干燥时咬得住三千六百磅，落叶天只剩八百多；', '再算上整列车爬坡要的劲。', '三个数一比，跑不跑得动当场见分晓。'],
    ['平道上，一千磅能拉动二十几节车厢；', '可坡度一到三十三分之一——当年那两条陡坡的真实坡度——它连自己加一节车都费劲。', '所以斯提芬孙干脆不机车爬坡：山头交给固定蒸汽机，钢绳把整列车拽上去、再放到另一边。', '第一列蒸汽火车，其实是绳索、马、机车三种动力接力跑完的。', '下面那条地形剖面，就是通车那天的完整接力路线。'],
    ['两种趴窝，得分清楚。', '干燥轨道爬陡坡，车轮稳稳咬住，是力气不够，原地不动；', '把轨面换成落叶，粘着力先崩，车轮开始空转，火星子直冒——', '这时候撒沙能救；', '但沙子增加的是抓地，不是马力，空转变回原地不动，想走还得减车厢。'],
    ['通车那天严重超载：原定三百人，上来四百五到六百。', '八英里半走了两个钟头，中途还停车修了三十五分钟；', '从达灵顿出来，三十一节车、五百五十人，最后一段走了三小时零七分。', '快到终点时，一个扒在车外的人摔下来，被后面的车压伤了脚。', '狂欢里也有代价。'],
    ['这套粘着的物理，两百年没换过剧本：', '高铁防落叶、重载铁路撒沙，都在跟同一个小数点较劲。', '拖动滑块，自己试。今天就到这儿，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
# TTS reads the builder name and years in Chinese; burned-in subtitles above
# keep the plain forms.
SEGMENTS[0] = SEGMENTS[0].replace('GLM-5.3', 'GLM 五点三')
SEGMENTS = [s.replace('一八二五年', '一八二五年') for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  html,body{overflow:hidden !important}
  .masthead{padding:10px 26px 2px}
  h1{font-size:27px}.eyebrow{margin-bottom:3px;font-size:10.5px}
  .intro-copy{display:none}
  main{max-width:1920px;padding:0 20px}
  .studio{grid-template-columns:minmax(0,1fr) 330px;gap:12px;margin-top:4px}
  #scene{height:398px}
  .panel{gap:7px}.block{padding:5px 10px 6px}h2{margin:0 0 3px;font-size:10.5px}
  .presets button{flex:1 1 0;padding:4px 2px;font-size:11px;white-space:nowrap}
  .presets button span{display:none}
  .check{margin-top:5px;font-size:11px}.check .sub{display:none}
  .forces{gap:4px}.force dt{font-size:10.5px}.force dt em{display:none}
  .force dd output{font-size:12px}.bar{height:14px}
  .hint{font-size:10.5px;min-height:22px;margin:4px 0 0}
  .ladder{font-size:10.5px}.ladder td{padding:1.5px 4px}
  .route-panel{margin-top:10px;padding:8px 12px 6px}
  .route-head{margin-bottom:2px}.route-head h2{font-size:11px}
  .route-cap{font-size:12px}.route-note{display:none}
  .colophon{display:none}
  #video-caption{font-size:28px;bottom:16px;max-width:1500px}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.sdr')
    page.evaluate('sdr.setAutoplay(false)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    page.add_style_tag(content=RECORDING_CSS)
    base.add_caption_overlay(page)
    page.add_style_tag(content='#video-caption{font-size:28px;max-width:1500px;bottom:16px}')
    base.add_cursor_overlay(page)
    board = page.locator('.route-panel').bounding_box()
    assert board['y'] + board['height'] < 1010, board


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

        def capture(clicking=False):
            nonlocal frame, timeline
            # Each frame advances the page clock, so the train keeps rolling.
            page.evaluate('sdr.tick(1 / %d)' % FPS)
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

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                # the three forces: load the opening-day train on the level.
                hold(seconds * .38)
                click('.presets button[data-w="21"]')
                park()
            elif index == 2:
                # the incline the locos were never asked to climb.
                hold(seconds * .22)
                click('.presets button[data-g="3.03"]')
                park()
                hold(seconds * .30)
                move((1200, 905)); hold(.8)   # point at the relay route
                park()
            elif index == 3:
                # two failures: dry stall → leaves wheelspin → sand it.
                hold(seconds * .16)
                click('#rail-seg button[data-rail="leaves"]')
                park()
                hold(seconds * .42)
                click('#sand')
                park()
            elif index == 4:
                # reset to the festive train, then replay opening day.
                click('.presets button[data-g="0"]')
                click('.presets button[data-w="21"]')
                click('#rail-seg button[data-rail="dry"]')
                page.uncheck('#sand', no_wait_after=True)
                park()
                hold(seconds * .10)
                click('#replay')
                park()
            elif index == 5:
                # outro: ride the surveyed fall down to the sea.
                hold(seconds * .30)
                click('.presets button[data-g="-1.9"]')
                park()
            hold(max(0, end - timeline))
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
        final = page.evaluate('({v: sdr.run.v.toFixed(1), regime: sdr.forces.regime, wagons: sdr.ui.wagons, grade: sdr.ui.grade})')
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
        page.evaluate('sdr.tick(0.5)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[0][2])
        page.screenshot(path=str(output/'opening.png'))
        # stall on the incline
        page.locator('.presets button[data-g="3.03"]').click()
        page.evaluate('sdr.tick(0.1)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[2][1])
        page.screenshot(path=str(output/'stall.png'))
        # wheelspin under leaves
        page.locator('#rail-seg button[data-rail="leaves"]').click()
        page.evaluate('sdr.tick(0.5)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[3][2])
        page.screenshot(path=str(output/'wheelspin.png'))
        # replay mid-route
        page.locator('#rail-seg button[data-rail="dry"]').click()
        page.locator('.presets button[data-g="0"]').click()
        page.locator('#replay').click()
        for _ in range(60):
            page.evaluate('sdr.tick(0.4)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[4][2])
        page.screenshot(path=str(output/'replay.png'))
        browser.close()
    print('1080p caption/layout previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
