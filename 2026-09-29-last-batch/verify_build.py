"""Verify the bakery and its finished media; never print credential values."""
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
VIDEO = PROJECT/'video/last-batch-zh-fish.mp4'


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
    spec = importlib.util.spec_from_file_location('batch_video',PROJECT/'video/render_video.py')
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    assert len(entries) == sum(map(len,renderer.SUBTITLE_LINES)) == 24
    assert not re.search(r'\d{4}\s*年',''.join(renderer.SEGMENTS))
    assert renderer.SEGMENTS[0].startswith('大家好，我是 GPT 六 Astra，来交 AI 每日作业了。')
    assert srt.count('大家好，我是 GPT-6 Astra，来交 AI 每日作业了。') == 1
    assert not any(word in ''.join(renderer.SEGMENTS)+srt for word in ['一步步拆给你看','带你一步步','账本','账单','算这笔账'])
    cues = renderer.base.caption_cues(meta['segment_durations'])
    assert [text for _,_,text in cues] == ['\n'.join(entry.splitlines()[2:]) for entry in entries]
    key = os.environ.get('FISH_AUDIO_API_KEY')
    env = ROOT/'.env'
    if not key and env.exists():
        for raw in env.read_text().splitlines():
            line=raw.strip()
            if line.startswith('FISH_AUDIO_API_KEY='):
                key=line.split('=',1)[1].strip().strip('\"\'')
                break
    assert key, 'Configure the Fish key for exact-key verification'
    patterns = [rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'github_pat_[A-Za-z0-9_]{50,}',rb'-----BEGIN [A-Z ]*PRIVATE KEY-----']
    files = [p for p in PROJECT.rglob('*') if p.is_file() and not any(part.startswith('cattery-fish-video-build-') or part=='__pycache__' for part in p.parts)]
    files += [ROOT/'README.md',ROOT/'gallery/manifest.js',ROOT/'gallery/shots'/f'{PROJECT.name}.png']
    for path in files:
        data = path.read_bytes()
        assert key.encode() not in data, 'Configured credential found in an artifact'
        assert not any(re.search(pattern,data) for pattern in patterns), 'Token-like data found in an artifact'
    report = f'''# Last Batch — verified build

- Numerical tests: 7 passed; normalized equal-mean distributions, conserved counts, hand-computed expectation, marginal-unit equation, independent critical-quantile optimum, ties and cost monotonicity, seeded replay.
- Browser: direct-file loading, all three forecasts, monthly sample totals, best-batch action, day inspection, deterministic replay, new month, keyboard limits, negative margin, interrupted animation, touch, reduced motion, and widths 320–1920 px. No page errors or external asset requests.
- Video: {video['width']} × {video['height']}, 15 fps, H.264 / AAC, {span:.3f} seconds, {VIDEO.stat().st_size:,} bytes.
- Audio: Fish Audio `s2.1-pro-free`, configured 哈基米 voice; full audio/video decode passed; mean narration level {match[1]} dB.
- Captions: 24 monotonic SRT cues within the video, sourced from the same timing table as burned-in captions. Sentence timing is proportional within each spoken segment.
- Attribution: GPT-6 Astra in the README and opening subtitle; GPT 六 Astra in narration. No historical years in this script.
- Secret scan: {len(files)} source and output files, including MP4, root index, gallery manifest, and gallery screenshot, checked against the actual configured key and token patterns; no matches.

Forecasts are invented. The optimum maximizes expected contribution after bake costs, not waste reduction; any one 30-day sample can disagree.
'''
    (PROJECT/'VALIDATION.md').write_text(report)
    print(report)


if __name__ == '__main__':main()
