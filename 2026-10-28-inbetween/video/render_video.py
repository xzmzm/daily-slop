"""Inbetween browser capture for the shared Fish Audio renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-10-28-inbetween/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。',
     '今天十月二十八日，国际动画日。我做了一张动画师的间距桌，名字叫 Inbetween。',
     '两颗小球走同一条路，花同样一秒，脾气却不一样。'],
    ['先选匀速，两颗球整齐得像在上班打卡。',
     '这里一共十三张画，头尾也算进去，中间是十二个等长时间段。',
     '每次挪一样远，就一直一样快。'],
    ['换成先慢后快，橙色小球开始磨蹭，后面突然赶路。',
     '再换成慢慢停下，开头迈大步，快到终点时才收住。',
     '紫色那颗始终匀速，方便看出差别。'],
    ['这条曲线，横着是时间，竖着是走了多远。',
     '暂停，选第七张，把点往上一拉。这一步变长，下一步变短。',
     '画面里的两张影子也挤到一起。点不能越过邻居，头尾也锁着，免得小球突然倒车。'],
    ['最后选两头慢、中间快。开头和结尾的画挤得近，中间拉得开。',
     '小球就像真的知道自己要出门，也知道该停下了。两颗球仍然同时到达。',
     '动画的性格，就藏在这些间隔里。今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines).replace('GPT-6.1 Sol', 'GPT 六点一 Sol') for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt
CSS = '''
main{max-width:1830px;padding:0 30px}header{height:40px}.intro{padding:15px 0 18px;grid-template-columns:1.7fr 1fr}h1{font-size:69px;line-height:.91;margin-top:10px}.intro-note{padding-top:0}.intro-note>p{font-size:16px;line-height:1.4;margin:9px 0}.handwritten{font-size:13px}.day-tag{padding:5px 8px}
.desk{grid-template-columns:minmax(0,1fr) 330px}.panel-top{height:35px}.screen{padding-top:11px}#stage{height:205px;margin-top:4px}.lane-label,.reference-label{font-size:10px}.reference-label{padding-bottom:11px}.transport{padding:8px 18px}.controls{padding:18px 24px}.control-intro{margin-bottom:16px}.controls h2{font-size:27px;margin-top:10px}.presets button{min-height:99px}.edit-frame{padding:22px 0 16px}.fixed-note{margin-top:16px}.fixed-number{font-size:30px}.chart-panel{padding:13px 23px 12px}.chart-heading h2{font-size:23px;margin-top:4px}#chart{height:150px;margin-top:6px}.chart-key{font-size:9px}.drawings{padding:12px 23px 15px}.frame-strip{margin-top:10px}.frame-card{height:59px;padding-top:6px}.frame-card svg{margin-top:3px}.footnote{padding:17px 0;grid-template-columns:40px 1fr 1.6fr}.footnote h2{font-size:23px}.footnote p{font-size:11px}.asterisk{font-size:37px}footer{display:none}#video-caption{font-size:29px;bottom:17px;max-width:1780px}
'''

CSS += '.footnote{display:none}.ball>circle{r:40px}.ball .face{transform:scale(1.3)}.chart-label{font-size:16px}.knot{r:7px}.knot.selected{r:9px}'

def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.inbetween')
    page.evaluate('inbetween.setRecordingClock(true)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(e,s)=>e.textContent=s', URL)
    page.locator('#video-browser-chrome .badge').evaluate("e=>e.textContent='LOCAL RECORDING · INBETWEEN'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=CSS)
    page.evaluate("document.querySelector('#stage').setAttribute('viewBox','0 0 1800 290');document.querySelector('#chart').dataset.width='1850';dispatchEvent(new Event('resize'))")
    base.set_cursor(page, (1840, 970))

def framing(page):
    caption = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.desk']:
        b = page.locator(selector).bounding_box()
        assert b['y'] + b['height'] < caption - 10, (selector, b, caption)

def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0., (1840, 970), 0
    cache, last = None, None
    errors = []
    end_seen = False
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(e,s)=>e.textContent=s', SUBTITLE_LINES[0][0])
        framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline, cache, last, end_seen
            current = page.evaluate('inbetween.advance(1000 / 15);inbetween.state.frame')
            if current == 12 and not end_seen:
                assert page.locator('#your-ball').get_attribute('transform') == 'translate(1730 90)'
                assert page.locator('#steady-ball').get_attribute('transform') == 'translate(1730 220)'
                end_seen = True
            key = (current, revision, base.caption_at(timeline, cues), pos, clicking)
            out = frames / f'{frame:06d}.png'
            if key == cache:
                shutil.copyfile(last, out)
            else:
                base.capture(page, out, timeline, cues, pos, clicking)
            cache, last = key, out
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                snap()

        def move(target, seconds=.45, drag=False):
            nonlocal pos, revision
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(16, distance * .04)
            control = ((start[0] + target[0])/2 - dy/distance*bend, (start[1] + target[1])/2 + dx/distance*bend)
            count = max(1, round(seconds * FPS))
            for i in range(count):
                u = (i+1)/count
                u = u*u*(3-2*u)
                v = 1-u
                pos = (v*v*start[0]+2*v*u*control[0]+u*u*target[0], v*v*start[1]+2*v*u*control[1]+u*u*target[1])
                page.mouse.move(*pos)
                if drag:
                    revision += 1
                snap()
            hold(.15)

        def click(selector):
            nonlocal revision
            b = page.locator(selector).bounding_box()
            move((b['x'] + b['width']/2, b['y'] + b['height']/2))
            page.mouse.click(*pos)
            revision += 1
            snap(True)
            hold(.2)

        def drag_seventh():
            b = page.locator('.knot').nth(6).bounding_box()
            center = (b['x'] + b['width']/2, b['y'] + b['height']/2)
            move(center)
            chart = page.locator('#chart').bounding_box()
            # The wide recording viewBox is centered inside a 150px-high SVG.
            scale = min(chart['width']/1850, chart['height']/234)
            page.mouse.down()
            move((center[0], center[1] - .07 * 160 * scale), .9, drag=True)
            page.mouse.up()
            assert abs(page.evaluate('inbetween.state.positions[6]') - .57) < .002
            assert page.locator('#take-name').inner_text() == 'YOUR OWN SPACING'

        start = 0.
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations)-1 else SILENCE_TAIL)
            if index == 0:
                pass
            elif index == 1:
                click('[data-preset=steady]')
                assert page.evaluate('inbetween.state.positions.every((v,i)=>Math.abs(v-i/12)<1e-10)')
            elif index == 2:
                click('[data-preset=launch]')
                hold(seconds * .44)
                click('[data-preset=arrive]')
            elif index == 3:
                hold(2)
                click('#play')
                click('[data-preset=steady]')
                click('.frame-card:nth-child(7)')
                hold(1.5)
                drag_seventh()
                # Park the ball at A so the newly adjacent onion skins are visible.
                click('.frame-card:first-child')
                assert not page.evaluate('inbetween.state.playing')
            else:
                click('[data-preset=both]')
                click('#play')
                hold(3.5)
            hold(end - timeline)
            assert timeline <= end + .2, (index, timeline, end)
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
            start = end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    assert end_seen, 'The recording must include the shared final pose.'
    return frames

def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(output)])

def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT / 'index.html').as_uri())
        page.locator('#video-caption').evaluate('(e,s)=>e.textContent=s', SUBTITLE_LINES[0][0])
        framing(page)
        page.screenshot(path=str(output / 'intro.png'))
        browser.close()
    print(output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
