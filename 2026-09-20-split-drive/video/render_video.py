#!/usr/bin/env python3
"""Reproducible 1080p real-browser walkthrough, using the established Fish voice.

Without the authorized key, produce an explicitly labelled caption/music
edition. Never quietly replace the requested voice with another one.
"""
from __future__ import annotations
import argparse
import array
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import wave
from PIL import Image
from playwright.sync_api import sync_playwright

PROJECT=Path(__file__).resolve().parents[1]
ROOT_DIR=PROJECT.parent
SHARED=ROOT_DIR/'2026-08-08-cattery/video'
sys.path.insert(0,str(PROJECT))
from browser_support import serve,launch,load

def module_at(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
base=module_at('split_drive_capture_base',SHARED/'render_video.py')
FPS,WIDTH,HEIGHT=20,1920,1080
SILENCE_BETWEEN,SILENCE_TAIL=.3,1.6
URL='https://dailyslop.pages.dev/2026-09-20-split-drive/'
SUBTITLE_LINES=[
    ['大家好，我是 GPT-6 Astra，来交 AI 每日作业了。',
     '今天是九月二十日，做个汽车拐弯的小实验。',
     '同一根车轴，两边轮子一定转得一样快吗？'],
    ['把弯道收紧，差别就明显了。',
     '青色的左轮走内圈，橙色的右轮走外圈。',
     '同一时间到达，外面那个就得多转几圈。'],
    ['现在把车轴锁住，两边转速一样了。',
     '可路并没有变短，总得有轮胎在地上滑。',
     '这里固定了车的路线，橙色划线只表示需要滑动，不模拟抓地力。'],
    ['往右拐，内外轮交换，滑动的方向也交换。',
     '左边现在要走得更快，锁住的车轴还是不让它快。',
     '不是谁偷懒，是两条路本来就不一样长。'],
    ['换成直线，就算锁着车轴，也没有这个速度矛盾。',
     '两条平行的路一样长，两边转得一样快正合适。'],
    ['解除锁定，再看一整圈的路程。',
     '把半径从小调到大，外轮每圈多走的距离居然没变。',
     '两条圆周的差，只取决于车轴有多宽。'],
    ['车轴加宽，两边每圈的路程差就增加。',
     '再把车速降到零，所有转速都归零。',
     '停着的时候，轮胎当然也不用滑。'],
    ['恢复原来的设置，保存一张实验图。',
     '画面放慢到四分之一，旁边的转速数字仍然按真实车速计算。',
     '今天的作业交了。我是 GPT-6 Astra，明天见。'],
]
SEGMENTS=[''.join(lines).replace('GPT-6 Astra','GPT 六 Astra') for lines in SUBTITLE_LINES]
FALLBACK_DURATIONS=[12,11,13,11,9,14,10,12]
base.SUBTITLE_LINES=SUBTITLE_LINES;base.SILENCE_BETWEEN=SILENCE_BETWEEN;base.SILENCE_TAIL=SILENCE_TAIL
duration=base.duration

def soundtrack(path,seconds):
    """Original quiet D-minor study, generated from oscillators, with no samples."""
    rate=22050;chord=[146.8324,174.6141,220.0];notes=[293.6648,349.2282,440,523.2511,659.2551,440,349.2282,329.6276]
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
        for start in range(0,round(seconds*rate),rate):
            samples=array.array('h')
            for i in range(start,min(start+rate,round(seconds*rate))):
                t=i/rate;fade=min(1,t/2,max(0,(seconds-t)/3));phase=t%1.8
                pad=sum(math.sin(2*math.pi*f*t+.13*math.sin(t*.19+j)) for j,f in enumerate(chord))*.014
                tone=math.sin(2*math.pi*notes[int(t/1.8)%len(notes)]*phase)*math.exp(-phase*3.3)*min(1,phase*70)*.047
                samples.append(round((pad+tone)*fade*32767))
            if sys.byteorder!='little':samples.byteswap()
            w.writeframes(samples.tobytes())

def audio(work,captions_only=False):
    # Fish's helper imports a module named render_video; provide this adapter.
    old=sys.modules.get('render_video');sys.modules['render_video']=sys.modules[__name__]
    try:fish=module_at('split_drive_fish',SHARED/'render_fish_video.py')
    finally:
        if old is not None:sys.modules['render_video']=old
        else:sys.modules.pop('render_video',None)
    fish.local=sys.modules[__name__];fish.load_workspace_env()
    key=os.environ.get('FISH_AUDIO_API_KEY')
    if key and not captions_only:
        track,durations=fish.make_fish_audio(work,key)
        return track,durations,{'mode':'chinese-narration','provider':'Fish Audio','model':fish.FISH_MODEL,'voice_id':fish.FISH_VOICE_ID}
    durations=FALLBACK_DURATIONS
    seconds=sum(durations)+(len(durations)-1)*SILENCE_BETWEEN+SILENCE_TAIL
    path=work/'original-music.wav';soundtrack(path,seconds)
    return path,durations,{'mode':'chinese-captions-and-original-music','narration':False,'reason':'captions-only requested' if captions_only else 'FISH_AUDIO_API_KEY not available','soundtrack':'Original oscillator-generated D-minor study'}

VIDEO_STYLE='''
  main{max-width:1540px;padding:0 36px}header{height:43px}.intro{padding:12px 0 15px}
  h1{font-size:54px}.intro .eyebrow{margin-bottom:9px}.studio{grid-template-columns:minmax(0,1fr) 340px}
  .track-stage{height:320px}.instrument-head{padding:13px 22px}.motion-bar{min-height:40px;padding:7px 20px}
  .telemetry{padding:15px 23px 13px}.controls{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:18px;align-content:start}
  .controls>*{grid-column:1/-1}.controls>.speed-control,.controls>.width-control{grid-column:auto}
  .control-label{margin-bottom:8px;gap:7px}.control-label span{font-size:11px}.control-label output{font-size:10px}
  .slider-group input{margin:8px 0}.range-hints{display:none}.lock-group{padding-top:10px}
  .status-card{padding:10px 12px}.status-card h3{margin:6px 0}.status-card p{min-height:30px;font-size:11px}
  .model-note{font-size:9px;line-height:1.5;margin:0}.experiment{padding-bottom:7px}
  .insight{padding:14px 0 11px}.insight .eyebrow{margin-bottom:8px}.insight h2{font-size:20px}
  .notes,footer{display:none}#video-browser-chrome{background:#0b131c;border-color:#33424a;color:#8ca4ad}
  #video-browser-chrome .address{background:#1a2b35;border-color:#3f555d;color:#ccddd8}
  #video-browser-chrome .badge{font-family:'Noto Sans CJK SC',sans-serif;color:#a6c8c5;letter-spacing:0}
  #video-caption{font-family:'Noto Sans CJK SC',sans-serif;font-size:24px;bottom:14px;background:#08151bed}
  #video-cursor,#video-cursor svg{width:18px;height:23px}
'''
def decorate(page,narrated=False):
    base.add_browser_chrome(page);base.add_caption_overlay(page);base.add_cursor_overlay(page)
    page.evaluate('(url)=>document.querySelector("#video-browser-chrome .address").textContent=url',URL)
    page.evaluate('(t)=>document.querySelector("#video-browser-chrome .badge").textContent=t','中文解说' if narrated else '中文字幕 · 原创配乐')
    page.add_style_tag(content=VIDEO_STYLE)
    page.wait_for_timeout(60)

def preview(directory):
    directory.mkdir(parents=True,exist_ok=True)
    with serve() as port,sync_playwright() as p:
        b=launch(p);page=b.new_page(viewport={'width':1600,'height':900},device_scale_factor=1.2)
        load(page,port,True);decorate(page);page.evaluate('splitDrive.advance(2)')
        page.screenshot(path=str(directory/'video-layout.png'))
        geometry=page.evaluate('Object.fromEntries([".studio",".controls",".insight"].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{top:r.top,bottom:r.bottom,height:r.height}]}))')
        (directory/'layout.json').write_text(json.dumps(geometry,indent=2)+'\n')
        # Keep the captions below the important on-screen data.
        assert geometry['.insight']['bottom']<842,geometry
        b.close()

def render(output,work,track,durations,audio_info):
    total=sum(durations)+(len(durations)-1)*SILENCE_BETWEEN+SILENCE_TAIL
    cues=base.caption_cues(durations);base.write_srt(output.with_suffix('.srt'),durations)
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',str(FPS),'-i','pipe:0','-i',str(track),'-t',f'{total:.3f}','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(output)]
    with serve() as port,sync_playwright() as p,(work/'ffmpeg.log').open('w') as log:
        b=launch(p);page=b.new_page(viewport={'width':1600,'height':900},device_scale_factor=1.2,accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        load(page,port,True);decorate(page,audio_info['mode']=='chinese-narration')
        encoder=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        frame=0;position=(1505.,790.);max_frames=round(total*FPS)
        def capture(clicking=False):
            nonlocal frame
            if frame>=max_frames:return
            page.evaluate('dt=>splitDrive.advance(dt)',1/FPS)
            page.evaluate('(s)=>document.getElementById("video-caption").textContent=s',base.caption_at(frame/FPS,cues))
            base.set_cursor(page,position,clicking)
            encoder.stdin.write(page.screenshot(type='png'))
            frame+=1
        def hold(until):
            while frame<min(round(until*FPS),max_frames):capture()
        def move(target):
            nonlocal position
            start=position;dx=target[0]-start[0];dy=target[1]-start[1];length=max(1,math.hypot(dx,dy))
            for i in range(9):
                u=i/8;e=u*u*(3-2*u);arc=math.sin(math.pi*e)*min(12,length*.025)
                position=(start[0]+dx*e-dy/length*arc,start[1]+dy*e+dx/length*arc);capture()
            hold(frame/FPS+.15)
        def click(selector):
            r=page.locator(selector).bounding_box();move((r['x']+r['width']/2,r['y']+r['height']/2));page.locator(selector).click();capture(True)
        def drag(selector,target):
            nonlocal position
            el=page.locator(selector);r=el.bounding_box();lo=float(el.get_attribute('min'));hi=float(el.get_attribute('max'));v=float(el.input_value())
            x=lambda value:r['x']+6+(r['width']-12)*(value-lo)/(hi-lo)
            y=r['y']+r['height']/2;move((x(v),y));page.mouse.move(*position);page.mouse.down()
            for i in range(16):
                u=i/15;e=u*u*(3-2*u);position=(x(v+(target-v)*e),y);page.mouse.move(*position);capture(True)
            page.mouse.up();capture()
        end=0.
        try:
            for i,span in enumerate(durations):
                end+=span+(SILENCE_BETWEEN if i<len(durations)-1 else SILENCE_TAIL)
                if i==1:drag('#radius',3.5)
                elif i==2:click('#lock')
                elif i==3:click('[data-turn="-1"]')
                elif i==4:click('[data-turn="0"]')
                elif i==5:
                    click('#lock');click('[data-turn="1"]');hold(end-8);drag('#radius',16)
                elif i==6:
                    drag('#track',2.4);hold(end-4);drag('#speed',0)
                elif i==7:
                    click('#reset');hold(end-7)
                    with page.expect_download() as pending:click('#export')
                    pending.value.save_as(str(work/'exported-study.png'))
                hold(end);print(f'Captured scene {i+1}/{len(durations)}: {frame/FPS:.1f}s',flush=True)
        finally:
            encoder.stdin.close();result=encoder.wait(timeout=120);b.close()
        if result:raise RuntimeError(f'ffmpeg failed; inspect {work/"ffmpeg.log"}')
        if errors:raise RuntimeError('Browser errors: '+repr(errors))
    subprocess.run(['ffmpeg','-v','error','-i',str(output),'-f','null','-'],check=True)
    metadata={'project':PROJECT.name,'built_by':'GPT-6 Astra','resolution':[WIDTH,HEIGHT],'fps':FPS,'duration_seconds':duration(output),'demo_url':URL,'capture':'real local browser controls; deterministic simulation time','visual_time_scale':.25,'audio':audio_info,'segment_durations':durations}
    output.with_suffix('.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(metadata,ensure_ascii=False,indent=2),flush=True)

def gallery_shot():
    with serve() as port,sync_playwright() as p:
        b=launch(p);page=b.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
        load(page,port,True);page.evaluate('splitDrive.advance(1)');data=page.screenshot(type='png');b.close()
    dest=ROOT_DIR/'gallery/shots'/f'{PROJECT.name}.png';dest.parent.mkdir(parents=True,exist_ok=True)
    Image.open(io.BytesIO(data)).resize((800,500),Image.Resampling.LANCZOS).save(dest)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preview',type=Path);parser.add_argument('--captions-only',action='store_true');parser.add_argument('--output',type=Path,default=PROJECT/'video/split-drive.mp4')
    args=parser.parse_args()
    if args.preview:preview(args.preview);return
    work=Path(tempfile.mkdtemp(prefix='split-drive-video-build-'));output=args.output.resolve();output.parent.mkdir(parents=True,exist_ok=True)
    track,durations,audio_info=audio(work,args.captions_only);print('Audio mode: '+audio_info['mode'],flush=True)
    render(output,work,track,durations,audio_info);gallery_shot()
    print('Retained diagnostics: '+str(work),flush=True)
if __name__=='__main__':main()
