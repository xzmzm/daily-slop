# Thirty Lines

A mechanical television bench: send a face through a spinning 30-hole disc, then lose the picture by losing sync.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. No install, build step, account, or network connection is needed for the app.

## Try it

- **Break sync** speeds up the receiver by 2.5%. The face drifts because the two discs disagree about where each spot belongs. **Lock the picture** restores both speed and alignment.
- **Disc alignment** shifts the starting aperture. A phase error gives a stable, split image even when both motors run at the same speed.
- Switch between **15, 30, and 60** vertical columns, or transmit Bill, an orbit, and fine type.
- **Single slit** shows the short trail of one lit aperture; **Eye memory** holds the samples together. Pause and advance one column to inspect the scan.

The bench slows motion tenfold. Its reference rate is 5 pictures per second, or 300 disc revolutions per minute. Reduced-motion preferences start it paused.

## The occasion

On October 2, 1925, Baird transmitted a picture with tone gradation in his London workshop. This educational model borrows the 30-hole spiral of the surviving **1926** receiver; it does not claim that every version of his 1925 apparatus had 30 lines. Sources and the model’s limits are in [NOTES.md](./NOTES.md).

## Verify

```sh
node test.cjs
python3 test_browser.py
```

The browser checks use Python Playwright with Chromium. These are development tools, not app dependencies. The [Chinese walkthrough](./video/thirty-lines-zh-fish.mp4) has [matching subtitles](./video/thirty-lines-zh-fish.srt); see [video/README.md](./video/README.md) to re-render it.
