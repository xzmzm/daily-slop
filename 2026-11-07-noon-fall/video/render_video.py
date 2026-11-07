"""Noon Fall capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-07-noon-fall/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 2.0, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3 Flash，来交 AI 每日作业了。',
     '今天是 11 月 7 日。1492 年的今天，一块石头在中午落进阿尔萨斯的恩西海姆，火球的响声传到 150 公里外。',
     '今天这个小实验叫 Noon Fall：给一块火球调速度、角度、质量和强度，看它有哪三种结局。'],
    ['先飞一颗塔里德火球的母体：尘埃和冰，100 公斤，每秒 29 公里。',
     '它最脆，78 公里高就撑不住，一闪，10 吨当量，然后什么也不剩。',
     '塔里德流星雨的火球就是这么收场的：亮一下，散成尘，落地无痕。'],
    ['换成恩西海姆那块石头：600 公斤，每秒 14 公里，入射角 62 度。',
     '挤压一路爬到 9.5 兆帕，它没碎。504 公斤落在 53 公里外，触地只剩每秒 129 米。',
     '当年捡回来的 127 公斤，如今还保存在镇上。'],
    ['2013 年的车里雅宾斯克：13000 吨，每秒 19 公里。',
     '个头越大反而越脆，28 公里高碎成一团，545 千吨当量在空中放完。',
     '幸好是在空中，落到地面的只剩碎块和响声。'],
    ['最后换铁：500 公斤，每秒 20 公里，21 兆帕的挤压都压不碎它。',
     '376 公斤落在 143 公里外，触地每秒 164 米。',
     '尘埃在高空碎，石头能落地，铁直接砸穿。'],
    ['模型很简单：一条指数大气，一个不变的角度，三样材料。',
     '真正的火球还会碎成碎片雨，风也会把最后的无声下落吹偏。',
     '11 月的夜里抬头看看，金牛座方向的那颗火球，正在把这条方程跑一遍。',
     '今天作业交完，明天见。'],
]
SEGMENTS = ["".join(lines).replace('GLM-5.3 Flash', 'GLM 五点三 Flash').replace('11 月 7 日', '十一月七日')
            .replace('1492 年', '一四九二年').replace('2013 年', '二零一三年') for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt
PARK = (1868, 960)
RECORDING_CSS = '''
main{max-width:1840px;padding:0 48px}header{min-height:42px}.intro{padding:9px 0 12px}
.intro .eyebrow{font-size:10px;margin-bottom:10px}h1{font-size:58px}.intro-copy{font-size:20px;padding:0 30px 0 0}.intro-copy .muted{font-size:13px}
.controls{padding:10px 27px;gap:60px}.control-label{font-size:10px;margin-bottom:6px}.segmented button{font-size:13px;padding:9px 18px}
.slider-control output{font-size:14px}.range-labels{font-size:10px}.launch-row{padding:9px 27px;gap:24px}.launch-row .control-label{font-size:10px}
.presets button{font-size:13px;padding:8px 16px}.drop{font-size:15px;padding:10px 24px}.motion{font-size:12px;padding:10px 13px}
.sky{grid-template-columns:1.9fr 1fr}.canvas-wrap{padding:10px 0 4px 27px}
.canvas-wrap canvas{width:auto;max-width:100%;height:400px;margin:0 auto}
.diagram-key{font-size:9px;margin-top:4px}.readouts{padding:6px 24px}
.readout{padding:6px 0}.readout-label{font-size:10px}.readout-value b{font-size:29px}.readout-value i{font-size:12px}
.verdict{padding:10px 2px 2px;min-height:70px;font-size:16px}.verdict span{font-size:12.5px}
.observation{padding:11px 27px}.observation-label{font-size:10px}.observation p{font-size:16px}.observation #flight-status{font-size:10px;max-width:250px}
.footnotes{padding:12px 0 8px;gap:36px;grid-template-columns:1fr 1.5fr 1.7fr}.occasion p{font-size:15px;margin-top:4px}.footnotes p{font-size:11px;line-height:1.55}.footnotes .model-note{font-size:9px;line-height:1.55}footer{padding:8px 0;font-size:8px}
#video-caption{font-size:28px;max-width:1780px;bottom:14px}
'''

def setup(page, url):
    page.clock.install(time='2026-11-07T09:00:00+08:00')
    page.goto(url, wait_until='load')
    page.wait_for_function('window.noonFall !== undefined')
    page.clock.pause_at('2026-11-07T09:05:00+08:00')
    page.evaluate('noonFall.setRecordingClock(true)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)

def framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.experiment', '.footnotes']:
        b = page.locator(selector).bounding_box()
        assert b['y'] + b['height'] < caption_top - 12, (selector, b, caption_top)

def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'; frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, PARK
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.on('pageerror', lambda e: errors.append(str(e)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s', SUBTITLE_LINES[0][0])
        framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline
            page.clock.run_for(round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS))
            page.evaluate('(ms)=>noonFall.advance(ms)', 1000 / FPS)
            base.capture(page, frames / f'{frame:06d}.png', timeline, cues, pos, clicking)
            frame += 1; timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                snap()

        def move(target):
            nonlocal pos
            start = pos; dx, dy = target[0] - start[0], target[1] - start[1]
            dist = max(1, math.hypot(dx, dy)); bend = min(18, dist * .04)
            control = ((start[0] + target[0]) / 2 - dy / dist * bend, (start[1] + target[1]) / 2 + dx / dist * bend)
            for i in range(8):
                u = (i + 1) / 8; u = u * u * (3 - 2 * u); v = 1 - u
                pos = (v * v * start[0] + 2 * v * u * control[0] + u * u * target[0], v * v * start[1] + 2 * v * u * control[1] + u * u * target[1])
                page.mouse.move(*pos); snap()
            hold(.18)

        def click(selector):
            nonlocal pos
            b = page.locator(selector).bounding_box()
            move((b['x'] + b['width'] / 2, b['y'] + b['height'] / 2))
            page.mouse.click(*pos)
            snap(True); hold(.2)

        def fly_and_check(fragment):
            """Run the flight to its verdict, asserting the expected ending."""
            for _ in range(1200):
                snap()
                if page.evaluate('noonFall.state.phase') == 'done':
                    break
            assert page.evaluate('noonFall.state.phase') == 'done'
            assert fragment in page.locator('#verdict').inner_text(), page.locator('#verdict').inner_text()

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                click('#preset-taurid'); click('#drop')
                fly_and_check('Shattered at 78')
            elif index == 2:
                click('#preset-ensisheim'); click('#drop')
                fly_and_check('504 kg of 600 kg')
            elif index == 3:
                click('#preset-chelyabinsk'); click('#drop')
                fly_and_check('545 kt')
            elif index == 4:
                click('#preset-iron'); click('#drop')
                fly_and_check('376 kg')
            elif index == 5:
                click('#preset-ensisheim')
            hold(end - timeline)
            assert timeline <= end + .2, (index, timeline, end)
            print(f'Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s', flush=True)
            start = end
        browser.close()
    assert not errors, errors
    return frames

def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration),
              '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
              '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k',
              '-shortest', '-movflags', '+faststart', str(output)])

def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT / 'index.html').as_uri())
        page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s', SUBTITLE_LINES[0][0]); framing(page)
        page.screenshot(path=str(output / 'intro.png'))
        page.locator('#preset-chelyabinsk').click()
        page.locator('#drop').click()
        for _ in range(1200):
            page.evaluate('(ms)=>noonFall.advance(ms)', 66)
            if page.evaluate('noonFall.state.phase') == 'done':
                break
        page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s', SUBTITLE_LINES[3][0]); framing(page)
        page.screenshot(path=str(output / 'airburst.png'))
        browser.close()
    print('Video framing previews:', output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
