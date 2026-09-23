"""Verify the finished app and narrated media without printing credentials."""
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
VIDEO = PROJECT/'video/headway-zh-fish.mp4'


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
    # Decode every video/audio packet, and also make sure narration isn't silent.
    decoded = subprocess.run(['ffmpeg','-hide_banner','-v','info','-i',str(VIDEO),'-af','volumedetect','-f','null','-'],check=True,capture_output=True,text=True)
    match = re.search(r'mean_volume: ([-\d.]+) dB',decoded.stderr)
    assert match and -40 < float(match[1]) < -2, 'Unexpected narration level'
    assert not re.search(r'corrupt|Error while|Invalid data',decoded.stderr,re.IGNORECASE)
    srt = VIDEO.with_suffix('.srt').read_text()
    entries = srt.strip().split('\n\n')
    assert len(entries) == 22
    previous = 0
    for i,entry in enumerate(entries,1):
        number,timing,*text = entry.splitlines()
        assert int(number) == i and text
        start,end = map(seconds,timing.split(' --> '))
        assert previous <= start < end <= span
        previous = end
    spec = importlib.util.spec_from_file_location('headway_video',PROJECT/'video/render_video.py')
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    assert srt.count('1852 年') == 1 and '一八五二年' in renderer.SEGMENTS[1]
    assert not re.search(r'\d{4}\s*年',''.join(renderer.SEGMENTS))
    assert renderer.SEGMENTS[0].startswith('大家好，我是 Claude Opus 五点五，来交 AI 每日作业了。')
    assert 'GLM' not in ''.join(renderer.SEGMENTS) + srt, 'Intro must name the actual builder'
    assert not any(word in ''.join(renderer.SEGMENTS)+srt for word in ['一步步拆给你看','账本','账单','算这笔账'])
    # Exact cues in the SRT and burned-in frames share the same timing source.
    lines = [text for _,_,text in renderer.base.caption_cues(meta['segment_durations'])]
    assert lines == ['\n'.join(entry.splitlines()[2:]) for entry in entries]
    key = os.environ.get('FISH_AUDIO_API_KEY')
    env = ROOT/'.env'
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith('FISH_AUDIO_API_KEY='):
                key = line.split('=',1)[1].strip().strip('\"\'')
                break
    assert key, 'Configure the Fish key to enable exact-key verification'
    patterns = [rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{50,}',rb'-----BEGIN [A-Z ]*PRIVATE KEY-----']
    files = [p for p in PROJECT.rglob('*') if p.is_file() and not any(part.startswith('cattery-fish-video-build-') or part=='__pycache__' for part in p.parts)]
    files += [ROOT/'README.md',ROOT/'gallery/manifest.js',ROOT/'gallery/shots'/f'{PROJECT.name}.png']
    for path in files:
        data = path.read_bytes()
        assert key.encode() not in data, 'Configured credential found in an artifact'
        assert not any(re.search(pattern,data) for pattern in patterns), 'Token-like data found in an artifact'
    report = f'''# Headway — verified build

- Numerical tests: 7 tests passed (bearings and wind convention, cube-root power law, place geometry, crab solution, headwind limits, reachable cone, whole flights).
- Browser: HTTP and direct-file loading; outbound, homeward, crosswind and manual-heading flights; zero power; widths 320–1920 px; no runtime page errors or external requests.
- Video: {video['width']} × {video['height']}, 15 fps, H.264 / AAC, {span:.3f} seconds, {VIDEO.stat().st_size:,} bytes.
- Audio: Fish Audio `s2.1-pro-free`, configured 哈基米 voice; full decode passed; mean audio level {match[1]} dB.
- Captions: 22 monotonic SRT cues within the video; the same cues are burned into the browser frames.
- Year spoken digit by digit (一八五二年); intro names the actual builder (Claude Opus 五点五).
- Secret scan: {len(files)} source and output files, including MP4, index, manifest, and screenshot, checked against the configured key and token patterns; no matches.

Flat local frame, steady uniform wind; presets are illustrative, not reconstructed 1852 weather.
'''
    (PROJECT/'VALIDATION.md').write_text(report)
    print(report)


if __name__ == '__main__':
    main()
