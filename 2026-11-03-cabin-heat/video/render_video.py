"""Cabin Heat capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-03-cabin-heat/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。',
     '今天是 11 月 3 日。1957 年的今天，苏联发射了斯普特尼克 2 号，',
     '舱里坐着一只叫莱卡的小狗。'],
    ['飞行中出了两个问题：火箭芯级没有分离，一部分隔热层也被扯掉了。',
     '舱温超过 40 度，几个小时后，莱卡就死了。'],
    ['太空里没有空气带走热量，舱体只能靠辐射散热。',
     '阳光下进来的热多，进到地球影子里就少。'],
    ['按真实飞行的情况，舱温在 4 小时 33 分越过 40 度，',
     '而且一直没有停下来。'],
    ['如果只把隔热层修好，',
     '舱温还是会在 6 小时 09 分越过 40 度。'],
    ['换一个：隔热层照样是破的，只让芯级正常分离。',
     '这次九个小时都没到 40 度，最后会停在 35 度左右。'],
    ['芯级在阳光下吸热，又挡住了舱体对着太空的那一面，',
     '它才是这次过热的主因。'],
    ['这是简化的单节点模型，参数是演示用的。',
     '莱卡真正的死因，到 2002 年才公开。明天见。'],
]
SPOKEN = {'Claude Opus 5.5': 'Claude Opus 五点五', '1957 年': '一九五七年', '2002 年': '二零零二年',
          '4 小时 33 分': '四小时三十三分', '6 小时 09 分': '六小时零九分'}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{width:calc(100% - 100px);max-width:1820px}
  main{display:grid;grid-template-columns:minmax(0,1fr) 600px}
  .intro{grid-column:1/-1;padding:16px 0 16px;gap:44px}
  .intro h1{font-size:60px}.eyebrow{margin-bottom:6px}
  .intro-copy{max-width:900px;font-size:18px}.intro-copy span{display:none}
  .bench{display:contents}
  .scene-panel{grid-column:1;grid-row:2;border-right:1px solid var(--rule)}
  .controls{grid-column:2;grid-row:2/4;border-left:0}
  .chart-panel{grid-column:1;grid-row:3;padding-right:24px;border-right:1px solid var(--rule);border-bottom:0}
  .panel-head,.ctl-label{padding:12px 0 9px}
  #scene{height:330px}
  .transport{padding:9px 0 6px}
  #chart{height:300px}
  .switch{grid-template-columns:130px 1fr}.sw-name{font-size:19px}.seg button{font-size:16px;padding:11px 6px}
  .presets button{font-size:15px;padding:10px}
  .bal-row{grid-template-columns:130px 1fr 70px;font-size:12px}.bal-row b{font-size:16px}.bal-parts{font-size:14px}
  .readout strong{font-size:30px}.readout span{font-size:12px}.verdict{font-size:19px}
  .field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1740px;bottom:20px}
"""
PARK = (1840, 945)


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#curve')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.locator('#time').fill('0')
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.scene-panel', '.controls', '.chart-panel #chart', '.verdict']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 8, (selector, box, caption_top)


def thumb_x(page, value):
    box = page.locator('#time').bounding_box()
    thumb = 16
    return box['x'] + thumb / 2 + (value / 540) * (box['width'] - thumb), box['y'] + box['height'] / 2


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

        def drag(start_value, end_value, seconds):
            nonlocal pos, revision
            move(thumb_x(page, start_value))
            page.mouse.down()
            count = max(1, round(seconds * FPS))
            for i in range(count):
                u = (i + 1) / count
                u = u * u * (3 - 2 * u)
                pos = thumb_x(page, start_value + (end_value - start_value) * u)
                page.mouse.move(*pos)
                revision += 1
                snap(clicking=True)
            page.mouse.up()
            hold(.2)

        def value():
            return int(page.locator('#time').input_value())

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                hold(.3)
                drag(0, 540, max(3, end - timeline - 1.2))
                assert value() >= 535, value()
            elif index == 3:
                hold(.3)
                drag(value(), 273, 1.6)
                assert page.locator('#r-cross').inner_text() == '4 h 33 m'
                assert 'SUNLIGHT' in page.locator('#sun-state').inner_text()
            elif index == 4:
                hold(.3)
                click('.switch[data-key="torn"] button[data-value="0"]')
                assert page.locator('#r-cross').inner_text() == '6 h 09 m'
            elif index == 5:
                hold(.2)
                click('.switch[data-key="torn"] button[data-value="1"]')
                hold(.5)
                click('.switch[data-key="stage"] button[data-value="0"]')
                assert page.locator('#r-cross').inner_text() == 'never'
                assert page.locator('#r-settle').inner_text() == '35.5 °C'
            elif index == 6:
                hold(.4)
                drag(value(), 540, 2.2)
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[1][0])
        assert_framing(page)
        page.screenshot(path=str(output / 'start.png'))
        page.locator('#time').fill('273')
        page.screenshot(path=str(output / 'flown.png'))
        page.locator('.switch[data-key="stage"] button[data-value="0"]').click()
        page.locator('#time').fill('80')
        page.screenshot(path=str(output / 'separated.png'))
        browser.close()
    print('Video framing previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
