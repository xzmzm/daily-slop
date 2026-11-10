"""Sound Ranging capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-11-sound-ranging/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 1.8, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 Gemini-3.8 Flash，来交 AI 每日作业了。',
     '今天是 11 月 11 日。1918 年的今天上午 11 点，',
     '西线停战协定生效，一战枪炮停息。'],
    ['战壕对面的重炮藏在掩体后，肉眼看不见，但声音藏不住。',
     '二十五岁的诺贝尔奖得主威廉·劳伦斯·布拉格，',
     '在西线带队研发了声测定位技术。'],
    ['沿四公里基线排开五个塔克热线麦克风，',
     '专测重炮的低频炮口波。',
     '检流计把五个通道的电信号投在照相纸带上，',
     '音叉在纸带上打出精密时间刻度。'],
    ['点一下开炮，声波向前扩散。',
     '相邻麦克风接收声波的时间差乘上声速，',
     '在地图上画出一条双曲线，多条双曲线交汇，锁定敌军炮位。'],
    ['但声速受气温和风向影响。切到阿拉斯强风模式，',
     '每秒 14 米的东风让声波漂移，',
     '不加修正时算出来的炮位漂了一百四十多米。'],
    ['打开布拉格大气修正，把风速矢量和气温补偿进去，',
     '双曲线立刻重新交汇，定位误差缩小到一米以内。'],
    ['切到 11 点停战时刻。',
     '纸带前段记录着持续炮击的波峰，',
     '十一整点一过，五条记录线同时被拉直成平线，战争结束了。'],
    ['从热线白金丝到双曲线交汇，百年物理测量都在这块测绘图上。',
     '今天作业交完，明天见。'],
]

SPOKEN = {
    'Gemini-3.8 Flash': 'Gemini 三点八 Flash',
    '11 月 11 日': '十一月十一日',
    '1918 年': '一九一八年',
    '11 点': '十一点',
    '14 米': '十四米',
    '一米以内': '一米以内',
}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body { padding: 12px 24px; }
  .page { max-width: 1840px; gap: 10px; }
  .masthead { padding-bottom: 4px; }
  .intro { margin-top: -2px; }
  .intro .tagline { font-size: 14px; max-width: 1400px; }
  .workbench { grid-template-columns: minmax(0, 1.7fr) 390px; gap: 14px; }
  .map-panel { padding: 12px; gap: 8px; }
  #map-canvas { height: 420px !important; aspect-ratio: auto; }
  .tape-section { padding: 10px 14px; gap: 6px; }
  #tape-canvas { height: 115px !important; aspect-ratio: auto; }
  .tape-table-wrapper { display: none; }
  .field-notes, .footer { display: none; }
  #video-caption { font-size: 28px; max-width: 1780px; bottom: 16px; }
"""
PARK = (1850, 980)


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#map-canvas')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['#map-canvas', '#tape-canvas', '.control-panel', '.preset-group']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 6, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, PARK, 0
    cache_key, last_frame = None, None
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[5][0])
        assert_framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline, cache_key, last_frame
            key = (revision, base.caption_at(timeline, cues), pos, clicking)
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
            bend = min(18, distance * 0.04)
            control = ((start[0] + target[0]) / 2 - dy / distance * bend,
                       (start[1] + target[1]) / 2 + dx / distance * bend)
            count = round(0.55 * FPS)
            for i in range(count):
                u = (i + 1) / count
                u = u * u * (3 - 2 * u)
                v = 1 - u
                pos = (v*v*start[0] + 2*v*u*control[0] + u*u*target[0],
                       v*v*start[1] + 2*v*u*control[1] + u*u*target[1])
                page.mouse.move(*pos)
                snap()
            hold(0.18)

        def click(selector):
            nonlocal revision
            box = page.locator(selector).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 80, (selector, box)
            move((box['x'] + box['width'] / 2, box['y'] + box['height'] / 2))
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            hold(0.25)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)

            if index == 0:
                # Scene 1: Introduction
                hold(seconds * 0.5)
            elif index == 1:
                # Scene 2: The challenge & Bragg
                hold(seconds * 0.4)
                move((400, 360)) # Hover near battlefield
                hold(0.4)
                move(PARK)
            elif index == 2:
                # Scene 3: Tucker mic & tape
                hold(seconds * 0.3)
                move((640, 680)) # Glance at tape
                hold(0.5)
                move(PARK)
            elif index == 3:
                # Scene 4: Fire Battery & hyperbola intersection
                hold(seconds * 0.2)
                click('#fire-btn')
                assert page.evaluate('SoundRanging.state.isAnimating') is True
                hold(1.2)
                move((580, 240)) # Move towards intersection fix
                hold(0.4)
                move(PARK)
            elif index == 4:
                # Scene 5: Switch to Crosswind preset (without correction)
                hold(seconds * 0.2)
                click('.preset-btn[data-preset="crosswind"]')
                assert page.evaluate('SoundRanging.state.preset') == 'crosswind'
                assert page.evaluate('SoundRanging.state.correctionEnabled') is False
                hold(0.8)
                move((1650, 480)) # Move towards error dist banner
                hold(0.5)
                move(PARK)
            elif index == 5:
                # Scene 6: Turn Bragg Atmospheric Correction ON
                hold(seconds * 0.2)
                click('label.switch')
                assert page.evaluate('SoundRanging.state.correctionEnabled') is True
                hold(0.8)
                move((1650, 480)) # Error drops to 0.0m
                hold(0.5)
                move(PARK)
            elif index == 6:
                # Scene 7: Armistice Day 11:00 AM preset
                hold(seconds * 0.2)
                click('.preset-btn[data-preset="armistice"]')
                assert page.evaluate('SoundRanging.state.isArmistice') is True
                hold(0.8)
                move((640, 680)) # Glance at the flat silent traces
                hold(0.6)
                move(PARK)
            elif index == 7:
                # Scene 8: Conclusion
                hold(seconds * 0.5)

            hold(end - timeline)
            assert timeline <= end + 0.3, (index, timeline, end)
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[5][0])
        assert_framing(page)
        page.screenshot(path=str(output / 'start.png'))

        page.locator('#fire-btn').click()
        page.screenshot(path=str(output / 'fired.png'))

        page.locator('.preset-btn[data-preset="crosswind"]').click()
        page.screenshot(path=str(output / 'crosswind.png'))

        page.locator('.preset-btn[data-preset="armistice"]').click()
        page.screenshot(path=str(output / 'armistice.png'))
        browser.close()
    print('Video framing previews saved to:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
