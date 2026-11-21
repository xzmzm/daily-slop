"""Film the unbalanced and balanced turns for the shared Fish Audio renderer."""
import importlib.util
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parents[1]
ROOT_DIR = PROJECT.parent
URL = f'https://dailyslop.pages.dev/{PROJECT.name}/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
SILENCE_BETWEEN, SILENCE_TAIL = 0.9, 1.4
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.2 Sol，来交 AI 每日作业了。',
     '1896 年 11 月 22 日，摩天轮的发明者乔治·费里斯去世。',
     '芝加哥世博会的原版有 36 个车厢。我画了个八车厢的小轮子。'],
    ['一开场，左右两边一样重，轴上显示零。',
     '让轮子转一圈。原来在上面的两组乘客，会一起转到右边。',
     '这时候重力会把轮子往顺时针拽，曲线最高到 8.5。'],
    ['把 H 厢的六位乘客换到空着的 F 厢。',
     '现在每个有人的车厢，正对面都有一样多的人。'],
    ['再转一圈。车厢在动，曲线还是一条直线。',
     '这下，摩天轮停在哪儿都一样。'],
]

SEGMENTS = [
    ''.join(lines).replace('GPT-6.2 Sol', 'GPT 六点二 Sol')
    .replace('1896 年', '一八九六年').replace('11 月 22 日', '十一月二十二日')
    .replace('8.5', '八点五')
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
    revision = 0
    pos = (1760, 770)
    previous = previous_path = None
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time='2026-11-22T09:00:00+08:00')
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.clock.pause_at('2026-11-22T10:00:00+08:00')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(el, url) => el.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("el => el.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .sheet { zoom: 1.07; }
          .masthead h1 { font-size: 112px; }
          #video-caption { font-size: 32px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(el, line) => el.textContent = line', max(starts, key=len))
        footer = page.locator('footer').bounding_box()
        assert footer['y'] + footer['height'] < caption.bounding_box()['y'] - 10, footer
        assert page.locator('#peak').inner_text() == '8.5'
        button = page.locator('#turn')

        def snap(clicking=False):
            nonlocal frame, revision, previous, previous_path
            if button.text_content() == 'Pause turn':
                step = round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS)
                page.clock.run_for(step)
                revision += 1
            now = frame / FPS
            key = (revision, base.caption_at(now, cues), pos, clicking)
            dest = frames / f'{frame:06d}.png'
            if previous == key:
                os.link(previous_path, dest)
            else:
                base.capture(page, dest, now, cues, pos, clicking)
            previous, previous_path = key, dest
            frame += 1

        def hold_until(seconds):
            while frame / FPS < seconds:
                snap()

        def click_at(seconds, target):
            nonlocal frame, pos, revision
            move_frames = 8
            hold_until(seconds - (move_frames + 2) / FPS)
            assert button.text_content() == 'Run one turn'
            box = target.bounding_box()
            arrival = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            frame, _ = base.write_move(page, frames, frame, move_frames, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            snap()
            snap()
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)

        first_turn = starts[SUBTITLE_LINES[1][1]]
        click_at(first_turn, button)
        hold_until(first_turn + 6.2)
        assert page.locator('#degrees').inner_text() == '0°'
        swap_at = max(starts[SUBTITLE_LINES[2][0]], first_turn + 7)
        click_at(swap_at, page.get_by_role('button', name='Cabin H, 6 riders', exact=True))
        click_at(swap_at + 1.25, page.get_by_role('button', name='Cabin F, 0 riders', exact=True))
        assert page.locator('#peak').inner_text() == '0.0'
        click_at(starts[SUBTITLE_LINES[3][0]], button)
        hold_until(cues[-1][1] + SILENCE_TAIL)
        assert button.text_content() == 'Run one turn'
        assert page.locator('#degrees').inner_text() == '0°'
        assert page.locator('#verdict').text_content() == 'Balanced through the entire turn.'
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-metadata:s:a:0', 'language=zho', '-shortest',
              '-movflags', '+faststart', str(output)])
