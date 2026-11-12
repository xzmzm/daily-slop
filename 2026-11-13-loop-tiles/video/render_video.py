"""Loop Tiles adapter for the shared cattery/Fish pipeline; preview is offline."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-13-loop-tiles/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 3.2, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。',
     '今天是 11 月 13 日。我有点好奇：',
     '只有两种方向的弯线，拼在一起能绕出什么花样？'],
    ['所以做了这块小拼板。每块砖有两条弧线，点一下就转向。',
     '先试个小挑战：中间四块差一点连起来，',
     '橙色标记的那块，就是缺的这一转。'],
    ['转过去，四条弧线刚好围成一个小圈。',
     '旁边会显示闭环数量、最长环的弧线数，还有转了几次。',
     '小圈不大，成就感倒是来得挺快。'],
    ['再找一下最长的环，整条线会变成橙色。',
     '它不一定只待在一个角落，也可能绕过好多块砖。',
     '数的是弧线，不是占了多少格。'],
    ['现在直接点中间小圈上的一段弧线，只追踪这一条。',
     '同一块砖上的另一条弧线，可能属于别的路径。',
     '线碰到边界就出去了，绕回起点才算闭环。'],
    ['换个种子，再转一块。相同的种子能找回相同的起始拼板。',
     '看着只是转动一小块，远处的连接也可能跟着变。',
     '今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines).replace('GPT-6.1 Sol', 'GPT 六点一 Sol').replace('11 月 13 日', '十一月十三日')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  body { overflow: hidden; }
  .page { max-width: 1270px; padding: 18px 28px; }
  .masthead { padding-bottom: 12px; }
  .intro { padding: 18px 0; }
  h1 { font-size: 60px; }
  .lede { font-size: 15px; margin-right: 0; }
  .workbench { grid-template-columns: 684px 420px; gap: 30px; justify-content: center; }
  .board-panel { padding: 16px; max-width: none; }
  #board { width: 650px; height: 650px; }
  .board-heading { margin-bottom: 12px; }
  .board-footer { margin-top: 12px; }
  .sidebar { gap: 10px; }
  .card { padding: 15px 18px; }
  .eyebrow { margin-bottom: 10px; }
  .card p:not(.eyebrow) { margin-bottom: 10px; font-size: 13px; }
  h2 { font-size: 23px; }
  .stats { padding: 12px; }
  .segmented { margin-bottom: 12px; }
  .footnotes { margin-top: 13px; padding-top: 10px; }
  #video-caption { font-size: 28px; max-width: 1780px; bottom: 16px; }
"""
PARK = (1800, 900)
CENTER = [27, 28, 35, 36]
SEED = 'little-turns'


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#board .tile')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.mouse.move(*PARK)
    page.clock.install()
    assert page.locator('.tile').count() == 64
    assert_state(page)


def state(page):
    return page.evaluate('LoopApp.getState()')


def assert_state(page):
    current = state(page)
    analysis = page.evaluate('LoopModel.analyze(LoopApp.getState().board, 8)')
    assert int(page.locator('#loop-count').inner_text()) == len(analysis['loops']) == current['loops']
    assert int(page.locator('#longest').inner_text()) == analysis['longestLoop'] == current['longestLoop']
    assert int(page.locator('#turns').inner_text()) == current['turns']
    return current, analysis


def assert_framing(page):
    # Test the longest subtitle too, not just a conveniently short caption.
    page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', max(sum(SUBTITLE_LINES, []), key=len))
    caption = page.locator('#video-caption').bounding_box()
    for selector in ['#board', '.board-panel', '.sidebar', '.footnotes']:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 44 and box['y'] + box['height'] < caption['y'] - 10, (selector, box, caption)
        assert 0 <= box['x'] and box['x'] + box['width'] <= WIDTH
    box = page.locator('#board').bounding_box()
    assert abs(box['width'] - 650) < 1 and abs(box['height'] - 650) < 1
    assert caption['width'] < WIDTH - 40


def center_component(page):
    current, analysis = assert_state(page)
    assert [current['board'][i] for i in CENTER] == [1, 0, 0, 1]
    components = [c for c in analysis['loops'] if {s['tile'] for s in c['segments']} == set(CENTER)]
    assert len(components) == 1 and components[0]['length'] == 4
    assert components[0]['closed'] and not components[0]['endpoints']
    assert 'Loop closed! Four arcs' in page.locator('#challenge-status').inner_text()
    return components[0]


def assert_scene(page, scene):
    current, analysis = assert_state(page)
    if scene == 1:
        assert current['challenge'] and current['turns'] == 0
        assert [current['board'][i] for i in CENTER] == [0, 0, 0, 1]
        assert page.locator('.tile.marked').get_attribute('data-tile') == '27'
        assert 'Turn the orange-marked tile' in page.locator('#challenge-status').inner_text()
    elif scene in (2, 3, 4):
        center = center_component(page)
        assert current['turns'] == 1 and page.locator('.tile.marked').count() == 0
        if scene == 3:
            selected = analysis['components'][current['selected']]
            assert current['mode'] == 'trace' and selected['closed']
            assert selected['length'] == analysis['longestLoop']
        if scene == 4:
            assert current['mode'] == 'trace' and current['selected'] == center['id']
            assert page.locator('path.selected').count() == 4
            assert page.locator('#thread-title').inner_text() == 'This thread comes home.'
            assert page.locator('#thread-detail').inner_text().startswith('4 curved arcs')
    elif scene == 5:
        expected = page.evaluate('(seed)=>LoopModel.createBoard(seed, 8)', SEED)
        expected[0] = 1 - expected[0]
        assert current['board'] == expected and current['turns'] == 1
        assert not current['challenge'] and current['mode'] == 'rotate'


def actions(page, scene, click):
    """Only real UI input mutates the board; evaluation above is read-only."""
    if scene == 1:
        click('#challenge')
    elif scene == 2:
        before = state(page)['board']
        click('.tile[data-tile="27"]')
        after = state(page)['board']
        assert [i for i in range(64) if before[i] != after[i]] == [27]
    elif scene == 3:
        click('#show-longest')
    elif scene == 4:
        if state(page)['mode'] != 'trace':
            click('#trace-mode')
        # Tile 27 is orientation 1. Its center-loop arc is the SE quarter-circle,
        # centered at (100,100), radius 50: sample at 225 degrees, not tile center.
        coordinate = 1 - math.sqrt(0.125)
        click('.tile[data-tile="27"]', (coordinate, coordinate))
    elif scene == 5:
        click('#rotate-mode')
        page.locator('#seed').fill(SEED)
        click('#seed-form button')
        assert state(page)['board'] == page.evaluate('(seed)=>LoopModel.createBoard(seed, 8)', SEED)
        click('.tile[data-tile="0"]')
    assert_scene(page, scene)


def capture_frames(work_dir, durations, port):
    assert len(durations) == len(SEGMENTS) == 6
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, revision, pos = 0, 0, PARK
    cache_key, last_frame = None, None
    errors = []
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
            key = (revision, base.caption_at(now(), cues), pos, clicking)
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                os.link(last_frame, output)
            else:
                base.capture(page, output, now(), cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1

        def until(end):
            while now() < end:
                snap()

        def click(selector, fraction=(0.5, 0.5)):
            nonlocal pos, revision
            box = page.locator(selector).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 90
            target = (box['x'] + box['width'] * fraction[0], box['y'] + box['height'] * fraction[1])
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(16, distance * 0.04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            for i in range(round(0.45 * FPS)):
                u = (i + 1) / round(0.45 * FPS)
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap()
            until(now() + 0.13)
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            until(now() + 0.13)
            # Stay here through narration; no decorative return trip to PARK.

        start = 0.0
        for scene, seconds in enumerate(durations):
            parked = pos
            until(start + seconds)
            assert pos == parked  # No cursor motion during any spoken segment.
            gap_end = start + seconds + (SILENCE_BETWEEN if scene < 5 else SILENCE_TAIL)
            if scene < 5:
                actions(page, scene + 1, click)
            assert now() <= gap_end, ('actions exceeded silent gap', scene, now(), gap_end)
            until(gap_end)
            start = gap_end
            print(f'Captured scene {scene + 1}/6 at {now():.1f}s', flush=True)
        assert not errors, errors
        browser.close()
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    # Captions are already burned into the screenshots; the shared writer also emits SRT.
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(output)])


def preview(output):
    """Offline stills and UI/model assertions only: never reads keys or calls TTS."""
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, (PROJECT / 'index.html').as_uri())
        assert_framing(page)

        def click(selector, fraction=(0.5, 0.5)):
            box = page.locator(selector).bounding_box()
            target = (box['x'] + box['width'] * fraction[0], box['y'] + box['height'] * fraction[1])
            page.mouse.click(*target)
            base.set_cursor(page, target)

        def save(name, scene):
            assert_framing(page)
            page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[scene][0])
            page.screenshot(path=str(output / f'{name}.png'))

        save('start', 0)
        for scene, name in [(1, 'challenge'), (2, 'solved'), (3, 'longest'), (4, 'traced'), (5, 'seed-rotate')]:
            actions(page, scene, click)
            save(name, scene)
        assert not errors, errors
        browser.close()
    print('Offline previews and assertions passed:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
