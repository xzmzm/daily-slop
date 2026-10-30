"""Ghost Light capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-10-31-ghost-light/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.1 Terra，来交 AI 每日作业了。',
     '今天是十月三十一日，万圣节，给大家开一家幽灵剧院。'],
    ['这个幽灵不是站在台上的人，而是躲在下面的演员。',
     '舞台前面斜着一块透明玻璃，观众透过它看见房间。'],
    ['演员的光打在玻璃上，反射进观众眼里。',
     '眼睛把光线往后延长，就看见了房间里的幽灵。'],
    ['演员的灯一关，幽灵就消失了，房间还在。'],
    ['灯重新亮起来，幽灵又回来了，身后的家具仍然看得见。'],
    ['如果舞台太亮，淡淡的倒影就很难看清。',
     '灯光师可不是随便按开关的。'],
    ['这个戏法叫佩珀尔幽灵，1862 年就在伦敦上演了。',
     '一个多世纪过去，吓人的还是一块玻璃。万圣节快乐，明天见。'],
]
SPOKEN = {'GPT-6.1 Terra': 'GPT 六点一 Terra', '1862 年': '一八六二年'}

def spoken(text):
    for written, said in SPOKEN.items():
        text = text.replace(written, said)
    return text

SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = '''
  .page{max-width:1760px;padding:0 42px}
  .masthead{height:34px}.intro{padding:16px 0 18px}
  h1{font-size:78px}.intro-copy{font-size:16px}
  .workbench{grid-template-columns:minmax(0,1.7fr) minmax(440px,.9fr)}
  .theatre{max-height:550px}.diagram{max-height:205px}
  .stage-wrap{padding-top:8px}.controls{padding-top:14px}
  .story,footer{display:none}
  .ghost,.stage-darkness,.ray,.ray-virtual,.diagram-ghost{transition:none!important}
  #video-caption{font-size:29px;max-width:1700px;bottom:22px}
'''
PARK = (1830, 885)


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.ghostLight')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.workbench', '.stage-panel', '.control-panel']:
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[0][0])
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
            count = round(.6 * FPS)
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
            move((box['x'] + box['width']/2, box['y'] + box['height']/2))
            page.mouse.click(*pos)
            revision += 1
            snap(clicking=True)
            hold(.25)

        start = 0.0
        for index, seconds in enumerate(durations):
            end = start + seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 3:
                hold(.25)
                click('[data-cue="vanish"]')
                assert page.locator('#hidden-value').inner_text() == '0%'
            elif index == 4:
                hold(.25)
                click('[data-cue="appear"]')
                assert page.locator('#hidden-value').inner_text() == '85%'
            elif index == 5:
                hold(.25)
                click('[data-cue="wash"]')
                assert page.locator('#stage-value').inner_text() == '100%'
            elif index == 6:
                hold(.25)
                click('[data-cue="appear"]')
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
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[0][0])
        assert_framing(page)
        page.screenshot(path=str(output / 'appear.png'))
        page.locator('[data-cue="vanish"]').click()
        page.screenshot(path=str(output / 'vanish.png'))
        browser.close()
    print('Video framing previews:', output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
