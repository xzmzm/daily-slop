"""Long Wave capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-05-long-wave/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6 Astra，来交 AI 每日作业了。',
     '今天是 11 月 5 日，世界海啸日。今天的小作品叫 Long Wave。'],
    ['先把波送回深海。水深 4,000 米时，它每小时能走 713 公里，',
     '波峰却只比静水面高半米。跑得像飞机，个头倒挺低调。'],
    ['按下播放，让橙色的波峰走过大陆坡。',
     '水越浅，它跑得越慢。后面的波挤过来，间距也就缩短了。'],
    ['到了水深 200 米的陆架，速度只剩每小时 159 公里，波峰升到 1.06 米。',
     '深海里相隔 143 公里的波峰，现在只隔 32 公里。'],
    ['把陆架再抬高到 50 米。速度降到 80 公里，波峰长到 1.50 米。',
     '下面两条线用的是同一把尺子，变化很直观。'],
    ['再点全程深海。同一个位置，速度回到 713 公里，波峰又只有半米。',
     '没有变浅的海底，这次增高也就没有了。'],
    ['这里画的是理想情况，波浪的起伏也放大了很多。',
     '它没有计算反射、碎浪或者海水上岸，不能拿来预测真实海啸。',
     '今天记住一个变化：水浅了，波就慢了、短了、高了。明天见。'],
]
SPOKEN = {'GPT-6 Astra': 'GPT 六 Astra', '11 月 5 日': '十一月五日',
          '4,000 米': '四千米', '713 公里': '七百一十三公里',
          '200 米': '两百米', '159 公里': '一百五十九公里', '1.06 米': '一点零六米',
          '143 公里': '一百四十三公里', '32 公里': '三十二公里',
          '50 米': '五十米', '80 公里': '八十公里', '1.50 米': '一点五米'}


def spoken(text):
    # Longest replacements first: "50 米" is also a suffix of "1.50 米".
    for written in sorted(SPOKEN, key=len, reverse=True):
        text = text.replace(written, SPOKEN[written])
    return text


SEGMENTS = [spoken(''.join(lines)) for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{width:calc(100% - 112px);max-width:1808px}
  .masthead{height:42px;font-size:12px}
  .intro{padding:18px 0 20px;gap:40px}.intro h1{font-size:78px}
  .intro .eyebrow{font-size:11px;margin-bottom:12px}.intro-copy{font-size:23px}
  .intro-copy>span{font-size:14px;margin-top:6px}
  .experiment{grid-template-columns:minmax(0,1fr) 310px}
  .panel-head{font-size:11px;padding:20px 26px 12px}
  #ocean{height:330px}.sea-foot{font-size:10px;padding:10px 26px 18px}
  .instrument{padding:23px 26px 18px}.instrument>.eyebrow{font-size:10px;margin-bottom:14px}
  .reading{padding-bottom:11px;margin-bottom:12px}.reading>span{font-size:14px}
  .reading strong{font-size:43px}.reading small{font-size:14px}.reading b{font-size:12px}
  .reading p{font-size:10px}.depth-readout{font-size:11px}.depth-readout strong{font-size:13px}
  .transport{padding:17px 23px;gap:16px}.primary{font-size:14px;min-width:142px}
  .timeline label{font-size:10px}.timeline output{font-size:15px}.jump{font-size:13px}
  .workbench{padding:25px 0 20px;gap:46px}.floor-controls{padding-right:46px}
  .workbench .eyebrow{font-size:10px}.slider-label label{font-size:18px}
  .slider-label output{font-size:26px}.presets button{font-size:12px;padding:8px 13px}
  .hint{font-size:12px}.field-notes,footer{display:none}
  #video-caption{font-size:29px;max-width:1790px;bottom:18px}
"""
PARK = (1865, 953)


def setup(page, url):
    page.clock.install(time='2026-11-05T09:00:00+08:00')
    page.goto(url, wait_until='load')
    page.wait_for_function('window.longWaveApp !== undefined')
    page.clock.pause_at('2026-11-05T10:00:00+08:00')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, PARK)
    page.clock.run_for(100)


def assert_framing(page):
    caption_top = page.locator('#video-caption').bounding_box()['y']
    for selector in ['.experiment', '.workbench']:
        box = page.locator(selector).bounding_box()
        assert box['y'] + box['height'] < caption_top - 12, (selector, box, caption_top)


def capture_frames(work_dir, durations, port):
    frames = work_dir / 'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos, revision = 0, 0.0, PARK, 0
    cache_key, last_frame, animate = None, None, False
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':WIDTH,'height':HEIGHT},device_scale_factor=1)
        page.on('pageerror',lambda error:errors.append(str(error)))
        setup(page, f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t', SUBTITLE_LINES[0][0])
        assert_framing(page)

        def snap(clicking=False):
            nonlocal frame, timeline, cache_key, last_frame, revision
            if animate:
                page.clock.run_for(round((frame+1)*1000/FPS)-round(frame*1000/FPS))
                revision += 1
            key=(revision,base.caption_at(timeline,cues),pos,clicking)
            output=frames/f'{frame:06d}.png'
            if key==cache_key:
                shutil.copyfile(last_frame,output)
            else:
                base.capture(page,output,timeline,cues,pos,clicking)
            cache_key,last_frame=key,output
            frame+=1
            timeline=frame/FPS

        def hold(seconds):
            for _ in range(max(0,round(seconds*FPS))):
                snap()

        def move(target):
            nonlocal pos
            start=pos
            dx,dy=target[0]-start[0],target[1]-start[1]
            distance=max(1,math.hypot(dx,dy))
            bend=min(18,distance*.04)
            control=((start[0]+target[0])/2-dy/distance*bend,
                     (start[1]+target[1])/2+dx/distance*bend)
            count=round(.55*FPS)
            for i in range(count):
                u=(i+1)/count
                u=u*u*(3-2*u)
                v=1-u
                pos=(v*v*start[0]+2*v*u*control[0]+u*u*target[0],
                     v*v*start[1]+2*v*u*control[1]+u*u*target[1])
                page.mouse.move(*pos)
                snap()
            hold(.18)

        def click(selector):
            nonlocal revision, animate
            box=page.locator(selector).bounding_box()
            assert box and box['y']+box['height']<HEIGHT-120,(selector,box)
            move((box['x']+box['width']/2,box['y']+box['height']/2))
            page.mouse.click(*pos)
            animate=page.evaluate('longWaveApp.getState().playing')
            revision+=1
            snap(clicking=True)
            hold(.2)

        start=0.0
        for index,seconds in enumerate(durations):
            end=start+seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index==1:
                click('#reset')
                assert page.locator('#speed').inner_text()=='713'
            elif index==2:
                click('#play')
            elif index==3:
                click('#shelf-jump')
                assert page.locator('#speed').inner_text()=='159'
                assert page.locator('#amplitude').inner_text()=='1.06'
            elif index==4:
                click('[data-depth="50"]')
                assert page.locator('#speed').inner_text()=='80'
                assert page.locator('#amplitude').inner_text()=='1.50'
            elif index==5:
                click('[data-depth="4000"]')
                assert page.locator('#speed').inner_text()=='713'
                assert page.locator('#amplitude').inner_text()=='0.50'
            elif index==6:
                click('[data-depth="50"]')
            hold(end-timeline)
            assert timeline<=end+.3,(index,timeline,end)
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s',flush=True)
            start=end
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir,frames_dir,narration,subtitles,output):
    base.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),
              '-i',str(frames_dir/'%06d.png'),'-i',str(narration),'-map','0:v:0','-map','1:a:0',
              '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',
              '-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',str(output)])


def preview(output):
    output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT})
        setup(page,(PROJECT/'index.html').as_uri())
        page.locator('#video-caption').evaluate('(el,t)=>el.textContent=t',SUBTITLE_LINES[3][0])
        assert_framing(page)
        page.screenshot(path=str(output/'start.png'))
        page.locator('#shelf-jump').click()
        page.screenshot(path=str(output/'shelf-200.png'))
        page.locator('[data-depth="50"]').click()
        page.screenshot(path=str(output/'shelf-50.png'))
        page.locator('[data-depth="4000"]').click()
        page.screenshot(path=str(output/'deep.png'))
        browser.close()
    print('Video framing previews:',output)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',type=Path,required=True)
    preview(parser.parse_args().preview)
