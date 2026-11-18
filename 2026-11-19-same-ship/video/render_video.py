"""Record the live shipyard for the shared Fish Audio renderer."""
from __future__ import annotations

import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-19-same-ship/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 2.0, 1.5
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.2 Sol，来交 AI 每日作业了。',
     '今天是 11 月 19 日，世界哲学日。',
     '我做了个修船坞，专修忒修斯那艘船。'],
    ['左边的船换下一块旧木板，右边捡去装上。',
     '左边照常修，右边慢慢拼。',
     '换到最后，船坞里会多出一艘船。'],
    ['如果只数原来的木板，换到第四块时，',
     '两个船坞各有四块，刚好打平。'],
    ['八块全换完，老木板都在右边。',
     '光看木板，右边这艘更像忒修斯的船。'],
    ['可如果你认的是一路修过来的那艘，名字还得留在左边。',
     '要是两艘只能留一艘做展品，你会留下哪艘？'],
]
SEGMENTS = [''.join(lines)
            .replace('GPT-6.2 Sol', 'GPT 六点二 Sol')
            .replace('11 月 19 日', '十一月十九日')
            for lines in SUBTITLE_LINES]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt
PARK = (400, 920)


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, revision, pos = 0, 0, PARK
    cached_key, previous = None, None
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(el, url) => el.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("el => el.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .page { max-width: 1600px; }
          .intro { padding-block: 24px 29px; }
          .reading { padding: 25px; }
          .reading h2 { margin-bottom: 26px; }
          .option { padding: 12px; }
          .option small, #reason { font-size: .92rem; }
          #video-caption { font-size: 27px; }
          #video-caption:empty { display: none; }
        ''')
        page.locator('#video-caption').evaluate("(el, text) => el.textContent = text", max(sum(SUBTITLE_LINES, []), key=len))
        caption = page.locator('#video-caption').bounding_box()
        footer = page.locator('footer').bounding_box()
        assert footer['y'] + footer['height'] < caption['y'] - 12, (footer, caption)
        page.mouse.move(*PARK)

        def snap(clicking=False):
            nonlocal frame, cached_key, previous
            now = frame / FPS
            key = (revision, base.caption_at(now, cues), pos, clicking)
            dest = frames / f'{frame:06d}.png'
            if key == cached_key:
                os.link(previous, dest)
            else:
                base.capture(page, dest, now, cues, pos, clicking)
            cached_key, previous = key, dest
            frame += 1

        def until(seconds):
            while frame / FPS < seconds:
                snap()

        def click(selector, fraction=.5):
            nonlocal pos, revision
            box = page.locator(selector).bounding_box()
            target = (box['x'] + box['width'] * fraction, box['y'] + box['height'] / 2)
            x, y = pos
            dx, dy = target[0] - x, target[1] - y
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .045)
            for i in range(1, 9):
                t = i / 8
                blend = t * t * (3 - 2 * t)
                arc = 4 * blend * (1 - blend) * bend / distance
                pos = (x + dx * blend - dy * arc, y + dy * blend + dx * arc)
                page.mouse.move(*pos)
                snap()
            snap()
            snap()
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            snap()

        moves = [
            (),
            (('#next', .5),),
            (('#progress', .5), ('.option:has([value="wood"])', .5)),
            (('#progress', .98),),
            (('.option:has([value="history"])', .5),),
        ]
        expected = [('0', 'Berth A'), ('1', 'Berth A'), ('4', 'A tie'), ('8', 'Berth B'), ('8', 'Berth A')]
        start = 0.0
        assert len(durations) == len(moves) == len(expected)
        for i, (seconds, actions, state) in enumerate(zip(durations, moves, expected)):
            for selector, fraction in actions:
                click(selector, fraction)
            assert frame / FPS <= start, ('actions exceeded silent gap', i)
            assert (page.locator('#progress').input_value(), page.locator('#verdict').inner_text()) == state
            until(start + seconds)
            print(f'Captured scene {i + 1}/{len(moves)} at {frame / FPS:.1f}s', flush=True)
            start += seconds + SILENCE_BETWEEN
        until(start - SILENCE_BETWEEN + SILENCE_TAIL)
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(output)])
