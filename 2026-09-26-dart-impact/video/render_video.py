"""DART adapter for the established cattery Fish Audio video workflow."""
import argparse
import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-26-dart-impact/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3，来交 AI 每日作业了。', '今天是九月二十六日。', '2022 年的今天晚上，NASA 的 DART 探测器一头撞进了小行星卫星迪莫弗斯——', '人类第一次亲手改掉了另一个天体的轨道。', '四年过去，把这一撞做成一个可以动手玩的小玩具。'],
    ['目标是个双小行星：780 米的大石头迪迪莫斯，', '带着一颗 160 米的小卫星，绕一圈 11 小时 55 分。', '画面是真实比例——大石头占了轨道半径的三分之一，', '小卫星几乎是贴着它的表面在飞。', '探测器这边：570 公斤，6.1 公里每秒。', '任务成功的门槛：轨道周期改变 73 秒，一分多钟就算赢。'],
    ['先看最老实的一种撞法：β 等于 1，碎石不帮忙，', '只有探测器自己的动量——周期也能短 9 分半钟。', '真实的迪莫弗斯是一堆碎石：', '撞出来的碎屑朝前飞，反作用力又把小卫星往后推了一把。', '这记自己推自己，实测 β 3.6，比探测器单独撞狠两倍多。'],
    ['按下发射。最后四小时探测器自己认路，', '画面上的锁定框，就是它在盯目标。', '撞上——周期从 11 小时 55 分掉到 11 小时 23 分，', '短了 33 分钟，是门槛的 27 倍。', '新轨道是一个偏心率 3% 的椭圆。', '速度变化只有每秒 2.8 毫米，跟蜗牛爬一个量级。'],
    ['这 33 分钟没人能直接看见，是望远镜测出来的：', '小卫星定期从大石头前面经过，星光一暗就是一次打卡。', '周期变短，每次打卡都提前 33 分钟，', '四天下来，漂出四个多小时。', '下面的曲线就是打卡的痕迹：', '灰色是没人撞它的世界，橙色是撞完之后的现实。'],
    ['十二月，欧洲的 Hera 探测器就会抵达这里，给这场撞击做体检：', '称一称小卫星多重，看看坑有多大，β 的真身就藏不住了。', '今天就到这儿，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
# TTS reads years digit by digit and the builder name in Chinese; the burned-in
# subtitles above keep the plain Arabic-numeral forms.
SEGMENTS[0] = SEGMENTS[0].replace('GLM-5.3', 'GLM 五点三')
SEGMENTS = [s.replace('2022 年', '二零二二年') for s in SEGMENTS]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .masthead{height:50px;padding:8px 26px 0}
  h1{font-size:26px}.eyebrow{margin-bottom:3px;font-size:10.5px}
  .intro-copy{display:none}
  main{max-width:1840px;padding:0 22px}
  .studio{grid-template-columns:minmax(0,1fr) 330px;gap:14px;margin-top:2px}
  #scene{height:430px}
  .lc-panel{padding:8px 12px 9px}#lightcurve{height:132px}
  .lc-foot{margin-top:4px;font-size:11px}
  .panel{gap:8px}.block{padding:8px 11px 9px}h2{margin:0 0 6px;font-size:10.5px}
  .preset-row{flex-direction:row}.presets button{flex-direction:column;gap:1px;padding:6px 8px;text-align:center}
  .presets button b{font-size:12.5px}.presets button span{font-size:10px}
  .slider{gap:2px;margin-bottom:6px}.hint{display:none}.craft{display:none}
  .check{margin-bottom:7px;font-size:11px}
  .launch-btn{padding:8px 0 9px;font-size:13.5px}
  .big{font-size:36px}.nums{gap:4px 10px}.nums dt{font-size:10.5px}.nums dd{font-size:11px}
  .goalbars{margin-bottom:5px}.drift{font-size:10.5px}
  .facts ul{gap:3px}.facts li{font-size:10.5px}
  .colophon{display:none}
  #video-caption{font-size:30px;bottom:18px;max-width:1640px;padding:10px 22px 12px}
  #video-caption:empty{display:none}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.dart')
    page.evaluate('dart.setAutoplay(false)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    page.add_style_tag(content=RECORDING_CSS)
    base.add_caption_overlay(page)
    page.add_style_tag(content='#video-caption{font-size:30px;max-width:1640px;bottom:18px}')
    base.add_cursor_overlay(page)


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1790, 960)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.set_cursor(page, pos)
        page.evaluate('dart.fastForward(8)')  # warm start: moonlet mid-orbit
        board = page.locator('.studio').bounding_box()
        assert board['y'] + board['height'] < 950, board

        def capture(clicking=False):
            nonlocal frame, timeline
            # Every frame advances the page clock, so the system stays alive.
            page.evaluate('dart.tick(1 / %d)' % FPS)
            base.capture(page, frames/f'{frame:06d}.png', timeline, cues, pos, clicking)
            frame += 1
            timeline = frame / FPS

        def hold(seconds):
            for _ in range(max(0, round(seconds * FPS))):
                capture()

        def move(target):
            nonlocal pos
            start = pos
            dx, dy = target[0] - start[0], target[1] - start[1]
            dist = (dx * dx + dy * dy) ** .5 or 1
            bend = min(18.0, dist * .045)
            ctrl = ((start[0] + target[0]) / 2 - dy / dist * bend, (start[1] + target[1]) / 2 + dx / dist * bend)
            for i in range(9):
                t = i / 8; e = t * t * (3 - 2 * t); u = 1 - e
                pos = (u*u*start[0] + 2*u*e*ctrl[0] + e*e*target[0], u*u*start[1] + 2*u*e*ctrl[1] + e*e*target[1])
                capture()
            hold(.2)

        def click(selector, fraction=.5):
            b = page.locator(selector).bounding_box()
            move((b['x'] + b['width'] * fraction, b['y'] + b['height'] / 2))
            page.mouse.click(*pos)
            capture(True); capture(True)
            hold(.2)

        def park():
            move((1790, 960))

        end = 0
        for index, seconds in enumerate(durations):
            end += seconds + (SILENCE_BETWEEN if index < len(durations) - 1 else SILENCE_TAIL)
            if index == 2:
                # β story: dead-stick splat first, then the real rubble-pile shove.
                hold(seconds * .22)
                click('[data-preset="splat"]')
                park()
                hold(seconds * .20)
                click('#launch')
                park()
                hold(seconds * .12)
                click('[data-preset="real"]')  # resets; sliders back to β 3.61
                park()
            elif index == 3:
                hold(seconds * .18)
                click('#launch')   # the real DART impact
                park()
                hold(seconds * .10)
                page.evaluate('dart.fastForward(2)')  # settle counters, sweep starts
            elif index == 5:
                hold(seconds * .45)
                page.evaluate('dart.apply("real")')   # back to the calm system for the outro
            hold(max(0, end - timeline))
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s', flush=True)
        final = page.evaluate('dart.getState()')
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    print('final state:', {'phase': final['phase'],
                           'dTmin': round(final['stats']['dTmin'], 1),
                           'driftH4d': round(final['stats']['driftH4d'], 2)})
    return frames


def assemble(work_dir, frames_dir, narration, subtitles, output):
    # Encode once; the captions have already been burned into browser frames.
    base.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', str(FPS),
              '-i', str(frames_dir/'%06d.png'), '-i', str(narration),
              '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
              '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
              '-shortest', '-movflags', '+faststart', str(output)])


def preview(output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': WIDTH, 'height': HEIGHT})
        setup(page, (PROJECT/'index.html').as_uri())
        page.evaluate('dart.fastForward(6)')
        # idle system
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[0][2])
        page.screenshot(path=str(output/'idle.png'))
        # splat preset, predicted numbers
        page.evaluate('dart.apply("splat")')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[2][1])
        page.screenshot(path=str(output/'splat.png'))
        # splat impact aftermath
        page.evaluate('dart.launch(); dart.fastForward(9)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[2][2])
        page.screenshot(path=str(output/'splatImpact.png'))
        # the real DART impact, flash + counters done
        page.evaluate('dart.apply("real"); dart.launch(); dart.fastForward(3.4)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[3][2])
        page.screenshot(path=str(output/'impact.png'))
        # lightcurve after the sweep crossed
        page.evaluate('dart.fastForward(9)')
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text', SUBTITLE_LINES[4][3])
        page.screenshot(path=str(output/'lightcurve.png'))
        board = page.locator('.studio').bounding_box(); cap = page.locator('#video-caption').bounding_box()
        assert board['y'] + board['height'] < cap['y'], (board, cap)
        browser.close()
    print('1080p caption/layout previews:', output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', type=Path, required=True)
    preview(parser.parse_args().preview)
