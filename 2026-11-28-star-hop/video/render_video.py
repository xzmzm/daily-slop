"""Record the Mariner 4 star-hop demo for the shared Fish Audio renderer."""
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
     '1964 年 11 月 28 日，水手 4 号发射去火星，到今天 62 年。',
     '它一头对着太阳，绕着这根轴滚，等星敏感器找到老人星。'],
    ['敏感器只认亮度。刚发射那会儿，地球离得太近，',
     '它先锁上了地球的散射光。',
     '地球越飞越远，这团光暗到门限以下，锁丢了，它接着滚，找到了老人星。'],
    ['没过多久又出事了。探测器旁边跟着一小团灰尘和漆片，',
     '一片飘进视场，信号一下子亮了好几倍，超出门限，',
     '锁又丢了，只能再滚一圈。'],
    ['把门限放宽到 8 倍，再发一条滚转指令。',
     '这回它停在了水委一上，亮度只有老人星的三分之一，宽门限照样放行。',
     '改回正常门限，水委一掉出门限，它自己滚回了老人星。'],
    ['当年的办法是：找到老人星以后，把亮度门限整个关掉。',
     '灰尘再飘过来，敏感器也不撒手了。'],
    ['12 月 4 日，中途修正在老人星锁定下点火。',
     '真的水手 4 号晚了一天，12 月 5 日才点火。',
     '第二年 7 月，它飞过火星，拍回了第一批火星近照。'],
]

REPLACEMENTS = [
    ('Claude Opus 5.5', 'Claude Opus 五点五'),
    ('1964 年 11 月 28 日', '一九六四年十一月二十八日'),
    ('62 年', '六十二年'), ('4 号', '四号'), ('8 倍', '八倍'),
    ('12 月 4 日', '十二月四日'), ('12 月 5 日', '十二月五日'), ('7 月', '七月'),
]


def spoken(lines):
    text = ''.join(lines)
    for written, said in REPLACEMENTS:
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(lines) for lines in SUBTITLE_LINES]
base.SUBTITLE_LINES = SUBTITLE_LINES
write_srt = base.write_srt

SEARCH_PACE = 0.012  # mission days per video second while rolling (one turn ≈ 4 s)
LOCK_PACE = 0.25
CREEP = 0.008


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
          .sheet { max-width: 1500px; margin: 0 auto; padding: 52px 30px 0; }
          h1 { font-size: 34px; margin: 0 0 8px; }
          .date { font-size: 14px; }
          .intro, footer, .legend { display: none; }
          .layout { grid-template-columns: 840px minmax(0, 1fr); gap: 34px; }
          #map { margin-top: 8px; }
          dd { font-size: 30px; }
          dt, .sub { font-size: 14px; }
          button { font-size: 18px; }
          button small { font-size: 13px; }
          .small { font-size: 15px; }
          .verdict p { font-size: 19px; }
          .log { font-size: 15px; max-height: 128px; overflow: hidden; }
          #video-caption { font-size: 32px; max-width: 1600px; }
          #video-caption:empty { visibility: hidden; }
        ''')
        page.mouse.move(*pos)
        base.set_cursor(page, pos)
        caption = page.locator('#video-caption')
        caption.evaluate('(element, line) => element.textContent = line', max(starts, key=len))
        caption_top = caption.bounding_box()['y']
        bottom = page.locator('#map').bounding_box()
        assert bottom['y'] + bottom['height'] < caption_top - 4, (bottom, caption_top)
        state = lambda: page.evaluate('__ft.state()')

        def snap(days=0.0, clicking=False):
            nonlocal frame
            page.evaluate(f'__ft.advance({days})')
            base.capture(page, frames / f'{frame:06d}.png', frame / FPS, cues, pos, clicking)
            frame += 1

        def paced():
            s = state()
            return (SEARCH_PACE if s['mode'] == 'search' else 0.1 if s['mode'] == 'idle' else LOCK_PACE) / FPS

        def creep_until(seconds, pace=CREEP):
            while frame / FPS < seconds:
                snap(pace / FPS)

        def run_until(done, limit=40):
            stop = frame / FPS + limit
            while not done(state()):
                assert frame / FPS < stop, state()
                snap(paced())

        def click_button(seconds, selector):
            nonlocal frame, pos
            box = page.locator(selector).bounding_box()
            arrival = (box['x'] + box['width'] * 0.86, box['y'] + box['height'] * 0.78)
            creep_until(seconds - 10 / FPS)
            frame, _ = base.write_move(page, frames, frame, 8, frame / FPS, cues, pos, arrival)
            pos = arrival
            page.mouse.move(*pos)
            snap(CREEP / FPS)
            snap(CREEP / FPS)
            page.mouse.click(*pos)
            snap(CREEP / FPS, clicking=True)

        # 0. Launch; the roll search begins on the third line.
        creep_until(line(0, 2), pace=0.245 / line(0, 2))
        run_until(lambda s: s['mode'] == 'lock')
        assert state()['locked'] == 'Earth-shine', state()

        # 1. Hold on Earth-shine, then let it fade until the sensor rolls on to Canopus.
        creep_until(line(1, 2) + 0.4)
        run_until(lambda s: s['mode'] == 'lock' and s['locked'] == 'Canopus' and s['day'] > 0.5)
        creep_until(line(2, 0) + 1.5)

        # 2. Dust breaks the lock; one more turn finds Canopus again.
        run_until(lambda s: s['losses'] >= 2)
        assert state()['mode'] == 'search', state()
        run_until(lambda s: s['mode'] == 'lock')
        assert state()['locked'] == 'Canopus', state()

        # 3. Wide gate + roll override lands on Achernar; back to normal and it rolls home.
        click_button(line(3, 0) + 0.4, '[data-gate=wide]')
        click_button(line(3, 0) + 1.6, '#hop')
        run_until(lambda s: s['mode'] == 'lock' and s['locked'] != 'Canopus')
        assert state()['locked'] == 'Achernar', state()
        click_button(line(3, 2) + 0.3, '[data-gate=normal]')
        run_until(lambda s: s['mode'] == 'lock' and s['locked'] == 'Canopus')
        assert state()['day'] < 3.7, state()

        # 4. Gate off: dust drifts by and the lock holds.
        click_button(line(4, 0) + 1.6, '[data-gate=off]')
        creep_until(line(4, 1) - 0.3)
        losses = state()['losses']
        burn_at = line(5, 0) + 0.6
        while state()['outcome'] is None:
            remaining = max(burn_at - frame / FPS, 1 / FPS)
            snap(max(0.0, (6.12 - state()['day']) / remaining / FPS))
        s = state()
        assert s['outcome']['ok'] and s['outcome']['slips'] == 0 and s['losses'] == losses, s
        verdict = page.locator('#verdict').bounding_box()
        assert verdict['y'] + verdict['height'] < caption_top - 4, verdict
        log = page.locator('#log').bounding_box()
        assert log['y'] + log['height'] < caption_top - 4, log

        creep_until(cues[-1][1] + SILENCE_TAIL, pace=0)
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
