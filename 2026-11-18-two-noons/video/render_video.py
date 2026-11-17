"""Two Noons adapter for the shared cattery/Fish pipeline.

The page is put in manual mode and the recording owns the clock: during each
narration the Greenwich time moves linearly across that scene's window, and
during the silent gaps it holds while the cursor makes the real clicks
(a town's dot, a pin on the map)."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-18-two-noons/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 2.4, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
SCENES = 6
# Greenwich minutes the clock sweeps across during each narration.
WINDOWS = [(930, 1006), (1006, 1022), (1022, 1030), (1030, 1083), (1083, 1142), (1142, 1230)]
PIN = (100.0, 35.0)                     # ° W, ° N: west Texas, Mountain zone

SUBTITLE_LINES = [
    ['大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。',
     '今天是 11 月 18 日。1883 年的今天是个星期天，',
     '美国和加拿大的铁路把车站的钟，统一拨到五条经线上。',
     '在那之前，每个城市各用各的中午：太阳经过头顶的那一刻。',
     '经度差一度，钟就差四分钟。'],
    ['金色这条线是当地正午，每小时往西扫十五度。',
     '纽约在七十五度经线东边一度，太阳先到，',
     '车站的钟先敲了一次十二点。四分钟后，东部标准时间的正午到了，',
     '钟往回拨三分五十九秒，十二点又敲了一次。',
     '这一天后来就叫“两个正午的日子”。'],
    ['匹兹堡在经线西边五度。标准正午到的时候，它的钟才十一点四十，',
     '一下跳到十二点，这二十分钟就没了。',
     '经线东边的城市过两次中午，西边的城市少几分钟。'],
    ['底特律被划进中部时区，离九十度经线将近七度。',
     '中部正午一到，它的钟要往回拨二十七分四十八秒，',
     '差不多半个小时以后，又是一个十二点。',
     '其实底特律市区很多年都没改，一直用自己的地方时。'],
    ['在地图上随便点一下，就多了一个自己的小镇。',
     '这里是西经一百度，离一百零五度经线五度，归山地时区。',
     '下午七点格林尼治时间，山地正午，它往回拨二十分钟。'],
    ['太平洋正午一过，二十一个车站全部换完：',
     '七个过了两次中午，十四个往前跳。',
     '丹佛离经线只差百分之一度，两次中午只隔两秒。',
     '美国国会直到 1918 年才把标准时间写进法律。',
     '今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines)
            .replace('Claude Opus 5.5', 'Claude Opus 五点五')
            .replace('11 月 18 日', '十一月十八日')
            .replace('1883 年', '一八八三年')
            .replace('1918 年', '一九一八年')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  body { overflow: hidden; }
  .page { max-width: 1760px; padding: 8px 36px; }
  .masthead { padding-bottom: 8px; }
  .intro { padding: 10px 0 12px; gap: 36px; }
  .eyebrow { margin-bottom: 7px; }
  h1 { font-size: 54px; }
  .lede { font-size: 14px; line-height: 1.5; max-width: 980px; }
  .workbench { grid-template-columns: minmax(0, 1fr) 470px; gap: 18px; }
  .map-panel { max-width: 1210px; }
  #map { max-height: 650px; }
  .scrub { margin-top: 9px; }
  .legend { margin-top: 7px; }
  .card { padding: 10px 14px; }
  .sidebar { gap: 12px; }
  .faces svg { width: 104px; height: 104px; }
  .faces strong { font-size: 19px; }
  .verdict { font-size: 13.5px; margin: 8px 0 6px; min-height: 4.5em; }
  .towns { font-size: 11px; line-height: 1.6; }
  .footnotes { display: none; }
  #video-caption { font-size: 26px; max-width: 1780px; bottom: 14px; }
  #video-caption:empty { display: none; }
"""
PARK = (1856, 996)


def state(page):
    return page.evaluate('Noons.getState()')


def assert_framing(page):
    page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', max(sum(SUBTITLE_LINES, []), key=len))
    caption = page.locator('#video-caption').bounding_box()
    for selector in ['.masthead', '#map', '.scrub', '.legend', '.town', '#trace', '#towns']:
        box = page.locator(selector).first.bounding_box()
        assert box and box['y'] >= 44 and box['y'] + box['height'] < caption['y'] - 8, (selector, box, caption)
        assert 0 <= box['x'] and box['x'] + box['width'] <= WIDTH, (selector, box)
    assert caption['width'] < WIDTH - 40, caption


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#map .town')
    page.evaluate('Noons.manual(true)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.mouse.move(*PARK)
    s = state(page)
    assert (s['t'], s['selected'], s['reset']) == (930, 'newyork', 0), s


def dot(town):
    return f'#map .town[data-id="{town}"] circle:nth-child(3)'


def pin_point(page):
    box = page.locator('#map').bounding_box()
    lon, lat = PIN
    return (box['x'] + box['width'] * (127.5 - lon) / 75,
            box['y'] + box['height'] * (44 + (48 - lat) / 20 * 476) / 560)


def play(page, click):
    """The demonstration as a generator: `yield n` lets narration n play while
    the clock sweeps WINDOWS[n-1]; the code after it runs in the silent gap."""
    yield 1
    assert state(page)['reset'] == 2                       # Halifax and Saint John at 16:00
    yield 2
    s = state(page)
    assert s['town']['station'] > 720 and s['reset'] == 9 and s['twice'] == 3, s
    assert page.locator('#trace circle').count() == 2      # New York's two noons
    click(dot('pittsburgh'))
    assert state(page)['selected'] == 'pittsburgh'
    yield 3
    click(dot('detroit'))
    assert state(page)['selected'] == 'detroit'
    yield 4
    s = state(page)
    assert s['town']['station'] > 722.9 and round(s['town']['off'], 2) == 27.8, s
    click(pin_point(page))
    s = state(page)
    assert s['selected'] == 'pin' and s['town']['zone'] == 105 and s['town']['lon'] == PIN[0] and s['town']['off'] == 20, s
    yield 5
    s = state(page)
    assert s['t'] >= s['town']['reset'], s                 # the pin has been reset
    yield 6


def capture_frames(work_dir, durations, port):
    assert len(durations) == len(SEGMENTS) == SCENES
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, revision, pos = 0, 0, PARK
    cache_key, last_frame = None, None
    errors = []
    clock = {'t': 930.0}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        assert_framing(page)

        def now():
            return frame / FPS

        def snap(clicking=False):
            nonlocal frame, cache_key, last_frame
            t = round(clock['t'] * 60) / 60                     # whole Greenwich seconds
            page.evaluate('t => Noons.setTime(t)', t)
            key = (revision, base.caption_at(now(), cues), pos, clicking, t)
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                os.link(last_frame, output)
            else:
                base.capture(page, output, now(), cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1

        def glide(dest, move):
            nonlocal pos
            start = pos
            dx, dy = dest[0] - start[0], dest[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(16, distance * 0.04)
            control = ((start[0] + dest[0]) / 2 - dy / distance * bend,
                       (start[1] + dest[1]) / 2 + dx / distance * bend)
            steps = max(1, round(move * FPS))
            for i in range(steps):
                u = (i + 1) / steps
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*dest[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*dest[1])
                page.mouse.move(*pos)
                snap()

        def click(target, move=0.5):
            nonlocal revision
            if isinstance(target, str):
                box = page.locator(target).bounding_box()
                target = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            assert target[1] < HEIGHT - 90, target
            glide(target, move)
            snap(); snap()                                       # settle before the click
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            snap(); snap()

        def run_until(end, sweep=None):
            while now() < end:
                if sweep:
                    a, b, s0, s1 = sweep
                    clock['t'] = a + (b - a) * min(1, (now() - s0) / (s1 - s0))
                snap()

        script = play(page, click)
        start = 0.0
        assert next(script) == 1
        for scene, seconds in enumerate(durations):
            a, b = WINDOWS[scene]
            run_until(start + seconds, (a, b, start, start + seconds))
            clock['t'] = b
            page.evaluate('t => Noons.setTime(t)', b)
            gap_end = start + seconds + (SILENCE_BETWEEN if scene < SCENES - 1 else SILENCE_TAIL)
            if scene < SCENES - 1:
                assert next(script) == scene + 2
            assert now() <= gap_end, ('actions exceeded silent gap', scene, now(), gap_end)
            run_until(gap_end)
            start = gap_end
            print(f'Captured scene {scene + 1}/{SCENES} at {now():.1f}s', flush=True)
        s = state(page)
        assert (s['t'], s['reset'], s['twice'], s['skip']) == (1230, 21, 7, 14), s   # narration 6's figures
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    # Captions are already burned into the screenshots; the shared writer also emits SRT.
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(output)])


def preview(output, chars_per_second=5.6):
    """Offline dry run: capture the whole video silently with estimated
    narration lengths, keeping two stills per scene. Reads no keys, calls no TTS."""
    import shutil
    import tempfile
    import threading
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

    output.mkdir(parents=True, exist_ok=True)
    durations = [len(text) / chars_per_second for text in SEGMENTS]
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT_DIR))
    handler.log_message = lambda *a, **k: None
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    work = Path(tempfile.mkdtemp(prefix='noons-preview-'))
    try:
        frames = capture_frames(work, durations, server.server_address[1])
        start = 0.0
        for scene, seconds in enumerate(durations):
            for name, when in (('start', start + 0.5), ('end', start + seconds - 0.2)):
                shutil.copy(frames / f'{round(when * FPS):06d}.png', output / f'scene-{scene + 1}-{name}.png')
            start += seconds + SILENCE_BETWEEN
    finally:
        server.shutdown()
    print('Offline dry run passed; estimated durations', [round(d, 1) for d in durations])
    print('stills:', output, '· frames left in', work)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
