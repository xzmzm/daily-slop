"""Azimuth browser capture for the shared Fish Audio renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT_DIR=Path(__file__).resolve().parents[2]
PROJECT=Path(__file__).resolve().parents[1]
URL='https://dailyslop.pages.dev/2026-10-27-azimuth/'
spec=importlib.util.spec_from_file_location('cattery_capture',ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
FPS,WIDTH,HEIGHT=base.FPS,base.WIDTH,base.HEIGHT
SILENCE_BETWEEN,SILENCE_TAIL=base.SILENCE_BETWEEN,base.SILENCE_TAIL
free_port,wait_for_server,duration=base.free_port,base.wait_for_server,base.duration
SUBTITLE_LINES=[
 ['大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。','今天十月二十七日，世界音像遗产日。今天的作业，是给磁带机拧一颗看不见的螺丝。'],
 ['磁带上的声音还在，可播放磁头歪了零点四度，高音就少了一大截。','一千赫兹几乎没事，一万赫兹已经掉了十七点五分贝。耳朵觉得闷，磁带可能觉得冤。'],
 ['把角度慢慢转回去，橙色曲线抬起来了。','磁头上端和下端读到的波形重新对齐，不再互相抵消。角度归零，高频回来了。'],
 ['同样的偏角，比较更快录制的磁带，凹口会跑到更高的频率。','这里保持声音频率不变，只比较带速的影响，不是在给一首歌按快进。'],
 ['换一盘录制角度未知的磁带，零度也未必正确。','找的是播放磁头和原来录音磁头一致的位置。转到这里，曲线又平了。','做数字转录前先对准。已经抵消掉的频率，事后拧高音旋钮也救不回来。今天作业交完，明天见。'],
]
SEGMENTS=[''.join(lines).replace('GPT-6.1 Sol','GPT 六点一 Sol') for lines in SUBTITLE_LINES]
base.SEGMENTS,base.SUBTITLE_LINES=SEGMENTS,SUBTITLE_LINES
write_srt=base.write_srt
CSS='''main{max-width:1810px;padding:0 35px}header{height:42px}.intro{padding:12px 0 12px}h1{font-size:85px}.intro .eyebrow{margin-bottom:8px}.bench{grid-template-columns:minmax(0,1fr) 370px}aside{padding:18px 23px}aside>.eyebrow{margin-bottom:6px}.angle-row h2{margin:8px 0 13px}.status{margin:15px 0;min-height:88px}.status h3{font-size:22px}.status p{font-size:12px}.audio-note{margin:9px 0 14px}.speed{padding-top:12px}.challenge{margin-top:13px;padding-top:7px}.challenge p{font-size:10px}.panel-head,.response-head{padding:13px 20px}#tape{height:222px}.diagram-key{padding:9px 20px 14px}#response{height:150px}.meters>div{padding:12px 20px}.meters strong{font-size:27px}.field-note{padding:15px 0;grid-template-columns:1fr 1.4fr 2.5fr}.field-note h2{font-size:27px}.field-note>p:last-child{font-size:12px;max-width:none}footer{display:none}#video-caption{font-size:29px;bottom:17px;max-width:1780px}'''

def setup(page,url):
 page.goto(url,wait_until='networkidle');page.wait_for_function('!!window.azimuth')
 base.add_browser_chrome(page)
 page.locator('#video-browser-chrome .address').evaluate('(e,s)=>e.textContent=s',URL)
 page.locator('#video-browser-chrome .badge').evaluate("e=>e.textContent='LOCAL RECORDING · AZIMUTH'")
 base.add_caption_overlay(page);base.add_cursor_overlay(page);page.add_style_tag(content=CSS)
 page.evaluate('azimuth.update()');base.set_cursor(page,(1810,970))

def framing(page):
 cap=page.locator('#video-caption').bounding_box()['y']
 for selector in ['.bench','.field-note']:
  b=page.locator(selector).bounding_box();assert b['y']+b['height']<cap-10,(selector,b,cap)

def capture_frames(work_dir,durations,port):
 frames=work_dir/'frames';frames.mkdir();cues=base.caption_cues(durations)
 frame,timeline,pos,revision=0,0.,(1810,970),0
 cache,last=None,None
 errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch();page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT},device_scale_factor=1)
  page.on('pageerror',lambda e:errors.append(str(e)))
  setup(page,f'http://127.0.0.1:{port}/{PROJECT.name}/')
  page.locator('#video-caption').evaluate('(e,s)=>e.textContent=s',SUBTITLE_LINES[0][0]);framing(page)
  def snap(clicking=False):
   nonlocal frame,timeline,cache,last
   key=(revision,base.caption_at(timeline,cues),pos,clicking);out=frames/f'{frame:06d}.png'
   if key==cache:shutil.copyfile(last,out)
   else:base.capture(page,out,timeline,cues,pos,clicking)
   cache,last=key,out;frame+=1;timeline=frame/FPS
  def hold(seconds):
   for _ in range(max(0,round(seconds*FPS))):snap()
  def move(target,seconds=.5,drag=False):
   nonlocal pos,revision
   start=pos;dx,dy=target[0]-start[0],target[1]-start[1];distance=max(1,math.hypot(dx,dy));bend=min(16,distance*.04)
   control=((start[0]+target[0])/2-dy/distance*bend,(start[1]+target[1])/2+dx/distance*bend)
   count=round(seconds*FPS)
   for i in range(count):
    u=(i+1)/count;u=u*u*(3-2*u);v=1-u
    pos=(v*v*start[0]+2*v*u*control[0]+u*u*target[0],v*v*start[1]+2*v*u*control[1]+u*u*target[1]);page.mouse.move(*pos)
    if drag:revision+=1
    snap()
   hold(.15)
  def click(selector):
   nonlocal revision
   b=page.locator(selector).bounding_box();move((b['x']+b['width']/2,b['y']+b['height']/2));page.mouse.click(*pos);revision+=1;snap(True);hold(.2)
  def tune(angle,seconds=2):
   b=page.locator('#angle').bounding_box()
   x=lambda value:b['x']+8+(value+.6)/1.2*(b['width']-16)
   move((x(page.evaluate('azimuth.state.angle')),b['y']+b['height']/2));page.mouse.down();move((x(angle),pos[1]),seconds,True);page.mouse.up();hold(.2)
   assert abs(page.evaluate('azimuth.state.angle')-angle)<.011
  start=0.
  for index,seconds in enumerate(durations):
   end=start+seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
   if index==0:pass
   elif index==1:hold(2)
   elif index==2:
    hold(1);tune(0,3);assert abs(page.evaluate('azimuth.err()'))<.011
   elif index==3:
    tune(.4,1);click('#fast');hold(3);click('#slow')
   else:
    click('#new-tape');hold(2);tune(-.175,3);assert page.locator('#status-tag').inner_text()=='IN ALIGNMENT'
   hold(end-timeline);assert timeline<=end+.2,(index,timeline,end)
   print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s',flush=True);start=end
  browser.close()
 if errors:raise RuntimeError(str(errors))
 return frames

def assemble(work_dir,frames_dir,narration,subtitles,output):
 base.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),'-i',str(frames_dir/'%06d.png'),'-i',str(narration),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',str(output)])

def preview(output):
 output.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  b=p.chromium.launch();page=b.new_page(viewport={'width':WIDTH,'height':HEIGHT});setup(page,(PROJECT/'index.html').as_uri())
  page.locator('#video-caption').evaluate('(e,s)=>e.textContent=s',SUBTITLE_LINES[0][0]);framing(page);page.screenshot(path=str(output/'intro.png'));b.close()
 print(output)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--preview',type=Path,required=True);preview(parser.parse_args().preview)
