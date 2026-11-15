"""Twenty-Three Wide adapter for the shared cattery/Fish pipeline."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-16-twenty-three-wide/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 3.2, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3 Flash，来交 AI 每日作业了。',
     '今天是 11 月 16 日。一九七四年的今晚，阿雷西博望远镜对准武仙座星团 M13，',
     '发出人类第一封主动的星际电报：1,679 个比特，每秒 10 个，功率 450 千瓦。',
     '页面上就是那串真实的比特，一格不假。'],
    ['左边纸带按 73 个一断，是信号落地的原始样子，看着全是雪。',
     '右边格子还是这条带子，换成 73 个一排铺开——仍然不成画。',
     '秘密在 1,679 本身：它只能写成 23 乘 73，两个都是质数，矩形天生只有两种摆法。'],
    ['换成 23 个一排，画自己站了出来：数字、元素、核苷酸、双螺旋、小人、太阳系、天线。',
     '73 个一排是噪声，23 个一排是信。外星同行拿到带子，也得先猜中这个宽度。',
     '猜得中猜不中，就看他们把 1,679 写成矩形的手气。'],
    ['颜色是后人涂的，电波里只有明暗。点亮标准配色，单独看 human 这一段。',
     '小人左边横着 1110：14 乘 126 毫米，一米七六四，当年美国男性的平均身高。',
     '右边 4,292,853,750，是一九七四年的人口。整封电报拿波长当尺子，落地不用换算。',
     '中间两列还藏着 43 亿对碱基，当年的估计；如今实测是三十二亿。'],
    ['02 号卡片把笔递给你：按下 LIFT THE PEN，再点小人头顶，添一顶帽子。',
     '比特从 0 翻成 1，画变了，格子还是 1,679 个——矩形拆不坏，这是半素数的脾气。',
     '点一下还原，一九七四年的比特原样回来。'],
    ['电波出碟：1 比特，载频抬 10 赫兹；0 比特，落回去，每秒 10 个。',
     '167.9 秒发完，就这一次，从不重播。',
     '此刻前沿已经跑出五万公里。往后的路，光要自己走两万五千年。'],
    ['跳到抵达：公元 26,974 年前后，波前到达 M13 一九七四年的位置。',
     '星团这些年挪了窝，好在核心够宽，大部分光束仍然接得住。',
     '真有谁架起 306 米的锅对准武仙座，听到的就是这 1,679 个比特。',
     '今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines)
            .replace('GLM-5.3 Flash', 'GLM 五点三 Flash')
            .replace('11 月 16 日', '十一月十六日')
            .replace('1110', '一一一〇')
            .replace('4,292,853,750', '四十二亿九千二百八十五万')
            .replace('M13', 'M 十三')
            .replace('1,679', '一千六百七十九')
            .replace('167.9', '一百六十七点九')
            .replace('26,974 年', '二六九七四年')
            .replace('306 米', '三百零六米')
            for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
  body { overflow: hidden; }
  .page { max-width: 1760px; padding: 10px 36px; }
  .masthead { padding-bottom: 9px; }
  .intro { padding: 11px 0 13px; }
  h1 { font-size: 52px; }
  .lede { font-size: 13.5px; margin-right: 0; }
  .workbench { grid-template-columns: minmax(0,1fr) 400px; gap: 16px; align-items: start; }
  .stage { padding: 11px 16px; }
  .panel-heading { margin-bottom: 8px; }
  .stage-row { grid-template-columns: 548px minmax(0,1fr); gap: 14px; }
  #feed { font-size: 11px; line-height: 1.5; }
  .canvas-holder { min-height: 519px; }
  .feed-note { margin-top: 6px; font-size: 9.5px; }
  .legend { margin-top: 5px; }
  .tx-panel { padding: 9px 16px; margin-top: 11px; gap: 16px; }
  .tx-panel .eyebrow { margin-bottom: 6px; }
  #run { padding: 9px 14px; }
  .tx-stats strong { font-size: 19px; }
  .tx-status p { font-size: 10.5px; margin-bottom: 5px; }
  .sidebar { gap: 11px; }
  .card { padding: 11px 15px; }
  .card p:not(.eyebrow) { margin-bottom: 7px; font-size: 11px; }
  .card-lede { margin: 0 0 6px !important; }
  .slider-row { margin-bottom: 7px; }
  .slider-row strong { font-size: 18px; }
  .chip { padding: 5px 9px; }
  .pick { padding-top: 6px; margin-top: 6px; }
  .pick .head strong { font-size: 11px; }
  .pick .blurb { font-size: 9px; }
  #colorize { padding: 6px; }
  .stats { margin-top: 9px; padding-top: 9px; gap: 9px; }
  .stats strong { font-size: 19px; }
  #detail { display: none; }
  .hint { font-size: 9px !important; margin: 7px 0 0 !important; }
  #reset { margin-top: 7px; }
  .footnotes { margin-top: 10px; padding-top: 9px; font-size: 9px; line-height: 1.5; }
  #video-caption { font-size: 26px; max-width: 1780px; bottom: 14px; }
"""
PARK = (1856, 996)

# State the screen must be in while each scene's narration plays. The loop
# clicks AFTER narration N, so narration N+1 narrates actions(N)'s result.
STATE_AFTER = {
    1: dict(stride=73, phase='idle', colorize=False, section=None),
    2: dict(stride=23, phase='idle', colorize=False, section=None),
    3: dict(stride=23, colorize=True, section=4, paint=False, edited=False, ones=397),
    4: dict(stride=23, colorize=True, paint=True, edited=False, ones=397, section=4),
    5: dict(phase='flight', sent=1679, colorize=True, paint=True),
    6: dict(phase='arrived', sent=1679),
    7: dict(phase='arrived', sent=1679),
}


def assert_state(page, expected):
    page.wait_for_function('Arecibo.getState().phase !== "sending"', timeout=20000)
    s = page.evaluate('Arecibo.getState()')
    for key, value in expected.items():
        assert s[key] == value, (key, value, s)
    return s


def assert_framing(page):
    # Test the longest subtitle too, not just a conveniently short caption.
    page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', max(sum(SUBTITLE_LINES, []), key=len))
    caption = page.locator('#video-caption').bounding_box()
    for selector in ['#feed', '.canvas-holder', '.tx-panel', '.sidebar', '.footnotes']:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 44 and box['y'] + box['height'] < caption['y'] - 10, (selector, box, caption)
        assert 0 <= box['x'] and box['x'] + box['width'] <= WIDTH
    assert caption['width'] < WIDTH - 40


def cell_target(page, row, col):
    box = page.locator('#grid').bounding_box()
    geo = page.evaluate('Arecibo._geom()')
    return (box['x'] + geo['pad'] + (col + 0.5) * geo['cell'],
            box['y'] + geo['pad'] + (row + 0.5) * geo['cell'])


def actions(page, scene, click):
    """Only real UI input moves the demo; evaluations above are read-only.
    Clicks land in the gap after narration `scene - 1`, so the state asserted
    here is what narration `scene` plays over (see STATE_AFTER)."""
    if scene == 1:
        click('.snap[data-stride="73"]')
        assert_state(page, STATE_AFTER[1])
    elif scene == 2:
        click('.snap[data-stride="23"]')
        assert_state(page, STATE_AFTER[2])
    elif scene == 3:
        click('#colorize')
        click('.pick[data-key="human"] button')
        assert_state(page, STATE_AFTER[3])
    elif scene == 4:
        click('#paint')
        click(cell_target(page, 44, 10))   # a white hat pixel, one cell above the head
        assert_state(page, dict(ones=398, edited=True))
        click('#reset')
        assert_state(page, STATE_AFTER[4])
    elif scene == 5:
        click('#run')
        assert_state(page, STATE_AFTER[5])
    elif scene == 6:
        click('#skip')
        assert_state(page, STATE_AFTER[6])
    elif scene == 7:
        assert_state(page, STATE_AFTER[7])  # closing tail: nothing left to click


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#grid')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.mouse.move(*PARK)
    assert_state(page, dict(stride=23, phase='idle', colorize=False, paint=False,
                            edited=False, sent=0, ones=397))  # scene 1 plays over the default plate


def capture_frames(work_dir, durations, port):
    assert len(durations) == len(SEGMENTS) == 7
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, revision, pos = 0, 0, PARK
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Reduced motion commits the transmit instantly, so every scene lands on
        # a deterministic app state before its narration starts.
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

        def click(target, fraction=(0.5, 0.5), move=0.4):
            nonlocal pos, revision
            if isinstance(target, str):
                box = page.locator(target).bounding_box()
                assert box and box['y'] + box['height'] < HEIGHT - 90, (target, box)
                dest = (box['x'] + box['width'] * fraction[0], box['y'] + box['height'] * fraction[1])
            else:
                dest = target
            start = pos
            dx, dy = dest[0] - start[0], dest[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(16, distance * 0.04)
            control = ((start[0] + dest[0]) / 2 - dy / distance * bend,
                       (start[1] + dest[1]) / 2 + dx / distance * bend)
            for i in range(round(move * FPS)):
                u = (i + 1) / round(move * FPS)
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*dest[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*dest[1])
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
            gap_end = start + seconds + (SILENCE_BETWEEN if scene < 6 else SILENCE_TAIL)
            if scene < 7:
                actions(page, scene + 1, click)
            assert now() <= gap_end, ('actions exceeded silent gap', scene, now(), gap_end)
            until(gap_end)
            start = gap_end
            print(f'Captured scene {scene + 1}/7 at {now():.1f}s', flush=True)
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

        def click(target, fraction=(0.5, 0.5)):
            if isinstance(target, str):
                box = page.locator(target).bounding_box()
                dest = (box['x'] + box['width'] * fraction[0], box['y'] + box['height'] * fraction[1])
            else:
                dest = target
            page.mouse.click(*dest)
            base.set_cursor(page, dest)

        def save(name, scene):
            assert_framing(page)
            page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[scene][0])
            page.screenshot(path=str(output / f'{name}.png'))

        save('start', 0)
        for scene in range(1, 7):
            actions(page, scene, click)
            save(f'stop-{scene}', scene)
        assert not errors, errors
        browser.close()
    print('Offline previews and assertions passed:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
