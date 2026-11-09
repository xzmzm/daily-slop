"""No Overlap capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-10-no-overlap/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 1.8, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3 Flash，来交 AI 每日作业了。',
     '今天是 11 月 10 日。1983 年的今天，微软在纽约广场饭店',
     '宣布给 MS-DOS 配一个图形外壳，名字叫 Windows。'],
    ['这套系统有条出名的规矩：窗口不许重叠。',
     '屏幕像地砖一样切开，每个程序一块，谁也压不住谁。',
     '不是不爱重叠，是内存太小，机器扛不住剪裁和重绘。'],
    ['点一下 Clock 的标题栏，它就成了当前窗口，',
     '拿走左上角最大的那块砖，其余窗口立刻让位。',
     '再点一块，桌面又重新铺满，一块空砖都不剩。'],
    ['中间这条缝叫 sash。拖它一下，左列变窄，右列跟着变宽，',
     '所有窗口一起挪，还是谁也压不住谁。'],
    ['标题栏右边这对箭头是 Zoom：当前窗口铺满整块桌面，',
     '其余四个缩到底部一排图标里。',
     '点一下图标，桌面又铺回来。'],
    ['一九八七年 Windows 2.0 才放开这条规矩。',
     '切到 1987 模式，窗口随便漂，压住的全标了红框。',
     '把 MS-DOS Executive 拖到日历上，压在一起的对子更多了。'],
    ['切回 1983，所有窗口各回各的砖位，计数归零。',
     '这套系统拖了两年才上市：1985 年 11 月 20 日发售，',
     '定价 99 美元。'],
    ['窗口、砖位和那条不许重叠的规矩，都在这块桌面上。',
     '今天作业交完，明天见。'],
]
SPOKEN = {
    'GLM-5.3 Flash': 'GLM 五点三 Flash', '11 月 10 日': '十一月十日',
    '1983': '一九八三', '1985 年 11 月 20 日': '一九八五年十一月二十日',
    '1987': '一九八七', 'Windows 2.0': 'Windows 二点零', '99 美元': '九十九美元',
}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{max-width:1840px;padding:0 40px}
  .masthead{padding:12px 0 10px}
  .intro{padding:16px 0 14px;gap:40px}
  .intro .eyebrow{margin-bottom:6px}
  h1{font-size:50px}
  .intro-copy{max-width:1420px;font-size:18px}.intro-copy span{display:none}
  .bench{grid-template-columns:minmax(0,1fr) 400px;gap:16px}
  #tiles{height:600px !important;aspect-ratio:auto}
  .clock-face b{font-size:34px}
  .readouts{grid-template-columns:1fr 1fr}
  #log{font-size:12px}
  .field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1800px;bottom:18px}
"""
PARK = (1856, 1006)


def setup(page, url):
    page.clock.install(time='1983-11-10T18:00:00')
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('.win')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['#screen', '#mode-overlap', '#log', '.legend']:
        box = page.locator(selector).bounding_box()
        assert 44 < box['y'] and box['y'] + box['height'] < caption_top - 8, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, version = 0, 0.0, PARK, 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[5][2])
        assert_framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline, cache_key, last_frame
            key = (version, base.caption_at(timeline, cues), pos, clicking)
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                shutil.copyfile(last_frame, output)
            else:
                base.capture(page, output, timeline, cues, pos, clicking)
            cache_key, last_frame = key, output
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                snap()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(18, distance * .04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            count = round(.55 * FPS)
            for i in range(count):
                u = (i + 1) / count
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap()
            hold(.18)

        def click(selector):
            nonlocal version
            box = page.locator(selector).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 100, (selector, box)
            move((box['x'] + box['width'] / 2, box['y'] + box['height'] / 2))
            page.mouse.click(*pos)
            version += 1
            snap(clicking=True)
            hold(.3)

        def drag(selector_from, to_xy, steps=10, grab_u=0.5):
            nonlocal version, pos
            box = page.locator(selector_from).bounding_box()
            assert box, selector_from
            grab = (box['x'] + min(box['width'] / 2, 140), box['y'] + box['height'] * grab_u)
            move(grab)
            page.mouse.down()
            sx, sy = grab
            for i in range(steps):
                u = (i + 1) / steps
                u = u * u * (3 - 2 * u)
                pos = (sx + (to_xy[0] - sx) * u, sy + (to_xy[1] - sy) * u)
                page.mouse.move(*pos)
                version += 1
                snap()
            page.mouse.up()
            version += 1
            snap(clicking=True)
            hold(.35)

        def current_id():
            return page.evaluate('NoOverlap.state.currentId')

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                hold(seconds * .2)
                click('#win-clock .title-name')
                assert current_id() == 'clock'
                hold(.4)
                click('#win-notepad .title-name')
                assert current_id() == 'notepad'
            elif index == 3:
                hold(seconds * .25)
                sash = page.locator('.sash[data-kind="main-col"]').bounding_box()
                tiles = page.locator('#tiles').bounding_box()
                grab_y = sash['y'] + sash['height'] * .35
                drag('.sash[data-kind="main-col"]', (sash['x'] - 130, grab_y), steps=10, grab_u=.35)
                assert abs(page.evaluate('NoOverlap.state.colFrac') - (sash['x'] - 130 - tiles['x']) / tiles['width']) < .02
                hold(.4)
            elif index == 4:
                hold(seconds * .22)
                cur = current_id()
                click(f'#win-{cur} .zoom-btn')
                assert page.evaluate('NoOverlap.state.zoomed') is True
                assert page.locator('.iconified').count() == 4
                hold(max(.4, start + seconds * .62 - timeline))
                click('.iconified[data-id="clock"]')
                assert page.evaluate('NoOverlap.state.zoomed') is False
            elif index == 5:
                hold(.3)
                click('#mode-overlap')
                assert page.evaluate('NoOverlap.api.pairs().count') >= 2
                hold(max(.5, start + seconds * .45 - timeline))
                cal = page.locator('#win-calendar').bounding_box()
                target = (cal['x'] + cal['width'] / 2, cal['y'] + cal['height'] / 2)
                before = page.evaluate('NoOverlap.api.pairs().count')
                drag('#win-dos .title', target, steps=12)
                after = page.evaluate('NoOverlap.api.pairs().count')
                assert after > before, (before, after)
                assert page.locator('.win.clash').count() >= 2
            elif index == 6:
                hold(.3)
                click('#mode-tile')
                assert page.evaluate('NoOverlap.api.pairs().count') == 0
                assert page.evaluate('NoOverlap.model.disjoint(NoOverlap.api.rects())') is True
            hold(end - timeline)
            assert timeline <= end + .3, (index, timeline, end)
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
            start = end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir / '%06d.png'), '-i', str(narration), '-map', '0:v:0', '-map', '1:a:0',
              '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(output)])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT / 'index.html').as_uri())
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[5][2])
        assert_framing(page)
        page.screenshot(path=str(output / 'start.png'))
        page.evaluate('NoOverlap.api.makeCurrent("clock")')
        page.locator('#win-notepad .title-name').click()
        page.screenshot(path=str(output / 'retiled.png'))
        page.locator('#mode-overlap').click()
        page.wait_for_timeout(250)
        page.screenshot(path=str(output / 'overlap.png'))
        browser.close()
    print('Video framing previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
