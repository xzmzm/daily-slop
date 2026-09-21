#!/usr/bin/env python3
"""Fail publication unless tests, narrated media and generated files verify."""
import json
import math
import os
from pathlib import Path
import re
import subprocess
from fractions import Fraction
PROJECT=Path(__file__).resolve().parent
VIDEO=PROJECT/'video/shortcut-trap.mp4'
checks=Path(os.environ.get('SHORTCUT_CHECK_DIR','/tmp/shortcut-trap-checks'))
math_report=json.loads(subprocess.check_output(['node',str(PROJECT/'test.cjs')],text=True))
assert math_report['status']=='passed'
browser=json.loads((checks/'browser-tests.json').read_text())
assert browser['status']=='passed' and not browser['url_checks_skipped']
assert len(browser['checks'])>=22 and not browser['errors']
layouts=json.loads((checks/'video-layout.json').read_text())
assert len(layouts)>=7
meta=json.loads(VIDEO.with_suffix('.json').read_text())
assert meta['provider']=='Fish Audio' and meta['model']=='s2.1-pro-free'
assert meta['voice_id']=='ae5adc6778ac459e8d6106b82f88fa2b'
assert meta['burned_in_subtitles'] and meta['language']=='zh-CN'
assert meta['capture'].endswith('local HTTP')
assert len(meta['segment_durations'])==8 and all(t>1 for t in meta['segment_durations'])
for scene,expected in zip(meta['scene_states'],[65,65,80,80,20,90,64.6875,65]):
    assert math.isclose(scene['average'],expected,abs_tol=1e-7),(scene['segment'],scene['average'])
assert len(meta['scene_states'])==8
assert meta['scene_states'][6]['flows']==[1750,1750,500]
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(VIDEO)],text=True))
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['codec_name'],v['pix_fmt'])==(1920,1080,'h264','yuv420p')
assert Fraction(v['avg_frame_rate'])==20 and a['codec_name']=='aac'
span=float(probe['format']['duration'])
assert abs(span-(sum(meta['segment_durations'])+17))<.2
assert abs(span-meta['duration_seconds'])<.01
subprocess.run(['ffmpeg','-hide_banner','-v','error','-i',str(VIDEO),'-f','null','-'],check=True)
srt=VIDEO.with_suffix('.srt').read_text()
entries=srt.strip().split('\n\n');assert len(entries)==24==meta['subtitle_cues']
def seconds(value):
    h,m,s=value.replace(',','.').split(':');return int(h)*3600+int(m)*60+float(s)
previous=0.
for i,entry in enumerate(entries,1):
    number,timing,*text=entry.splitlines();assert int(number)==i and text
    start,end=map(seconds,timing.split(' --> '))
    assert previous<=start<end<=span;previous=end
assert 'GPT-6 Astra' in srt
# Scan tracked source-like files and generated metadata, never log matched material.
key=os.environ.get('FISH_AUDIO_API_KEY','').encode()
patterns=[rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{50,}',rb'-----BEGIN [A-Z ]*PRIVATE KEY-----']
scanned=0
for p in PROJECT.rglob('*'):
    if not p.is_file() or '__pycache__' in p.parts:continue
    if p.suffix not in {'.js','.cjs','.py','.html','.css','.md','.json','.srt'}:continue
    data=p.read_bytes();scanned+=1
    assert not key or key not in data,'Configured credential found in generated/source file'
    assert not any(re.search(pattern,data) for pattern in patterns),'Token-like material found in source/generated file'
shot=PROJECT.parent/'gallery/shots'/f'{PROJECT.name}.png'
assert shot.is_file()
report=f'''# Shortcut Trap — verified build

- Numerical suite: **{math_report['assertions']:,} assertions** across {math_report['scenario_cases']:,} scenarios and {math_report['independent_optimum_samples']:,} independent feasible-allocation samples.
- Browser: **{len(browser['checks'])} checks**, actual local HTTP; URL/clipboard checks were not skipped; no JavaScript errors or runtime external asset requests.
- Video layout: **{len(layouts)} parameter states** checked for subtitle clearance.
- Recorded scene averages: **65, 65, 80, 80, 20, 90, 64.6875, 65 minutes**; coordinated flow **1,750 / 1,750 / 500**.
- Video: **1920 × 1080, 20 fps, H.264, yuv420p**, duration **{span:.3f} seconds**, file size **{VIDEO.stat().st_size:,} bytes**.
- Audio: **AAC**, Chinese Fish Audio narration, configured `s2.1-pro-free` model and voice reference.
- Subtitles: **24 cues**, monotonic timing within the video duration; the renderer uses the same cues for the burned-in captions and SRT.
- Media integrity: **full FFmpeg decode passed**, video/audio stream checks passed, rendered duration matches measured narration plus gaps.
- Secret scan: **{scanned} source/metadata files** checked for token patterns and the actual configured key; no matches. Credentials are not included in this report.
- Gallery screenshot exists; generated index/gallery are rebuilt by the publishing workflow.

These are executable checks, not a claim that the model predicts a real city's traffic. Sentence captions are proportionally timed within narration segments, not word-aligned transcripts.
'''
(PROJECT/'VALIDATION.md').write_text(report)
print(report)
