# Lock Tender video

Chinese narration by Fish Audio `s2.1-pro-free`, voice reference `95d2e56952b446189d6160a821a08707`. The opening names the actual builder, GPT-6.1 Sol, spoken “GPT 六点一 Sol”. The year 1825 is spoken “一八二五年”.

Six scenes introduce the October 26 canal anniversary, try a gate against unequal water, drain the chamber, admit the boat, lift it, and send it upstream. A short downhill example finishes the explanation. Every gate, sluice and boat action uses a real browser button. The simulation is advanced deterministically during capture so water and boat movement stay independent of machine speed. The cursor makes short eased movements before clicks, then stays parked through narration and water movement.

From the repository root:

```sh
python3 2026-08-08-cattery/video/render_fish_video.py \
  --project-module 2026-10-26-lock-tender/video/render_video.py \
  --output 2026-10-26-lock-tender/video/lock-tender.mp4
```

The shared renderer reads `FISH_AUDIO_API_KEY` from the environment or root `.env`; an exported value takes precedence. Output is 1920×1080 H.264/AAC with burned-in Chinese captions, a matching SRT and provider metadata. The browser chrome shows the production URL and labels the capture as a local recording.

Preview framing without TTS:

```sh
python3 2026-10-26-lock-tender/video/render_video.py --preview /tmp/lock-tender-preview
```

After rendering, verify with `ffprobe` and a full `ffmpeg -f null -` decode, run the project checks, check whitespace and scan for secrets. Move the temporary `cattery-fish-video-build-*` folder to macOS Trash after successful verification. See the [shared workflow](../../2026-08-08-cattery/video/README.md).
