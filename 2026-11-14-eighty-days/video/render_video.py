"""Eighty Days adapter for the shared cattery/Fish pipeline; preview is offline."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-14-eighty-days/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 3.2, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3 Flash，来交 AI 每日作业了。',
     '今天是 11 月 14 日。一八八九年的今天，记者娜丽·布莱从霍博肯码头出发，去破一个只存在于小说里的八十天纪录。',
     '开局就是她的选择：汉堡邮船今天开，冠达快船晚一天但快两天。我点了她真正坐的那一班。'],
    ['大西洋上晃了七天，凌晨两点半到南安普顿，雾里全是闪光灯。',
     '换接驳火车进伦敦，再挑绕经巴黎的那班南下车——',
     '反正两班火车都赶得上同一班邮船，绕道去看凡尔纳不要钱。'],
    ['在亚眠，凡尔纳对娜丽说：八十天里回来，我用双手给你鼓掌。',
     '绕这一趟一分没耽误，凌晨一点半照样到布林迪西，',
     '码头上每周一班去印度的邮船正等着装邮件。'],
    ['从这儿开始是一根链条：每周一班的邮船，港口一站咬着一站，',
     '锡兰、槟城、新加坡，全看上一班的脸色。',
     '晚到一步，下一班就是七天以后——娜丽的行程就排在链条的缝里。'],
    ['圣诞节的早上到香港，邮件船海洋号偏偏要等到 12 月 28 日才开，码头上干等三天。',
     '过了横滨往东，轮船穿过一百八十度经线，',
     '日历自己往回跳一天——船上的人把同一天过了两遍。'],
    ['芝加哥，《世界报》包下的专列已经在等：一台机车，一条空线，1013 英里一口气跑完。',
     '霍博肯下车，计时器正好停在 72 天 6 小时 11 分——',
     '和娜丽的官方纪录分秒不差。今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines).replace('GLM-5.3 Flash', 'GLM 五点三 Flash')
            .replace('11 月 14 日', '十一月十四日')
            .replace('12 月 28 日', '十二月二十八日')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  body { overflow: hidden; }
  .page { max-width: 1420px; padding: 16px 34px; }
  .masthead { padding-bottom: 12px; }
  .intro { padding: 16px 0; }
  h1 { font-size: 56px; }
  .lede { font-size: 15px; margin-right: 0; }
  .workbench { grid-template-columns: minmax(0,1fr) 430px; gap: 20px; justify-content: center; }
  .map-panel { padding: 14px; }
  #map { width: 100%; height: 500px; }
  .map-heading { margin-bottom: 10px; }
  .clock-strip { grid-template-columns: 130px 1fr 250px; gap: 16px; margin-top: 12px; padding-top: 10px; }
  .elapsed strong { font-size: 26px; }
  .clocks strong { font-size: 13px; }
  .sidebar { gap: 10px; }
  .card { padding: 14px 16px; }
  .eyebrow { margin-bottom: 8px; }
  .card p:not(.eyebrow) { margin-bottom: 10px; font-size: 12px; }
  h2 { font-size: 21px; }
  .option .note { display: none; }
  .option .dep:nth-of-type(n+2) { display: none; }
  .option .dep { padding: 7px 11px; margin-bottom: 5px; font-size: 11px; }
  .log-card { min-height: 0; }
  #log { max-height: 150px; }
  .footnotes { margin-top: 12px; padding-top: 10px; }
  #video-caption { font-size: 26px; max-width: 1780px; bottom: 16px; }
"""
PARK = (1790, 940)

CHAIN = ['augusta-victoria', 'boat-train', 'express-paris', 'victoria', 'canal-boat',
         'aden-mail', 'colombo-mail', 'penang-mail', 'singapore-mail', 'oceanic-hk',
         'oceanic-pacific', 'overland-limited', 'world-special']
STOP_AFTER = {
    1: ['augusta-victoria'],
    2: ['boat-train', 'express-paris'],
    3: ['victoria', 'canal-boat'],
    4: ['aden-mail', 'colombo-mail', 'penang-mail', 'singapore-mail'],
    5: ['oceanic-hk', 'oceanic-pacific', 'overland-limited'],
}
PORT_AFTER = {1: 'southampton', 2: 'brindisi', 3: 'aden', 4: 'hongkong', 5: 'chicago'}


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#options .dep')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.mouse.move(*PARK)
    assert_state(page, 'hoboken')


def state(page):
    return page.evaluate('EightyApp.getState()')


def assert_state(page, port, elapsed=None):
    current = state(page)
    assert current['port'] == port, (current['port'], port)
    assert current['mode'] == 'idle' or (port == 'hoboken' and elapsed is None), current['mode']
    assert page.locator('#port-name').inner_text() == page.evaluate(
        'id => EightyDays.PORTS[id].name', port)
    assert page.locator('#home-clock').inner_text() == page.evaluate(
        'id => { const s = EightyApp.getState(); return EightyDays.formatShort(s.time, -5); }')
    if elapsed is not None:
        assert abs(current['elapsed'] - elapsed) < 1e-6
    return current


def assert_framing(page):
    # Test the longest subtitle too, not just a conveniently short caption.
    page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', max(sum(SUBTITLE_LINES, []), key=len))
    caption = page.locator('#video-caption').bounding_box()
    for selector in ['#map', '.map-panel', '.sidebar', '.footnotes']:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 44 and box['y'] + box['height'] < caption['y'] - 10, (selector, box, caption)
        assert 0 <= box['x'] and box['x'] + box['width'] <= WIDTH
    assert caption['width'] < WIDTH - 40


def actions(page, scene, click):
    """Only real UI input moves the trip; evaluations above are read-only."""
    # Scene 4 packs four connections into one silent gap; shorter cursor
    # moves keep the whole sequence inside it.
    move = 0.33 if scene == 4 else 0.45
    for leg_id in STOP_AFTER.get(scene, []):
        click(f'.dep[data-leg="{leg_id}"][data-index="0"]', move=move)
        base.set_cursor(page, PARK)
    if scene == 6:
        click('.dep[data-leg="world-special"][data-index="0"]')
        base.set_cursor(page, PARK)
        assert state(page)['finished']
        assert 'A perfect run' in page.locator('#modal-title').inner_text()
        assert page.locator('#modal-big').inner_text() == '72d 6h 11m'
        return
    assert_state(page, PORT_AFTER[scene])
    if scene == 5:
        log = page.locator('#log').inner_text()
        assert '180th meridian crossed' in log, log


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
        # Reduced motion commits each leg instantly, so every scene lands on
        # a deterministic port before its narration starts.
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT},
                                device_scale_factor=1, reduced_motion='reduce')
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

        def click(selector, fraction=(0.5, 0.5), move=0.45):
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
            for i in range(round(move * FPS)):
                u = (i + 1) / round(move * FPS)
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
            if scene < 6:
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
    """Offline stills and UI assertions only: never reads keys or calls TTS."""
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT},
                                device_scale_factor=1, reduced_motion='reduce')
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
        for scene in range(1, 6):
            actions(page, scene, click)
            save(f'stop-{PORT_AFTER[scene]}', scene)
        actions(page, 6, click)
        save('finish', 5)
        assert not errors, errors
        browser.close()
    print('Offline previews and assertions passed:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
