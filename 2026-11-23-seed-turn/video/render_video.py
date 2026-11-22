"""Record the angle comparisons and both seed traces for the Fish renderer."""
import importlib.util
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parents[1]
ROOT_DIR = PROJECT.parent
URL = f'https://dailyslop.pages.dev/{PROJECT.name}/'
spec = importlib.util.spec_from_file_location(
    'cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py'
)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
SILENCE_BETWEEN, SILENCE_TAIL = 0.9, 1.4
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.2 Sol，来交 AI 每日作业了。',
     '11 月 23 日写成 11/23，刚好是斐波那契数列开头的 1、1、2、3。',
     '今天种一盘向日葵。每放一颗种子，就转过同样的角度。'],
    ['先试 135 度。每放八颗，方向就绕回原位，盘里留下八条直线。',
     '换成 144 度，五颗就绕回去了。现在有五条。'],
    ['再换成黄金角，大约 137.508 度。这次方向没有整齐地绕回去。',
     '种子散开了，盘子一下就填满了。'],
    ['把编号相差 21 的种子连起来，绿线往一个方向弯。',
     '编号相差 34 的也连起来，紫线往另一边弯。',
     '21 和 34 也是相邻的斐波那契数。'],
]

SEGMENTS = [
    ''.join(lines).replace('GPT-6.2 Sol', 'GPT 六点二 Sol')
    .replace('11 月 23 日', '十一月二十三日').replace('11/23', '一一二三')
    .replace('135 度', '一百三十五度').replace('144 度', '一百四十四度')
    .replace('137.508 度', '一百三十七点五零八度')
    .replace('相差 21', '相差二十一').replace('相差 34', '相差三十四')
    .replace('21 和 34', '二十一和三十四')
    for lines in SUBTITLE_LINES
]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    starts = {line: start for start, _, line in cues}
    frame = 0
    pos = (1680, 440)
    revision = 0
    previous = previous_path = None
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(element, url) => element.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("element => element.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .sheet { width: 1400px; }
          .experiment { gap: 38px; }
          canvas { height: 550px; }
          #video-caption { font-size: 32px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(element, line) => element.textContent = line', max(starts, key=len))
        footer = page.locator('footer').bounding_box()
        assert footer['y'] + footer['height'] < caption.bounding_box()['y'] - 10, footer

        def snap(clicking=False):
            nonlocal frame, previous, previous_path
            now = frame / FPS
            key = (revision, base.caption_at(now, cues), pos, clicking)
            image = frames / f'{frame:06d}.png'
            if previous == key:
                os.link(previous_path, image)
            else:
                base.capture(page, image, now, cues, pos, clicking)
            previous, previous_path = key, image
            frame += 1

        def hold_until(seconds):
            while frame / FPS < seconds:
                snap()

        def click_at(seconds, target):
            nonlocal frame, pos, revision
            movement = 8
            hold_until(seconds - (movement + 2) / FPS)
            box = target.bounding_box()
            arrival = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            frame, _ = base.write_move(page, frames, frame, movement, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            snap()
            snap()
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)

        for line, preset, degrees in [
            (SUBTITLE_LINES[1][0], 'eight', '135°'),
            (SUBTITLE_LINES[1][1], 'five', '144°'),
            (SUBTITLE_LINES[2][0], 'golden', '137.5078°'),
        ]:
            click_at(starts[line], page.locator(f'[data-preset="{preset}"]'))
            assert page.locator('#degrees').inner_text() == degrees
        for line, interval in zip(SUBTITLE_LINES[3], (21, 34)):
            checkbox = page.locator(f'.trace input[value="{interval}"]')
            click_at(starts[line], checkbox)
            assert checkbox.is_checked()

        hold_until(cues[-1][1] + SILENCE_TAIL)
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
        '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-metadata:s:a:0', 'language=zho', '-shortest',
        '-movflags', '+faststart', str(output),
    ])
