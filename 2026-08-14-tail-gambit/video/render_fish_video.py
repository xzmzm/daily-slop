#!/usr/bin/env python3
"""Render tail-gambit with Fish Audio s2.1-pro-free and the 哈基米 voice."""
from __future__ import annotations
import argparse,json,os,subprocess,sys,tempfile,time,urllib.error,urllib.request
from pathlib import Path
import render_video as local
FISH_TTS_URL="https://api.fish.audio/v1/tts";FISH_MODEL="s2.1-pro-free";FISH_VOICE_ID="ae5adc6778ac459e8d6106b82f88fa2b";VIDEO_DIR=Path(__file__).resolve().parent
def load_workspace_env():
 p=local.ROOT_DIR/".env"
 if not p.exists():return
 for raw in p.read_text().splitlines():
  line=raw.strip()
  if not line or line.startswith("#") or "=" not in line:continue
  k,v=line.split("=",1);v=v.strip().strip("'\"");os.environ.setdefault(k.strip(),v)
def run(cmd):print("+"," ".join(map(str,cmd)),flush=True);subprocess.run(list(map(str,cmd)),check=True)
def make_fish_audio(work,key):
 ad=work/"audio";ad.mkdir();ds=[]
 for i,text in enumerate(local.SEGMENTS):
  mp3=ad/f"segment-{i:02}.mp3";wav=ad/f"segment-{i:02}.wav";body=json.dumps({"text":text,"reference_id":FISH_VOICE_ID,"temperature":.7,"top_p":.7,"prosody":{"speed":1,"volume":0,"normalize_loudness":True},"chunk_length":300,"normalize":True,"format":"mp3","sample_rate":44100,"mp3_bitrate":128,"latency":"normal","max_new_tokens":1024,"repetition_penalty":1.2,"min_chunk_length":50,"condition_on_previous_chunks":True,"early_stop_threshold":1},ensure_ascii=False).encode()
  data=b""
  for attempt in range(6):
   req=urllib.request.Request(FISH_TTS_URL,data=body,method="POST",headers={"Authorization":f"Bearer {key}","Content-Type":"application/json","model":FISH_MODEL})
   try:
    with urllib.request.urlopen(req,timeout=180) as resp:data=resp.read()
    break
   except urllib.error.HTTPError as exc:
    detail=exc.read().decode(errors="replace")
    if exc.code in (429,502,503,504) and attempt<5:wait=5*(attempt+1);print(f"segment {i}: {exc.code}; retrying in {wait}s",flush=True);time.sleep(wait);continue
    raise RuntimeError(f"Fish Audio segment {i}: {exc.code} {detail}") from exc
  mp3.write_bytes(data);run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",mp3,"-ar","44100","-ac","1","-c:a","pcm_s16le",wav]);ds.append(local.duration(wav));print(f"Fish segment {i+1}/{len(local.SEGMENTS)}: {ds[-1]:.2f}s",flush=True)
 silence=ad/"silence.wav";tail=ad/"tail.wav";run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t",local.SILENCE_BETWEEN,"-c:a","pcm_s16le",silence]);run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t",local.SILENCE_TAIL,"-c:a","pcm_s16le",tail]);entries=[]
 for i in range(len(local.SEGMENTS)):entries.append(f"file '{ad/f'segment-{i:02}.wav'}'");entries += ([f"file '{silence}'"] if i<len(local.SEGMENTS)-1 else [])
 entries.append(f"file '{tail}'");lst=ad/"concat.txt";lst.write_text("\n".join(entries)+"\n");out=work/"narration-fish.wav";run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",lst,"-c","copy",out]);return out,ds
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--output",type=Path,default=VIDEO_DIR/"tail-gambit-zh-fish.mp4");args=ap.parse_args();load_workspace_env();key=os.environ.get("FISH_AUDIO_API_KEY")
 if not key:raise SystemExit("Set FISH_AUDIO_API_KEY in the environment or workspace .env.")
 work=Path(tempfile.mkdtemp(prefix="tail-gambit-fish-video-build-",dir=VIDEO_DIR));print(f"work directory: {work}");audio,ds=make_fish_audio(work,key);subs=args.output.with_suffix(".srt");local.write_srt(subs,ds);port=local.free_port();server=subprocess.Popen([sys.executable,"-m","http.server",str(port),"--directory",str(local.ROOT_DIR)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:local.wait_for_server(port);frames=local.capture_frames(work,ds,port)
 finally:server.terminate();server.wait(timeout=10)
 local.assemble(work,frames,audio,subs,args.output);meta={"output":str(args.output.resolve()),"provider":"Fish Audio REST API","model":FISH_MODEL,"voice_id":FISH_VOICE_ID,"segment_durations":ds,"video_duration":local.duration(args.output),"fps":local.FPS,"resolution":f"{local.WIDTH}x{local.HEIGHT}"};args.output.with_suffix(".json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n");print(json.dumps(meta,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
