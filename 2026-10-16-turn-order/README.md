# Turn Order

Give two marked cubes the same turns in opposite orders. A small rotation experiment for Hamilton’s quaternion day.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit http://localhost:8765/2026-10-16-turn-order/.

## Try it

- Replay **Two axes**. X then Y and Y then X end 120° apart.
- Scrub the turns to follow the marked faces. The room axes stay fixed.
- Build up to six positive or negative turns, then change their shared angle.
- **Back and forth** cancels the signed angles on each axis without returning home.
- **Just one axis** agrees in either order. Two perpendicular 180° turns also agree.

Every face has a distinct label and an asymmetric mark. The difference is the shortest rotation needed to align the full poses, rather than the angle between just two arrows.

The app runs entirely locally with no dependencies. Mathematical checks: `node 2026-10-16-turn-order/test_model.cjs` from the repository root. Browser checks: `python3 2026-10-16-turn-order/test_browser.py` with Playwright installed.

Inspired by [Hamilton’s discovery on 16 October 1843](https://www.maths.tcd.ie/pub/HistMath/People/Hamilton/Quaternions.html).
