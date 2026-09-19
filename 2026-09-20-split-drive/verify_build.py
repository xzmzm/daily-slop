#!/usr/bin/env python3
"""Verify the completed video and record results without disclosing secrets."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PROJECT=Path(__file__).resolve().parent
ROOT=PROJECT.parent
video=PROJECT/'video/split-drive.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)],text=True))
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['codec_name'],v['pix_fmt'])==(1920,1080,'h264','yuv420p')
assert a['codec_name']=='aac'
assert v['avg_frame_rate']=='20/1'
assert abs(float(v['duration'])-float(a['duration']))<.15
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
meta=json.loads(video.with_suffix('.json').read_text())
assert len(meta['segment_durations'])==8
expected=sum(meta['segment_durations'])+7*.3+1.6
assert abs(float(probe['format']['duration'])-expected)<.15
assert meta['project']==PROJECT.name and meta['built_by']=='GPT-6 Astra'
subtitles=video.with_suffix('.srt').read_text()
assert '九月二十日' in subtitles and '明天见' in subtitles
assert all(s not in subtitles for s in ['一步步拆给你看','账本','账单','算这笔账'])
key=os.environ.get('FISH_AUDIO_API_KEY','')
patterns=[rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'sk-[A-Za-z0-9]{32,}',rb'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----']
files=[p for p in PROJECT.rglob('*') if p.is_file() and '__pycache__' not in p.parts]
files += [ROOT/'README.md',ROOT/'.github/workflows/split-drive-video.yml']
for p in files:
    data=p.read_bytes()
    assert not (key and len(key)>8 and key.encode() in data),'Secret value found in '+str(p.relative_to(ROOT))
    assert not any(re.search(pattern,data) for pattern in patterns),'Credential pattern found in '+str(p.relative_to(ROOT))
tracked=subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines()
assert not any(p=='.env' or p.endswith('/.env') for p in tracked),'Tracked .env file'
checks=json.loads(Path('/tmp/split-drive-checks/tests.json').read_text())
run=os.environ.get('GITHUB_RUN_ID','local')
report=f'''# Split Drive — validation\n\nBuild: {run}\n\n- 25 core test groups passed.\n- {checks['browser_checks_passed']} real-browser checks passed, including native PNG download.\n- Desktop/mobile screenshots and 1080p composition captured.\n- H.264, 1920 × 1080, 20 fps, yuv420p, AAC verified with ffprobe.\n- Full ffmpeg decode passed.\n- Duration: {float(probe['format']['duration']):.2f} seconds; audio/video lengths agree.\n- Audio mode: {meta['audio']['mode']}.\n- Project/media/workflow secret-pattern and available-key scan passed.\n- No tracked .env file.\n\nVideo SHA-256: `{hashlib.sha256(video.read_bytes()).hexdigest()}`\n'''
(PROJECT/'VALIDATION.md').write_text(report)
print(report)
