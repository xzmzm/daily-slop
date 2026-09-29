"""Jumbo Loader adapter for the established cattery Fish Audio renderer."""
import argparse
from datetime import datetime, timezone
import importlib.util
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-09-30-jumbo-loader/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3，来交 AI 每日作业了。', '一九六八年九月三十日，第一架波音 747 在埃弗雷特工厂下线。', '波音赌超音速会抢走客源，干脆按货机来设计她：驾驶舱搬上驼峰，机头整块能掀开。', '今天就来装这架珍宝机。'],
    ['每一件货都有自己的站位，也就是力臂。', '先点最重的机床，塞进最前面的站位。', '铅锤线立刻往前冲，重心小点一头栽出绿区，判定：机头过重。'],
    ['同一箱货往后挪，力臂整个反过来，重心又被拉回来。', '装货就是跷跷板：重的贴着机翼放，轻的往两头填。', '看着小点沿橙线爬回绿带，这条轨迹就是你刚才每一步的手笔。'],
    ['绿带为什么越往上越窄？', '重心位置用平均气动弦长的百分比表示，机翼就是尺子。', '装得越重，前后余量越小，飞机就越挑剔。', '关上机头门，滑出，抬轮。'],
    ['最刁钻的是黄金航班。', '金子又小又沉，四块金板自己就能定住全机重心；', '花花草草轻得几乎不算数，正好当配平的砝码。', '八件货全部进舱，小点稳稳停在绿带中段。'],
    ['再关一次机头门，滑出。', '埃弗雷特工厂至今仍是世界上体积最大的建筑，五万名“不可思议队”造出了她。', '从一九六八到二零二三，五十四年，一千五百多架。', '去装一架你自己的珍宝机吧，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace('GLM-5.3', 'GLM 五点三').replace('波音 747', '波音七四七')
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{padding-bottom:150px}
  .masthead,main,.history,footer{max-width:1240px;margin-left:auto;margin-right:auto}
  .masthead{padding-top:20px}.intro-copy{margin:10px 0 20px;font-size:15px;max-width:130ch}
  h1{font-size:52px}.eyebrow{margin-bottom:6px}
  main{grid-template-columns:minmax(0,1fr)}
  .hangar{padding:14px 18px 12px}.hangar h2{font-size:19px}
  .loadmaster{gap:12px;grid-template-columns:none}
  .panel{padding:13px 16px}.panel h2{margin-bottom:9px;font-size:15px}
  .mission{padding:8px 11px;font-size:12.5px}
  .mission-brief{margin:9px 0 0;font-size:13px;min-height:2.6em}
  .manifest{gap:6px}.manifest button{padding:7px 10px}
  .readouts{display:grid;grid-template-columns:1fr 1fr;align-items:center}
  .readout strong{font-size:25px}
  .actions{grid-column:1/-1}.verdict{min-height:2.8em;font-size:13.5px;padding:9px 12px}
  .dispatch{padding:11px 14px}.unload{padding:11px 12px}
  #chart svg{max-height:330px;margin:0 auto;display:block}
  .chart-hint{font-size:12px;margin-top:7px}
  .history{margin-top:20px;padding-top:16px}.history p{font-size:14.5px}
  #video-caption{font-size:30px;bottom:19px;max-width:1640px;padding:10px 22px 12px}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.jumboLoader')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,text)=>el.textContent=text', URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)


def capture_frames(work_dir, durations, port):
    frames = work_dir/'frames'
    frames.mkdir()
    cues = base.caption_cues(durations)
    frame, timeline, pos = 0, 0., (1185, 705)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':WIDTH,'height':HEIGHT},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        setup(page,f'http://127.0.0.1:{port}/{PROJECT.name}/')
        base.set_cursor(page,pos)

        def capture(clicking=False):
            nonlocal frame,timeline
            base.capture(page,frames/f'{frame:06d}.png',timeline,cues,pos,clicking)
            frame += 1
            timeline = frame/FPS

        def hold(seconds):
            seconds = max(0,seconds)
            for _ in range(round(seconds*FPS)):
                capture()

        def click(selector, move_frames=7):
            nonlocal frame,timeline,pos
            box = page.locator(selector).bounding_box()
            if box['y'] < 130 or box['y'] > HEIGHT-170:
                # bring off-screen targets (manifest rows, slots) back into frame
                abs_y = page.evaluate('window.scrollY')+box['y']
                scroll_to(max(0,abs_y-340),.8)
                box = page.locator(selector).bounding_box()
            target = (box['x']+box['width']/2,box['y']+box['height']/2)
            frame,timeline = base.write_move(page,frames,frame,move_frames,timeline,cues,pos,target)
            pos=target;hold(.16)
            page.mouse.click(*pos);capture(True);hold(.24)

        def place(index,slot):
            click(f'#manifest li button >> nth={index}')
            click(f'#{slot}')

        def scroll_to(y_target,seconds):
            nonlocal frame,timeline
            y_start = page.evaluate('window.scrollY')
            steps = max(1,round(seconds*FPS))
            for step in range(1,steps+1):
                eased = step/steps
                eased = eased*eased*(3-2*eased)
                page.evaluate(f'window.scrollTo(0,{round(y_start+(y_target-y_start)*eased)})')
                capture()

        def panel_top(selector):
            return page.locator(selector).bounding_box()['y']-90

        end = 0
        for index,seconds in enumerate(durations):
            end += seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index == 0:
                hold(seconds*.30)
                scroll_to(120,1.2)
                hold(max(0,end-timeline))
            elif index == 1:
                hold(seconds*.12)
                place(0,'slot-m0')
                hold(seconds*.30)
                scroll_to(panel_top('.readouts'),1.2)
                hold(seconds*.18)
                click('#slot-m0')           # unload again before the fix
                hold(max(0,end-timeline))
            elif index == 2:
                place(0,'slot-m7');place(1,'slot-m8')
                place(2,'slot-m4');place(3,'slot-l4')
                scroll_to(panel_top('.chart-panel'),1.2)
                place(4,'slot-l5');place(5,'slot-l0')
                hold(max(0,end-timeline))
            elif index == 3:
                scroll_to(panel_top('.readouts'),1.0)
                hold(seconds*.14)
                click('#dispatch')
                hold(seconds*.24)
                scroll_to(panel_top('.chart-panel'),1.2)
                hold(seconds*.16)
                click('[data-mission="2"]')
                scroll_to(0,.9)
                place(4,'slot-m1');place(5,'slot-m4')
                hold(max(0,end-timeline))
            elif index == 4:
                place(0,'slot-l3');place(1,'slot-m5')
                place(2,'slot-l6');place(3,'slot-m6')
                scroll_to(panel_top('.chart-panel'),1.1)
                place(6,'slot-l5');place(7,'slot-l0')
                hold(max(0,end-timeline))
            elif index == 5:
                scroll_to(panel_top('.readouts'),1.0)
                click('#dispatch')
                hold(seconds*.24)
                scroll_to(page.evaluate('document.body.scrollHeight'),1.6)
                hold(max(0,end-timeline))
            state = page.evaluate('jumboLoader.getState()')
            if index == 4:
                assert all(item['slot'] for item in state['items']), 'gold run must be fully loaded'
            if index == 5:
                assert page.evaluate('jumboLoader.getState().dispatched.ok')
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
        assert 140 < page.locator('#slot-m0').bounding_box()['y'] < 760
        assert page.locator('#dispatch').bounding_box()['y'] > 700
        # a fully loaded, chart-visible state with captions clear of it
        page.evaluate('''() => {
            const pairs = [['machinery','m7'],['machinery','m8'],['pallet','m4'],
                           ['pallet','l4'],['pallet','l5'],['mail','l0']];
            pairs.forEach(([type,slot],i) => {
                document.querySelectorAll('#manifest li button')[i].click();
                document.getElementById('slot-'+slot).dispatchEvent(new MouseEvent('click',{bubbles:true}));
            });
        }''')
        page.evaluate('window.scrollTo(0,document.querySelector(".chart-panel").getBoundingClientRect().top+window.scrollY-80)')
        page.wait_for_timeout(300)
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text',SUBTITLE_LINES[2][2])
        page.screenshot(path=str(output/'loaded.png'))
        box=page.locator('#chart').bounding_box();caption=page.locator('#video-caption').bounding_box()
        assert box['y']+box['height'] < caption['y'], (box,caption)
        assert page.locator('#slot-l5.loaded').count() == 1
        browser.close()
    print('Video framing previews:',output)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',type=Path,required=True)
    preview(parser.parse_args().preview)
