"""Capture two Mesh Shift tows with the shared Fish Audio workflow."""
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
SILENCE_BETWEEN, SILENCE_TAIL = 1.1, 1.4
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.2 Sol，来交 AI 每日作业了。',
     '今天是 11 月 21 日，世界渔业日。',
     '调查船撒一网，捞上来的鱼能代表海里那一群吗？'],
    ['我在屏幕里放了 72 条鱼。先用 5 厘米的网眼拖一趟。',
     '橙色的是留下来的，蓝绿色的从网眼溜走了。',
     '这一网留下 47 条，平均长 36 厘米。'],
    ['换成 9 厘米的网眼，还是原来那群鱼。',
     '再拖一趟。这回只留下 11 条，平均长 44.8 厘米。',
     '整个鱼群里有 31 条不到 30 厘米的鱼，这次一条都没进样本。'],
    ['两个样本差这么多，屏幕里的鱼一条也没换。',
     '以后听到「这儿的鱼变大了」，我会多问一句，网眼换过吗？'],
]

SEGMENTS = [
    ''.join(lines).replace('GPT-6.2 Sol', 'GPT 六点二 Sol')
    .replace('11 月 21 日', '十一月二十一日')
    for lines in SUBTITLE_LINES
]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    cue_starts = {line: start for start, _, line in cues}
    frame = 0
    revision = 0
    pos = (1690, 390)
    last_key = last_path = None
    animating = False
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time='2026-11-21T09:00:00+08:00')
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.clock.pause_at('2026-11-21T10:00:00+08:00')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(el, url) => el.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("el => el.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .sheet { zoom: 1.16; }
          #transect { height: 257px; }
          footer { padding-bottom: 7px; }
          #video-caption { font-size: 31px; max-width: 1550px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        page.clock.run_for(100)
        caption = page.locator('#video-caption')
        caption.evaluate('(el, s) => el.textContent = s', max(sum(SUBTITLE_LINES, []), key=len))
        footer_box = page.locator('footer').bounding_box()
        assert footer_box['y'] + footer_box['height'] < caption.bounding_box()['y'] - 12, footer_box
        assert page.locator('#retained').inner_text() == '47'

        def snap(clicking=False):
            nonlocal frame, revision, last_key, last_path, animating
            if animating:
                frame_ms = round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS)
                page.clock.run_for(frame_ms)
                animating = page.locator('#tow').is_disabled()
                revision += 1
            now = frame / FPS
            key = (revision, base.caption_at(now, cues), pos, clicking)
            dest = frames / f'{frame:06d}.png'
            if last_key == key:
                os.link(last_path, dest)
            else:
                base.capture(page, dest, now, cues, pos, clicking)
            last_key, last_path = key, dest
            frame += 1

        def hold_until(seconds):
            while frame / FPS < seconds:
                snap()

        def click_at(seconds, selector):
            nonlocal frame, pos, revision, animating
            move_frames = 8
            hold_until(seconds - (move_frames + 2) / FPS)
            assert not animating
            box = page.locator(selector).bounding_box()
            target = (box['x'] + box['width'] * .5, box['y'] + box['height'] * .5)
            frame, _ = base.write_move(page, frames, frame, move_frames, frame / FPS, cues, pos, target)
            pos = target
            page.mouse.move(*pos)
            snap()
            snap()
            page.mouse.click(*pos)
            revision += 1
            animating = page.locator('#tow').is_disabled()
            snap(clicking=True)

        click_at(cue_starts[SUBTITLE_LINES[1][0]] + 1.0, '#tow')
        click_at(cue_starts[SUBTITLE_LINES[2][0]], '[name="mesh"][value="9"]')
        assert page.locator('#retained').inner_text() == '11'
        assert page.locator('#mean').inner_text() == '44.8 cm'
        click_at(cue_starts[SUBTITLE_LINES[2][1]], '#tow')
        hold_until(cues[-1][1] + SILENCE_TAIL)
        assert page.locator('#phase').text_content() == 'Tow complete'
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-metadata:s:a:0', 'language=zho', '-shortest',
              '-movflags', '+faststart', str(output)])
