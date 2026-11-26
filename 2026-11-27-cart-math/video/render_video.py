"""Record the Cart Math demo for the shared Fish Audio renderer."""
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
SILENCE_BETWEEN, SILENCE_TAIL = 0.7, 1.5
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.2 Sol，来交 AI 每日作业了。',
     '今天是 2026 年 11 月 27 日，黑色星期五。',
     '我开了家假网店，想看看哪张券结账最便宜。'],
    ['台灯加本子，一共 64 美元。折后满 55 美元包邮。',
     '用减 8 美元的券，付 56 美元，还是包邮。'],
    ['换成八五折，东西只要 54.40 美元。',
     '离包邮差 60 美分，运费却加了 9 美元，一共 63.40。'],
    ['那就加一个 1.50 美元的长尾夹。',
     '长尾夹也打折，刚好跨过包邮线，到手 55.67 美元。',
     '多拿一个夹子，反而少付 7.73 美元。'],
    ['三种用券选项，乘上加不加小东西，一共六种结法。',
     '换个购物篮，赢的也可能换一张券。'],
]

REPLACEMENTS = [
    ('GPT-6.2 Sol', 'GPT 六点二 Sol'),
    ('2026 年 11 月 27 日', '二零二六年十一月二十七日'),
    ('54.40 美元', '五十四美元四十美分'),
    ('63.40', '六十三美元四十美分'),
    ('1.50 美元', '一美元五十美分'),
    ('55.67 美元', '五十五美元六十七美分'),
    ('7.73 美元', '七美元七十三美分'),
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
    pos = (360, 600)
    cached = None
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(element, url) => element.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("element => element.textContent = 'CART MATH'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content="""
          .page { max-width: 1390px; padding-top: 26px; }
          h1 { font-size: 105px; }
          .hero > p:last-child { margin: 14px 0 23px; }
          .board { gap: 32px; }
          .receipt { padding: 26px 32px; }
          #video-caption { font-size: 33px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        """)
        page.mouse.move(*pos)

        def hold_until(seconds):
            nonlocal frame, cached
            while frame / FPS < seconds:
                path = frames / f'{frame:06d}.png'
                caption = base.caption_at(frame / FPS, cues)
                if cached is None or cached[0] != caption:
                    base.capture(page, path, frame / FPS, cues, pos)
                    cached = (caption, path)
                else:
                    os.link(cached[1], path)
                frame += 1

        def click(seconds, selector, x_fraction=0.82, y_fraction=0.72):
            nonlocal frame, pos, cached
            box = page.locator(selector).bounding_box()
            arrival = (box['x'] + box['width'] * x_fraction, box['y'] + box['height'] * y_fraction)
            movement = 7
            hold_until(seconds - (movement + 2) / FPS)
            frame, _ = base.write_move(page, frames, frame, movement, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            cached = None
            hold_until(seconds)
            page.mouse.click(*pos)
            base.capture(page, frames / f'{frame:06d}.png', frame / FPS, cues, pos, clicking=True)
            frame += 1
            cached = None

        assert page.locator('#total').inner_text() == '$64.00'
        click(starts[SUBTITLE_LINES[1][1]] + 0.4, '.coupon:has([value="flat"])')
        assert page.locator('#total').inner_text() == '$56.00'
        click(starts[SUBTITLE_LINES[2][0]] + 0.35, '.coupon:has([value="percent"])')
        assert page.locator('#total').inner_text() == '$63.40'
        click(starts[SUBTITLE_LINES[3][0]] + 0.5, '.extra')
        assert page.locator('#total').inner_text() == '$55.67'
        click(starts[SUBTITLE_LINES[4][0]] + 0.4, '#compare')
        assert page.locator('#results li').count() == 6
        assert 'Lowest' in page.locator('#results li').first.inner_text()
        box = page.locator('#results li').last.bounding_box()
        assert box['y'] + box['height'] < 970, box

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
