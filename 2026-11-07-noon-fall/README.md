# Noon Fall

Set one fireball's speed, angle, mass and strength; watch it burn up, shatter in an airburst, or land as a meteorite.

Built by GLM-5.3 Flash

An atmospheric-entry experiment for the Ensisheim stone, which fell at noon on 7 November 1492 — the fireball was heard 150 km away, and 127 kg of the rock still sits in the town. This November the Taurids are shedding their slow fireballs again, so the app drops four real falls into the same sky: a Taurid fireball, Ensisheim itself, Chelyabinsk 2013, and an iron bolide.

## How to run

Open `index.html` directly, or serve the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-11-07-noon-fall/](http://localhost:8765/2026-11-07-noon-fall/).

[Live project](https://dailyslop.pages.dev/2026-11-07-noon-fall/)

Pick a material, drag speed / angle / mass, press **Drop it**. Every flight is animated at its own pace so the whole descent fits on screen; brightness is the apparent magnitude a watcher 100 km away would see. Nothing launches until you press the button, and there is no sound.

## What the model represents

A single-body entry model: exponential atmosphere (scale height 7.2 km), flat ground, one constant flight angle, drag coefficient 0.7, ablation carrying 2 % of stagnation heat, 0.5 % of that energy glowing. Fragmentation happens when dynamic pressure ρv² exceeds the body's strength, where strength is a 1-metre dynamic strength scaled by a quarter-power size effect — big bodies are weaker, which is why a 20-metre stone bursts near 30 km while a 60-centimetre stone rides 10 MPa down to the ground.

The burst is drawn as one flash: real events fragment in cascades, drop fragment showers, and can still leave surviving stones (Chelyabinsk did). Dark flight is compressed to fit the screen; the wind, spins, and ablation shape changes are left out. The preset numbers (78 km, 28 km, ~545 kt, ~504 kg) come out of the model, not from the historical record — the model happens to land close to Chelyabinsk's accepted ~500 kt at ~30 km.

## Verification

```sh
node 2026-11-07-noon-fall/test_model.cjs
python3 2026-11-07-noon-fall/test_browser.py
```

The model test covers the atmosphere, strength scaling, magnitude scale, the four preset stories, monotone trajectories across 36 entries, determinism, and invalid inputs. The browser check uses the locally installed Python Playwright and Chromium. The app itself has no dependencies.

## Video

The [Chinese narrated video](video/noon-fall-zh-fish.mp4) has [matching subtitles](video/noon-fall-zh-fish.srt). Reproduction instructions are in [video/README.md](video/README.md).
