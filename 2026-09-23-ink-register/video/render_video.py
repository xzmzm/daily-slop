"""Ink Register adapter for the established cattery Fish Audio video workflow."""
import argparse
import importlib.util
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-23-ink-register/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6 Astra，来交 AI 每日作业了。', '今天是九月二十三日。', '今天做了间小印刷工坊，叫 Ink Register。'],
    ['翻到任天堂的早期历史，才想起它一开始做的是花札。', '1889 年，山内房治郎在京都开始制作这些纸牌。', '今天借这个由头，玩一下两种颜色的套印。'],
    ['绿色一张版，橙色一张版。', '单独看，各画各的。', '叠在一起，中间就多出了一种深色。', '第三种颜色，省下一桶墨。'],
    ['拖动纸上的橙色，太阳就开始离家出走。', '右边还能转动它。', '边上的小十字也跟着错开了，', '印刷时就靠它们检查两张版有没有对齐。'],
    ['换成蓝色和粉色，再种一朵花。', '花和叶子稍微错开，倒也挺精神。', '按一下随机偏移，每次都有点不同。', '手抖这件事，总算有了用武之地。'],
    ['复位一下，两张版的十字就对上了。', '关掉标记，保留纸纹。', '点一下出图，就能存成一张 PNG。', '今天这张小版画，算是印好了。明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace('GPT-6 Astra', 'GPT 六 Astra')
SEGMENTS[1] = SEGMENTS[1].replace('1889 年', '一八八九年')
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .masthead{height:62px;margin:0 8%}main{width:84%;max-width:1500px}
  .intro{padding:24px 0 25px}h1{font-size:52px}.eyebrow{margin-bottom:10px}
  .workshop{grid-template-columns:minmax(0,1fr) 340px;gap:36px}
  .controls{padding-top:2px}.control-section{padding-bottom:17px;margin-bottom:17px}
  .control-section h2{margin-bottom:13px}.design svg{height:54px}
  .range-label{margin-top:12px}.finishing{margin-bottom:18px}
  .mat{height:641px;min-height:0;padding:24px 46px 34px}.bench-bar{height:51px}
  .primary{padding:17px 18px}.colophon{padding-top:13px}
  #video-caption{font-size:30px;bottom:20px;max-width:1500px;padding:10px 22px 12px}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.inkRegister')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text',URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    page.add_style_tag(content=RECORDING_CSS)
    base.add_caption_overlay(page)
    page.add_style_tag(content='#video-caption{font-size:30px;max-width:1500px;bottom:20px}')
    base.add_cursor_overlay(page)


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0.0, (1745,934)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':WIDTH,'height':HEIGHT},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        setup(page,f'http://127.0.0.1:{port}/{PROJECT.name}/')
        # Keep the example accident reproducible without changing app behavior.
        page.evaluate('Math.random = InkCore.seeded(923)')
        base.set_cursor(page,pos)
        assert page.locator('.workshop').bounding_box()['y'] + page.locator('.workshop').bounding_box()['height'] < 975

        def capture(clicking=False):
            nonlocal frame,timeline
            base.capture(page,frames/f'{frame:06d}.png',timeline,cues,pos,clicking)
            frame += 1
            timeline = frame/FPS

        def hold(seconds):
            nonlocal frame,timeline
            previous_caption,previous_path = None,None
            for _ in range(max(0,round(seconds*FPS))):
                caption = base.caption_at(timeline,cues)
                path = frames/f'{frame:06d}.png'
                if previous_path is not None and caption == previous_caption:
                    os.link(previous_path,path)
                    frame += 1
                    timeline = frame/FPS
                else:
                    capture()
                previous_caption,previous_path = caption,path

        def move(target):
            nonlocal frame,timeline,pos
            frame,timeline = base.write_move(page,frames,frame,9,timeline,cues,pos,target)
            pos = target
            hold(.2)

        def click(selector,fraction=.5):
            box = page.locator(selector).bounding_box()
            move((box['x']+box['width']*fraction,box['y']+box['height']/2))
            page.mouse.click(*pos)
            capture(True)
            hold(.25)

        def drag():
            nonlocal pos
            box = page.locator('#print').bounding_box()
            start = (box['x']+box['width']*.65,box['y']+box['height']*.4)
            move(start)
            page.mouse.move(*start)
            page.mouse.down()
            for i in range(24):
                t=(i+1)/24;e=t*t*(3-2*t)
                pos=(start[0]+60*e,start[1]+28*e)
                page.mouse.move(*pos)
                capture(True)
            page.mouse.up()
            capture()

        end = 0
        for index,seconds in enumerate(durations):
            end += seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index == 2:
                click('[data-view="a"]');hold(seconds*.20)
                click('[data-view="b"]');hold(seconds*.18)
                click('[data-view="both"]')
            elif index == 3:
                drag();hold(seconds*.20);click('#rotation',.70)
            elif index == 4:
                click('[data-palette="1"]');click('[data-design="bloom"]')
                hold(seconds*.36);click('#surprise')
            elif index == 5:
                click('#align');hold(seconds*.22);click('#marks')
                hold(seconds*.12)
                with page.expect_download() as pending:
                    click('#export')
                pending.value.save_as(str(work_dir/'walkthrough-print.png'))
            hold(max(0,end-timeline))
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s',flush=True)
        browser.close()
    if errors:
        raise RuntimeError(str(errors))
    return frames


def assemble(work_dir,frames_dir,narration,subtitles,output):
    # Encode once; the captions have already been burned into browser frames.
    base.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),
              '-i',str(frames_dir/'%06d.png'),'-i',str(narration),
              '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium',
              '-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k',
              '-shortest','-movflags','+faststart',str(output)])


def preview(output):
    output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT})
        setup(page,(PROJECT/'index.html').as_uri())
        for name,actions,caption in [
            ('sun',[],SUBTITLE_LINES[0][0]),
            ('flower',['[data-palette="1"]','[data-design="bloom"]'],SUBTITLE_LINES[4][1]),
            ('tide',['[data-palette="2"]','[data-design="tide"]'],SUBTITLE_LINES[5][3]),
        ]:
            for action in actions:page.locator(action).click()
            page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text',caption)
            page.screenshot(path=str(output/f'{name}.png'))
            board=page.locator('.workshop').bounding_box();caption_box=page.locator('#video-caption').bounding_box()
            assert board['y']+board['height'] < caption_box['y'], (board,caption_box)
        browser.close()
    print('1080p caption/layout previews:',output)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',type=Path,required=True)
    preview(parser.parse_args().preview)
