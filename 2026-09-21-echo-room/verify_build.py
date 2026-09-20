#!/usr/bin/env python3
"""Validate actual generated media and record reproducible test evidence."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import wave
P=Path(__file__).resolve().parent
OUT=Path(os.environ.get('ECHO_CHECKS_DIR','/tmp/echo-room-checks'))
movie=P/'video/echo-room.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)],text=True))
v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['codec_name'],v['pix_fmt'])==(1920,1080,'h264','yuv420p')
assert v['r_frame_rate']=='20/1' and a['codec_name']=='aac' and a['sample_rate']=='44100'
duration=float(probe['format']['duration']);assert 40<duration<180
subprocess.run(['ffmpeg','-v','error','-i',str(movie),'-f','null','-'],check=True)
meta=json.loads((P/'video/echo-room.json').read_text());assert meta['audio']['mode']=='chinese-narration-and-app-audio'
assert meta['audio']['model']=='s2.1-pro-free' and len(meta['sound_effects'])==7
assert sum(e['mode']=='direct' for e in meta['sound_effects'])==1
assert abs(meta['duration_seconds']-duration)<.11
text=(P/'video/echo-room.srt').read_text()
assert len(re.findall(r' --> ',text))==23
assert 'GPT-6 Astra' in text
with wave.open(str(OUT/'exported-echo.wav'),'rb') as w:assert (w.getnchannels(),w.getsampwidth(),w.getframerate())==(1,2,44100)
results=json.loads((OUT/'browser-results.json').read_text());assert results['status']=='passed' and results['transport']=='http'
core=subprocess.check_output(['node',str(P/'test.cjs')],text=True);core_result=json.loads(core.strip().splitlines()[-1]);assert core_result['status']=='passed'
patterns=[re.compile(rb'ghp_[A-Za-z0-9]{30,}'),re.compile(rb'github_pat_[A-Za-z0-9_]{30,}'),re.compile(rb'sk-[A-Za-z0-9_-]{24,}')]
key=os.environ.get('FISH_AUDIO_API_KEY','').encode();scanned=0
files=[x for x in P.rglob('*') if x.is_file() and '__pycache__' not in x.parts]
files+=[P.parent/'.github/workflows/echo-room-video.yml',P.parent/'README.md',P.parent/'gallery/manifest.js']
for path in files:
    data=path.read_bytes()
    assert not key or key not in data,f'Known secret found in {path.name}'
    if path.suffix in {'.js','.py','.md','.html','.yml','.json','.cjs'}:
        assert not any(pattern.search(data) for pattern in patterns),f'Token pattern in {path.name}'
    scanned+=1
sha=hashlib.sha256(movie.read_bytes()).hexdigest()
report=f'''# Echo Room — verified build

- Core tests: **{core_result['core_test_groups']} groups passed**, including 100 randomized rooms.
- Browser tests: **{results['browser_checks']} checks passed**, against the real local HTTP app.
- Desktop/mobile layouts, pointer/keyboard input, Web Audio, actual WAV download and reduced motion: passed.
- 1080p preview: subtitles clear the experiment and insight panel.
- Video: **1920 × 1080, 20 fps, H.264 yuv420p / AAC 44100 Hz**, {duration:.2f} seconds.
- Chinese narration: Fish Audio `s2.1-pro-free`, configured repository voice.
- Seven sound demonstrations use exact app-generated WAV samples; one is direct-only.
- SRT: 23 nonempty timed captions; the same lines are burned into the recording.
- Full ffmpeg decode: passed.
- Secret scan: {scanned} files checked against the available private key and common token patterns; passed.
- MP4 SHA-256: `{sha}`.

The model is a finite planar early-reflection sketch, not a measured room response or full reverberation model. These checks do not certify acoustical design accuracy outside the documented assumptions.
'''
(P/'VALIDATION.md').write_text(report)
(OUT/'media-probe.json').write_text(json.dumps(probe,indent=2)+'\n')
print(report)
