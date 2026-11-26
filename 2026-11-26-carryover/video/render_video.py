"""Record the turkey carryover demo for the shared Fish Audio renderer."""
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
     '今天是 2026 年 11 月 26 日，美国感恩节。',
     '美国农业部的说法是：胸肉最厚处、大腿和翅膀最里面，都要到 165 华氏度。'],
    ['先照这个来。14 磅的火鸡，烤箱 325 度，烤了三个小时。',
     '出炉以后，温度计还在往上走，',
     '静置半小时，最高到了 174 度。'],
    ['在这个模型里，最慢熟的那块肉沙门氏菌杀灭超过一百个数量级，目标是 7 个。',
     '可是切开一看，外面一大圈都烤过了，汁水少了 26%。'],
    ['换一只，150 度就拿出来，同样静置半小时。',
     '模型里杀菌按温度和时间一起算，150 度多待几分钟，也能到 7 个数量级。',
     '汁水只少了 23.6%，但页面会标红：这个读数没到 165 度。'],
    ['静置这一步，模型里也省不得。',
     '145 度出炉马上切，最慢熟的那块只杀到 2.5 个数量级，模型目标也没达到。',
     '出炉后的那半小时，火鸡其实还在烤。'],
    ['不过这只是一个二维的玩具模型，证明不了一只真火鸡能放心吃。',
     '真烤火鸡，还是拿温度计查：胸肉、大腿、翅膀最里面，都要到 165 华氏度。'],
]

REPLACEMENTS = [
    ('Claude Opus 5.5', 'Claude Opus 五点五'),
    ('2026 年 11 月 26 日', '二零二六年十一月二十六日'),
    ('165', '一百六十五'), ('174', '一百七十四'), ('14 磅', '十四磅'), ('325', '三百二十五'),
    ('150', '一百五十'), ('145', '一百四十五'), ('7 个', '七个'), ('3 分钟', '三分钟'),
    ('26%', '百分之二十六'), ('23.6%', '百分之二十三点六'), ('2.5 个', '二点五个'),
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
          .sheet { max-width: 1320px; margin: 10px auto; padding: 12px 26px 10px; }
          h1 { font-size: 36px; margin: 2px 0 6px; }
          .masthead { margin-bottom: 6px; }
          .intro, footer { display: none; }
          .layout { grid-template-columns: 720px minmax(0, 1fr); gap: 34px; }
          .stage canvas { width: 720px; }
          dd { font-size: 34px; }
          fieldset label { font-size: 19px; grid-template-columns: 74px 1fr 76px; }
          .verdict p { font-size: 19px; }
          .verdict .small { font-size: 16px; }
          button { font-size: 18px; }
          .usda { font-size: 15px; margin-top: 10px; padding: 8px 12px; }
          #video-caption { font-size: 32px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(element, line) => element.textContent = line', max(starts, key=len))
        bottom = page.locator('.legend').bounding_box()
        caption_top = caption.bounding_box()['y']
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

        def click_button(seconds, selector):
            # Click near the lower-right corner so the parked cursor leaves the label readable.
            box = page.locator(selector).bounding_box()
            click_point(seconds, (box['x'] + box['width'] * 0.88, box['y'] + box['height'] * 0.78))

        def set_slider(seconds, selector, value):
            box = page.locator(selector).bounding_box()
            lo, hi = (float(page.locator(selector).get_attribute(k)) for k in ('min', 'max'))
            x = box['x'] + 8 + (box['width'] - 16) * (value - lo) / (hi - lo)
            click_point(seconds, (x, box['y'] + box['height'] / 2))
            page.locator(selector).evaluate(
                "(el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }", value)
            assert float(page.locator(selector).input_value()) == value

        def run_until_carved():
            while page.evaluate('__ft.state().phase') != 'carved':
                snap()
            verdict = page.locator('#verdict').bounding_box()
            assert verdict['y'] + verdict['height'] < caption_top - 4, verdict
            assert page.locator('#v-safe').get_attribute('class') == '', 'model verdict must stay neutral'

        # 1. The USDA-style plan: pull at 165°F, rest 30 minutes.
        click_button(starts[SUBTITLE_LINES[1][0]] + 0.6, '#go')
        run_until_carved()
        state = page.evaluate('__ft.state()')
        assert state['leastKill'] > 100 and 0.255 < state['loss'] < 0.27, state
        assert 172 < state['restPeakF'] < 176, state

        # 2. Pull at 150°F, same rest.
        click_button(starts[SUBTITLE_LINES[3][0]], '#reset')
        set_slider(starts[SUBTITLE_LINES[3][0]] + 1.2, '#pull', 150)
        click_button(starts[SUBTITLE_LINES[3][0]] + 2.6, '#go')
        run_until_carved()
        state = page.evaluate('__ft.state()')
        assert state['leastKill'] > 100 and 0.23 < state['loss'] < 0.24, state
        assert page.locator('#v-usda').is_visible()
        assert '安全' not in ''.join(sum(SUBTITLE_LINES[1:5], []))

        # 3. Pull at 145°F and carve straight away.
        click_button(starts[SUBTITLE_LINES[4][0]], '#reset')
        set_slider(starts[SUBTITLE_LINES[4][0]] + 0.9, '#pull', 145)
        set_slider(starts[SUBTITLE_LINES[4][0]] + 1.8, '#rest', 0)
        click_button(starts[SUBTITLE_LINES[4][1]], '#go')
        run_until_carved()
        state = page.evaluate('__ft.state()')
        assert 2.45 <= state['leastKill'] < 2.55, state

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
