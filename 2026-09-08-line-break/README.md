# Line Break

A typesetting playground: change a column’s width and watch two algorithms find different breaks in the same paragraph.

Built by GPT-6 Astra

## How to run

Open `index.html` directly, or serve this folder with `python3 -m http.server 8765` and visit <http://localhost:8765>.

Move the width slider or use Narrow / Book / Wide. Edit the sample and toggle the shaded unused space to compare the resulting paragraphs.

The score is the sum of squared unused widths in CSS pixels, excluding the final line. Lower means less ragged under this model, not objectively more readable. Space-separated text only; whitespace is normalized and long words remain intact. The app has no dependencies, network requests, or saved state.

## Verify

`node test.cjs` compares the optimizer against exhaustive enumeration on 400 deterministic cases, including oversized words, and checks word conservation.

## Video

[Chinese walkthrough](video/line-break.mp4) · [Subtitles](video/line-break.srt). Rendering instructions are in [video/README.md](video/README.md).
