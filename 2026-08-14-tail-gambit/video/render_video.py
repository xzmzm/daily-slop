#!/usr/bin/env python3
"""Render the tail-gambit Chinese walkthrough with local fallback speech."""
from __future__ import annotations
import argparse, json, socket, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

FPS=15; DESIGN_WIDTH=1280; DESIGN_HEIGHT=720; WIDTH=1920; HEIGHT=1080
SILENCE_BETWEEN=.22; SILENCE_TAIL=1.6
PROJECT_DIR=Path(__file__).resolve().parent.parent; ROOT_DIR=PROJECT_DIR.parent
VIDEO_DIR=Path(__file__).resolve().parent; SLUG="2026-08-14-tail-gambit"
SEGMENTS=[
"大家好，我是 GPT 五点六 Sol，来交 AI 每日作业了。今天是八月十四日，世界蜥蜴日。我做了一个叫 Tail Gambit 的断尾实验。它讲的是一个很狠、但很划算的决定：丢掉一部分身体，换整只蜥蜴逃走。",
"按下开始，捕食者会在两点四秒后咬到尾巴。等它真正扑过来，再按掉尾巴。太早，捕食者会重新盯上身体；太晚，尾巴还没断，嘴就先到了。现在试一次，蜥蜴跑了，捕食者却被还在乱动的尾巴留下。",
"断下来的尾巴没有等大脑继续发指令。尾巴里的局部神经回路，还会让左右肌肉交替收缩，波动沿着一节一节传播，再慢慢衰减。右边的示波器和地上的尾巴，用的是同一条阻尼行波公式。",
"壁虎、石龙子和变色树蜥，是三种游戏策略，不是假装精确的物种数据。石龙子的尾巴抖得最猛，时机也更窄。换成它，再来一次：先等捕食者承诺，短短一下，断尾，逃跑。",
"但这不是免费技能。尾巴储存能量，断掉以后冲刺和平衡也会受影响。拖动天数，伤口长出替代尾巴，可里面不是原来那串脊椎，而是一根不分节的软骨管。能再长，不等于原样撤销。去亲手赌一次两点四秒吧。",
]
SUBTITLE_LINES=[
["大家好，我是 GPT 五点六 Sol，来交 AI 每日作业了。","今天是八月十四日，世界蜥蜴日。","我做了一个叫 Tail Gambit 的断尾实验。","它讲的是一个很狠、但很划算的决定：","丢掉一部分身体，换整只蜥蜴逃走。"],
["按下开始，捕食者会在两点四秒后咬到尾巴。","等它真正扑过来，再按掉尾巴。","太早，捕食者会重新盯上身体；太晚，尾巴还没断，嘴就先到了。","现在试一次，蜥蜴跑了，捕食者却被还在乱动的尾巴留下。"],
["断下来的尾巴没有等大脑继续发指令。","尾巴里的局部神经回路，还会让左右肌肉交替收缩，","波动沿着一节一节传播，再慢慢衰减。","右边的示波器和地上的尾巴，用的是同一条阻尼行波公式。"],
["壁虎、石龙子和变色树蜥，是三种游戏策略，不是假装精确的物种数据。","石龙子的尾巴抖得最猛，时机也更窄。","换成它，再来一次：先等捕食者承诺，短短一下，断尾，逃跑。"],
["但这不是免费技能。尾巴储存能量，断掉以后冲刺和平衡也会受影响。","拖动天数，伤口长出替代尾巴，","可里面不是原来那串脊椎，而是一根不分节的软骨管。","能再长，不等于原样撤销。去亲手赌一次两点四秒吧。"],
]
def run(cmd): print("+"," ".join(map(str,cmd)),flush=True); subprocess.run(list(map(str,cmd)),check=True)
def duration(path):
 r=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True,check=True);return float(r.stdout)
def free_port(preferred=8765):
 with socket.socket() as s:
  try:s.bind(("127.0.0.1",preferred));return preferred
  except OSError:s.bind(("127.0.0.1",0));return s.getsockname()[1]
def wait_for_server(port):
 for _ in range(80):
  try: urllib.request.urlopen(f"http://127.0.0.1:{port}/{SLUG}/",timeout=.25);return
  except Exception:time.sleep(.1)
 raise RuntimeError("local server did not start")
def timecode(v):
 ms=round(v*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000);return f"{h:02}:{m:02}:{s:02},{ms:03}"
def caption_cues(ds):
 out=[];cursor=0
 for idx,d in enumerate(ds):
  weights=[max(1,len(x.replace(" ",""))) for x in SUBTITLE_LINES[idx]];total=sum(weights);local=cursor
  for line,weight in zip(SUBTITLE_LINES[idx],weights):end=local+d*weight/total;out.append((local,end,line));local=end
  cursor+=d+(SILENCE_BETWEEN if idx<len(ds)-1 else 0)
 return out
def caption_at(t,cues):
 return next((x for a,b,x in cues if a<=t<b),"")
def write_srt(path,ds):path.write_text("\n".join(f"{i}\n{timecode(a)} --> {timecode(b)}\n{x}\n" for i,(a,b,x) in enumerate(caption_cues(ds),1)),encoding="utf-8")
def make_audio(work):
 ad=work/"audio";ad.mkdir();ds=[]
 for i,text in enumerate(SEGMENTS):
  a=ad/f"segment-{i:02}.aiff";w=ad/f"segment-{i:02}.wav";run(["say","-v","Tingting","-r","188","-o",a,text]);run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",a,"-af","asetrate=22050*1.10,aresample=44100,atempo=.98","-c:a","pcm_s16le",w]);ds.append(duration(w))
 silence=ad/"silence.wav";tail=ad/"tail.wav";run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t",SILENCE_BETWEEN,"-c:a","pcm_s16le",silence]);run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t",SILENCE_TAIL,"-c:a","pcm_s16le",tail])
 entries=[]
 for i in range(len(SEGMENTS)):entries.append(f"file '{ad/f'segment-{i:02}.wav'}'");entries += ([f"file '{silence}'"] if i<len(SEGMENTS)-1 else [])
 entries.append(f"file '{tail}'");lst=ad/"concat.txt";lst.write_text("\n".join(entries)+"\n");out=work/"narration.wav";run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",out]);return out,ds
def overlays(page):
 page.add_style_tag(content="""#video-browser-chrome{position:fixed;inset:0 0 auto;height:44px;z-index:2147483647;display:flex;align-items:center;gap:13px;padding:0 17px;background:#111411;border-bottom:1px solid #3a3e36;color:#817d73;font:12px -apple-system}.traffic{display:flex;gap:7px}.traffic i{width:10px;height:10px;border-radius:50%;display:block}.traffic i:nth-child(1){background:#ed6a5f}.traffic i:nth-child(2){background:#f4bd4f}.traffic i:nth-child(3){background:#61c554}.address{flex:1;max-width:760px;margin:auto;padding:6px 16px;border:1px solid #3a3e36;border-radius:7px;background:#1d211d;color:#b4b0a5;font-family:ui-monospace}.badge{color:#c8f04a;font-size:10px;letter-spacing:1px}body{padding-top:44px!important}#video-caption{position:fixed;left:50%;bottom:22px;z-index:2147483646;transform:translateX(-50%);max-width:1100px;width:max-content;padding:8px 18px 10px;border-radius:8px;color:#fffaf1;background:rgba(8,10,8,.84);text-align:center;white-space:pre-wrap;font:24px/1.42 -apple-system,"Hiragino Sans GB";letter-spacing:.02em}#video-cursor{position:fixed;left:0;top:0;z-index:2147483647;width:24px;height:30px;pointer-events:none;transform:translate(-3px,-3px);filter:drop-shadow(0 2px 3px #000)}#video-cursor.clicking:after{content:'';position:absolute;left:4px;top:4px;width:17px;height:17px;border:2px solid #c8f04a;border-radius:50%;transform:translate(-50%,-50%)}""")
 page.evaluate("""() => {let b=document.createElement('div');b.id='video-browser-chrome';b.innerHTML='<span class="traffic"><i></i><i></i><i></i></span><span class="address">https://dailyslop.pages.dev/view?p=2026-08-14-tail-gambit</span><span class="badge">LIVE DEMO</span>';document.body.append(b);let c=document.createElement('div');c.id='video-caption';document.body.append(c);let p=document.createElement('div');p.id='video-cursor';p.innerHTML='<svg viewBox="0 0 24 30"><path d="M2 1V23L8 18L12 28L16 26L12 17H22Z" fill="#fff" stroke="#111" stroke-width="2"/></svg>';document.body.append(p)}""")
def center(page,selector):
 b=page.locator(selector).first.bounding_box();return (b["x"]+b["width"]/2,b["y"]+b["height"]/2)
def capture_frames(work,ds,port):
 fd=work/"frames";fd.mkdir(exist_ok=True);cues=caption_cues(ds);frame=0;timeline=0
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True);context=browser.new_context(viewport={"width":DESIGN_WIDTH,"height":DESIGN_HEIGHT},device_scale_factor=1.5);page=context.new_page();page.goto(f"http://127.0.0.1:{port}/{SLUG}/",wait_until="networkidle");page.evaluate("window.__tailVideoClock=0");page.wait_for_timeout(700);overlays(page);parked=(520,400)
  def shot(pos=None,click=False):
   nonlocal frame,timeline
   page.evaluate("""({text,pos,click})=>{document.querySelector('#video-caption').textContent=text;let p=document.querySelector('#video-cursor');if(pos){p.style.left=pos[0]+'px';p.style.top=pos[1]+'px'}p.classList.toggle('clicking',click)}""",{"text":caption_at(timeline,cues),"pos":pos,"click":click});page.screenshot(path=str(fd/f"{frame:06}.png"),animations="disabled");page.evaluate("window.__tailVideoClock += 1/15");frame+=1;timeline+=1/FPS
  def hold(sec,pos=parked,click=.0):
   for i in range(max(1,round(sec*FPS))):shot(pos,i<round(click*FPS))
  def move(sec,a,b):
   for i in range(max(2,round(sec*FPS))):
    q=i/max(1,round(sec*FPS)-1);q=q*q*(3-2*q);shot((a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q))
  def click(selector,frompos,settle=.5,video_clock=None):
   target=center(page,selector);move(.35,frompos,target);hold(.12,target)
   if video_clock is not None:page.evaluate("""({selector,value})=>{window.__tailVideoClock=value;document.querySelector(selector).click()}""",{"selector":selector,"value":video_clock})
   else:page.locator(selector).click(force=True)
   hold(settle,target,.22);return target
  title=context.new_page();title.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html",wait_until="networkidle");title.add_style_tag(content="#video-caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10;padding:8px 18px;color:white;background:#080a08cc;font:24px -apple-system,'Hiragino Sans GB';white-space:nowrap}");title.evaluate("document.body.insertAdjacentHTML('beforeend','<div id=video-caption></div>')")
  intro=min(2.8,ds[0]-.2)
  for _ in range(round(intro*FPS)):title.evaluate("t=>document.querySelector('#video-caption').textContent=t",caption_at(timeline,cues));title.screenshot(path=str(fd/f"{frame:06}.png"));frame+=1;timeline+=1/FPS
  hold(ds[0]+SILENCE_BETWEEN-intro)
  p=click("#startBtn",parked);hold(1.24,p);p=click("#dropBtn",p,.55,1.96);hold(1.05,p)
  hold(max(.5,ds[1]+SILENCE_BETWEEN-3.35),p)
  scopepos=center(page,".telemetry");move(.5,p,scopepos);hold(ds[2]+SILENCE_BETWEEN-.5,scopepos)
  p=click('[data-species="skink"]',scopepos,.35);p=click("#startBtn",p,.25);hold(1.33,p);p=click("#dropBtn",p,.5,2.055);hold(1.05,p)
  hold(max(.5,ds[3]+SILENCE_BETWEEN-4.25),p)
  slider=center(page,"#daySlider");move(.45,p,slider);page.locator("#daySlider").evaluate("e=>{e.value=Math.round(+e.max*.72);e.dispatchEvent(new Event('input',{bubbles:true}))}");hold(ds[4]-.45,slider)
  end=context.new_page();end.goto(f"http://127.0.0.1:{port}/{SLUG}/video/title.html?scene=end",wait_until="networkidle");end.add_style_tag(content="#video-caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10;padding:8px 18px;color:white;background:#080a08cc;font:24px -apple-system,'Hiragino Sans GB'}");end.evaluate("document.body.insertAdjacentHTML('beforeend','<div id=video-caption></div>')")
  for _ in range(round(SILENCE_TAIL*FPS)):end.screenshot(path=str(fd/f"{frame:06}.png"));frame+=1;timeline+=1/FPS
  browser.close()
 return fd
def assemble(work,frames,audio,subs,out):
 silent=work/"video-only.mp4";run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",FPS,"-i",frames/"%06d.png","-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p","-r",FPS,silent]);run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",silent,"-i",audio,"-map","0:v:0","-map","1:a:0","-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k","-shortest",out])
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--output",type=Path,default=VIDEO_DIR/"tail-gambit-zh.mp4");args=ap.parse_args();work=Path(tempfile.mkdtemp(prefix="tail-gambit-video-build-",dir=VIDEO_DIR));audio,ds=make_audio(work);subs=args.output.with_suffix(".srt");write_srt(subs,ds);port=free_port();server=subprocess.Popen([sys.executable,"-m","http.server",str(port),"--directory",str(ROOT_DIR)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:wait_for_server(port);frames=capture_frames(work,ds,port)
 finally:server.terminate();server.wait(timeout=10)
 assemble(work,frames,audio,subs,args.output);meta={"output":str(args.output),"voice":"macOS Tingting fallback","segment_durations":ds,"video_duration":duration(args.output),"fps":FPS,"resolution":f"{WIDTH}x{HEIGHT}"};args.output.with_suffix(".json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n");print(json.dumps(meta,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
