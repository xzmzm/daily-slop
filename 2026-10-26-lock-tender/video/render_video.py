"""Lock Tender capture adapter for the shared Fish Audio video renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-10-26-lock-tender/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。', '今天十月二十六日，伊利运河在 1825 年的今天通航。今天的作业，是帮一条小船上个坡。'],
    ['船在低处，闸室的水却在高处。先开大门？不行，两边差了 2.4 米，水压把门顶住了。', '先开下游的小水门，让闸室降下来。'],
    ['水面齐了，关好小水门，打开下游大门，小船就能进来。', '大门是给船走的，小水门是给水走的，别让它们抢道。'],
    ['船进来了，关上身后的大门，再开上游小水门。', '高处的水往里流，小船跟着水面上升。没有谁在吊船，它只是在原地继续浮着。'],
    ['两边水面又齐了，关小水门，开上游大门，小船出发。', '爬完 2.4 米，用掉的不是船的力气，而是高处流进来的水。'],
    ['下坡也一样，先让闸室的水面跟船齐平。闸门不是健身器材，推不动，先看看两边的水。', '船进来以后，再把水放低。运河像一串台阶，船只管浮着。今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines).replace('GPT-6.1 Sol', 'GPT 六点一 Sol').replace('1825 年', '一八二五年') for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = '''
main{max-width:1810px;padding:0 42px}header{height:49px}.intro{padding:20px 0 22px}h1{font-size:91px}.intro-copy{margin-top:10px}.eyebrow{margin-bottom:5px}
.desk{grid-template-columns:minmax(0,1fr) 350px}.drawing-top{padding:13px 0}.section-label{padding-top:13px}#scene{height:402px;min-height:0;flex:none;max-height:none}.drawing-bottom{padding:10px 22px}.readings{padding:15px 23px}.readings strong{font-size:28px}aside{padding:20px 22px}.control-group{margin-top:18px}.pair button{padding:12px}.instruction{margin-top:18px;min-height:115px}.instruction h3{font-size:24px}.instruction p{font-size:12px}.feedback{font-size:12px}.move{margin-top:18px}.field-note{padding:21px 0;grid-template-columns:1fr 2fr 1.6fr}.field-note>p:nth-child(2){font-size:25px}.field-note>div{font-size:12px}footer{display:none}#video-caption{font-size:29px;bottom:17px;max-width:1790px}
'''

def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.lockTender')
    page.evaluate('lockTender.pauseAutomatic()')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING · LOCK TENDER'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1810, 975))


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.desk', '.field-note']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 10, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, (1810, 975), 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)

        def snap(step=0, clicking=False):
            nonlocal frame, timeline, revision, cache_key, last_frame
            if step:
                page.evaluate('dt=>lockTender.tick(dt)', step)
                revision += 1
            key = (revision, base.caption_at(timeline, cues), pos, clicking)
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                shutil.copyfile(last_frame, output)
            else:
                base.capture(page, output, timeline, cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1
            timeline = frame / FPS

        def hold(seconds, simulated=0):
            count = max(0, round(seconds * FPS))
            for _ in range(count):
                snap(simulated / count if count else 0)

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend, (start[1] + target[1]) / 2 + dx / distance * bend)
            count = round(.55 * FPS)
            for i in range(count):
                u = (i + 1) / count
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0], v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap()
            hold(.15)

        def click(selector):
            nonlocal revision
            box = page.locator(selector).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 125, (selector, box)
            move((box['x'] + box['width'] / 2, box['y'] + box['height'] / 2))
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            hold(.2)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 0:
                hold(end - timeline)
            elif index == 1:
                click('#gate-lower')
                hold(min(3, max(0, seconds - 10)))
                click('#sluice-lower')
                hold(min(7.2, max(2, end - timeline - .2)), simulated=7.2)
                hold(end - timeline)
                assert page.evaluate('lockTender.model.level') == 0
            elif index == 2:
                click('#sluice-lower')
                click('#gate-lower')
                click('#move')
                hold(2.5, simulated=2.5)
                hold(end - timeline)
                assert page.evaluate('lockTender.model.boat') == 'chamber'
            elif index == 3:
                click('#gate-lower')
                click('#sluice-upper')
                hold(min(7.2, max(2, end - timeline - .2)), simulated=7.2)
                hold(end - timeline)
                assert abs(page.evaluate('lockTender.model.level') - 2.4) < 1e-7
            elif index == 4:
                click('#sluice-upper')
                click('#gate-upper')
                click('#move')
                hold(2.5, simulated=2.5)
                hold(end - timeline)
                assert page.evaluate('lockTender.model.complete')
            else:
                click('#down')
                click('#sluice-upper')
                hold(3.2, simulated=7.2)
                click('#sluice-upper')
                click('#gate-upper')
                click('#move')
                hold(1.4, simulated=2.5)
                click('#gate-upper')
                click('#sluice-lower')
                hold(max(.5, end - timeline), simulated=7.2)
                assert page.evaluate('lockTender.model.boat') == 'chamber'
                assert page.evaluate('lockTender.model.level') == 0
            assert timeline <= end + .3, (index, timeline, end)
            print(f'Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s', flush=True)
            start = end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(output)])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT / 'index.html').as_uri())
        page.locator('#video-caption').evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)
        page.screenshot(path=str(output / 'intro.png'))
        for selector in ['#sluice-lower', '#sluice-lower', '#gate-lower', '#move', '#gate-lower', '#sluice-upper']:
            page.locator(selector).click()
            if selector == '#sluice-lower' and page.evaluate('lockTender.model.sluices.lower'):
                page.evaluate('lockTender.tick(7.2)')
            if selector == '#move':
                page.evaluate('lockTender.tick(2.5)')
        page.evaluate('lockTender.tick(3.5)')
        page.screenshot(path=str(output / 'lifting.png'))
        browser.close()
    print('Video framing previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
