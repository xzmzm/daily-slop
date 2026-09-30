"""44,100 adapter for the established cattery Fish Audio renderer."""
import argparse
from pathlib import Path
import importlib.util
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-10-01-44100/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GLM-5.3，来交 AI 每日作业了。', '一九八二年十月一日，第一台 CD 机 CDP-101 上市，同一天上架五十张唱片，头一张是比利·乔尔的《52 街》。', '一张 CD 的家底就两个数：每秒量四万四千一百次，每次十六位。', '今天就照这副规格开工。'],
    ['声音是连续的，CD 只能每隔一小段量一下。', '奈奎斯特说：想录住两万赫兹，每秒至少要四万个点。', '把三千赫兹降到四千的采样率，出来的是一千赫兹——频率照镜子折回来，这就是混叠。', '按一下扫频，音调爬到一半就掉头往下。'],
    ['量化就是四舍五入，舍掉的误差就是底噪。', '十六位是六万五千五百三十六级台阶，底噪压在九十八分贝以下。', '拉到四位，台阶粗了，误差变成听得见的沙沙声；每砍一位，底噪抬六分贝。', '这排小灯，就是一个样本写进盘里的样子。'],
    ['四万四千一百这个数，不是声学定的，是录像带定的。', '最早的数字录音，把样本搭在录像机的扫描线上。', 'NTSC 每场 245 条可用线、每秒 60 场、每线三个样本，乘出来正好四万四千一百；PAL 换成 294 乘 50，还是它。', '盘那边转速不恒定：里圈四百五十八转，外圈一百九十八转，锁死的是线速度。'],
    ['再拿指甲划一道。', '盘上字节是打散着存的：连伤八个格子，摊到八行头上，每行只丢一个字节。', '校验码挨个补回来，音乐照放不误。', '把打散关掉，同样一道伤全砸在一行，一行破两处校验就无能为力，剩下的就是一声咔哒。'],
    ['当年 Philips 主张 11.5 厘米装一小时；索尼的大贺典雄学过歌剧，非要装下整部贝多芬第九。', '圆盘这才撑到 12 厘米、74 分钟。', '四十四年过去，44100 还在给每一部手机定采样率。', '去拉一拉你自己的滑块吧，明天见。'],
]
SEGMENTS = [''.join(lines) for lines in SUBTITLE_LINES]
SEGMENTS[0] = SEGMENTS[0].replace('GLM-5.3', 'GLM 五点三').replace('《52 街》', '《五十二街》')
SEGMENTS[5] = SEGMENTS[5].replace('44100', '四四一零零')
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  body{padding-bottom:150px}
  .masthead,main,.history,footer{max-width:1240px;margin-left:auto;margin-right:auto}
  .masthead{padding-top:20px}.intro-copy{margin:10px 0 20px;font-size:15px;max-width:130ch}
  h1{font-size:50px}.eyebrow{margin-bottom:6px}
  main{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
  .station{padding:16px 20px}
  .station-title h2{font-size:22px}.station-sub{font-size:14px}
  #sampler-canvas,#bits-canvas{height:430px}
  #tv-canvas{height:400px}
  #disc-canvas{height:330px}
  .station-state{font-size:13px;padding:8px 14px}
  .readout strong{font-size:26px}
  .chips button{font-size:15px;padding:9px 14px}
  .control label{font-size:14px}.control label strong{font-size:17px}
  .byte{font-size:14px}.ph{width:20px;height:32px}
  .lamp{width:34px;height:42px;font-size:17px}
  .verdict{font-size:14.5px}
  .fact-line{font-size:14px}
  .history{margin-top:24px;padding-top:18px}.history p{font-size:15px}
  #video-caption{font-size:30px;bottom:19px;max-width:1640px;padding:10px 22px 12px}
"""


def setup(page, url):
    page.goto(url, wait_until='networkidle')
    page.wait_for_function('!!window.cdLab')
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
                abs_y = page.evaluate('window.scrollY')+box['y']
                scroll_to(max(0,abs_y-340),.8)
                box = page.locator(selector).bounding_box()
            target = (box['x']+box['width']/2,box['y']+box['height']/2)
            frame,timeline = base.write_move(page,frames,frame,move_frames,timeline,cues,pos,target)
            pos=target;hold(.16)
            page.mouse.click(*pos);capture(True);hold(.24)

        def scratch_drag(start_cell, end_cell):
            # drag a wound across the disc-surface strip, capturing as it grows
            nonlocal frame,timeline,pos
            a = page.evaluate(f"document.querySelectorAll('#physical-strip .ph')[{start_cell}].getBoundingClientRect()")
            b = page.evaluate(f"document.querySelectorAll('#physical-strip .ph')[{end_cell}].getBoundingClientRect()")
            x0,y0 = a['x']+a['width']/2, a['y']+a['height']/2
            x1,y1 = b['x']+b['width']/2, b['y']+b['height']/2
            frame,timeline = base.write_move(page,frames,frame,7,timeline,cues,pos,(x0,y0))
            pos=(x0,y0)
            page.mouse.move(*pos);hold(.12)
            page.mouse.down()
            steps = 8
            for step in range(1,steps+1):
                eased = step/steps
                eased = eased*eased*(3-2*eased)
                page.mouse.move(x0+(x1-x0)*eased, y0+(y1-y0)*eased)
                capture()
            page.mouse.up();hold(.2)

        def scroll_to(y_target,seconds):
            nonlocal frame,timeline
            y_start = page.evaluate('window.scrollY')
            steps = max(1,round(seconds*FPS))
            for step in range(1,steps+1):
                eased = step/steps
                eased = eased*eased*(3-2*eased)
                page.evaluate(f'window.scrollTo(0,{round(y_start+(y_target-y_start)*eased)})')
                capture()

        def panel_top(selector, offset=90):
            box = page.locator(selector).bounding_box()
            return page.evaluate('window.scrollY') + box['y'] - offset

        end = 0
        for index,seconds in enumerate(durations):
            end += seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index == 0:
                hold(seconds*.30)
                scroll_to(150,1.2)
                hold(max(0,end-timeline))
            elif index == 1:
                scroll_to(panel_top('#station-sampler'),1.0)
                hold(seconds*.14)
                click('[data-tone="3000"]')
                hold(seconds*.10)
                click('[data-rate="4000"]')
                hold(seconds*.28)
                click('#play-sweep')
                hold(max(0,end-timeline))
            elif index == 2:
                scroll_to(panel_top('#station-bits'),1.0)
                hold(seconds*.14)
                click('[data-bits="4"]')
                hold(seconds*.16)
                scroll_to(panel_top('.lampblock')+40,.9)
                hold(max(0,end-timeline))
            elif index == 3:
                scroll_to(panel_top('#station-origin'),1.0)
                hold(seconds*.12)
                click('#tv-pal')
                hold(seconds*.30)
                scroll_to(panel_top('.disc-strip')+60,1.1)
                click('[data-radius="58"]')
                hold(max(0,end-timeline))
            elif index == 4:
                scroll_to(panel_top('#station-scratch'),1.0)
                hold(seconds*.10)
                scratch_drag(0,7)
                hold(seconds*.20)
                click('#polish')
                hold(max(0,end-timeline))
            elif index == 5:
                click('#interleave-toggle')
                hold(.3)
                click('#wipe')
                hold(seconds*.10)
                scratch_drag(0,7)
                hold(seconds*.14)
                click('#polish')
                hold(seconds*.18)
                scroll_to(page.evaluate('document.body.scrollHeight'),1.6)
                hold(max(0,end-timeline))
            state = page.evaluate('cdLab.getState()')
            if index == 1:
                assert state['aliasing'] and abs(state['alias']-1000) < 1e-6, state
            if index == 2:
                assert state['bits'] == 4 and abs(state['snr']-25.84) < .01, state
            if index == 3:
                assert state['tv'] == 'PAL' and abs(state['rpm']-197.57) < .3, state
            if index == 4:
                assert state['lost'] == 0 and state['recovered'] == 8, state
            if index == 5:
                assert state['lost'] == 8 and state['recovered'] == 0, state
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
        assert 140 < page.locator('#sampler-canvas').bounding_box()['y'] < 640
        assert page.locator('[data-rate="4000"]').bounding_box()['y'] < HEIGHT-160
        # the alias state with captions clear of the canvas
        page.evaluate('cdLab.setTone(3000); cdLab.setRate(4000)')
        page.wait_for_timeout(200)
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text',SUBTITLE_LINES[1][2])
        page.screenshot(path=str(output/'alias.png'))
        # the healed scratch verdict in frame
        page.evaluate('cdLab.scratch(0,8); cdLab.polish()')
        page.wait_for_timeout(300)
        page.evaluate('window.scrollTo(0, document.querySelector("#station-scratch").getBoundingClientRect().top+scrollY-90)')
        page.wait_for_timeout(200)
        page.locator('#video-caption').evaluate('(el,text)=>el.textContent=text',SUBTITLE_LINES[4][2])
        page.screenshot(path=str(output/'scratch.png'))
        box=page.locator('#scratch-verdict').bounding_box();caption=page.locator('#video-caption').bounding_box()
        assert box['y']+box['height'] < caption['y'], (box,caption)
        assert page.locator('#logic-grid .byte.repaired').count() == 8
        browser.close()
    print('Video framing previews:',output)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',type=Path,required=True)
    preview(parser.parse_args().preview)
