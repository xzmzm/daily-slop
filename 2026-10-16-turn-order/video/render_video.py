"""Turn Order adapter for the shared Fish Audio daily-project renderer."""
from __future__ import annotations
import argparse
import importlib.util
import math
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[2]
PROJECT = Path(__file__).resolve().parents[1]
URL = "https://dailyslop.pages.dev/2026-10-16-turn-order/"
spec = importlib.util.spec_from_file_location("cattery_capture", ROOT_DIR / "2026-08-08-cattery/video/render_video.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
FPS, WIDTH, HEIGHT = base.FPS, base.WIDTH, base.HEIGHT
SILENCE_BETWEEN, SILENCE_TAIL = base.SILENCE_BETWEEN, base.SILENCE_TAIL
free_port, wait_for_server, duration = base.free_port, base.wait_for_server, base.duration

SUBTITLE_LINES = [
    ["大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。",
     "今天十月十六日，做个旋转顺序的小实验。"],
    ["左边先绕 X 轴转九十度，再绕 Y 轴转九十度。",
     "右边顺序反过来。明明是同样两下，最后却差了一百二十度。",
     "方块记性挺好，先干什么后干什么，它都记着。"],
    ["把每次的角度改成一百八十度，这两个结果反而重合了。",
     "所以顺序会影响结果，也有碰巧一样的时候。"],
    ["这组更怪。正着转两下，再各自反着转回来。",
     "每根轴的角度加起来都是零，方块却没回家。",
     "想原路返回，得倒着撤销刚才的动作。"],
    ["如果只绕同一根轴，先后顺序就无所谓了。",
     "九十度，再负九十度，这次终于回家了。"],
    ["清空，换成 X 轴和 Z 轴，再试一次。",
     "六个面都有字，还有偏在一边的小圆点。",
     "不做记号，方块转完还长得一样，太会装了。"],
    ["1843 年的今天，哈密顿把四元数的公式刻在都柏林的桥上。",
     "四个数记录一个姿态，乘的时候，顺序得留着。",
     "今天的作业交完了，明天见。"],
]
SEGMENTS = ["".join(lines).replace("GPT-6.1 Sol", "GPT 六点一 Sol").replace("1843 年", "一八四三年") for lines in SUBTITLE_LINES]
base.SEGMENTS, base.SUBTITLE_LINES = SEGMENTS, SUBTITLE_LINES
write_srt = base.write_srt

RECORDING_CSS = """
  .page{max-width:1780px;padding:0 55px}
  .masthead{height:48px;font-size:12px}
  .masthead a{font-size:13px}
  .intro{padding:22px 0 24px}
  h1{font-size:91px;margin-top:2px}
  .intro .eyebrow{font-size:12px}
  .intro-copy{font-size:19px;max-width:530px}
  .intro-copy>span{font-size:13px}
  .workbench{grid-template-columns:minmax(0,1fr) 355px;height:650px}
  .controls{padding:24px 27px;gap:18px}
  .result .eyebrow{font-size:11px}
  .difference{font-size:73px}
  .verdict{font-size:14px}
  .result-help{font-size:11px}
  .control-heading h2{font-size:15px}
  .control-heading>span{font-size:10px}
  .axis-buttons button{font-size:16px;padding:10px 13px}
  .move-chip{font-size:12px;padding:7px 9px}
  .edit-actions button{font-size:11px}
  .angle-control label{font-size:11px}
  .range-ticks{font-size:10px}
  .presets .eyebrow{font-size:10px}
  .presets button{font-size:13px;padding:9px 0}
  .stage-heading{font-size:11px;padding:21px 26px}
  .specimen-label{margin:8px 27px 0}
  .specimen-label h2{font-size:19px}
  .specimen-label p{font-size:13px}
  .badge{width:32px;height:32px;font-size:16px}
  canvas{max-height:388px;height:388px;aspect-ratio:auto;flex:none}
  .pose{font-size:11px;margin:0 27px 18px}
  .pose strong{font-size:21px}
  .playback{padding:17px 26px}
  .play-button{font-size:15px;min-width:162px}
  .scrubber label{font-size:10px}
  .stage-foot{font-size:9px;padding:14px 26px}
  .observation{padding:17px 0;min-height:68px}
  .observation p{font-size:16px;max-width:1330px}
  .observation-tag{font-size:10px}
  .field-notes,footer{display:none}
  #video-browser-chrome .badge{width:auto;height:auto;display:block;background:transparent;white-space:nowrap;line-height:1.2}
  #video-caption{font-size:28px;max-width:1600px;bottom:20px}
"""


def setup(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_function("!!window.turnOrder")
    page.evaluate("turnOrder.setLive(false)")
    base.add_browser_chrome(page)
    page.locator("#video-browser-chrome .address").evaluate("(el,url)=>el.textContent=url", URL)
    page.locator("#video-browser-chrome .badge").evaluate("el=>el.textContent='LOCAL RECORDING'")
    base.add_caption_overlay(page)
    base.add_cursor_overlay(page)
    page.add_style_tag(content=RECORDING_CSS)
    base.set_cursor(page, (1805, 956))
    page.evaluate("turnOrder.render()")


def assert_framing(page):
    caption_top=page.locator("#video-caption").bounding_box()["y"]
    for selector in [".workbench", ".observation"]:
        box=page.locator(selector).bounding_box()
        assert box["y"]+box["height"]<caption_top-10,(selector,box,caption_top)


def capture_frames(work_dir, durations, port):
    frames=work_dir/"frames"
    frames.mkdir()
    cues=base.caption_cues(durations)
    frame,timeline,pos,revision=0,0.0,(1805,956),0
    cache_key,last_frame=None,None
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":WIDTH,"height":HEIGHT},device_scale_factor=1)
        page.on("pageerror",lambda e:errors.append(str(e)))
        setup(page,f"http://127.0.0.1:{port}/{PROJECT.name}/")
        page.locator("#video-caption").evaluate("el=>el.textContent='大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。'")
        assert_framing(page)

        def snap(animate=False,clicking=False):
            nonlocal frame,timeline,revision,cache_key,last_frame
            if animate:
                page.evaluate("dt=>turnOrder.advance(dt)",1/FPS)
                revision+=1
            key=(revision,base.caption_at(timeline,cues),pos,clicking)
            output=frames/f"{frame:06d}.png"
            if key==cache_key:
                shutil.copyfile(last_frame,output)
            else:
                base.capture(page,output,timeline,cues,pos,clicking)
            cache_key,last_frame=key,output
            frame+=1
            timeline=frame/FPS

        def hold(seconds,animate=False):
            for _ in range(max(0,round(seconds*FPS))):snap(animate)

        def move(target):
            nonlocal pos
            start=pos
            dx,dy=target[0]-start[0],target[1]-start[1]
            distance=max(1,math.hypot(dx,dy));bend=min(18,distance*.04)
            control=((start[0]+target[0])/2-dy/distance*bend,(start[1]+target[1])/2+dx/distance*bend)
            for i in range(round(.6*FPS)):
                u=(i+1)/round(.6*FPS);u=u*u*(3-2*u);v=1-u
                pos=(v*v*start[0]+2*v*u*control[0]+u*u*target[0],v*v*start[1]+2*v*u*control[1]+u*u*target[1])
                page.mouse.move(*pos);snap()
            hold(.15)

        def click(selector,fraction=.5):
            nonlocal revision
            box=page.locator(selector).bounding_box()
            assert box and box["y"]+box["height"]<HEIGHT-110,(selector,box)
            move((box["x"]+box["width"]*fraction,box["y"]+box["height"]/2))
            page.mouse.click(*pos);revision+=1;snap(clicking=True);hold(.25)

        start=0.0
        for index,seconds in enumerate(durations):
            end=start+seconds+(SILENCE_BETWEEN if index<len(durations)-1 else SILENCE_TAIL)
            if index==0:
                hold(end-timeline)
            elif index==1:
                click("#play")
                hold(3.0,True)
                assert abs(page.evaluate("turnOrder.getStats().gap")-120)<.01
                hold(end-timeline)
            elif index==2:
                click("#angle",.985)
                assert page.locator("#angle-value").inner_text()=="180°"
                assert page.evaluate("turnOrder.getStats().gap")<.01
                hold(end-timeline)
            elif index==3:
                click('[data-preset="loop"]')
                click("#play")
                hold(5.5,True)
                assert abs(page.evaluate("turnOrder.getStats().homeA")-120)<.01
                hold(end-timeline)
            elif index==4:
                click('[data-preset="one"]')
                click("#play")
                hold(3,True)
                assert page.evaluate("turnOrder.getStats().homeA")<.01
                hold(end-timeline)
            elif index==5:
                click("#clear")
                click('[data-axis="x"][data-sign="1"]')
                click('[data-axis="z"][data-sign="1"]')
                click("#play")
                hold(3,True)
                assert abs(page.evaluate("turnOrder.getStats().gap")-120)<.01
                hold(end-timeline)
            else:
                hold(end-timeline)
            assert timeline<=end+.3,(index,timeline,end)
            print(f"Captured scene {index+1}/{len(durations)} at {timeline:.1f}s",flush=True)
            start=end
        browser.close()
    if errors:raise RuntimeError(str(errors))
    return frames


def assemble(work_dir,frames_dir,narration,subtitles,output):
    base.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(FPS),
              "-i",str(frames_dir/"%06d.png"),"-i",str(narration),"-map","0:v:0","-map","1:a:0",
              "-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p",
              "-c:a","aac","-b:a","128k","-shortest","-movflags","+faststart",str(output)])


def preview(output):
    output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":WIDTH,"height":HEIGHT})
        setup(page,(PROJECT/"index.html").as_uri())
        page.locator("#video-caption").evaluate("el=>el.textContent='右边顺序反过来。明明是同样两下，最后却差了一百二十度。'")
        assert_framing(page)
        page.screenshot(path=str(output/"intro.png"))
        page.locator('[data-preset="loop"]').click()
        page.screenshot(path=str(output/"loop.png"))
        browser.close()
    print("Video framing previews:",output)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--preview",type=Path,required=True)
    preview(parser.parse_args().preview)
