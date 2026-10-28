"""Out of Order browser recording adapter for the shared Fish Audio workflow."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT_DIR=Path(__file__).resolve().parents[2]
PROJECT=Path(__file__).resolve().parents[1]
URL='https://dailyslop.pages.dev/2026-10-29-out-of-order/'
spec=importlib.util.spec_from_file_location('cattery_capture',ROOT_DIR/'2026-08-08-cattery/video/render_video.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
FPS,WIDTH,HEIGHT=base.FPS,base.WIDTH,base.HEIGHT
SILENCE_BETWEEN,SILENCE_TAIL=base.SILENCE_BETWEEN,base.SILENCE_TAIL
free_port,wait_for_server,duration=base.free_port,base.wait_for_server,base.duration
SUBTITLE_LINES=[
 ['大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。','今天十月二十九日。1969 年的这一天，加州大学洛杉矶分校试着向斯坦福研究所发送 LOGIN。','只到了 L 和 O，系统就崩了。今天的小实验叫 Out of Order，研究消息分成几块以后，谁先到，谁还得等。'],
 ['先让两条路花一样长的时间。六块消息依次出发，也依次到达。','下面每收到一块，就能多读一截。就像快递按门牌号排队，暂时没有人插队。'],
 ['现在让下边这条路绕远。第一、第三、第五块先到了。','可第三块不能直接接在第一块后面。第二块还没到，后面的内容只能先放在接收缓冲区。','收到多少，和能读多少，是两回事。'],
 ['再让第二块丢在半路。其他五块都到了，句子还是卡在开头。','打开重试，第二块换条路再跑一趟。空缺一补上，后面等着的几块就一起接上了。'],
 ['关掉重试再看一次。等到最后，缺的那块也不会自己变出来。','这里的路线和重试时间都是教学用的设定，不是当年网络的复刻，也不是完整的 TCP。','网络可以乱序送达，读消息的人还是喜欢顺着读。今天作业交完，明天见。']]
SEGMENTS=[''.join(lines).replace('GPT-6.1 Sol','GPT 六点一 Sol').replace('1969 年','一九六九年') for lines in SUBTITLE_LINES]
base.SEGMENTS,base.SUBTITLE_LINES=SEGMENTS,SUBTITLE_LINES
write_srt=base.write_srt
CSS='''main{max-width:1820px;padding:0 36px}header{height:39px}.intro{padding:19px 0 20px}h1,.intro h1{font-size:85px}.intro-copy{font-size:18px}.intro-copy span{font-size:12px}.workbench{grid-template-columns:minmax(0,1fr) 340px}#map{height:300px;max-height:300px}.panel-label{padding:12px 21px}.receiver{padding-bottom:15px}aside{padding:20px 25px}aside h2{font-size:31px;margin:8px 0 18px}.choices{margin:14px 0}.choices button{min-height:65px;padding:10px}.choices button div{font-size:15px}.control-note{margin:7px 0 12px}.history{padding:15px 0;grid-template-columns:140px 1.5fr 1fr}.history p{font-size:12px}.history .model-note{font-size:10px}.history h2{font-size:24px}footer{padding:12px 0}.assembly-heading{padding-top:15px}.arrival span{font-size:17px}#message-output{font-size:32px}#video-caption{font-size:28px;max-width:1780px;bottom:15px}.route-name{font-size:13px}.machine-label{font-size:11px}'''
def setup(page,url):
 page.goto(url,wait_until='networkidle');page.evaluate('packetTrip.setRecordingClock(true);packetTrip.seek(0)')
 base.add_browser_chrome(page);base.add_caption_overlay(page);base.add_cursor_overlay(page)
 page.locator('#video-browser-chrome .address').evaluate('(e,s)=>e.textContent=s',URL)
 page.locator('#video-browser-chrome .badge').evaluate("e=>e.textContent='LOCAL RECORDING · OUT OF ORDER'")
 page.add_style_tag(content=CSS);base.set_cursor(page,(1850,980))
def framing(page):
 caption=page.locator('#video-caption').bounding_box()['y']
 b=page.locator('.workbench').bounding_box()
 assert b['y']+b['height']<caption-15,(b,caption)
def capture_frames(work_dir,durations,port):
 frames=work_dir/'frames';frames.mkdir();cues=base.caption_cues(durations)
 speed=1.;frame=0;timeline=0.;pos=(1850,980);cache=None;last=None;errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch();page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT})
  page.on('pageerror',lambda e:errors.append(str(e)))
  setup(page,f'http://127.0.0.1:{port}/{PROJECT.name}/')
  page.locator('#video-caption').evaluate('(e,s)=>e.textContent=s',SUBTITLE_LINES[0][0]);framing(page)
  def snap(clicking=False):
   nonlocal frame,timeline,cache,last
   page.evaluate('(speed)=>packetTrip.advance(1000/15*speed)',speed)
   key=(page.evaluate('packetTrip.state.time'),page.locator('#retry').is_checked(),page.evaluate('packetTrip.state.run.scenario'),base.caption_at(timeline,cues),pos,clicking)
   out=frames/f'{frame:06d}.png'
   if cache==key:shutil.copyfile(last,out)
   else:base.capture(page,out,timeline,cues,pos,clicking)
   cache,last=key,out;frame+=1;timeline=frame/FPS
  def hold(seconds):
   for _ in range(max(0,round(seconds*FPS))):snap()
  def click(selector):
   nonlocal pos
   b=page.locator(selector).bounding_box();target=(b['x']+b['width']/2,b['y']+b['height']/2);start=pos
   dx,dy=target[0]-start[0],target[1]-start[1];dist=max(1,math.hypot(dx,dy));bend=min(16,dist*.04)
   control=((start[0]+target[0])/2-dy/dist*bend,(start[1]+target[1])/2+dx/dist*bend)
   for i in range(7):
    u=(i+1)/7;u=u*u*(3-2*u);v=1-u;pos=(v*v*start[0]+2*v*u*control[0]+u*u*target[0],v*v*start[1]+2*v*u*control[1]+u*u*target[1]);page.mouse.move(*pos);snap()
   hold(.15);page.mouse.click(*pos);snap(True);hold(.2)
  start=0.
  for index,seconds in enumerate(durations):
   speed=2.5 if index==3 else 1.
   end=start+seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
   if index==0:
    page.locator('#play').click();page.evaluate('packetTrip.seek(0)')
   elif index==1:click('[data-scene=even]')
   elif index==2:
    click('[data-scene=detour]');hold(4.2);click('#play');page.evaluate('packetTrip.seek(4.4)');hold(4)
    assert page.evaluate('packetTrip.state.buffered.length')==2
    click('#play')
   elif index==3:
    # Leave a visible gap first; enable retry during the explanation.
    if page.locator('#retry').is_checked():click('#retry')
    click('[data-scene=missing]');hold(3.1)
    assert page.evaluate('packetTrip.state.count')==1
    click('#retry');hold(3.4)
    assert page.evaluate('packetTrip.state.complete')
   elif index==4:
    click('#retry');hold(9.2)
    assert not page.evaluate('packetTrip.state.complete')
   hold(end-timeline)
   assert timeline<end+.15,(index,timeline,end)
   print(f'Captured scene {index+1}/{len(durations)} at {timeline:.1f}s',flush=True);start=end
  browser.close()
 assert not errors,errors
 return frames
def assemble(work_dir,frames_dir,narration,subtitles,output):
 base.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(FPS),'-i',str(frames_dir/'%06d.png'),'-i',str(narration),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',str(output)])
def preview(output):
 output.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch();page=browser.new_page(viewport={'width':WIDTH,'height':HEIGHT})
  setup(page,(PROJECT/'index.html').as_uri());page.locator('#video-caption').evaluate('(e,s)=>e.textContent=s',SUBTITLE_LINES[0][0]);framing(page)
  page.screenshot(path=str(output/'intro.png'));browser.close()
 print(output)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--preview',type=Path,required=True);preview(parser.parse_args().preview)
