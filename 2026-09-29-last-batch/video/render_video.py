"""Last Batch adapter for the established cattery Fish Audio renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-29-last-batch/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6 Astra，来交 AI 每日作业了。', '今天是九月二十九日，国际粮食损失和浪费问题宣传日。', '今天开了一家小面包店，叫 Last Batch。', '面包烤多了剩下，烤少了客人白跑，店还没开就开始纠结。'],
    ['先来一群老顾客，平均每天 24 人，人数变化不大。', '每个面包卖 3 块，烤一个花 1 块。', '先烤 24 个，开店一个月。绿色的卖掉了，留下的还是面包。', '点开任意一天，就能看到那天来了多少人，又剩下多少。'],
    ['换成旁边的办公室。', '居家的日子冷清，坐班的日子排队。', '平均依然是 24 人，直方图却分成了两座山。', '客人可不会照着平均数来排队。'],
    ['这种客流下，平均利润最高的批量是 33 个。', '多做一个要花 1 块，卖出去能收 3 块。', '只要卖掉它的机会超过三分之一，就还值得往烤盘里加。', '不过，利润最高，照样会剩下不少面包。'],
    ['再换一种，平时冷清，偶尔爆满。', '平均还是 24，推荐却降到了 19。', '三种客流，25、33、19，平均值一个也没告诉你。', '统计学写得再漂亮，面包也不会自己卖完。'],
    ['把成本往上推，推荐的数量还会往下走。', '改批量再开店，这 30 天的顾客都不变，比较才公平。', '偶尔一个月赚得多，也不代表每个月都能这么走运。', '今天的面包出炉了，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace('GPT-6 Astra', 'GPT 六 Astra')
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{padding-bottom:140px}
  .masthead,main{max-width:1500px;margin-left:auto;margin-right:auto}
  .masthead{padding:14px 0 12px}.intro{padding:18px 0 20px;gap:40px}
  h1{font-size:70px}.intro-copy{font-size:16px;margin:7px 0 0}.eyebrow{margin-bottom:8px}
  .stamp{width:85px;height:85px;font-size:9px}.bakery{grid-template-columns:285px minmax(0,1fr);gap:36px}
  .controls,.workbench{padding-top:20px}.controls{padding-right:27px}
  .controls h2{margin-bottom:13px}.forecast-choices{gap:3px}.forecast-choices button{padding-top:9px;padding-bottom:9px;min-height:52px}
  .batch-control{margin-top:14px;padding-top:14px}.quantity-line{margin:3px 0 4px}.quantity-line output{font-size:53px}
  .cost-control{margin-top:15px;padding-top:15px}.cost-control p{margin-bottom:15px}.run-button{padding:12px 13px}
  .month-controls{margin-top:8px}.replay-note{margin-top:5px}.forecast-heading h2{font-size:28px}
  #forecast-description{margin:8px 0 6px}#forecast-chart{height:98px}.distribution{margin-bottom:13px}
  .tray{padding-top:8px}.tray canvas{height:161px;object-fit:contain}.tray-edge{padding:4px 0 8px}
  .legend{margin:12px 0 16px}.days{margin:10px 0 12px}.day{height:44px}
  .metrics{padding:10px 0}.metrics strong{font-size:31px;margin:3px 0}.answer-section{margin-top:8px}
  #answer{padding:14px 21px;margin-top:4px}.answer-top strong{font-size:31px}.answer-top p>span{margin-bottom:5px}
  #answer-reason{margin-top:10px;margin-bottom:5px;font-size:14px;max-width:none;line-height:1.5}
  .answer-foot{font-size:12px;margin-top:5px}footer{margin-top:19px;padding:14px 0}
  #video-caption{font-size:30px;bottom:19px;max-width:1640px;padding:10px 22px 12px}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.lastBatch')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text',URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)


def fit_answer(page):
    # Scroll the real page just enough to keep the answer clear of the captions.
    bottom = page.locator('#answer').bounding_box()
    distance = max(0,bottom['y']+bottom['height']-962)
    if distance:page.evaluate('(distance)=>window.scrollBy(0,distance)',distance)


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0., (1770,939)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':WIDTH,'height':HEIGHT},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        # Pause the browser's timer; advance the actual app by exactly one video
        # frame while opening the bakery. Capture speed cannot change the month.
        moment = datetime(2026,9,29,6,0,tzinfo=timezone.utc)
        page.clock.install(time=moment)
        page.clock.pause_at(moment)
        setup(page,f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.set_cursor(page,pos)

        def capture(clicking=False):
            nonlocal frame,timeline
            base.capture(page,frames/f'{frame:06d}.png',timeline,cues,pos,clicking)
            frame += 1
            timeline = frame/FPS

        def hold(seconds):
            nonlocal frame,timeline
            previous_caption,previous_path = None,None
            for _ in range(max(0,round(seconds*FPS))):
                moving = page.evaluate('lastBatch.getState().running')
                if moving:page.clock.run_for(round((frame+1)*1000/FPS)-round(frame*1000/FPS))
                caption = base.caption_at(timeline,cues)
                path = frames/f'{frame:06d}.png'
                if previous_path is not None and caption == previous_caption and not moving:
                    os.link(previous_path,path)
                    frame += 1;timeline = frame/FPS
                else:capture()
                previous_caption,previous_path = caption,path

        def click(selector):
            nonlocal frame,timeline,pos
            box = page.locator(selector).bounding_box()
            target = (box['x']+box['width']/2,box['y']+box['height']/2)
            frame,timeline = base.write_move(page,frames,frame,8,timeline,cues,pos,target)
            pos=target;hold(.18)
            page.mouse.click(*pos);capture(True);hold(.2)

        end = 0
        for index,seconds in enumerate(durations):
            end += seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index == 1:
                hold(seconds*.32);click('#run');hold(3)
                click('[data-day="13"]')
            elif index == 2:
                click('[data-forecast="split"]');hold(seconds*.45);click('#run');hold(3)
            elif index == 3:
                click('#reveal');fit_answer(page);hold(seconds*.50)
                click('#use-best');click('#run');hold(3)
            elif index == 4:
                click('[data-forecast="spike"]');hold(seconds*.35)
                click('#use-best');hold(seconds*.18);click('#run');hold(3)
            elif index == 5:
                click('#cost');page.locator('#cost').press('End');capture();hold(seconds*.24)
                click('#use-best');click('#run');hold(3)
            hold(max(0,end-timeline))
            if index:assert page.evaluate('lastBatch.getState().revealed') == 30
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s',flush=True)
        browser.close()
    if errors:raise RuntimeError(str(errors))
    return frames


def assemble(work_dir,frames_dir,narration,subtitles,output):
    base.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),
              '-i',str(frames_dir/'%06d.png'),'-i',str(narration),
              '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium',
              '-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k',
              '-shortest','-movflags','+faststart',str(output)])


def preview(output):
    output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT},reduced_motion='reduce')
        setup(page,(PROJECT/'index.html').as_uri())
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text',SUBTITLE_LINES[0][0])
        page.screenshot(path=str(output/'opening.png'))
        assert page.locator('#run').bounding_box()['y'] < 900
        for forecast in ['split','spike']:
            page.locator(f'[data-forecast="{forecast}"]').click()
            if page.locator('#answer').is_hidden():page.locator('#reveal').click()
            page.locator('#use-best').click();page.locator('#run').click()
            fit_answer(page)
            page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text',SUBTITLE_LINES[4][2])
            box=page.locator('#answer').bounding_box();caption=page.locator('#video-caption').bounding_box()
            assert box['y']+box['height'] < caption['y'], (box,caption)
            page.screenshot(path=str(output/f'{forecast}.png'))
        browser.close()
    print('Video framing previews:',output)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',type=Path,required=True)
    preview(parser.parse_args().preview)
