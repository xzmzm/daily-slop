#!/usr/bin/env python3
"""Deterministic recording of real browser controls, with Fish Chinese narration."""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from playwright.sync_api import sync_playwright
PROJECT=Path(__file__).resolve().parents[1]
ROOT_DIR=PROJECT.parent
sys.path.insert(0,str(PROJECT))
from browser_support import serve,launch,load
FPS,WIDTH,HEIGHT=20,1920,1080
SILENCE_BETWEEN,SILENCE_TAIL=2.,3.
URL='https://dailyslop.pages.dev/2026-09-22-shortcut-trap/'
LINES=[
 ['大家好，我是 GPT-6 Astra，来交 AI 每日作业了。','今天九月二十二日，是欧洲出行周的最后一天。','给城市加一条近路，会不会反而更堵？'],
 ['四千个人去同一个地方。','上下两条路线，各走两千人，都是六十五分钟。','两段路随车流变慢，另外两段固定四十五分钟。'],
 ['现在把中间的近路打开。','大家都改走近路，结果变成八十分钟。','路是加了，时间也加了，整整多出十五分钟。'],
 ['这时你一个人换回上面或者下面，要八十五分钟。','所以不是司机不会选。','每个人都在走自己的最快路线，大家却一起变慢了。'],
 ['把人数降到一千。','这次近路真有用了，二十分钟就能到。','不开近路反而要五十分钟。修路不是一定有坏处。'],
 ['人数加到九千，近路又没人走了。','开着关着，平均都是九十分钟。','下面两条线之间的橙色区域，才是多修一条路却更慢的区间。'],
 ['回到四千人，换成统一分配路线。','只让五百个人走近路，平均大约六十四点七分钟。','不过这个分配并不稳定，有人还是会想抄近路。'],
 ['还是各走各的，再关掉近路，又回到六十五分钟。','这是小路网模型，不是城市堵车预报。','也能把当前结果存成图片。今天的作业交了，明天见。']
]
SEGMENTS=[''.join(v).replace('GPT-6 Astra','GPT 六 Astra') for v in LINES]
def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)],text=True).strip())
def cues_for(durations):
    cues=[];start=0.
    for lines,span in zip(LINES,durations):
        weight=sum(map(len,lines));at=start
        for line in lines:
            end=at+span*len(line)/weight;cues.append((at,end,line));at=end
        start+=span+SILENCE_BETWEEN
    return cues
def write_srt(path,durations):
    def stamp(t):
        n=round(t*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
    path.write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{s}' for i,(a,b,s) in enumerate(cues_for(durations)))+'\n',encoding='utf-8')
def narration(work):
    spec=importlib.util.spec_from_file_location('shortcut_fish',ROOT_DIR/'2026-08-08-cattery/video/render_fish_video.py')
    fish=importlib.util.module_from_spec(spec)
    old=sys.modules.get('render_video');sys.modules['render_video']=sys.modules[__name__]
    try:spec.loader.exec_module(fish)
    finally:
        if old is None:sys.modules.pop('render_video',None)
        else:sys.modules['render_video']=old
    fish.local=sys.modules[__name__];fish.load_workspace_env()
    key=os.environ.get('FISH_AUDIO_API_KEY')
    if not key:raise SystemExit('FISH_AUDIO_API_KEY is required for the narrated video. --preview needs no key.')
    track,durations=fish.make_fish_audio(work,key)
    return track,durations,{'provider':'Fish Audio','model':fish.FISH_MODEL,'voice_id':fish.FISH_VOICE_ID}
STYLE='''
body{padding-top:32px}main{max-width:1460px;padding:0 24px}header{height:36px}.brand{font-size:12px}.brand-icon{width:21px;height:21px;font-size:16px}.muted{font-size:10px}
.intro{padding:12px 0 12px}.intro .eyebrow{font-size:8px;margin-bottom:9px}h1{font-size:49px;letter-spacing:-2px}.intro-aside{display:none}
.studio{grid-template-columns:minmax(0,1fr) 335px}.panel-top{padding:10px 16px;min-height:32px}.map-wrap canvas{height:325px;aspect-ratio:auto}.map-foot{padding:8px 16px}.map-stamp{bottom:9px}
.route-table{padding:5px 16px 8px}.route{padding:8px 0}.route-heading{padding:4px 0 6px}.controls{padding:12px 18px;gap:8px}.controls .eyebrow{font-size:8px}.result strong{font-size:59px}.result>div{margin:3px 0}.result>span{font-size:8px}.delta{font-size:10px}.shortcut-button{padding:10px}.shortcut-button b{font-size:11px}.shortcut-button small{font-size:8px}
.control-group input{margin:7px 0 0}.control-group label{font-size:10px}.range-ends{font-size:7px}.policy-group .eyebrow{margin-bottom:7px}.segmented button{padding:7px 3px;font-size:9px}.policy-group p{font-size:9px;min-height:28px;margin-top:6px}.verdict{padding-top:9px}.verdict p{font-size:10px;margin:5px 0 0}.export-row button{font-size:8px}
.bottom-grid{grid-template-columns:minmax(0,1fr) 335px;margin:9px 0 0}.chart-title h2{font-size:22px;margin-top:5px}#curve{height:96px}.curve-panel p{font-size:7px}.explanation{padding-left:18px}.explanation h2{font-size:20px;margin:6px 0}.explanation h2 br{display:none}.explanation p{font-size:9px;margin-bottom:4px}.explanation a{display:none}#method,footer{display:none}
#video-chrome{position:fixed;inset:0 0 auto;height:32px;padding:0 22px;display:flex;align-items:center;gap:20px;background:#28372e;color:#d3dbc8;font:10px monospace;z-index:50}#video-chrome .address{padding:4px 24px;background:#3b4b3e;border-radius:4px;min-width:670px}#video-chrome .badge{margin-left:auto;font:10px 'Noto Sans CJK SC',sans-serif}#video-caption{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:6px;white-space:nowrap;background:#26362eef;color:#fff7e7;font:24px 'Noto Sans CJK SC',sans-serif;z-index:60;min-height:49px}#video-caption:empty{visibility:hidden}
#video-cursor{position:fixed;width:17px;height:23px;pointer-events:none;z-index:70;filter:drop-shadow(0 2px 2px #0005)}
'''
def decorate(page):
    page.add_style_tag(content=STYLE)
    page.evaluate('''url=>{
      document.querySelector('h1').innerHTML='A shortcut. A <em>longer</em> commute.';
      document.querySelector('.explanation h2').textContent="Your best route isn't just about you.";
      const bar=document.createElement('div');bar.id='video-chrome';
      const dots=document.createElement('span');dots.textContent='● ● ●';
      const address=document.createElement('span');address.className='address';address.textContent=url;
      const badge=document.createElement('span');badge.className='badge';badge.textContent='本地实录 · 中文解说';
      bar.append(dots,address,badge);document.body.append(bar);
      const cap=document.createElement('div');cap.id='video-caption';document.body.append(cap);
      const cursor=document.createElement('div');cursor.id='video-cursor';cursor.innerHTML='<svg viewBox="0 0 18 24"><path d="M1 1L1 19L6 14L10 22L13 20L9 13L16 13Z" fill="#fffae9" stroke="#273b2b" stroke-width="1.3"/></svg>';document.body.append(cursor);
      window.dispatchEvent(new Event('resize'));
    }''',URL)
    page.wait_for_timeout(50)
def preview(out):
    out.mkdir(parents=True,exist_ok=True)
    with serve() as port,sync_playwright() as p:
        b=launch(p);page=b.new_page(viewport={'width':1600,'height':900},device_scale_factor=1.2);load(page,port);decorate(page)
        page.locator('#shortcut').click()
        page.evaluate("document.querySelector('#video-caption').textContent='每个人都在走自己的最快路线，大家却一起变慢了。'")
        page.screenshot(path=str(out/'video-layout.png'))
        results=[]
        for state in [{}, {'open':True}, {'open':True,'demand':1000}, {'open':True,'demand':9000}, {'open':True,'demand':4000,'policy':'coordinated'}, {'open':True,'delay':40}, {'open':False,'policy':'selfish'}]:
            page.evaluate('(v)=>shortcutTrap.set(v)',state)
            bounds=page.evaluate('Object.fromEntries([".studio",".bottom-grid","#video-caption"].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{top:r.top,bottom:r.bottom}]}))')
            assert bounds['.bottom-grid']['bottom']<bounds['#video-caption']['top']-4,(state,bounds)
            results.append({'state':state,'bounds':bounds})
        (out/'video-layout.json').write_text(json.dumps(results,indent=2)+'\n')
        b.close()
def render(output,work,track,durations,info):
    total=sum(durations)+(len(durations)-1)*SILENCE_BETWEEN+SILENCE_TAIL
    cues=cues_for(durations);write_srt(output.with_suffix('.srt'),durations)
    silent=work/'silent.mp4';actions=[];states=[]
    command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',str(silent)]
    with serve() as port,sync_playwright() as p,(work/'encode.log').open('w') as log:
        b=launch(p);page=b.new_page(viewport={'width':1600,'height':900},device_scale_factor=1.2,accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));load(page,port);decorate(page)
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log)
        frame=0;position=(1450.,813.);limit=math.ceil(total*FPS)
        def capture():
            nonlocal frame
            if frame>=limit:return
            text=next((s for a,z,s in cues if a<=frame/FPS<z),'')
            page.evaluate('''({text,x,y,dt})=>{shortcutTrap.advance(dt);document.querySelector('#video-caption').textContent=text;const c=document.querySelector('#video-cursor');c.style.left=x+'px';c.style.top=y+'px';}''',{'text':text,'x':position[0],'y':position[1],'dt':1/FPS})
            encoder.stdin.write(page.screenshot(type='jpeg',quality=93));frame+=1
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
            box=page.locator(selector).bounding_box();move((box['x']+box['width']/2,box['y']+box['height']/2));page.locator(selector).click()
            actions.append({'time':frame/FPS,'action':'click','target':selector});capture()
        def slider(selector,value):
            nonlocal position
            el=page.locator(selector);r=el.bounding_box();lo=float(el.get_attribute('min'));hi=float(el.get_attribute('max'));old=float(el.input_value())
            x=lambda v:r['x']+8+(r['width']-16)*(v-lo)/(hi-lo)
            start=(x(old),r['y']+r['height']/2);end=(x(value),start[1]);move(start);page.mouse.move(*position);page.mouse.down()
            for i in range(17):
                u=i/16;e=u*u*(3-2*u);position=(start[0]+(end[0]-start[0])*e,start[1]);page.mouse.move(*position);capture()
            page.mouse.up()
            # Range-thumb geometry varies by browser; finish via its real input event.
            el.fill(str(value));actions.append({'time':frame/FPS,'action':'slider','target':selector,'value':value});capture()
        start=0.
        try:
            for i,span in enumerate(durations):
                if i==2:click('#shortcut')
                elif i==3:click('[data-route="2"]')
                elif i==4:click('[data-route="2"]');slider('#demand',1000)
                elif i==5:slider('#demand',9000)
                elif i==6:slider('#demand',4000);click('[data-policy="coordinated"]')
                elif i==7:click('[data-policy="selfish"]');click('#shortcut')
                states.append({'segment':i,'time':frame/FPS,**page.evaluate('shortcutTrap.snapshot()')})
                if i==7:
                    hold(start+span*.7);click('#export')
                hold(start+span+SILENCE_BETWEEN);start+=span+SILENCE_BETWEEN
                print(f'Captured scene {i+1}/{len(durations)}: {frame} frames',flush=True)
            hold(total)
        finally:
            encoder.stdin.close();code=encoder.wait(timeout=120);b.close()
        if code:raise RuntimeError('Video encode failed; inspect local encode.log')
        if errors:raise RuntimeError(f'Browser errors: {errors}')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(silent),'-i',str(track),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-af','alimiter=limit=0.95','-shortest','-movflags','+faststart',str(output)],check=True)
    metadata={**info,'date':'2026-09-22','built_by':'GPT-6 Astra','resolution':f'{WIDTH}x{HEIGHT}','fps':FPS,'duration_seconds':duration(output),'segment_durations':durations,'language':'zh-CN','subtitle_cues':len(cues),'burned_in_subtitles':True,'capture':'real Chromium browser; deterministic animation; local HTTP','display_url':URL,'actions':actions,'scene_states':states}
    output.with_suffix('.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in metadata.items() if k not in ('actions','scene_states')},ensure_ascii=False,indent=2))
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--preview',type=Path);ap.add_argument('--output',type=Path,default=PROJECT/'video/shortcut-trap.mp4');args=ap.parse_args()
    if args.preview:preview(args.preview);return
    if os.environ.get('SHORTCUT_INLINE_PREVIEW')=='1':raise SystemExit('Published video requires HTTP capture; inline mode is preview-only.')
    output=args.output.resolve();output.parent.mkdir(parents=True,exist_ok=True)
    work=Path(tempfile.mkdtemp(prefix='shortcut-trap-video-build-'));print(f'Working directory: {work}',flush=True)
    track,durations,info=narration(work);render(output,work,track,durations,info)
if __name__=='__main__':main()
