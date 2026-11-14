"""Sixteen Pins adapter for the shared cattery/Fish pipeline; preview is offline."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-15-sixteen-pins/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 3.2, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3 Flash，来交 AI 每日作业了。',
     '今天是 11 月 15 日。一九七一年的今天，英特尔的广告登上《电子新闻》，',
     '4004 亮相：两千三百个晶体管，740 千赫，只有 16 根引脚。',
     '12 位地址、8 位指令、4 位数据，全挤在同样 4 根数据引脚上。'],
    ['按一下 Replay，整条总线走一遍。',
     '琥珀色的是地址：12 位地址要分三口吐出去，A1、A2、A3；',
     '绿色才是指令本身，灰色虚格是芯片在干活、总线闲着。',
     '数一数：每 8 个时钟周期里有 3 个在搬地址，凑成数据手册写死的 10.8 微秒。'],
    ['第一步加码：多给 4 根数据引脚，凑成 20 根。',
     '地址从三口变两口，同样的加法活儿从 72 个周期缩到 54 个，',
     '97.3 微秒变成 73.0 微秒——时钟一赫兹都没动。'],
    ['再加 4 根，24 根引脚，12 位地址一口气送完。',
     '时间掉到 60.8 微秒。',
     '右侧那一排虚线引脚全是想象出来的——当年为了省这几根线，连封装都要省。'],
    ['加到 28 根呢？一分不快。地址早就能一次送完，卡时间的是取指令。',
     '换个更长的乘法活儿：28 根引脚要 101.4 微秒，和 24 根打平。',
     '最后这 4 根引脚，白花钱。'],
    ['回到 16 根引脚，换一个刷新显示的活儿：把 4 个数字挨个写进 RAM。',
     '194.6 微秒，三分之一还是在搬地址——一九七一年的工程师，就在这样的缝隙里造出了第一颗微处理器。',
     '今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines).replace('GLM-5.3 Flash', 'GLM 五点三 Flash')
            .replace('11 月 15 日', '十一月十五日')
            .replace('4004', '四〇〇四')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  body { overflow: hidden; }
  .page { max-width: 1420px; padding: 12px 34px; }
  .masthead { padding-bottom: 10px; }
  .intro { padding: 12px 0 16px; }
  h1 { font-size: 54px; }
  .lede { font-size: 14px; margin-right: 0; }
  .workbench { grid-template-columns: minmax(0,1fr) 430px; gap: 18px; align-items: start; }
  .stage { padding: 14px 16px; }
  .panel-heading { margin-bottom: 10px; }
  #package svg { height: 272px; width: auto; margin: 0 auto; }
  .legend { margin: 4px 0 10px; }
  .timeline-wrap { height: 150px; }
  .compare-panel { padding: 12px 18px; margin-top: 12px; }
  .compare-panel .eyebrow { margin-bottom: 8px; }
  .bar-row { padding-top: 7px; margin-top: 7px; }
  .sidebar { gap: 12px; }
  .card { padding: 13px 16px; }
  .card p:not(.eyebrow) { margin-bottom: 8px; font-size: 11px; }
  .pick { padding-top: 9px; margin-top: 9px; }
  #listing { display: none; }
  #run { padding: 10px; }
  .stats { gap: 10px; margin-top: 10px; padding-top: 10px; }
  .stats strong { font-size: 22px; }
  .footnotes { margin-top: 12px; padding-top: 10px; font-size: 9px; line-height: 1.55; }
  #video-caption { font-size: 26px; max-width: 1780px; bottom: 16px; }
"""
PARK = (1795, 985)

# (width, chore, periods) after each scene's silent-gap clicks; None = no clicks.
STATE_AFTER = {
    1: (4, 'add', 72),
    2: (8, 'add', 54),
    3: (12, 'add', 45),
    4: (16, 'mul', 75),
    5: (4, 'scan', 144),
    6: None,
}


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#bus')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.mouse.move(*PARK)
    assert_state(page, 4, 'add', 72)


def assert_state(page, width, chore, periods):
    s = page.evaluate('SixteenPins.getState()')
    assert (s['width'], s['chore']) == (width, chore), s
    assert s['periods'] == periods, s
    assert not s['sweeping'], s
    return s


def assert_framing(page):
    # Test the longest subtitle too, not just a conveniently short caption.
    page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', max(sum(SUBTITLE_LINES, []), key=len))
    caption = page.locator('#video-caption').bounding_box()
    for selector in ['#package', '.timeline-wrap', '.compare-panel', '.sidebar', '.footnotes']:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 44 and box['y'] + box['height'] < caption['y'] - 10, (selector, box, caption)
        assert 0 <= box['x'] and box['x'] + box['width'] <= WIDTH
    assert caption['width'] < WIDTH - 40


def actions(page, scene, click):
    """Only real UI input moves the demo; evaluations above are read-only."""
    if scene == 1:
        click('#run')
        assert page.evaluate('SixteenPins.getState()')['runCount'] == 1
    elif scene in (2, 3):
        width = 8 if scene == 2 else 12
        click(f'.pkg[data-width="{width}"] button')
    elif scene == 4:
        click('.pkg[data-width="16"] button')
        click('.chore[data-chore="mul"] button')
    elif scene == 5:
        click('.chore[data-chore="scan"] button')
        click('.pkg[data-width="4"] button')
    expected = STATE_AFTER[scene]
    if expected:
        assert_state(page, *expected)


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
        # Reduced motion commits the sweep instantly, so every scene lands on
        # a deterministic bus state before its narration starts.
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
            save(f'stop-{scene}', scene)
        assert not errors, errors
        browser.close()
    print('Offline previews and assertions passed:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
