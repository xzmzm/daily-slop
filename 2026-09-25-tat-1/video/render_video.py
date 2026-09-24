"""TAT-1 adapter for the established cattery Fish Audio video workflow."""
import argparse
import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-25-tat-1/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3，来交 AI 每日作业了。', '今天是九月二十五日。', '1956 年的今天，第一条跨大西洋电话电缆开通，叫 TAT-1。', '在那之前，给欧洲打电话只能靠短波电台，天一黑就断。'],
    ['电缆从纽芬兰的克拉伦维尔，铺到苏格兰的奥本，海底三千七百公里。', '两条同轴电缆，一条去、一条回；', '里面是五十一个真空管增音器——晶体管当时太新，没人敢把它埋进大西洋。', '开通那天，三十六个信道，三十五路电话。', '画面上每种颜色是一路通话：说话才有脉冲，一停就暗下去。', '右边的数字不太好看：电路里只有三分之一在跑话音，剩下全是沉默。'],
    ['电话的秘密：一头说话，另一头在听，句与句之间还在换气。', '一路电话，真正出声的时间只占三分之一。', '1960 年 6 月，贝尔给电缆装上 TASI：', '你一开口，它抓一条空线给你；你一停，这条线马上让给别人。', '三十七条线，就这样接了七十二路电话。', '座位图上颜色换来换去——那不是故障，是沉默在被回收。'],
    ['代价也有。', '开口的人比线多的那一瞬间，抢输的开头半个字被剪掉。', '现在把线砍到二十四条，七十二路电话抢线，红字就是被剪掉的话。', '工程师当年的标准：剪掉不到百分之一，没人听得出来。'],
    ['这条电缆还有个小麻烦：信号在海底跑一个来回要 37 毫秒，你会听见自己的回声。', '打一嗓子试试——白点过去，等一个来回，回声自己回来。', '装上回声抑制器，对端干脆不把回声发回来。', '可它分不清回声和抢话：两个人同时开口，后开口的那头被拦在外面。', '电缆一直用到 1978 年，后来的海底光缆，都是它的后代。'],
    ['今天就到这儿。', '三十六路线路，七十二路电话，中间隔着一个好主意：别给沉默留座。', '明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
# TTS reads years digit by digit and the builder name in Chinese; the burned-in
# subtitles above keep the plain Arabic-numeral forms.
SEGMENTS[0] = SEGMENTS[0].replace('GLM-5.3', 'GLM 五点三')
SEGMENTS = [s.replace('1956 年', '一九五六年')
             .replace('1960 年', '一九六零年')
             .replace('1978 年', '一九七八年')
            for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .masthead{height:52px}
  .intro{padding:10px 0 8px}h1{font-size:34px}.eyebrow{margin-bottom:5px;font-size:11px}
  .intro-copy{display:none}
  main{max-width:1700px}.studio{grid-template-columns:minmax(0,1fr) 384px;gap:20px}
  #ocean{width:96%;margin:0 auto}
  .panel{gap:9px}.block{padding:9px 12px 10px}h2{margin:0 0 5px;font-size:11px}
  .presets{gap:4px}.presets button{padding:5px 10px}.presets button span{display:none}
  .slider{gap:2px;margin-bottom:5px}.switch{margin-top:1px}
  .matrix-frame{width:60%;margin:0 auto}
  .stats{gap:6px 12px}.stats>div{padding-top:5px}.stats dd{font-size:15.5px}.stats dt{font-size:10.5px}
  .fine{display:none}
  .chart-foot{padding:8px 14px 10px}.verdict{font-size:15px;margin-bottom:6px;min-height:0}
  .echo-status{margin-top:5px;font-size:12px}
  .colophon{display:none}
  #video-caption{font-size:30px;bottom:18px;max-width:1600px;padding:10px 22px 12px}
  #video-caption:empty{display:none}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.tat1')
    page.evaluate('tat1.setAutoplay(false)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    page.add_style_tag(content=RECORDING_CSS)
    base.add_caption_overlay(page)
    page.add_style_tag(content='#video-caption{font-size:30px;max-width:1600px;bottom:18px}')
    base.add_cursor_overlay(page)


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1790, 960)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.set_cursor(page, pos)
        page.evaluate('tat1.fastForward(25)')  # warm start: dashes already streaming
        box = page.locator('.studio').bounding_box()
        assert box['y'] + box['height'] < 985, box

        def capture(clicking=False):
            nonlocal frame, timeline
            # Every frame advances the page clock, so the cable stays alive.
            page.evaluate('tat1.tick(1 / %d)' % FPS)
            base.capture(page, frames/f'{frame:06d}.png', timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target):
            nonlocal pos
            # Eased, slightly curved approach, as in the shared renderer.
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            dist = (dx * dx + dy * dy) ** .5 or 1
            bend = min(18.0, dist * .045)
            ctrl = ((start[0] + target[0]) / 2 - dy / dist * bend, (start[1] + target[1]) / 2 + dx / dist * bend)
            for i in range(9):
                t = i / 8; e = t * t * (3 - 2 * t); u = 1 - e
                pos = (u*u*start[0] + 2*u*e*ctrl[0] + e*e*target[0], u*u*start[1] + 2*u*e*ctrl[1] + e*e*target[1])
                capture()
            hold(.2)

        def click(selector, fraction=.5):
            b = page.locator(selector).bounding_box()
            move((b['x'] + b['width'] * fraction, b['y'] + b['height'] / 2))
            page.mouse.click(*pos)
            capture(True); capture(True)
            hold(.2)

        def park():
            move((1790, 960))

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                hold(seconds * .30)
                click('[data-preset="day1"]')
                park()
            elif index == 2:
                hold(seconds * .12)
                click('[data-preset="tasi1960"]')
                park()
            elif index == 3:
                hold(seconds * .10)
                click('[data-preset="rush"]')
                park()
            elif index == 4:
                # Echo story: quieter crossing so the round trip fits the narration.
                page.evaluate('tat1.apply("tasi1960"); tat1.set("crossing", 7.5); tat1.fastForward(3)')
                hold(seconds * .20)
                click('#shoutE')
                park()
                hold(seconds * .16)
                click('#suppressor')
                page.evaluate('tat1.shout(1)')  # suppressed echo, no cursor needed
                hold(seconds * .10)
                page.evaluate('tat1.shout(1); tat1.shout(-1)')  # both ends: lockout
                hold(seconds * .10)
                page.evaluate('tat1.set("crossing", 9)')
            hold(max(0, end - timeline))
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
        final = page.evaluate('tat1.getState()')
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    print('final state:', {'clipped': round(final['stats']['clippedPct'] * 100, 2),
                           'gain': round(final['stats']['gain'], 2), 'preset': final['preset']})
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    # Encode once; the captions have already been burned into browser frames.
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir/'%06d.png'), '-i', str(narration),
              '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
              '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
              '-shortest', '-movflags', '+faststart', str(output)])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT/'index.html').as_uri())
        page.evaluate('tat1.fastForward(20)')
        shots = [
            ('live', None, SUBTITLE_LINES[0][0]),
            ('day1', 'day1', SUBTITLE_LINES[1][5]),
            ('tasi', 'tasi1960', SUBTITLE_LINES[2][4]),
            ('rush', 'rush', SUBTITLE_LINES[3][2]),
        ]
        for name, preset, caption in shots:
            if preset:
                page.evaluate(f'tat1.apply("{preset}")')
                page.evaluate('tat1.fastForward(12)')
            page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', caption)
            page.screenshot(path=str(output/f'{name}.png'))
            board = page.locator('.studio').bounding_box(); cap = page.locator('#video-caption').bounding_box()
            assert board['y'] + board['height'] < cap['y'], (board, cap)
        # Echo framing check with the shout mid-ocean.
        page.evaluate('tat1.apply("tasi1960"); tat1.set("crossing", 7.5); tat1.fastForward(2); tat1.shout(1)')
        page.evaluate('tat1.tick(2)')
        page.screenshot(path=str(output/'echo.png'))
        browser.close()
    print('1080p caption/layout previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
