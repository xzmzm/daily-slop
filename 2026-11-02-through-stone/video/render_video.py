"""Through Stone capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-02-through-stone/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.1 Terra，来交 AI 每日作业了。',
     '今天是 11 月 2 日，2017 年的今天，',
     '研究人员公布了金字塔里一个此前未知的大空隙。'],
    ['这个发现靠的是宇宙射线产生的缪子。',
     '它们从天而降，穿过石头，有些会被石头挡住。'],
    ['每根柱子代表一个方向，短线是同样时间里实心石头的预计数量。',
     '点选柱子，左边会画出粒子经过的方向。'],
    ['先选左边这一束。30 天里模拟到 476 个，',
     '实心参考是 473 个，差得不多。'],
    ['再选右边这束，模拟到 658 个，比实心参考多 185 个。',
     '这个方向，似乎少穿过了一些石头。'],
    ['揭开遮挡，果然是一段空隙。',
     '把曝光时间加到 90 天，多出来的粒子会更容易分辨。'],
    ['这是简化的二维模型，图形和数字都是演示用的。',
     '真实研究结合了不同探测器，发现空隙至少有 30 米长。明天见。'],
]
SPOKEN = {'GPT-6.1 Terra': 'GPT 六点一 Terra', '2017 年': '二零一七年'}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = '''
  .page{width:calc(100% - 100px);max-width:1800px}
  .masthead{height:58px}.brand{font-size:13px}.brand-mark{font-size:35px}
  .masthead-note,.issue{font-size:11px}
  .intro{padding:21px 0 24px;gap:25px;align-items:end}
  .eyebrow{font-size:11px;margin-bottom:8px}.intro h1{font-size:60px;line-height:.95}
  .intro-copy{max-width:480px}.intro-copy p{font-size:17px;line-height:1.35}
  .intro-copy>span{display:none}
  .experiment{grid-template-columns:minmax(0,1.16fr) minmax(600px,.84fr)}
  .scene-panel .panel-heading{padding:20px 25px 0}
  .section-number,.field-label{font-size:12px}.panel-heading p{font-size:23px;margin-top:7px}
  .scene-badge{font-size:10px}.scene-panel svg{height:500px;max-height:500px}
  .scene-footer{min-height:60px;margin:0 25px;font-size:13px}
  .scene-footer button{font-size:13px;padding:10px 13px}
  .readout-panel{padding:20px 25px}.readout-heading{padding-bottom:18px}
  .exposure{padding:15px 0}.exposure p,.chart-title p{font-size:15px}
  .segmented button{font-size:14px;min-width:52px}
  .chart-title{margin:16px 0 10px}.chart-unit{font-size:10px}
  .chart{height:127px}.chart-axis{font-size:11px}.legend{font-size:11px;margin-top:10px}
  .selection{margin-top:15px;padding:14px 17px}.angle{font-size:25px}
  .measurements{margin-top:10px}.measurements span{font-size:10px}
  .measurements strong{font-size:31px;margin-top:5px}.selection p{font-size:14px;margin-top:10px;padding-top:9px}
  .story,footer{display:none}
  #video-caption{font-size:29px;max-width:1740px;bottom:20px}
'''
PARK = (1840, 945)


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#chart button')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.experiment', '.scene-panel', '.readout-panel']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 8, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, PARK, 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[0][0])
        assert_framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline, cache_key, last_frame
            key = (revision, base.caption_at(timeline, cues), pos, clicking)
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                shutil.copyfile(last_frame, output)
            else:
                base.capture(page, output, timeline, cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                snap()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            count = round(.55 * FPS)
            for i in range(count):
                u = (i + 1) / count
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap()
            hold(.18)

        def click(selector):
            nonlocal revision
            box = page.locator(selector).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 115, (selector, box)
            move((box['x'] + box['width'] / 2, box['y'] + box['height'] / 2))
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            hold(.25)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 3:
                hold(.25)
                click('#chart button:nth-child(6)')
                assert page.locator('#angle-value').inner_text() == '−18°'
                assert page.locator('#count-value').inner_text() == '476'
                assert page.locator('#reference-value').inner_text() == '473'
            elif index == 4:
                hold(.25)
                click('#chart button:nth-child(12)')
                assert page.locator('#angle-value').inner_text() == '+18°'
                assert page.locator('#count-value').inner_text() == '658'
                assert page.locator('#difference-value').inner_text() == '+185'
            elif index == 5:
                hold(.25)
                click('#reveal')
                assert page.locator('#reveal').get_attribute('aria-pressed') == 'true'
                hold(min(3, max(0, end - timeline - 2)))
                click('[data-days="90"]')
                assert page.locator('[data-days="90"]').get_attribute('aria-pressed') == 'true'
            hold(end - timeline)
            assert timeline <= end + .3, (index, timeline, end)
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[0][0])
        assert_framing(page)
        page.screenshot(path=str(output / 'hidden.png'))
        page.locator('#reveal').click()
        page.screenshot(path=str(output / 'revealed.png'))
        browser.close()
    print('Video framing previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
