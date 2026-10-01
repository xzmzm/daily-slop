"""Verify the finished app and media, without displaying credentials."""
from fractions import Fraction
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

PROJECT = Path(__file__).resolve().parent
ROOT = PROJECT.parent
VIDEO = PROJECT / "video/thirty-lines-zh-fish.mp4"

def seconds(text):
    h, m, s = text.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)

def main():
    subprocess.run(["node", str(PROJECT / "test.cjs")], check=True)
    subprocess.run([sys.executable, str(PROJECT / "test_browser.py")], check=True)
    meta = json.loads(VIDEO.with_suffix(".json").read_text())
    assert meta["provider"] == "Fish Audio REST API"
    assert meta["model"] == "s2.1-pro-free"
    assert meta["voice_id"] == "ae5adc6778ac459e8d6106b82f88fa2b"
    assert len(meta["segment_durations"]) == 6
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(VIDEO)
    ], text=True))
    video = next(s for s in probe["streams"] if s["codec_type"] == "video")
    audio = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    assert (video["width"], video["height"], video["codec_name"], video["pix_fmt"]) == (1920, 1080, "h264", "yuv420p")
    assert Fraction(video["avg_frame_rate"]) == 15
    assert audio["codec_name"] == "aac"
    span = float(probe["format"]["duration"])
    expected = sum(meta["segment_durations"]) + .22 * 5 + 1.6
    assert abs(span - expected) < .15, (span, expected)
    decoded = subprocess.run([
        "ffmpeg", "-hide_banner", "-v", "info", "-i", str(VIDEO),
        "-af", "volumedetect", "-f", "null", "-"
    ], check=True, capture_output=True, text=True)
    volume = re.search(r"mean_volume: ([-\d.]+) dB", decoded.stderr)
    assert volume and -40 < float(volume[1]) < -2, "Unexpected narration level"
    assert not re.search(r"corrupt|Error while|Invalid data", decoded.stderr, re.IGNORECASE)

    srt = VIDEO.with_suffix(".srt").read_text()
    entries = srt.strip().split("\n\n")
    previous = 0
    for i, entry in enumerate(entries, 1):
        number, timing, *text = entry.splitlines()
        assert int(number) == i and text
        start, end = map(seconds, timing.split(" --> "))
        assert previous <= start < end <= span
        previous = end
    spec = importlib.util.spec_from_file_location("thirty_video", PROJECT / "video/render_video.py")
    renderer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(renderer)
    assert len(entries) == sum(map(len, renderer.SUBTITLE_LINES)) == 18
    assert renderer.SEGMENTS[0].startswith("大家好，我是 GPT 六点一 Sol，来交 AI 每日作业了。")
    assert srt.count("大家好，我是 GPT-6.1 Sol，来交 AI 每日作业了。") == 1
    assert not re.search(r"\d{4}\s*年", "".join(renderer.SEGMENTS))
    assert "一九二五年" in renderer.SEGMENTS[0]
    banned = ["一步步拆给你看", "带你一步步", "拆给你看", "账本", "账单", "算这笔账"]
    assert not any(word in "".join(renderer.SEGMENTS) + srt for word in banned)
    cues = renderer.base.caption_cues(meta["segment_durations"])
    assert [text for _, _, text in cues] == ["\n".join(entry.splitlines()[2:]) for entry in entries]
    assert "Built by GPT-6.1 Sol\n" in (PROJECT / "README.md").read_text()
    assert re.search(r"2026-10-02 \| \[thirty-lines\].*\| GPT-6\.1 Sol \|", (ROOT / "README.md").read_text())
    manifest = (ROOT / "gallery/manifest.js").read_text()
    assert '"dir": "2026-10-02-thirty-lines"' in manifest
    assert '"builtBy": "GPT-6.1 Sol"' in manifest or '"built_by": "GPT-6.1 Sol"' in manifest

    key = os.environ.get("FISH_AUDIO_API_KEY")
    env = ROOT / ".env"
    if not key and env.exists():
        for raw in env.read_text().splitlines():
            line = raw.strip()
            if line.startswith("FISH_AUDIO_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("\"'")
                break
    assert key, "Configure the Fish key for exact-key verification"
    patterns = [rb"gh[pousr]_[A-Za-z0-9]{30,}", rb"github_pat_[A-Za-z0-9_]{50,}", rb"-----BEGIN [A-Z ]*PRIVATE KEY-----"]
    files = [p for p in PROJECT.rglob("*") if p.is_file() and not any(
        part.startswith("cattery-fish-video-build-") or part == "__pycache__" for part in p.parts
    )]
    files += [ROOT / "README.md", ROOT / "gallery/manifest.js", ROOT / "gallery/shots" / f"{PROJECT.name}.png"]
    for path in files:
        data = path.read_bytes()
        assert key.encode() not in data, "Configured credential found in an artifact"
        assert not any(re.search(pattern, data) for pattern in patterns), "Token-like data found in an artifact"

    report = f"""# Thirty Lines — verified build

- Core: synchronized round trips at 15/30/60 lines, negative wraparound, half-turn phase offsets, accumulating positive/negative drift, continuous motor position across a speed change, RPM and area-averaged grey levels passed.
- Browser: real controls, 2.5% drift and 307.5 rpm, lock recovery, phase keyboard input, three targets, resolution changes, aperture view, reduced-motion start, pause/column stepping and six viewport widths (360–1920 px) passed. No page errors or external app requests.
- Video: {video['width']} × {video['height']}, 15 fps, H.264 / AAC, {span:.3f} seconds, {VIDEO.stat().st_size:,} bytes. Full audio/video decode passed.
- Narration: Fish Audio `s2.1-pro-free`, configured 哈基米 voice; mean level {volume[1]} dB. GPT-6.1 Sol credited in the opening, project README and root index; GPT 六点一 Sol spoken. Year spoken digit by digit, 一九二五年.
- Captions: 18 ordered SRT cues within the video, matching the same table used for the burned-in captions. Sentence timing is proportional within each spoken segment.
- Gallery: today's project and GPT-6.1 Sol attribution present; an actual Chrome screenshot was generated.
- Secret scan: {len(files)} source and output files, including the MP4, root index, gallery manifest and screenshot, checked against the configured key and token patterns; no matches.

The rectangular scan and frame-holding view are educational approximations. The 30-hole apparatus is attributed to the surviving 1926 receiver, rather than asserted as an exact specification of the October 1925 experiment.
"""
    (PROJECT / "VALIDATION.md").write_text(report)
    print(report)

if __name__ == "__main__": main()
