"""Barium Glow capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-08-barium-glow/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 2.0, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3 Flash，来交 AI 每日作业了。',
     '今天是 11 月 8 日。1895 年的这个晚上，伦琴在暗室里发现：罩着黑纸板的克鲁克斯管，让两米外的一块荧光屏在发亮。',
     '他给这种看不见的射线起名叫 X。'],
    ['今天这个小实验叫 Barium Glow。',
     '黑纸板挡得住灯光，挡不住这种射线；把管电压从 40 千伏抬到 95，屏上的绿光一下就跳起来，书里的回形针也在屏上现了形。'],
    ['先正经拍一张书：40 千伏，曝光 12 毫安秒。',
     '书页几乎挡不住射线，藏在里面的黄铜回形针是一片最亮的影子；底片是从噪点里慢慢凝出来的。'],
    ['换一块木头。表面什么都看不出来，底片上却躺着一根钢钉——重的东西影子深，钉子再会藏也白搭。'],
    ['然后是手：60 千伏，12 毫安秒，指骨和戒指从雪花里浮出来。',
     '1895 年 12 月 22 日，伦琴拍下人类第一张手骨照片，那一次曝光用了十五分钟。'],
    ['最后换铅：电压电流全拉满，铅后面还是一片白——所以挡辐射的都是铅。',
     '一条指数衰减，一种材料一个系数，这就是所有底片的共同点。',
     '今天作业交完，明天见。'],
]
SEGMENTS = ["".join(lines).replace('GLM-5.3 Flash', 'GLM 五点三 Flash').replace('11 月 8 日', '十一月八日')
            .replace('1895 年的这个晚上', '一八九五年的这个晚上').replace('1895 年 12 月 22 日', '一八九五年十二月二十二日')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt
PARK = (1868, 960)
RECORDING_CSS = '''
main{max-width:1840px;padding:0 48px}header{min-height:46px}.intro{padding:14px 0 14px}
.intro .eyebrow{font-size:10px;margin-bottom:8px}h1{font-size:52px}.intro-copy{font-size:19px;padding:0 30px 0 0}.intro-copy .muted{font-size:13px}
.controls{padding:12px 27px;gap:44px}.control-label{font-size:10px;margin-bottom:6px}.segmented button{font-size:13px;padding:10px 18px}
.slider-control output{font-size:14px}.range-labels{font-size:10px}.cover-control button{font-size:12.5px;padding:11px 12px}
.go .control-label{margin-bottom:2px}.drop{font-size:15px;padding:10px 24px}.motion{font-size:12px;padding:10px 13px}
.sky{grid-template-columns:1.9fr 1fr}.canvas-wrap{padding:10px 0 4px 27px}
.canvas-wrap canvas{height:470px;max-height:470px;width:auto;max-width:100%;margin:0 auto}
.diagram-key{font-size:9px;margin-top:4px}.readouts{padding:12px 24px 8px}
.plate-wrap canvas{max-height:330px}.readout{padding:5px 0}.readout-label{font-size:10px}.readout-value b{font-size:27px}.readout-value i{font-size:12px}
.verdict{padding:10px 2px 2px;min-height:74px;font-size:16px}.verdict span{font-size:12.5px}
.observation{padding:11px 27px}.observation-label{font-size:10px}.observation p{font-size:16px}.observation #bench-status{font-size:10px;max-width:250px}
.footnotes{padding:12px 0 8px;gap:36px;grid-template-columns:1fr 1.5fr 1.7fr}.occasion p{font-size:15px;margin-top:4px}.footnotes p{font-size:11px;line-height:1.55}.footnotes .model-note{font-size:9px;line-height:1.55}footer{padding:8px 0;font-size:8px}
#video-caption{font-size:28px;max-width:1780px;bottom:14px}
'''

def setup(page, url):
    page.clock.install(time='2026-11-08T09:00:00+08:00')
    page.goto(url, wait_until='load')
    page.wait_for_function('window.bariumGlow !== undefined')
    page.clock.pause_at('2026-11-08T09:05:00+08:00')
    page.evaluate('bariumGlow.setRecordingClock(true)')
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
            page.evaluate('(ms)=>bariumGlow.advance(ms)', 1000 / FPS)
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

        def expose_to(target_mas, verdict_fragment):
            """Open the beam, ride the counter up, then fix and grade the plate."""
            click('#expose')
            assert page.evaluate('bariumGlow.state.mode') == 'exposing'
            for _ in range(1200):
                snap()
                if page.evaluate('bariumGlow.state.mAs') >= target_mas:
                    break
            click('#expose')
            verdict = page.locator('#verdict').inner_text()
            assert verdict_fragment in verdict, verdict

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                click('#cover'); hold(.5); click('#cover')
                page.locator('#kvp').fill('95'); page.locator('#ma').fill('9')
                page.evaluate('bariumGlow.newPlate()')
            elif index == 2:
                page.locator('#kvp').fill('40'); page.locator('#ma').fill('4')
                page.evaluate('bariumGlow.newPlate()')
                expose_to(12, '★★★')
            elif index == 3:
                click('#object-wood')
                page.evaluate('bariumGlow.newPlate()')
                expose_to(12, '★★★')
            elif index == 4:
                click('#object-hand')
                page.locator('#kvp').fill('60')
                page.evaluate('bariumGlow.newPlate()')
                expose_to(12, '★★★')
            elif index == 5:
                click('#object-lead')
                page.locator('#kvp').fill('120'); page.locator('#ma').fill('10')
                page.evaluate('bariumGlow.newPlate()')
                expose_to(40, 'Lead stops')
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
        for scene in (2, 4, 5):
            if scene == 2:
                page.locator('#kvp').fill('95'); page.locator('#ma').fill('9')
            elif scene == 4:
                page.locator('#object-hand').click(); page.locator('#kvp').fill('60')
            elif scene == 5:
                page.locator('#object-lead').click(); page.locator('#kvp').fill('120')
            page.evaluate('bariumGlow.expose()')
            for _ in range(600):
                page.evaluate('bariumGlow.advance(66)')
                if page.evaluate('bariumGlow.state.mode') == 'fixed':
                    break
            page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s', SUBTITLE_LINES[scene][0]); framing(page)
            page.screenshot(path=str(output / f'scene{scene}.png'))
            page.evaluate('bariumGlow.newPlate()')
        browser.close()
    print('Video framing previews:', output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
