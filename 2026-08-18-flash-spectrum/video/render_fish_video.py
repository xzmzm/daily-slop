#!/usr/bin/env python3
"""Render the flash-spectrum story video with Fish Audio's 哈基米 voice.

The API key is loaded from the process environment or the workspace-root
``.env`` file. It is never copied into source code or generated metadata.
The endpoint/model/voice settings mirror Fish Audio's REST TTS contract.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

import render_video as local


FISH_TTS_URL = "https://api.fish.audio/v1/tts"
FISH_MODEL = "s2.1-pro-free"
FISH_VOICE_ID = "ae5adc6778ac459e8d6106b82f88fa2b"
VIDEO_DIR = Path(__file__).resolve().parent


def load_workspace_env() -> None:
    """Load the one local secret needed by this renderer without a dependency."""
    env_path = local.ROOT_DIR / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def run(command: list[str]) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, check=True)


def make_fish_audio(work_dir: Path, api_key: str) -> tuple[Path, list[float]]:
    audio_dir = work_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    durations: list[float] = []

    for index, text in enumerate(local.SEGMENTS):
        mp3 = audio_dir / f"segment-{index:02d}.mp3"
        wav = audio_dir / f"segment-{index:02d}.wav"
        payload = {
            "text": text,
            "reference_id": FISH_VOICE_ID,
            "temperature": 0.7,
            "top_p": 0.7,
            "prosody": {"speed": 1, "volume": 0, "normalize_loudness": True},
            "chunk_length": 300,
            "normalize": True,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "latency": "normal",
            "max_new_tokens": 1024,
            "repetition_penalty": 1.2,
            "min_chunk_length": 50,
            "condition_on_previous_chunks": True,
            "early_stop_threshold": 1,
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        # Fish Audio occasionally returns 503 ("serving DC cannot serve this
        # request"); retry with backoff. Up to 6 attempts covers a ~2 min window.
        audio_bytes = b""
        for attempt in range(6):
            request = urllib.request.Request(FISH_TTS_URL, data=body, method="POST")
            request.add_header("Authorization", f"Bearer {api_key}")
            request.add_header("Content-Type", "application/json")
            request.add_header("model", FISH_MODEL)
            try:
                with urllib.request.urlopen(request, timeout=180) as response:
                    audio_bytes = response.read()
                break
            except urllib.error.HTTPError as error:
                details = error.read().decode("utf-8", errors="replace")
                if error.code in (502, 503, 504, 429) and attempt < 5:
                    wait = 5 * (attempt + 1)
                    print(f"  segment {index}: {error.code}, retry {attempt + 1}/5 in {wait}s ({details[:80]})", flush=True)
                    time.sleep(wait)
                    continue
                raise RuntimeError(f"Fish Audio request failed for segment {index}: {error.code} {details}") from error
        else:
            raise RuntimeError(f"Fish Audio request exhausted retries for segment {index}")
        mp3.write_bytes(audio_bytes)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp3),
             "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
        durations.append(local.duration(wav))
        print(f"Fish segment {index + 1}/{len(local.SEGMENTS)}: {durations[-1]:.2f}s", flush=True)

    silence = audio_dir / "silence.wav"
    tail_silence = audio_dir / "tail-silence.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(local.SILENCE_BETWEEN),
         "-c:a", "pcm_s16le", str(silence)])
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(local.SILENCE_TAIL),
         "-c:a", "pcm_s16le", str(tail_silence)])

    concat_list = audio_dir / "concat.txt"
    entries: list[str] = []
    for index in range(len(local.SEGMENTS)):
        entries.append(f"file '{audio_dir / f'segment-{index:02d}.wav'}'")
        if index < len(local.SEGMENTS) - 1:
            entries.append(f"file '{silence}'")
    entries.append(f"file '{tail_silence}'")
    concat_list.write_text("\n".join(entries) + "\n", encoding="utf-8")

    narration = work_dir / "narration-fish.wav"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
         "-safe", "0", "-i", str(concat_list), "-c:a", "copy", str(narration)])
    return narration, durations


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=VIDEO_DIR / "flash-spectrum-zh-fish.mp4")
    args = parser.parse_args()
    load_workspace_env()
    api_key = os.environ.get("FISH_AUDIO_API_KEY")
    if not api_key:
        raise SystemExit("Set FISH_AUDIO_API_KEY in the environment or workspace .env before running this script.")

    work_dir = Path(tempfile.mkdtemp(prefix="flash-spectrum-fish-video-build-", dir=str(VIDEO_DIR)))
    print(f"work directory: {work_dir}")
    narration, durations = make_fish_audio(work_dir, api_key)
    subtitles = args.output.with_suffix(".srt")
    local.write_srt(subtitles, durations)

    port = local.free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", str(local.ROOT_DIR)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        local.wait_for_server(port)
        frames_dir = local.capture_frames(work_dir, durations, port)
    finally:
        server.terminate()
        server.wait(timeout=10)

    local.assemble(work_dir, frames_dir, narration, subtitles, args.output)
    metadata = {
        "output": str(args.output),
        "provider": "Fish Audio REST API",
        "model": FISH_MODEL,
        "voice_id": FISH_VOICE_ID,
        "segment_durations": durations,
        "video_duration": local.duration(args.output),
        "fps": local.FPS,
        "resolution": f"{local.WIDTH}x{local.HEIGHT}",
    }
    args.output.with_suffix(".json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
