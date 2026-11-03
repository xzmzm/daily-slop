"""Early Returns capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-04-early-returns/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。',
     '今天是 11 月 4 日。1952 年的今天是美国大选夜，',
     'CBS 电视台借来了一台 UNIVAC 计算机。'],
    ['民调说这次选举很接近。晚上 8 点半，票才数了几个百分点，',
     'UNIVAC 就算出艾森豪威尔能拿 438 张选举人票。CBS 不敢信，没有播。'],
    ['现在停在 8 点半：只数了 5.6% 的票，',
     '艾森豪威尔只有 48.1%，看起来是史蒂文森领先。'],
    ['可这些早到的票几乎都来自东部城市，',
     '而城市本来就偏向民主党。'],
    ['换个比法：每个选区只跟它自己 1948 年的结果比。',
     '同样的地方，向艾森豪威尔偏了 5.5 个百分点，',
     '机器打出来的是一百比一。'],
    ['往后拖，直接数票要到 9 点半才让他过 266 票。',
     '到凌晨，结果是 442 比 89。'],
    ['那晚还出过一次输入错误，胜算一下掉到 8 比 7。',
     '这里给新泽西一个选区 1948 年的票数多打一个零，',
     '胜算就成了差不多一半对一半。'],
    ['这是简化的教学模型，选区和胜算公式都是编的。',
     '那天深夜，CBS 承认机器几个小时前就算对了。明天见。'],
]
SPOKEN = {'Claude Opus 5.5': 'Claude Opus 五点五', '1952 年': '一九五二年', '1948 年': '一九四八年',
          '5.6%': '百分之五点六', '48.1%': '百分之四十八点一', '5.5 个百分点': '五点五个百分点',
          '8 点半': '八点半', '9 点半': '九点半', '11 月 4 日': '十一月四日'}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{width:calc(100% - 100px);max-width:1820px}
  .masthead{height:44px}
  main{display:grid;grid-template-columns:minmax(0,1fr) 600px}
  .intro{grid-column:1/-1;padding:14px 0 14px;gap:44px}
  .intro h1{font-size:56px}.eyebrow{margin-bottom:6px}
  .intro-copy{max-width:1000px;font-size:18px}.intro-copy span{display:none}
  .bench{display:contents}
  .map-panel{grid-column:1;grid-row:2;padding-right:24px;border-right:1px solid var(--rule)}
  .desk{grid-column:2;grid-row:2/4;padding:12px 0 0 28px;gap:12px}
  .chart-panel{grid-column:1;grid-row:3;padding-right:24px;border-right:1px solid var(--rule);border-bottom:0}
  .panel-head{padding:10px 0 8px}
  #map{height:370px}
  .legend{padding:4px 0 2px}
  .transport{padding:6px 0 8px}
  #chart{height:205px}
  .tt-line{font-size:24px}.tt-ev b{font-size:34px}
  .readout strong{font-size:28px}.verdict{font-size:19px}
  .field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1740px;bottom:20px}
"""
PARK = (1840, 945)
MAX_STEP = 108


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('.tile')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.locator('[data-view="count"]').click()
    page.locator('#time').fill('0')
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.map-panel', '.teletype', '.readouts', '.presets', '#chart']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 8, (selector, box, caption_top)


def thumb_x(page, value):
    box = page.locator('#time').bounding_box()
    thumb = 16
    return box['x'] + thumb / 2 + (value / MAX_STEP) * (box['width'] - thumb), box['y'] + box['height'] / 2


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

        def odds():
            return page.locator('#tt-odds').inner_text()

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                hold(.6)
                drag(0, 18, max(2.5, end - timeline - 1.5))
                assert page.locator('#clock').inner_text() == '8:30 PM', page.locator('#clock').inner_text()
            elif index == 2:
                assert page.locator('#r-counted').inner_text() == '5.6 %'
                assert page.locator('#r-raw').inner_text() == '48.1 %'
            elif index == 4:
                hold(.4)
                click('[data-view="proj"]')
                assert odds() == 'CHANCES ARE 100 TO 1 IN FAVOR OF EISENHOWER', odds()
            elif index == 5:
                hold(.3)
                drag(value(), 30, 1.6)
                hold(.6)
                drag(30, MAX_STEP, max(1.5, end - timeline - 1.2))
                assert page.locator('#p-r').inner_text() == '442'
            elif index == 6:
                hold(.3)
                click('[data-jump="18"]')
                hold(1.4)
                click('[data-typo="1"]')
                assert '100 TO 1' not in odds(), odds()
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[1][1])
        assert_framing(page)
        page.screenshot(path=str(output / 'start.png'))
        page.locator('#time').fill('18')
        page.screenshot(path=str(output / 'count-830.png'))
        page.locator('[data-view="proj"]').click()
        page.screenshot(path=str(output / 'proj-830.png'))
        page.locator('[data-typo="1"]').click()
        page.screenshot(path=str(output / 'typo.png'))
        browser.close()
    print('Video framing previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
