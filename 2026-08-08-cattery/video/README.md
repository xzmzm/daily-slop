# cattery video

`cattery-zh-fish.mp4` is the Chinese story video for the August 8 project,
using Fish Audio's `s2.1-pro-free` model and the 哈基米 voice model. The
earlier `cattery-zh.mp4` is the local-TTS fallback.
It introduces the idea, clicks through the live browser app, shows the
expected-vs-actual ratios and Punnett square, and ends on the seven-locus
cheat sheet.

## Narration style (applies to every daily-project video)

Narration copy must not have AI 味. Banned stock phrases include
“一步步拆给你看”, “账本”, “账单”, “算这笔账” — and close variants of
either pattern: no announce-then-explain filler (“拆给你看”, “带你一步步…”),
and no dressing every quantity up as accounting (a ledger, a bill, an
account to settle). Don't say you're about to explain something; state the
fact or the number plainly and move on. This applies to the spoken script,
the burned-in subtitles, and on-screen titles alike.

**Years are read digit by digit.** In the spoken script (the TTS `SEGMENTS`
text) spell every year in Chinese digits — 一九零六年 9 月 5 日, 二零一一赛季 —
never as an Arabic numeral: TTS reads “1906 年” as 一千九百零六年, which is
wrong for years. Quantities that are not years (158.3, 2.375, 60 码) stay
written as normal numbers. The burned-in subtitles keep Arabic numerals
(“1906 年”) — the rule is about the spoken track only.

The Fish version uses the REST `/v1/tts` endpoint. The renderer automatically
loads `FISH_AUDIO_API_KEY` from the repository-root `.env`; an already-exported
environment variable takes precedence. The key is never stored in this folder,
source code, or generated metadata.

## Re-render

From the repository root:

```bash
python3 2026-08-08-cattery/video/render_video.py       # local fallback
python3 2026-08-08-cattery/video/render_fish_video.py  # Fish Audio; reads .env
```

To override the local value for one run:

```bash
FISH_AUDIO_API_KEY=... python3 2026-08-08-cattery/video/render_fish_video.py
```

Both scripts serve the project temporarily on a free local port, capture the
actual UI with headless Chrome, burn in Chinese subtitles, and write a 1920×1080
MP4 plus its matching `.srt` file. The cursor stays still during explanation
and scrolling, and only makes short eased movements before real clicks; this
avoids the unnatural long linear drifts from the first recording. The mother
picker is held open for about 1.8 seconds so its choices are visible.
