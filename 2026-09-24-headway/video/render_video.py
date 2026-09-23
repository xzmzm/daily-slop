"""Headway adapter for the established cattery Fish Audio video workflow."""
import argparse
import importlib.util
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-24-headway/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。', '今天是九月二十四日。', '今天做的叫 Headway，讲的是逆风。'],
    ['1852 年的今天，亨利·吉法尔在巴黎放飞了第一艘有动力的飞艇。', '三马力的蒸汽机，最快每小时九公里。', '他从星形广场飞到了二十七公里外的埃朗库尔，', '然后就没能飞回来。'],
    ['先按当年的方向飞。', '这里给它每小时四公里的顺风，', '对地速度十三公里，两个小时出头就到了。'],
    ['换成侧风，船头就得斜着顶住风。', '右边的三角形：风，加上船自己在空气里的速度，', '才是它在地面上真正走的方向。', '船头偏了五十一度，航迹还是一条直线。'],
    ['现在回家。风速调到十二，比船还快。', '蓝色扇形是这艘船还能去的所有方向，', '巴黎正好在扇形外面。', '船头一直对着家，人却在往后退。'],
    ['把风降到每小时四公里，就能回家了，', '只是对地速度只剩五公里，要飞五个多小时。', '速度想翻一倍，蒸汽机的功率得翻八倍。', '今天就飞到这儿，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace('Claude Opus 5.5', 'Claude Opus 五点五')
SEGMENTS[1] = SEGMENTS[1].replace('1852 年', '一八五二年')
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .masthead{height:52px}.intro{padding:16px 0 14px}h1{font-size:40px}
  main{width:1500px}.studio{grid-template-columns:minmax(0,1fr) 370px;gap:30px}
  .block{padding-bottom:10px;margin-bottom:10px}.triangle svg{max-width:215px}
  .colophon{display:none}
  #video-caption{font-size:30px;bottom:18px;max-width:1500px;padding:10px 22px 12px}
  #video-caption:empty{display:none}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.headway')
    page.evaluate('headway.setAutoplay(false)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    page.add_style_tag(content=RECORDING_CSS)
    base.add_caption_overlay(page)
    page.add_style_tag(content='#video-caption{font-size:30px;max-width:1500px;bottom:18px}')
    base.add_cursor_overlay(page)


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1790, 960)
    errors = []
    rate = 0.2  # flight hours per recorded second
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.set_cursor(page, pos)
        box = page.locator('.studio').bounding_box()
        assert box['y'] + box['height'] < 985, box

        def capture(clicking=False):
            nonlocal frame, timeline
            # Every frame advances the page clock, so wind streaks keep drifting.
            page.evaluate('([s, r]) => headway.tick(s, r)', [1 / FPS, rate])
            base.capture(page, frames/f'{frame:06d}.png', timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target):
            nonlocal pos
            # Eased, slightly curved approach, as in the shared renderer.
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            dist = (dx * dx + dy * dy) ** .5 or 1
            bend = min(18.0, dist * .045)
            ctrl = ((start[0] + target[0]) / 2 - dy / dist * bend, (start[1] + target[1]) / 2 + dx / dist * bend)
            for i in range(9):
                t = i / 8; e = t * t * (3 - 2 * t); u = 1 - e
                pos = (u*u*start[0] + 2*u*e*ctrl[0] + e*e*target[0], u*u*start[1] + 2*u*e*ctrl[1] + e*e*target[1])
                capture()
            hold(.2)

        def click(selector, fraction=.5):
            b = page.locator(selector).bounding_box()
            move((b['x'] + b['width'] * fraction, b['y'] + b['height'] / 2))
            page.mouse.click(*pos)
            capture(True); capture(True)
            hold(.2)

        def park():
            move((1790, 960))

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                # Fit each flight into its narration: land with a beat to spare.
                rate = 2.05 / (seconds * .62)
                hold(seconds * .08)
                click('#fly')
                park()
            elif index == 3:
                rate = 0.2
                click('[data-preset="cross"]')
                hold(seconds * .10)
                click('#fly')
                park()
            elif index == 4:
                click('[data-preset="home"]')
                hold(seconds * .40)
                click('#fly')
                park()
            elif index == 5:
                rate = 5.35 / (seconds * .5)
                click('#reset')
                click('#windSpeed', 4 / 20)
                page.locator('#windSpeed').evaluate('el => { el.value = 4; el.dispatchEvent(new Event("input", {bubbles: true})); }')
                hold(seconds * .12)
                click('#fly')
                park()
            hold(max(0, end - timeline))
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
        final = page.evaluate('headway.getState().result')
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    print('final flight result:', final)
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    # Encode once; the captions have already been burned into browser frames.
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
        for name, preset, caption in [
            ('out', 'out', SUBTITLE_LINES[0][0]),
            ('cross', 'cross', SUBTITLE_LINES[3][1]),
            ('home', 'home', SUBTITLE_LINES[4][1]),
        ]:
            page.locator(f'[data-preset="{preset}"]').click()
            page.evaluate('headway.tick(0.5)')
            page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', caption)
            page.screenshot(path=str(output/f'{name}.png'))
            board = page.locator('.studio').bounding_box(); cap = page.locator('#video-caption').bounding_box()
            assert board['y'] + board['height'] < cap['y'], (board, cap)
        browser.close()
    print('1080p caption/layout previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
