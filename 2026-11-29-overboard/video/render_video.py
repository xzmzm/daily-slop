"""Record the Overboard demo for the shared Fish Audio renderer."""
import importlib.util
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
     '1929 年 11 月 29 日，伯德四个人开着一架福特三发飞机，第一次飞越南极点，到今天 97 年。',
     '要去南极点，先得顺着冰川爬上去，翻过尽头的山口。'],
    ['可飞机装得太满，爬不动。',
     '黄色虚线是什么都不扔、照这样飞下去的高度，红叉是撞上冰面的地方。',
     '绿色虚线是现在再扔一袋吃的，会飞成什么样。'],
    ['扔一袋，150 磅。',
     '黄线抬起来了，但还是在山口前擦到冰面。',
     '那就再扔一袋。'],
    ['两袋扔下去，黄线越过了山口。',
     '剩下三袋吃的，万一迫降，四个人还能撑五十多天。',
     '扔汽油也一样减重，可回程就到不了补给点了。'],
    ['最后十几英里，冷空气顺着冰川往下灌，',
     '飞机怎么都在掉高度。',
     '所以分量要早点扔，到这儿再扔就晚了。'],
    ['翻过山口，上了极地高原，富余三百多英尺。',
     '当年他们也是扔了差不多两袋吃的才翻过去，',
     '然后飞到南极点，又平安飞回了小美国基地。'],
]

REPLACEMENTS = [
    ('Claude Opus 5.5', 'Claude Opus 五点五'),
    ('1929 年 11 月 29 日', '一九二九年十一月二十九日'),
    ('97 年', '九十七年'), ('150 磅', '一百五十磅'),
]


def spoken(lines):
    text = ''.join(lines)
    for written, said in REPLACEMENTS:
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(lines) for lines in SUBTITLE_LINES]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt
SPEED = 1.5  # miles per flight minute, matches sim.js


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    starts = {line: start for start, _, line in cues}
    line = lambda i, j: starts[SUBTITLE_LINES[i][j]]
    frame = 0
    pos = (1780, 960)
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.add_init_script('window.__ftManualClock = true')
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(element, url) => element.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("element => element.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .sheet { max-width: 1820px; margin: 0 auto; padding: 50px 30px 0; }
          h1 { font-size: 34px; margin: 0 0 8px; }
          .date { font-size: 14px; }
          .intro, footer, .log { display: none; }
          .layout { grid-template-columns: 1240px minmax(0, 1fr); gap: 30px; }
          .legend { font-size: 16px; }
          dd { font-size: 30px; }
          dt, .sub { font-size: 14px; }
          button { font-size: 19px; }
          button small { font-size: 14px; }
          .small { font-size: 15px; }
          .verdict p { font-size: 19px; }
          #video-caption { font-size: 32px; max-width: 1640px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(element, line) => element.textContent = line', max(starts, key=len))
        caption_top = caption.bounding_box()['y']
        for selector in ('.legend', '.controls'):
            box = page.locator(selector).bounding_box()
            assert box['y'] + box['height'] < caption_top - 4, (selector, box, caption_top)
        state = lambda: page.evaluate('__ft.state()')

        def snap(minutes=0.0, clicking=False):
            nonlocal frame
            page.evaluate(f'__ft.advance({minutes})')
            base.capture(page, frames / f'{frame:06d}.png', frame / FPS, cues, pos, clicking)
            frame += 1

        def fly_to(x_target, seconds):
            # Spread the flight to x_target evenly over the frames until `seconds`.
            while frame / FPS < seconds:
                left = max(1, round((seconds - frame / FPS) * FPS))
                s = state()
                if s['outcome']:
                    snap(0)
                    continue
                snap(max(0.0, (x_target - s['x']) / SPEED / left))

        def click_button(seconds, selector, x_target):
            nonlocal frame, pos
            box = page.locator(selector).bounding_box()
            arrival = (box['x'] + box['width'] * 0.7, box['y'] + box['height'] * 0.7)
            fly_to(x_target, seconds - 10 / FPS)
            step = 0.004
            frame, _ = base.write_move(page, frames, frame, 8, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            snap(step)
            snap(step)
            page.mouse.click(*pos)
            snap(step, clicking=True)

        # 0–1. Over the shelf, then up the glacier mouth while the lines are explained.
        fly_to(-2.5, line(1, 0))
        assert state()['hit'] is not None, state()
        fly_to(4.5, line(2, 0) + 0.3)

        # 2. One sack: still hits the ice. A second one.
        click_button(line(2, 0) + 0.9, '#dropFood', 5.5)
        s = state()
        assert s['food'] == 4 and s['hit'] is not None, s
        click_button(line(2, 2) + 0.7, '#dropFood', 8.5)
        s = state()
        assert s['food'] == 3 and s['hit'] is None and s['projected'] > 250, s

        # 3–4. Climb the glacier, then into the sink.
        fly_to(33, line(4, 0))
        fly_to(49.6, line(5, 0))
        s = state()
        assert s.get('cleared') is None and s['outcome'] is None, s

        # 5. Over the pass and onto the plateau.
        fly_to(58.3, line(5, 1))
        s = state()
        assert s['outcome'] and s['outcome']['kind'] == 'plateau' and s['outcome']['food'] == 3, s
        verdict = page.locator('#verdict').bounding_box()
        assert verdict['y'] + verdict['height'] < caption_top - 4, verdict
        fly_to(58.3, cues[-1][1] + SILENCE_TAIL)
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
