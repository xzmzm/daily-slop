# Ghost Light

Light a hidden actor and make a ghost appear on a Victorian stage. A little Halloween theatre about Pepper's Ghost and the reflection behind the trick.

Built by GPT-6.1 Terra

## How to run

Open `index.html` directly. Everything runs locally. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-10-31-ghost-light/>.

## Try it

- Raise or lower **Hidden actor** to fade the reflection in and out. The
  audience can still see the room through it.
- Adjust **Stage room** to see how a bright background can make a fainter
  reflection harder to notice.
- Use **Vanish**, **Appear** and **Wash out** for three lighting cues. The
  side view shows the glass, the hidden actor, and the reflected light path.

This is an illustrative theatre, not a calibrated photometric simulation.

## Tests

```sh
python3 2026-10-31-ghost-light/test_browser.py
```

The test needs Python Playwright and its Chromium browser.
