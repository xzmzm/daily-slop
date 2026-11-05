"""Second Breath capture adapter for the shared Fish Audio renderer."""
from __future__ import annotations

import argparse
import importlib.util
import math
import struct
import wave
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = 'https://dailyslop.pages.dev/2026-11-06-second-breath/'
spec = importlib.util.spec_from_file_location('cattery_capture', ROOT_DIR / '2026-08-08-cattery/video/render_video.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = 2.0, 1.6
base.SILENCE_BETWEEN, base.SILENCE_TAIL = SILENCE_BETWEEN, SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ['大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。',
     '今天是 11 月 6 日。1814 年的今天，萨克斯的发明者阿道夫·萨克斯出生。',
     '今天这个小实验叫 Second Breath。两种管子，都用簧片，往高音一跳，距离却不一样。'],
    ['先看低音。两边的声学长度都是 65 厘米，直管大约 132 赫兹，锥形管大约 264 赫兹。',
     '管子一样长，低音已经差了一个八度。外形这点差别，耳朵可不觉得小。'],
    ['切到下一个共振。左边的直管，从 132 跳到 396 赫兹，是原来的三倍。',
     '中间的两倍被跳过了。这一跳叫十二度，比八度还多一个五度。',
     '点一下播放，先听低音，再听它跳上去。'],
    ['右边的锥形管，从 264 到 528 赫兹，正好两倍，也就是一个八度。',
     '下面这排数字，两边亮起的位置也不同。一个从一到三，一个从一到二。',
     '现在听右边，这一跳就收敛多了。'],
    ['把长度拉到一米，两边的音都会变低。',
     '不过，直管还是跳三倍，锥形管还是跳两倍。长度管音高，形状管这次怎么跳。',
     '图上的小圆点，是压力起伏始终为零的位置。两边的位置也不一样。'],
    ['这里比较的是理想管子，声音用两个纯音表示。',
     '真实乐器还有吹嘴、音孔和泛音，演奏者也会借助高音孔选择更高的振动模式。',
     '同一片簧片，换个管子，就换了跳法。今天作业交完，明天见。'],
]
SEGMENTS = [''.join(lines).replace('GPT-6.1 Sol','GPT 六点一 Sol').replace('11 月 6 日','十一月六日').replace('1814 年','一八一四年') for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt
PARK = (1868, 960)
TONE_EVENTS = []
RECORDING_CSS = '''
main{max-width:1840px;padding:0 48px}header{min-height:45px}.intro{padding:12px 0 15px}
.intro .eyebrow{font-size:10px;margin-bottom:13px}h1{font-size:65px}.intro-copy{font-size:23px;padding:0 30px 0 0}.intro-copy .muted{font-size:15px}
.controls{padding:12px 27px;gap:70px}.control-label{font-size:10px;margin-bottom:7px}.segmented{max-width:400px}.segmented button{font-size:14px;padding:10px 20px}
.length-control{max-width:480px}.range-labels{font-size:10px}.instrument{padding:17px 29px 15px}
.instrument-heading .eyebrow{font-size:10px}h2{font-size:31px}.shape-tag{font-size:10px}.pitch{margin-top:13px}.frequency{font-size:55px}.note{font-size:14px}.jump strong{font-size:31px}.jump span{font-size:12px}
.instrument canvas{height:157px;max-height:157px;aspect-ratio:auto;margin-top:7px}.diagram-key{font-size:9px;margin-top:4px}.harmonics{margin-top:10px;padding-top:12px}.harmonic-heading{font-size:9px}.harmonic{padding:7px;font-size:14px}
.instrument-bottom{margin-top:11px;gap:24px}.instrument-bottom p{font-size:13px;min-height:44px;line-height:1.6}.listen{font-size:13px;padding:12px 16px}
.observation{padding:15px 27px}.observation-label{font-size:10px}.observation p{font-size:18px}.observation #audio-status{font-size:10px;max-width:250px}
.footnotes{padding:18px 0 12px;gap:40px;grid-template-columns:1fr 1.5fr 1.7fr}.occasion p{font-size:17px;margin-top:5px}.footnotes p{font-size:12px;line-height:1.6}.footnotes .model-note{font-size:10px;line-height:1.6}footer{padding:10px 0;font-size:8px}
#video-caption{font-size:28px;max-width:1780px;bottom:14px}
'''

def setup(page, url):
    page.clock.install(time='2026-11-06T09:00:00+08:00')
    page.goto(url, wait_until='load')
    page.wait_for_function('window.secondBreath !== undefined')
    page.clock.pause_at('2026-11-06T09:00:01+08:00')
    page.evaluate('secondBreath.setRecordingClock(true)')
    base.add_browser_chrome(page)
    page.locator('#video-browser-chrome .address').evaluate('(el,url)=>el.textContent=url',URL)
    page.locator('#video-browser-chrome .badge').evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page,PARK)

def framing(page):
    caption_top=page.locator('#video-caption').bounding_box()['y']
    for selector in ['.experiment','.footnotes']:
        b=page.locator(selector).bounding_box()
        assert b['y']+b['height']<caption_top-12,(selector,b,caption_top)

def capture_frames(work_dir,durations,port):
    frames=work_dir/'frames';frames.mkdir()
    cues=base.caption_cues(durations)
    frame,timeline,pos=0,0.0,PARK
    errors=[];TONE_EVENTS.clear()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT})
        page.on('pageerror',lambda e:errors.append(str(e)))
        setup(page,f'http://127.0.0.1:{port}/{PROJECT.name}/')
        page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s',SUBTITLE_LINES[0][0])
        framing(page)

        def snap(clicking=False):
            nonlocal frame,timeline
            page.clock.run_for(round((frame+1)*1000/FPS)-round(frame*1000/FPS))
            page.evaluate('(ms)=>secondBreath.advance(ms)',1000/FPS)
            base.capture(page,frames/f'{frame:06d}.png',timeline,cues,pos,clicking)
            frame+=1;timeline=frame/FPS

        def hold(seconds):
            for _ in range(max(0,round(seconds*FPS))):snap()

        def move(target):
            nonlocal pos
            start=pos;dx,dy=target[0]-start[0],target[1]-start[1]
            dist=max(1,math.hypot(dx,dy));bend=min(18,dist*.04)
            control=((start[0]+target[0])/2-dy/dist*bend,(start[1]+target[1])/2+dx/dist*bend)
            for i in range(8):
                u=(i+1)/8;u=u*u*(3-2*u);v=1-u
                pos=(v*v*start[0]+2*v*u*control[0]+u*u*target[0],v*v*start[1]+2*v*u*control[1]+u*u*target[1])
                page.mouse.move(*pos);snap()
            hold(.18)

        def click(selector,kind=None):
            b=page.locator(selector).bounding_box()
            move((b['x']+b['width']/2,b['y']+b['height']/2))
            page.mouse.click(*pos)
            if kind:
                page.wait_for_function('(id)=>document.getElementById(id).getAttribute("aria-pressed")==="true"',arg='hear-'+kind)
                TONE_EVENTS.append((kind,timeline+.04,page.evaluate('secondBreath.state.length')))
            snap(True);hold(.2)

        start=0.0
        for index,seconds in enumerate(durations):
            end=start+seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index==2:
                click('#overblow')
                assert page.locator('#cylinder-hz').inner_text()=='396'
                hold(start+seconds-.6-timeline)
                click('#hear-cylinder','cylinder')
            elif index==3:
                assert page.locator('#cone-hz').inner_text()=='528'
                hold(start+seconds-.6-timeline)
                click('#hear-cone','cone')
            elif index==4:
                b=page.locator('#length').bounding_box()
                move((b['x']+b['width']-8,b['y']+b['height']/2))
                page.mouse.click(*pos);page.locator('#length').press('End');snap(True)
                assert page.locator('#length-value').inner_text()=='100 cm'
            elif index==5:
                click('#reset');click('#low')
            hold(end-timeline)
            assert timeline<=end+.2,(index,timeline,end)
            print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s',flush=True)
            start=end
        browser.close()
    assert not errors,errors
    return frames

def tone_pair(path,kind,length):
    """Match the app's sine frequencies, gain, note duration and 0.85 s spacing."""
    rate=44100;low=343/((4 if kind=='cylinder' else 2)*length)
    frequencies=[low,low*(3 if kind=='cylinder' else 2)]
    samples=[]
    for i in range(round(1.6*rate)):
        t=i/rate;value=0.0
        for j,f in enumerate(frequencies):
            local=t-j*.85
            if 0<=local<.7:
                envelope=min(1,local/.04, max(0,(.7-local)/.15))
                value+=.13*envelope*math.sin(2*math.pi*f*local)
        samples.append(round(value*32767))
    with wave.open(str(path),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(rate)
        wav.writeframes(struct.pack('<'+'h'*len(samples),*samples))

def assemble(work_dir,frames_dir,narration,subtitles,output):
    command=['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),'-i',str(frames_dir/'%06d.png'),'-i',str(narration)]
    filters=[];inputs=['[1:a]']
    for i,(kind,when,length) in enumerate(TONE_EVENTS):
        path=work_dir/f'{kind}-tones.wav';tone_pair(path,kind,length)
        command+=['-i',str(path)]
        filters.append(f'[{i+2}:a]adelay={round(when*1000)}[tone{i}]');inputs.append(f'[tone{i}]')
    filters.append(''.join(inputs)+f'amix=inputs={len(inputs)}:duration=first:normalize=0,alimiter=limit=0.95:level=false[mix]')
    command+=['-filter_complex',';'.join(filters),'-map','0:v:0','-map','[mix]','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',str(output)]
    base.run(command)

def preview(output):
    output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT})
        setup(page,(PROJECT/'index.html').as_uri())
        page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s',SUBTITLE_LINES[0][0]);framing(page)
        page.screenshot(path=str(output/'intro.png'))
        page.locator('#overblow').click()
        page.locator('#video-caption').evaluate('(el,s)=>el.textContent=s',SUBTITLE_LINES[3][0]);framing(page)
        page.screenshot(path=str(output/'next.png'))
        browser.close()
    print('Video framing previews:',output)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--preview',type=Path,required=True)
    preview(parser.parse_args().preview)
