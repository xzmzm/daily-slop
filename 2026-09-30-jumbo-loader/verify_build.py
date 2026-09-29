"""Verify the loader and its finished media; never print credential values."""
from fractions import Fraction
from pathlib import Path
import importlib.util
import json
import os
import re
import subprocess
import sys

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent
VIDEO = PROJECT/'video/jumbo-loader-zh-fish.mp4'


def seconds(text):
    h,m,s = text.replace(',','.').split(':')
    return int(h)*3600 + int(m)*60 + float(s)


def main():
    subprocess.run(['node','--test',str(PROJECT/'test.cjs')],check=True)
    subprocess.run([sys.executable,str(PROJECT/'test_browser.py')],check=True)
    meta = json.loads(VIDEO.with_suffix('.json').read_text())
    assert meta['provider'] == 'Fish Audio REST API'
    assert meta['model'] == 's2.1-pro-free'
    assert meta['voice_id'] == 'ae5adc6778ac459e8d6106b82f88fa2b'
    assert len(meta['segment_durations']) == 6
    probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(VIDEO)],text=True))
    video = next(s for s in probe['streams'] if s['codec_type']=='video')
    audio = next(s for s in probe['streams'] if s['codec_type']=='audio')
    assert (video['width'],video['height'],video['codec_name'],video['pix_fmt']) == (1920,1080,'h264','yuv420p')
    assert Fraction(video['avg_frame_rate']) == 15 and audio['codec_name'] == 'aac'
    span = float(probe['format']['duration'])
    expected = sum(meta['segment_durations']) + .22*5 + 1.6
    assert abs(span-expected) < .15, (span,expected)
    decoded = subprocess.run(['ffmpeg','-hide_banner','-v','info','-i',str(VIDEO),'-af','volumedetect','-f','null','-'],check=True,capture_output=True,text=True)
    match = re.search(r'mean_volume: ([-\d.]+) dB',decoded.stderr)
    assert match and -40 < float(match[1]) < -2, 'Unexpected narration level'
    assert not re.search(r'corrupt|Error while|Invalid data',decoded.stderr,re.IGNORECASE)
    srt = VIDEO.with_suffix('.srt').read_text()
    entries = srt.strip().split('\n\n')
    previous = 0
    for i,entry in enumerate(entries,1):
        number,timing,*text = entry.splitlines()
        assert int(number) == i and text
        start,end = map(seconds,timing.split(' --> '))
        assert previous <= start < end <= span
        previous = end
    spec = importlib.util.spec_from_file_location('jumbo_video',PROJECT/'video/render_video.py')
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    assert len(entries) == sum(map(len,renderer.SUBTITLE_LINES)) == 22
    assert renderer.SEGMENTS[0].startswith('大家好，我是 GLM 五点三，来交 AI 每日作业了。')
    assert srt.count('大家好，我是 GLM-5.3，来交 AI 每日作业了。') == 1
    assert not re.search(r'\d{4}\s*年',''.join(renderer.SEGMENTS))
    assert '一九六八年九月三十日' in renderer.SEGMENTS[0]
    assert '一九六八' in renderer.SEGMENTS[5] and '二零二三' in renderer.SEGMENTS[5]
    assert '波音七四七' in renderer.SEGMENTS[0]
    assert not any(word in ''.join(renderer.SEGMENTS)+srt for word in ['一步步拆给你看','带你一步步','账本','账单','算这笔账'])
    cues = renderer.base.caption_cues(meta['segment_durations'])
    assert [text for _,_,text in cues] == ['\n'.join(entry.splitlines()[2:]) for entry in entries]
    readme = (PROJECT/'README.md').read_text()
    assert 'Built by GLM-5.3' in readme
    assert re.search(r'2026-09-30 \| \[jumbo-loader\].*\| GLM-5\.3 \|', (ROOT/'README.md').read_text())
    key = os.environ.get('FISH_AUDIO_API_KEY')
    env = ROOT/'.env'
    if not key and env.exists():
        for raw_line in env.read_text().splitlines():
            line=raw_line.strip()
            if line.startswith('FISH_AUDIO_API_KEY='):
                key=line.split('=',1)[1].strip().strip('"\'')
                break
    assert key, 'Configure the Fish key for exact-key verification'
    patterns = [rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{50,}',rb'-----BEGIN [A-Z ]*PRIVATE KEY-----']
    files = [p for p in PROJECT.rglob('*') if p.is_file() and not any(part.startswith('cattery-fish-video-build-') or part=='__pycache__' for part in p.parts)]
    files += [ROOT/'README.md',ROOT/'gallery/manifest.js',ROOT/'gallery/shots'/f'{PROJECT.name}.png']
    for path in files:
        data = path.read_bytes()
        assert key.encode() not in data, 'Configured credential found in an artifact'
        assert not any(re.search(pattern,data) for pattern in patterns), 'Token-like data found in an artifact'
    report = f'''# Jumbo Loader — verified build

- Numerical tests: 7 passed; hand-computed moment math, weight-dependent limits, authored legal placements plus all-forward failures for all three missions, zero-fuel overload, station-pull monotonicity, reachable tail-heavy case.
- Browser: direct-file loading, item selection arming slots, nose-heavy refusal with the door still open, container unload, three mission solutions dispatching, door close/reopen cycle, sandbox catalog overload, keyboard placement, touch, and widths 390–1920 px. No page errors or external asset requests.
- Video: {video['width']} × {video['height']}, 15 fps, H.264 / AAC, {span:.3f} seconds, {VIDEO.stat().st_size:,} bytes.
- Audio: Fish Audio `s2.1-pro-free`, configured 哈基米 voice; full audio/video decode passed; mean narration level {match[1]} dB.
- Captions: 22 monotonic SRT cues within the video, sourced from the same timing table as burned-in captions. Sentence timing is proportional within each spoken segment.
- Attribution: GLM-5.3 in the README, root index and opening subtitle; GLM 五点三 in narration. Years spoken digit by digit (一九六八年九月三十日, 一九六八到二零二三).
- Secret scan: {len(files)} source and output files, including MP4, root index, gallery manifest, and gallery screenshot, checked against the actual configured key and token patterns; no matches.

Envelope numbers are rounded for play from 747-100F ballpark figures; LEMAC 1325.6 in and MAC 327.8 in follow the real type. The optimum is any placement inside the band, not a unique solution.
'''
    (PROJECT/'VALIDATION.md').write_text(report)
    print(report)


if __name__ == '__main__':main()
