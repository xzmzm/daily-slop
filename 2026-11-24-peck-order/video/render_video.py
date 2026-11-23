"""Record a hunt, ten generations on lichen, and the switch to soot for the Fish renderer."""
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
SILENCE_BETWEEN, SILENCE_TAIL = 0.8, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL

SUBTITLE_LINES = [
    ['大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。',
     '1859 年 11 月 24 日，达尔文的《物种起源》出版。',
     '今天不读书，今天当鸟。'],
    ['树皮上停着 40 只蛾子，深浅不一。',
     '我专挑显眼的吃，一代吃掉 20 只。',
     '没被看见的那一半，留下来生下一代。'],
    ['让鸟接着吃十代。',
     '蛾子越来越浅，红线贴上了树皮的颜色。',
     '没有哪只蛾子想变色，只是显眼的先没了。'],
    ['现在把树皮熏黑，像工业革命时的曼彻斯特。',
     '刚才最安全的浅色蛾子，一下全成了靶子。'],
    ['再吃二十代，蛾群又变黑了。',
     '现实里，曼彻斯特 1848 年首次记录到黑色桦尺蛾，',
     '到 1895 年，黑色的已经占了 98%。'],
]

REPLACEMENTS = [
    ('Claude Opus 5.5', 'Claude Opus 五点五'),
    ('1859 年 11 月 24 日', '一八五九年十一月二十四日'),
    ('40 只', '四十只'), ('20 只', '二十只'),
    ('1848 年', '一八四八年'), ('1895 年', '一八九五年'), ('98%', '百分之九十八'),
]


def spoken(lines):
    text = ''.join(lines)
    for written, said in REPLACEMENTS:
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(lines) for lines in SUBTITLE_LINES]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    starts = {line: start for start, _, line in cues}
    frame = 0
    pos = (1720, 760)
    revision = 0
    previous = previous_path = None
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.add_init_script('window.__peckManualClock = true')
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(element, url) => element.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("element => element.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .sheet { width: 1500px; padding-top: 12px; }
          h1 { font-size: 38px; }
          .masthead { margin-bottom: 8px; }
          footer { display: none; }
          #video-caption { font-size: 32px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(element, line) => element.textContent = line', max(starts, key=len))
        tree = page.locator('.tree').bounding_box()
        assert tree['y'] + tree['height'] < caption.bounding_box()['y'] - 4, tree

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

        def click_point(seconds, arrival, movement=8):
            nonlocal frame, pos, revision
            hold_until(seconds - (movement + 2) / FPS)
            frame, _ = base.write_move(page, frames, frame, movement, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            snap()
            snap()
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)

        def click_on(seconds, selector):
            box = page.locator(selector).bounding_box()
            click_point(seconds, (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2))

        def play_queue():
            nonlocal revision
            more = True
            while more:
                for _ in range(5):
                    snap()
                more = page.evaluate('__peck.advance()')
                revision += 1
            snap()

        hunt_line = SUBTITLE_LINES[1][1]
        for index in range(6):
            target = page.evaluate('__peck.mostVisible()')
            click_point(starts[hunt_line] + index * 0.62, (target['x'], target['y']), movement=4)
        assert page.evaluate('__peck.state().eaten') == 6

        click_on(starts[SUBTITLE_LINES[1][2]], '#one')
        play_queue()
        assert page.evaluate('__peck.state().generation') == 1

        click_on(starts[SUBTITLE_LINES[2][0]], '#ten')
        play_queue()
        lichen = page.evaluate('__peck.state()')
        assert lichen['generation'] == 11 and abs(lichen['mean'] - lichen['bark']) < 0.1, lichen

        click_on(starts[SUBTITLE_LINES[3][0]], '[data-bark="soot"]')
        assert page.evaluate('__peck.state().bark') == 0.14

        click_on(starts[SUBTITLE_LINES[4][0]], '#ten')
        play_queue()
        click_on(frame / FPS, '#ten')
        play_queue()
        soot = page.evaluate('__peck.state()')
        assert soot['generation'] == 31 and abs(soot['mean'] - soot['bark']) < 0.1, soot

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
