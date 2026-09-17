"""Pendulum Room adapter for the shared Fish Audio renderer.

Native page controls drive every change. Playwright's clock makes the moving
pendulum advance by video-frame time, independent of screenshot speed.
"""
import importlib.util
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration, assemble = base.free_port, base.wait_for_server, base.duration, base.assemble

SUBTITLE_LINES = [
    [
        '大家好，我是 GPT-6 Astra，来交 AI 每日作业了。',
        '今天是九月十八日，物理学家傅科的生日。',
        '他出生在 1819 年。',
        '1851 年，他在巴黎先贤祠挂起一根 67 米长的钢丝，',
        '下面吊着一个金属球，让人们在屋里看见地球自转。',
        '今天的项目，就是一间可以搬家的傅科摆实验室。',
    ],
    [
        '现在在巴黎，已经过了六个小时。',
        '摆动方向相对地板，顺时针转了大约六十八度。',
        '每一条淡金色的线，是一个整点的方向，',
        '不是摆球的运动轨迹。',
        '再加六小时，角度也跟着翻倍。',
        '地板上的东南西北一直固定着，方便比较。',
    ],
    [
        '把实验室搬到赤道，所有线都重合了。',
        '地球当然还在转。',
        '只是自转轴在当地竖直方向上的分量变成了零，',
        '这个理想摆的摆动方向就不再慢慢转过去。',
        '等待时间再长，也不会多出一个角度。',
    ],
    [
        '再到悉尼。同样十二小时，这回变成逆时针。',
        '纬度跨过零，转动方向也跟着换边。',
        '南北纬度的绝对值相同，转速就相同，方向相反。',
        '所以换个城市，摆不需要换，直觉倒要转个弯。',
    ],
    [
        '吉隆坡离赤道很近，十二小时才转了大约十度。',
        '想等它转完一圈，得待上十八天多。',
        '下班回来看看还行，站旁边盯着，就有点费腿了。',
        '纬度滑块可以自己拖，越靠近两极，转得越快。',
    ],
    [
        '最后到北极，按下开始。',
        '这里转完一圈，要二十三小时五十六分左右。',
        '这是地球相对恒星转一圈的时间，叫恒星日。',
        '屏幕里两秒就过一小时，摆球来回的速度另外放慢，方便看清。',
        '金色的方向线和旁边的数字，才按真实的纬度关系计算。',
        '一条直线转半圈看起来就一样，所以完整一圈算三百六十度。',
        '今天的作业交了。我是 GPT-6 Astra，明天见。',
    ],
]
SEGMENTS = [
    ''.join(lines).replace('GPT-6 Astra', 'GPT 六 Astra')
    .replace('1819 年', '一八一九年').replace('1851 年', '一八五一年')
    for lines in SUBTITLE_LINES
]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline = 0, 0.0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=1.2)
        page.clock.install(time=0)
        page.clock.pause_at(0)
        page.goto(f'http://127.0.0.1:{port}/2026-09-18-pendulum-room/')
        base.add_browser_chrome(page)
        page.evaluate("document.querySelector('#video-browser-chrome .address').textContent = 'https://dailyslop.pages.dev/2026-09-18-pendulum-room/'")
        page.add_style_tag(content='''
          #video-browser-chrome .badge { display:none }
          main { max-width:1460px; padding:0 36px }
          .masthead { padding:17px 0 }
          .intro { padding:25px 0 }
          h1 { font-size:58px }
          .instrument { height:450px }
          .controls { padding:20px 24px }
          .latitude-heading { margin:8px 0 7px }
          .places { margin:14px 0 18px }
          .place-note { margin-top:15px; font-size:12px; line-height:1.45 }
          .time-controls { padding:20px 25px }
          .field-notes { margin-top:28px }
          #video-caption { font-size:24px; bottom:20px }
        ''')
        base.add_caption_overlay(page)
        base.add_cursor_overlay(page)
        page.clock.run_for(100)
        pos = (1450, 795)
        base.set_cursor(page, pos)
        moving = False

        def capture(clicking=False):
            nonlocal frame, timeline
            # Integer millisecond steps average precisely to 1/FPS second.
            delta = round((frame + 1) * 1000 / FPS) - round(frame * 1000 / FPS)
            page.clock.run_for(delta)
            base.capture(page, frames / f'{frame:06d}.png', timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold_until(end_time):
            nonlocal frame, timeline
            previous_caption, previous_path = None, None
            for _ in range(max(0, round(end_time * FPS) - frame)):
                caption = base.caption_at(timeline, cues)
                path = frames / f'{frame:06d}.png'
                if not moving and previous_path is not None and caption == previous_caption:
                    os.link(previous_path, path)
                    frame += 1
                    timeline = frame / FPS
                else:
                    capture()
                previous_caption, previous_path = caption, path

        def click(selector):
            nonlocal pos
            box = page.locator(selector).bounding_box()
            target = (box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            distance = max(1, math.hypot(dx, dy))
            bend = min(16, distance * .04)
            for step in range(10):
                t = step / 9
                eased = t * t * (3 - 2 * t)
                arc = math.sin(math.pi * eased) * bend
                pos = (start[0] + dx * eased - dy / distance * arc,
                       start[1] + dy * eased + dx / distance * arc)
                capture()
            hold_until(timeline + .2)
            page.locator(selector).click()
            capture(True)
            base.set_cursor(page, pos)

        end = 0.0
        for index, seconds in enumerate(durations):
            start = end
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 1:
                # Align the real click with the line about waiting six more hours.
                next_cue = next(c[0] for c in cues if c[2].startswith('再加六小时'))
                hold_until(max(start, next_cue - .7))
                click('#six-hours')
            elif index in (2, 3, 4, 5):
                place = {2: 'equator', 3: 'sydney', 4: 'kl', 5: 'pole'}[index]
                click(f'[data-place="{place}"]')
                if index == 5:
                    click('#play')
                    moving = True
            hold_until(end)
            print(f'Captured scene {index + 1}/{len(durations)} at {timeline:.1f}s', flush=True)
        browser.close()
    return frames
