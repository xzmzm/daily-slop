"""Drive by Stills adapter for the shared cattery/Fish pipeline.

The app is a real-time simulation, so the recording owns its clock: the page is
put in manual mode and every captured video frame advances the rover by exactly
WARP / FPS seconds. Commands are still real mouse clicks on the real pad; the
timed ones land on the exact simulation instant the test suite uses."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-17-drive-by-stills/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 3.2, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration
WARP = 4            # matches the ×4 chip lit on the page
SCENES = 6

SUBTITLE_LINES = [
    ['大家好，我是 Claude Fable 5.2，来交 AI 每日作业了。',
     '今天是 11 月 17 日。1970 年的今天，月球车一号落在雨海，',
     '是第一辆在别的星球上跑起来的遥控车。',
     '司机坐在克里米亚，看着电视开。那台电视放的不是视频，是一张一张的照片。'],
    ['我按下二挡前进，时速两公里。指令要飞 1.28 秒才到月球。',
     '屏幕上这张照片是出发那一刻拍的，远处那条暗缝是个坑。',
     '琥珀色的线是下一张照片，从上往下扫，扫完一张要 21 秒。',
     '等坑在画面里变大，车已经自己停在坑沿了，离出发点 15 米。',
     '照片比车晚了十几秒。'],
    ['右边是领航员的图。照片拍到过的地面才亮起来，坑也是拍到了才画上去。',
     '打开真相，橙色虚线圈都是还没进过镜头的坑。',
     '二十多秒才来一张照片，每按一次前进，车都要先走十几米才看得见结果。'],
    ['换成月球车二号的相机，3.2 秒一张，同一片地再走一遍。',
     '照片最多旧七八秒，车离照片里的位置不到五米。',
     '先左转一点，从第一个坑的左边绕过去，',
     '过了坑再右转，对准路标一直开。'],
    ['能发的指令只有五个走和一个停。',
     '方向看陀螺，路程看拖在车尾的第九个轮子，这两个读数只晚一秒多。',
     '所以领航员的图上，白色方块差不多就是车现在的位置，',
     '琥珀色扇形才是屏幕上那张照片拍下的地方。'],
    ['到了。里程表 59 米，直线 57.7 米，一次自动刹车都没有，用时不到两分钟。',
     '同一辆车，同一片地，差别只在照片来得多快。',
     '按通常的说法，月球车一号大约二十秒才有一张，',
     '它就这样在月面上工作了 322 天，走了十公里半。',
     '今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines)
            .replace('Claude Fable 5.2', 'Claude Fable 五点二')
            .replace('11 月 17 日', '十一月十七日')
            .replace('1970 年', '一九七零年')
            .replace('1.28 秒', '一点二八秒')
            .replace('3.2 秒', '三点二秒')
            .replace('21 秒', '二十一秒')
            .replace('15 米', '十五米')
            .replace('59 米', '五十九米')
            .replace('57.7 米', '五十七点七米')
            .replace('322 天', '三百二十二天')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  body { overflow: hidden; }
  .page { max-width: 1700px; padding: 10px 36px; }
  .masthead { padding-bottom: 9px; }
  .intro { padding: 11px 0 13px; }
  .eyebrow { margin-bottom: 8px; }
  h1 { font-size: 50px; }
  .lede { font-size: 13.5px; max-width: 900px; }
  .workbench { grid-template-columns: 740px 462px minmax(0, 1fr); gap: 16px; }
  .panel { padding: 12px 14px; }
  .tv-holder { padding: 8px; }
  .gauges { margin-top: 10px; }
  .pad { margin-top: 10px; }
  .cmd { padding: 9px 6px 8px; }
  .uplink { margin-top: 9px; min-height: 1.5em; font-size: 12.5px; }
  .sidebar { gap: 12px; }
  .card { padding: 12px 16px; }
  .footnotes { display: none; }
  #video-caption { font-size: 26px; max-width: 1780px; bottom: 14px; }
"""
PARK = (1856, 996)
# The clean route on ground 1970 (same as test_browser.py): press time in
# simulation seconds, then the command.
ROUTE = [(1.8, 'F2'), (36.6, 'RIGHT'), (40.75, 'F2')]

TICK_JS = """([inc, limit]) => {
  const s = Stills.getState();
  if (s.phase !== 'driving') { window.__target = s.t; return s; }
  window.__target = (window.__target ?? s.t) + inc;
  const goal = limit == null ? window.__target : Math.min(window.__target, limit);
  const n = Math.floor((goal - s.t) / 0.05 + 1e-6);
  if (n > 0) Stills.step(n * 0.05);
  return Stills.getState();
}"""


def state(page):
    return page.evaluate('Stills.getState()')


def expect(page, **want):
    s = state(page)
    for key, value in want.items():
        assert s[key] == value, (key, value, s)
    return s


def assert_framing(page):
    page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', max(sum(SUBTITLE_LINES, []), key=len))
    caption = page.locator('#video-caption').bounding_box()
    for selector in ['.masthead', '#tv', '.pad', '#uplink', '#chart', '.legend', '.sidebar']:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 44 and box['y'] + box['height'] < caption['y'] - 8, (selector, box, caption)
        assert 0 <= box['x'] and box['x'] + box['width'] <= WIDTH, (selector, box)
    assert caption['width'] < WIDTH - 40, caption


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#chart')
    page.evaluate('Stills.manual(true)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate('window.dispatchEvent(new Event("resize"))')
    base.set_cursor(page, PARK)
    page.mouse.move(*PARK)
    expect(page, phase='ready', period=21.1, warp=WARP, truth=False, seed=1970, frame=0)


def play(page, click, timed_click, pending):
    """The whole demonstration as a generator: each `yield n` hands control
    back so narration n can play over the state reached so far."""
    yield 1                                   # parked, one complete picture
    click('.cmd[data-cmd="F2"]')              # straight at the waypoint in second gear
    yield 2
    s = expect(page, mode='STOP', stops=1, trip='crater rim')
    assert s['frame'] >= 2, s                 # the close-up picture has finally arrived
    click('#truth')
    expect(page, truth=True)
    yield 3
    click('#periods .chip[data-period="3.2"]')
    expect(page, phase='ready', period=3.2, stops=0)
    click('.cmd[data-cmd="LEFT"]')
    for when, cmd in ROUTE[:1]:
        timed_click(when, f'.cmd[data-cmd="{cmd}"]')
    pending.extend(ROUTE[1:])                 # run_until() presses these on time
    yield 4                                   # the timed turns land inside narration 4
    yield 5
    s = expect(page, phase='arrived', stops=0, runs=1)
    assert round(s['odo']) == 59 and s['t'] < 120, s   # the figures narration 6 quotes
    yield 6


def capture_frames(work_dir, durations, port):
    assert len(durations) == len(SEGMENTS) == SCENES
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, revision, pos = 0, 0, PARK
    cache_key, last_frame = None, None
    pending = []
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        assert_framing(page)

        def now():
            return frame / FPS

        def snap(clicking=False, limit=None):
            """One video frame: advance the rover's clock, then photograph."""
            nonlocal frame, cache_key, last_frame
            s = page.evaluate(TICK_JS, [WARP / FPS, limit])
            key = (revision, base.caption_at(now(), cues), pos, clicking, s['t'], s['phase'], s['pending'])
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                os.link(last_frame, output)
            else:
                base.capture(page, output, now(), cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1
            return s

        def glide(target, move, limit=None):
            nonlocal pos
            box = page.locator(target).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 90, (target, box)
            dest = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
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
                snap(limit=limit)

        def press():
            nonlocal revision
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            snap(); snap()

        def click(target, move=0.4):
            glide(target, move)
            snap(); snap()                    # short settle before the click
            press()

        def timed_click(when, target, move=0.27):
            """Click exactly when the rover's clock reads `when`."""
            glide(target, move, limit=when)
            s = snap(limit=when)
            while s['t'] < when - 1e-6:
                s = snap(limit=when)
            assert abs(s['t'] - when) < 1e-6, (when, s['t'])
            press()

        def run_until(end):
            while now() < end:
                if pending and state(page)['phase'] == 'driving':
                    when, cmd = pending[0]
                    lead = (0.27 + 2 / FPS) * WARP      # glide plus settle, in rover seconds
                    if state(page)['t'] >= when - lead:
                        pending.pop(0)
                        timed_click(when, f'.cmd[data-cmd="{cmd}"]')
                        continue
                snap()

        script = play(page, click, timed_click, pending)
        start = 0.0
        assert next(script) == 1
        for scene, seconds in enumerate(durations):
            run_until(start + seconds)
            gap_end = start + seconds + (SILENCE_BETWEEN if scene < SCENES - 1 else SILENCE_TAIL)
            if scene < SCENES - 1:
                assert next(script) == scene + 2      # the clicks between two narrations
            assert now() <= gap_end, ('actions exceeded silent gap', scene, now(), gap_end)
            run_until(gap_end)
            start = gap_end
            print(f'Captured scene {scene + 1}/{SCENES} at {now():.1f}s', flush=True)
        assert not pending, pending
        expect(page, phase='arrived', stops=0)
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
    narration lengths, keeping one still per scene. Reads no keys, calls no TTS."""
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
    work = Path(tempfile.mkdtemp(prefix='stills-preview-'))
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
