"""Set Point capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-09-set-point/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 Claude Opus 5.5，来交 AI 每日作业了。',
     '今天是 11 月 9 日。1965 年的今天傍晚，',
     '美国东北部和加拿大安大略一起停了电。'],
    ['尼亚加拉的 Beck 电站有五条 230 千伏线路通往多伦多。',
     '其中一条的后备继电器，1963 年被设在 375 兆瓦跳闸，',
     '值班的人并不知道这个数。'],
    ['现在是下午 5 点 16 分 10 秒。1 号线带着 356 兆瓦，',
     '离设定值只差 19 兆瓦。'],
    ['5 点 16 分 11 秒，多伦多的用电往上晃了 100 兆瓦。',
     '1 号线到了 376，只超出不到 1 兆瓦，继电器跳了。'],
    ['它的电全挤到剩下四条线上：460、610、911、1812，',
     '两秒多五条全断。多伦多自己只发 300 兆瓦，先黑了。'],
    ['尼亚加拉的电送不出去，全往东涌，',
     '去锡拉丘兹和罗切斯特的线也被压断。',
     '纽约和新英格兰缺电，频率崩溃，这块板上 2820 万人停电。'],
    ['把设定改成 500 兆瓦，再跑一次。',
     '同样晃 100 兆瓦，1 号线 376，继电器不动，灯都亮着。'],
    ['线路和电厂是简化的教学模型，375 和 356 是真实的数。',
     '事后安大略水电把五个继电器的设定都调高了。明天见。'],
]
SPOKEN = {
    'Claude Opus 5.5': 'Claude Opus 五点五', '1965 年': '一九六五年', '1963 年': '一九六三年',
    '11 月 9 日': '十一月九日', '5 点 16 分 10 秒': '五点十六分十秒', '5 点 16 分 11 秒': '五点十六分十一秒',
    '230 千伏': '二百三十千伏', '1 号线': '一号线', '2820 万人': '两千八百二十万人',
    '460、610、911、1812': '四百六、六百一、九百一十一、一千八百一十二',
}


def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{width:calc(100% - 100px);max-width:1820px}
  .masthead{height:40px}
  .intro{padding:12px 0 12px;gap:44px}
  .intro h1{font-size:54px}.eyebrow{margin-bottom:6px}
  .intro-copy{max-width:1150px;font-size:18px}.intro-copy span{display:none}
  .bench{grid-template-columns:1210px minmax(0,1fr)}
  .panel-head{padding:10px 0 8px}
  .legend{padding:8px 0 8px}
  .desk{padding:12px 0 0 28px;gap:12px}
  .log-wrap{min-height:0}
  #log{font-size:13px}
  .field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1740px;bottom:20px}
"""
PARK = (1840, 945)


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('.bus')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    page.evaluate('SetPointApp.state.manual = true')
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['#board', '.readouts', '#run', '.presets']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 8, (selector, box, caption_top)


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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[5][2])
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
            nonlocal revision
            box = page.locator(selector).bounding_box()
            assert box and box['y'] + box['height'] < HEIGHT - 115, (selector, box)
            move((box['x'] + box['width'] / 2, box['y'] + box['height'] / 2))
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            hold(.25)

        def step(count=1):
            nonlocal revision
            for _ in range(count):
                assert page.evaluate('SetPointApp.state.next ? SetPointApp.state.next() : false') is not None
                revision += 1

        def steps_until(end_time, count):
            # spread `count` cascade steps evenly over the time left
            gap = max(.4, (end_time - timeline - .6) / count)
            for _ in range(count):
                hold(gap)
                step()
                snap()

        def trips():
            return page.locator('#r-trips').inner_text()

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                assert 'L1 356 MW' in page.locator('#board').text_content()
            elif index == 3:
                hold(seconds * .25)
                click('#run')
                assert page.locator('#r-peak').inner_text() == '376 MW'
                hold(max(.5, end - timeline - 1.0))
                step()                      # line 1 opens
                assert trips() == '1', trips()
            elif index == 4:
                steps_until(start + seconds * .62, 4)   # lines 2–5
                assert trips() == '5', trips()
                hold(max(.3, start + seconds * .8 - timeline))
                step()                      # Toronto dark
                assert page.locator('#r-dark').inner_text() == '3.0 M'
            elif index == 5:
                steps_until(start + seconds * .55, 2)   # south + Rochester lines
                hold(max(.3, start + seconds * .7 - timeline))
                step()                      # the east collapses
                assert page.locator('#r-dark').inner_text() == '28.2 M'
                assert page.evaluate('SetPointApp.state.next') is None
            elif index == 6:
                hold(.4)
                click('[data-set="500"]')
                hold(.8)
                click('#run')
                assert trips() == '0' and 'The relays hold' in page.locator('#log').inner_text()
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
        page.locator('#run').click()
        page.evaluate('for (let i = 0; i < 6; i++) SetPointApp.state.next()')
        page.screenshot(path=str(output / 'toronto-dark.png'))
        page.evaluate('while (SetPointApp.state.next && SetPointApp.state.next());')
        page.screenshot(path=str(output / 'east-dark.png'))
        browser.close()
    print('Video framing previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
