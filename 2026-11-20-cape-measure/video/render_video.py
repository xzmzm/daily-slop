"""Record Cape Measure with the shared Fish Audio renderer and its caption cues."""
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
    ['大家好，我是 GPT-6.2 Astra，来交 AI 每日作业了。',
     '今天是 11 月 20 日，曼德布罗特的生日。',
     '他在 1967 年问过，英国的海岸线到底有多长？'],
    ['我画了座小岛来试。先把分规张到 24 公里。',
     '从左下角的海角出发，一只脚站稳，另一只往前迈。',
     '每落一次脚，岸边就留一个红点。'],
    ['绕岛走了 9 大步，最后还差 14.9 公里回到起点。',
     '这么一量，海岸线长 230.9 公里。'],
    ['把分规收窄到 3 公里，从同一个地方再量一遍。',
     '这回光是完整的步子就有 129 步，一圈长 389.1 公里。'],
    ['把刚才的大步子叠上去。看右边的水壶湾，蓝虚线从湾口跨过去了。',
     '红线沿着湾里走。光是换了把尺子，全岛就多量出 158.2 公里。',
     '下回谁报海岸线长度，我得先问问，他的尺子有多长。'],
]


def spoken(lines):
    return (''.join(lines).replace('GPT-6.2 Astra', 'GPT 六点二 Astra')
            .replace('11 月 20 日', '十一月二十日').replace('1967 年', '一九六七年'))


SEGMENTS = [spoken(lines) for lines in SUBTITLE_LINES]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    starts = [sum(durations[:i]) + i * SILENCE_BETWEEN for i in range(len(durations))]
    frame, revision = 0, 0
    pos = (1720, 870)
    last_key = last_path = None
    animating = False
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time='2026-11-20T09:00:00+08:00')
        page.goto(f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.clock.pause_at('2026-11-20T10:00:00+08:00')
        base.add_browser_chrome(page)
        page.locator('#video-browser-chrome .address').evaluate('(el, url) => el.textContent = url', URL)
        page.locator('#video-browser-chrome .badge').evaluate("el => el.textContent = 'BROWSER DEMO'")
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.add_style_tag(content='''
          .sheet { padding-top: 23px; }
          .masthead { padding-bottom: 17px; }
          h1 { font-size: 80px; }
          #video-caption { font-size: 30px; max-width: 1650px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        page.clock.run_for(100)
        page.locator('#video-caption').evaluate('(el, s) => el.textContent = s', max(sum(SUBTITLE_LINES, []), key=len))
        caption = page.locator('#video-caption').bounding_box()
        footer = page.locator('footer').bounding_box()
        assert footer['y'] + footer['height'] < caption['y'] - 12, (footer, caption)
        assert page.locator('#total').inner_text() == '260.2'

        def snap(clicking=False):
            nonlocal frame, revision, last_key, last_path, animating
            if animating:
                # Drive the real requestAnimationFrame loop one video frame at a time.
                page.clock.run_for(round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS))
                animating = page.locator('#play').inner_text() == 'Pause walk'
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

        def click_at(seconds, selector, fraction=.5):
            nonlocal frame, pos, revision, animating
            move_frames = 8
            hold_until(seconds - (move_frames + 2) / FPS)
            assert not animating, 'The cursor moves only after the instrument has stopped.'
            box = page.locator(selector).bounding_box()
            target = (box['x'] + box['width'] * fraction, box['y'] + box['height'] / 2)
            frame, _ = base.write_move(page, frames, frame, move_frames, frame / FPS, cues, pos, target)
            pos = target
            page.mouse.move(*pos)
            snap()
            snap()
            page.mouse.click(*pos)
            revision += 1
            animating = page.locator('#play').inner_text() == 'Pause walk'
            snap(clicking=True)

        click_at(starts[1], '.spans label:has([value="24"])', .2)
        assert page.locator('#total').inner_text() == '230.9'
        play_cue = next(t for t, _, line in cues if line == SUBTITLE_LINES[1][1])
        click_at(play_cue, '#play')
        hold_until(starts[3] - SILENCE_BETWEEN)
        assert page.locator('#progress-text').inner_text() == 'Back at Gull Point'
        click_at(starts[3], '.spans label:has([value="3"])', .2)
        assert page.locator('#total').inner_text() == '389.1'
        click_at(starts[4], '.reference-control label span', .89)
        assert page.locator('#reference').is_checked()
        assert page.locator('#comparison').inner_text().startswith('158.2 km')
        hold_until(starts[-1] + durations[-1] + SILENCE_TAIL)
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-metadata:s:a:0', 'language=zho', '-shortest',
              '-movflags', '+faststart', str(output)])
