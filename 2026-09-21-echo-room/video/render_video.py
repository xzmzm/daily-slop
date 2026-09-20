#!/usr/bin/env python3
"""Real-browser 1080p walkthrough, Fish narration, captions and actual app audio."""
from __future__ import annotations
import argparse
import base64
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
import array
from PIL import Image
from playwright.sync_api import sync_playwright
PROJECT=Path(__file__).resolve().parents[1]
ROOT_DIR=PROJECT.parent
sys.path.insert(0,str(PROJECT))
from browser_support import serve,launch,load
FPS,WIDTH,HEIGHT=20,1920,1080
SILENCE_BETWEEN,SILENCE_TAIL=3.0,3.0
URL='https://dailyslop.pages.dev/2026-09-21-echo-room/'
SUBTITLE_LINES=[
 ['大家好，我是 GPT-6 Astra，来交 AI 每日作业了。','今天九月二十一日，做个能听的房间。','同一个声音，换个地方，听起来会差多少？'],
 ['橙色是声源，绿色是听的人。','挪一下位置，直达的路和碰过墙的路都变了。','下面每一根细线，都是一条路径的到达时间。'],
 ['先只听直接传来的声音。','反射暂时关掉，同一个小敲击声，没有后面的尾巴。'],
 ['现在把反射打开。','不是换了音效，是刚才那个声音，绕着不同的路回来。','直接声和反射声用同一套音量，没有偷偷拉响。'],
 ['把墙面调得更吸声。','反射的细线变矮了，到达时间却没动。','墙软了，不代表路短了。'],
 ['换成长走廊，听听区别。','这里有更长的反射路径。','声音按正常速度播放，画面故意放慢，方便看清楚。'],
 ['小房间这个预设，尺寸小，墙也更吸声。','两件事可以分开调，不要把它们混在一起。','这里只画水平方向，没有地板和天花板，也不是完整混响。'],
 ['恢复原来的房间，还能把声音存成音频文件。','这是个听觉小实验，别拿它给录音棚验收。','今天的作业交了。我是 GPT-6 Astra，明天见。']
]
SEGMENTS=[''.join(lines).replace('GPT-6 Astra','GPT 六 Astra') for lines in SUBTITLE_LINES]
FALLBACK=[11,10,8,11,8,10,12,11]

def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)],text=True).strip())

def cues_for(durations):
    cues=[];start=0.
    for lines,span in zip(SUBTITLE_LINES,durations):
        weights=[len(s) for s in lines];at=start
        for text,weight in zip(lines,weights):
            end=at+span*weight/sum(weights);cues.append((at,end,text));at=end
        start+=span+SILENCE_BETWEEN
    return cues

def write_srt(path,durations):
    def stamp(t):
        ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    path.write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{s}' for i,(a,b,s) in enumerate(cues_for(durations)))+'\n',encoding='utf-8')

def narration(work,captions_only=False):
    if captions_only:
        with wave.open(str(work/'narration.wav'),'wb') as w:
            w.setparams((1,2,44100,0,'NONE','not compressed'))
            w.writeframes(b'\0\0'*round((sum(FALLBACK)+len(FALLBACK)*3)*44100))
        return work/'narration.wav',FALLBACK,{'mode':'captions-and-app-audio','narration':False}
    spec=importlib.util.spec_from_file_location('echo_fish',ROOT_DIR/'2026-08-08-cattery/video/render_fish_video.py')
    fish=importlib.util.module_from_spec(spec)
    old=sys.modules.get('render_video');sys.modules['render_video']=sys.modules[__name__]
    try:spec.loader.exec_module(fish)
    finally:
        if old is None:sys.modules.pop('render_video',None)
        else:sys.modules['render_video']=old
    fish.local=sys.modules[__name__];fish.load_workspace_env()
    key=os.environ.get('FISH_AUDIO_API_KEY')
    if not key:raise SystemExit('FISH_AUDIO_API_KEY is required for the narrated edition. Use --captions-only explicitly for a preview.')
    track,durations=fish.make_fish_audio(work,key)
    return track,durations,{'mode':'chinese-narration-and-app-audio','provider':'Fish Audio','model':fish.FISH_MODEL,'voice_id':fish.FISH_VOICE_ID}

VIDEO_STYLE='''
body{padding-top:36px}main{max-width:1540px;padding:0 28px}header{height:40px}
.intro{padding:15px 0 16px}.intro .eyebrow{margin-bottom:9px}h1{font-size:60px}.title-wave{font-size:48px}.lede{font-size:12px}
.studio{grid-template-columns:minmax(0,1fr) 350px}.room-stage{height:300px}.panel-head{padding:13px 20px}
.legend{padding:10px 20px}.timeline-head{padding:14px 20px 3px}#timeline{height:75px}.metrics{padding:13px 20px 16px}.metrics strong{font-size:25px}
.controls{padding:18px;gap:12px}.controls .eyebrow{font-size:8px}.sliders{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
.sliders label[for=depth]{grid-row:1;grid-column:2}.sliders #width{grid-row:2;grid-column:1}.sliders #depth{grid-row:2;grid-column:2}
.sliders input{margin:12px 0 2px}label{font-size:11px}.absorption-control input{margin:11px 0 9px}.listen-section{padding-top:12px}
.listen-section .eyebrow{margin-bottom:9px}.audio-note{min-height:28px;margin-top:7px}.primary{padding:12px}.path-card{padding:10px 12px}
.path-card p{margin-top:7px}.model-note{font-size:8px}.insight{padding:17px 0 10px}.insight h2{font-size:21px}.insight .eyebrow{margin-bottom:6px}
.method,footer{display:none}#video-chrome{position:fixed;inset:0 0 auto;height:36px;background:#0a151a;border-bottom:1px solid #34464c;display:flex;align-items:center;padding:0 22px;gap:15px;z-index:40;color:#93aaa9;font:10px monospace}
#video-chrome .dots{letter-spacing:5px;color:#698080}#video-chrome .address{padding:6px 24px;background:#1c2d34;border:1px solid #3b4c53;border-radius:4px;min-width:610px;color:#c5d8d3}
#video-chrome .badge{margin-left:auto;font-family:'Noto Sans CJK SC',sans-serif}
#video-caption{position:fixed;bottom:13px;left:50%;transform:translateX(-50%);max-width:95%;white-space:nowrap;padding:9px 22px;border-radius:7px;background:#081419ef;border:1px solid #44605c77;color:#eff6ef;font:24px 'Noto Sans CJK SC',sans-serif;z-index:60;min-height:48px}
#video-caption:empty{visibility:hidden}#video-cursor{position:fixed;pointer-events:none;z-index:70;width:18px;height:24px;filter:drop-shadow(0 2px 3px #0008)}
'''

def decorate(page,narrated=True):
    page.evaluate('''({url,narrated})=>{
      const bar=document.createElement('div');bar.id='video-chrome';
      const dots=document.createElement('span');dots.className='dots';dots.textContent='● ● ●';
      const address=document.createElement('span');address.className='address';address.textContent=url;
      const badge=document.createElement('span');badge.className='badge';badge.textContent=narrated?'本地录屏 · 中文解说 + 实际音效':'本地预览 · 字幕 + 实际音效';
      bar.append(dots,address,badge);document.body.append(bar);
      const caption=document.createElement('div');caption.id='video-caption';document.body.append(caption);
      const cursor=document.createElement('div');cursor.id='video-cursor';cursor.innerHTML='<svg viewBox="0 0 18 24"><path d="M1 1 L1 19 L6 14 L10 22 L13 20 L9 13 L16 13 Z" fill="#f0f6ef" stroke="#233a3c" stroke-width="1.3"/></svg>';document.body.append(cursor);
    }''',{'url':URL,'narrated':narrated})
    page.add_style_tag(content=VIDEO_STYLE);page.wait_for_timeout(60);page.evaluate('echoRoom.advance(0)')

def preview(directory):
    directory.mkdir(parents=True,exist_ok=True)
    with serve() as port,sync_playwright() as p:
        b=launch(p);page=b.new_page(viewport={'width':1600,'height':900},device_scale_factor=1.2);load(page,port);decorate(page)
        page.evaluate("document.getElementById('video-caption').textContent='反射的细线变矮了，到达时间却没动。'")
        page.screenshot(path=str(directory/'video-layout.png'))
        bounds=page.evaluate('Object.fromEntries([".studio",".controls",".insight","#video-caption"].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{top:r.top,bottom:r.bottom}]}))')
        (directory/'video-layout.json').write_text(json.dumps(bounds,indent=2)+'\n')
        assert bounds['.insight']['bottom']<bounds['#video-caption']['top']-4,bounds
        b.close()

def mix_audio(track,events,output):
    with wave.open(str(track),'rb') as w:
        assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==44100
        data=array.array('h',w.readframes(w.getnframes()))
        if sys.byteorder!='little':data.byteswap()
    mixed=[v*.88 for v in data]
    for event in events:
        with wave.open(io.BytesIO(event['wav']),'rb') as w:
            values=array.array('h',w.readframes(w.getnframes()))
            if sys.byteorder!='little':values.byteswap()
        offset=round(event['time']*44100)
        for i,v in enumerate(values):
            if offset+i<len(mixed):mixed[offset+i]+=v
    result=array.array('h',(round(max(-32767,min(32767,v))) for v in mixed))
    if sys.byteorder!='little':result.byteswap()
    with wave.open(str(output),'wb') as w:w.setparams((1,2,44100,0,'NONE','not compressed'));w.writeframes(result.tobytes())

def render(output,work,track,durations,info):
    total=sum(durations)+(len(durations)-1)*SILENCE_BETWEEN+SILENCE_TAIL
    cues=cues_for(durations);write_srt(output.with_suffix('.srt'),durations)
    silent=work/'silent.mp4';events=[];actions=[]
    command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',str(silent)]
    with serve() as port,sync_playwright() as p,(work/'encode.log').open('w') as log:
        b=launch(p);page=b.new_page(viewport={'width':1600,'height':900},device_scale_factor=1.2,accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));load(page,port);decorate(page,info.get('narration',True))
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        frame=0;position=(1470.,815.);limit=math.ceil(total*FPS)
        def capture():
            nonlocal frame
            if frame>=limit:return
            page.evaluate('dt=>echoRoom.advance(dt)',1/FPS)
            text=next((s for a,z,s in cues if a<=frame/FPS<z),'')
            page.evaluate('''({text,x,y})=>{document.getElementById('video-caption').textContent=text;const c=document.getElementById('video-cursor');c.style.left=x+'px';c.style.top=y+'px';}''',{'text':text,'x':position[0],'y':position[1]})
            encoder.stdin.write(page.screenshot(type='png'));frame+=1
        def hold(until):
            while frame<min(round(until*FPS),limit):capture()
        def move(target):
            nonlocal position
            start=position;dx=target[0]-start[0];dy=target[1]-start[1];length=max(1,math.hypot(dx,dy))
            for i in range(9):
                u=i/8;e=u*u*(3-2*u);arc=math.sin(math.pi*e)*min(12,length*.025)
                position=(start[0]+dx*e-dy/length*arc,start[1]+dy*e+dx/length*arc);capture()
            hold(frame/FPS+.1)
        def click(selector):
            r=page.locator(selector).bounding_box();move((r['x']+r['width']/2,r['y']+r['height']/2));page.locator(selector).click()
            if selector=='#play':
                events.append({'time':frame/FPS,'wav':base64.b64decode(page.evaluate('echoRoom.audioBase64()')),'mode':page.evaluate('echoRoom.snapshot().mode')})
            actions.append({'time':frame/FPS,'action':'click','target':selector});capture()
        def drag(selector,target=None,offset=None):
            nonlocal position
            el=page.locator(selector);r=el.bounding_box()
            if target is not None:
                lo=float(el.get_attribute('min'));hi=float(el.get_attribute('max'));old=float(el.input_value());x=lambda v:r['x']+7+(r['width']-14)*(v-lo)/(hi-lo)
                start=(x(old),r['y']+r['height']/2);end=(x(target),start[1])
            else:start=(r['x']+r['width']/2,r['y']+r['height']/2);end=(start[0]+offset[0],start[1]+offset[1])
            move(start);page.mouse.move(*position);page.mouse.down()
            for i in range(21):
                u=i/20;e=u*u*(3-2*u);position=(start[0]+(end[0]-start[0])*e,start[1]+(end[1]-start[1])*e);page.mouse.move(*position);capture()
            page.mouse.up();actions.append({'time':frame/FPS,'action':'drag','target':selector});capture()
        start=0.
        try:
            for i,span in enumerate(durations):
                if i==1:drag('#listener',offset=(-65,-35))
                elif i==2:click('[data-mode="direct"]')
                elif i==3:click('[data-mode="room"]')
                elif i==4:drag('#absorption',target=95)
                elif i==5:click('[data-preset="corridor"]')
                elif i==6:click('[data-preset="studio"]')
                elif i==7:
                    click('#reset')
                    if not os.environ.get('ECHO_INLINE_PREVIEW'):
                        with page.expect_download() as pending:click('#export')
                        pending.value.save_as(str(work/'exported-echo-room.wav'))
                hold(start+span+.15)
                if i<7:click('#play')
                hold(start+span+3);start+=span+3
                print(f'Captured scene {i+1}/{len(durations)} at {frame/FPS:.1f}s',flush=True)
        finally:encoder.stdin.close();result=encoder.wait(timeout=120);b.close()
        if result:raise RuntimeError('Video encoder failed')
        if errors:raise RuntimeError(repr(errors))
    mixed=work/'mixed.wav';mix_audio(track,events,mixed)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(silent),'-i',str(mixed),'-t',f'{total:.3f}','-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart',str(output)],check=True)
    subprocess.run(['ffmpeg','-v','error','-i',str(output),'-f','null','-'],check=True)
    meta={'project':PROJECT.name,'built_by':'GPT-6 Astra','resolution':[WIDTH,HEIGHT],'fps':FPS,'duration_seconds':duration(output),'demo_url':URL,'capture':'real app controls in a local browser; deterministic visual time','audio':info,'visual_time_scale':.06,'segment_durations':durations,'sound_effects':[{'time':x['time'],'mode':x['mode'],'source':'unchanged WAV samples synthesized by the app'} for x in events],'actions':actions}
    output.with_suffix('.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print(json.dumps(meta,ensure_ascii=False),flush=True)

def gallery_shot():
    with serve() as port,sync_playwright() as p:
        b=launch(p);page=b.new_page(viewport={'width':1280,'height':800});load(page,port);page.evaluate('echoRoom.setClock(.03)');data=page.screenshot();b.close()
    dest=ROOT_DIR/'gallery/shots'/f'{PROJECT.name}.png';dest.parent.mkdir(parents=True,exist_ok=True);Image.open(io.BytesIO(data)).resize((800,500),Image.Resampling.LANCZOS).save(dest)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preview',type=Path);parser.add_argument('--captions-only',action='store_true');parser.add_argument('--output',type=Path,default=PROJECT/'video/echo-room.mp4');args=parser.parse_args()
    if args.preview:preview(args.preview);return
    work=Path(tempfile.mkdtemp(prefix='echo-room-video-build-'));output=args.output.resolve();output.parent.mkdir(parents=True,exist_ok=True)
    track,durations,info=narration(work,args.captions_only);render(output,work,track,durations,info);gallery_shot()
    print('Temporary build directory:',work,flush=True)
if __name__=='__main__':main()
