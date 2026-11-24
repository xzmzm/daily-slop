"""Record the Mercury perihelion demo for the shared Fish Audio renderer."""
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
     '1915 年 11 月 25 日，爱因斯坦把场方程交给了普鲁士科学院。',
     '一周前，他刚用它解释了水星轨道上多出来的 43 角秒。'],
    ['水星离太阳最近的那个点，每一百年转 574 角秒。',
     '金星、木星、地球这些行星的拉扯全加上，只有 532。',
     '光金星一颗就占了 278。'],
    ['把时间快进一百万年。',
     '虚线是水星真实的轨道，实线是牛顿算出来的。',
     '两条线差出去一百多度。'],
    ['1859 年，勒维耶的办法是在水星内侧再加一颗行星，叫祝融星。',
     '放在 0.2 天文单位，它得有 1.3 个水星那么重。',
     '缺口合上了，可天文学家找了几十年，谁也没见过它。'],
    ['爱因斯坦 1913 年的草稿理论，只补得上 18 角秒。',
     '1915 年 11 月的广义相对论给出 42.98。',
     '不加行星，不调参数，正好合上。'],
]

REPLACEMENTS = [
    ('Claude Opus 5.5', 'Claude Opus 五点五'),
    ('1915 年 11 月 25 日', '一九一五年十一月二十五日'),
    ('1915 年 11 月', '一九一五年十一月'),
    ('1913 年', '一九一三年'), ('1859 年', '一八五九年'),
    ('43 角秒', '四十三角秒'), ('574 角秒', '五百七十四角秒'), ('532', '五百三十二'),
    ('278', '二百七十八'), ('0.2 天文单位', '零点二个天文单位'), ('1.3 个', '一点三个'),
    ('18 角秒', '十八角秒'), ('42.98', '四十二点九八'),
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
    pos = (1700, 900)
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
          .sheet { width: 1560px; padding-top: 12px; }
          h1 { font-size: 38px; }
          .masthead { margin-bottom: 8px; }
          .sky canvas { max-width: 640px; }
          .time, .legend { max-width: 640px; }
          .layout { grid-template-columns: minmax(0, 1fr) 520px; }
          .readout dd { font-size: 32px; }
          .sources label { font-size: 18px; grid-template-columns: 20px 160px 1fr 72px; }
          .note { font-size: 18px; }
          button { font-size: 16px; }
          footer { display: none; }
          #video-caption { font-size: 32px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(element, line) => element.textContent = line', max(starts, key=len))
        bottom = page.locator('.legend').bounding_box()
        assert bottom['y'] + bottom['height'] < caption.bounding_box()['y'] - 4, bottom

        def snap(clicking=False):
            nonlocal frame
            page.evaluate(f'__ft.step({1 / FPS})')
            base.capture(page, frames / f'{frame:06d}.png', frame / FPS, cues, pos, clicking)
            frame += 1

        def hold_until(seconds):
            while frame / FPS < seconds:
                snap()

        def click_point(seconds, arrival, movement=8):
            nonlocal frame, pos
            hold_until(seconds - (movement + 2) / FPS)
            frame, _ = base.write_move(page, frames, frame, movement, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            snap()
            snap()
            page.mouse.click(*pos)
            snap(clicking=True)

        def center(selector):
            box = page.locator(selector).bounding_box()
            return (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)

        def click_on(seconds, selector):
            click_point(seconds, center(selector))

        venus = SUBTITLE_LINES[1][2]
        click_on(starts[venus], '[data-source=venus]')
        assert page.evaluate('__ft.state().newton') < 260
        click_on(starts[venus] + 1.6, '[data-source=venus]')
        assert abs(page.evaluate('__ft.state().gap') - 42.57) < 0.01

        click_on(starts[SUBTITLE_LINES[2][0]], '#play')
        while page.evaluate('__ft.state().playing'):
            snap()
        state = page.evaluate('__ft.state()')
        assert state['years'] == 1e6 and not state['playing'], state

        click_on(starts[SUBTITLE_LINES[3][0]] + 1.0, '[data-fix=vulcan]')
        needed = round(page.evaluate('__ft.vulcanNeeded()'), 2)
        slider = page.locator('#v-mass').bounding_box()
        target = (slider['x'] + 8 + (slider['width'] - 16) * needed / 4, slider['y'] + slider['height'] / 2)
        click_point(starts[SUBTITLE_LINES[3][1]] + 0.8, target)
        page.evaluate(f'__ft.setVulcan(0.2, {needed})')
        assert abs(page.evaluate('__ft.state().gap')) < 0.65

        click_on(starts[SUBTITLE_LINES[4][0]] + 0.6, '[data-fix=entwurf]')
        assert page.evaluate('__ft.state().gap') > 20
        click_on(starts[SUBTITLE_LINES[4][1]] + 0.4, '[data-fix=gr]')
        assert abs(page.evaluate('__ft.state().gap')) < 0.65

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
