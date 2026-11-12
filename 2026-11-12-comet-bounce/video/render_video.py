"""Comet Bounce capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-12-comet-bounce/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 1.8, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 Gemini-3.8 Flash，来交 AI 每日作业了。',
     '今天是 11 月 12 日。2014 年的今天，',
     '菲莱着陆器降落在 67P 彗星上，结果落地之后又弹了起来。'],
    ['这颗彗星长得像只橡皮鸭，质量大约一百亿吨。',
     '表面重力只有地球的几万分之一。',
     '在这里用力蹬一下，可比在地球上跳远刺激多了。'],
    ['菲莱原本靠冷气喷管压住自己，再用两枚鱼叉固定。',
     '但喷管无法工作，鱼叉也没有发射。',
     '落地不算完，能不能留在地上才是问题。'],
    ['点一下播放。真实任务中，菲莱以大约每秒 1 米触地，',
     '又以大约每秒 0.38 米弹起，第一段反弹飞行持续了近两小时。',
     '这里用简化的二维模型演示反弹，不是原始航迹复原。'],
    ['画面里的轨迹会受双叶引力和自转影响，几次碰撞后停止。',
     '真实菲莱最后停在阿比多斯的阴影里，日照远少于计划。',
     '它依靠电池完成了约六十小时的工作，随后进入休眠。'],
    ['换成固定成功的方案。',
     '模型把喷管和鱼叉都设为有效，第一次碰撞就固定下来。',
     '它只是理想化对照，不代表真实硬件能保证百分之百成功。'],
    ['再换成高速反弹。',
     '更快的到达速度，加上更有弹性的碰撞，可能让探测器离开彗星。',
     '逃逸没有统一的速度门槛，出发位置和方向都很重要。'],
    ['你还可以调整回弹系数，或在空白处投放自己的探测器。',
     '在地球上落稳是基本功，在彗星上却得专门设计。',
     '今天作业交完，明天见。'],
]
SPOKEN = {
    'Gemini-3.8 Flash': 'Gemini 三点八 Flash',
    '11 月 12 日': '十一月十二日',
    '2014 年': '二零一四年',
    '67P': '六七 P',
    '0.38 米': '零点三八米',
    '1 米': '一米',
}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt
RECORDING_CSS = """
  body { padding: 10px 24px; }
  .page { max-width: 1840px; gap: 8px; }
  .masthead { padding-bottom: 2px; }
  .masthead .tagline { font-size: 14px; max-width: 1400px; }
  .workbench { grid-template-columns: minmax(0, 1.85fr) 420px; gap: 14px; }
  .viewport-card { padding: 10px; gap: 8px; }
  .canvas-container { aspect-ratio: auto; height: 560px !important; }
  #sim-canvas { height: 560px !important; }
  .control-panel { gap: 10px; }
  .telemetry-grid { gap: 6px; }
  .metric-card { padding: 6px 8px; }
  .metric-value { font-size: 16px; }
  .panel-section { padding: 8px 12px; gap: 6px; }
  .preset-buttons { gap: 4px; }
  .preset-btn { padding: 6px 8px; }
  .preset-name { font-size: 12px; }
  .preset-desc { font-size: 10px; }
  .hardware-section { display: none; }
  #civa-canvas { height: 100px !important; }
  .field-notes { display: none; }
  #video-caption { font-size: 28px; max-width: 1780px; bottom: 16px; }
"""
PARK = (1850, 980)


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('#sim-canvas')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.clock.install()


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['#sim-canvas', '.control-panel', '.scrubber-bar']:
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[3][2])
        assert_framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline, cache_key, last_frame
            key = (revision, base.caption_at(timeline, cues), pos, clicking)
            output = frames / f'{frame:06d}.png'
            if key == cache_key:
                os.link(last_frame, output)
            else:
                page.clock.run_for(20)
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
            for i in range(round(0.55 * FPS)):
                u = (i + 1) / round(0.55 * FPS)
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
            page.evaluate('CometApp.pause()')
            revision += 1
            snap(clicking=True)
            hold(0.25)
            move(PARK)

        def fly(seconds, simulated_seconds):
            nonlocal revision
            count = max(1, round(seconds * FPS))
            for _ in range(count):
                page.evaluate('(dt)=>CometApp.step(dt)', simulated_seconds / count)
                revision += 1
                snap()

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 3:
                click('#btn-play')
                fly(max(1, end - timeline - 1), 2800)
            elif index == 4:
                fly(min(8, seconds * 0.5), 3500)
                assert page.evaluate('CometApp.getSim().status') == 'settled'
            elif index == 5:
                click('.preset-btn[data-preset="nominal"]')
                fly(3, 340)
                assert page.evaluate('CometApp.getSim().status') == 'anchored'
            elif index == 6:
                click('.preset-btn[data-preset="escape"]')
                fly(max(1, end - timeline - 1), 7200)
                assert page.evaluate('CometApp.getSim().status') == 'escaped'
            elif index == 7:
                click('.preset-btn[data-preset="historical"]')
                fly(min(7, seconds * 0.5), 6100)
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[3][2])
        assert_framing(page)
        for name, preset, seconds in [('start', 'historical', 0), ('bounce', 'historical', 2800),
                                      ('rest', 'historical', 6100), ('nominal', 'nominal', 340),
                                      ('escape', 'escape', 7200)]:
            page.locator(f'.preset-btn[data-preset="{preset}"]').click()
            page.evaluate('(dt)=>CometApp.step(dt)', seconds)
            page.clock.run_for(30)
            page.screenshot(path=str(output / f'{name}.png'))
        browser.close()
    print('Video framing previews saved to:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
