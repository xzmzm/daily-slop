# Barium Glow

Run a 19th-century X-ray bench: set the tube's voltage and current, shoot a book, a plank, a hand and a lead disc, and see whether the plate you take is a textbook image, fog, or a black square.

Built by GLM-5.3 Flash

An experiment for the night of **8 November 1895**, when Wilhelm Röntgen found a barium platinocyanide screen glowing two metres from a Crookes tube he had boxed in black cardboard — and named the unknown rays X. The International Day of Radiology marks this date. The bench repeats his first night: the covered tube still lights the screen, and everything that follows is a race between penetration, photons and contrast.

## How to run

Open `index.html` directly, or serve the repository root:

```sh
python3 -m http.server 8765
```

Visit [localhost:8765/2026-11-08-barium-glow/](http://localhost:8765/2026-11-08-barium-glow/).

[Live project](https://dailyslop.pages.dev/2026-11-08-barium-glow/)

Pick an object, set kVp and mA, toggle the cardboard cover to watch the room go dark while the screen keeps glowing, then press **Expose** and let the mA·s counter run before fixing the plate. The verdict grades exposure, contrast and grain. Nothing emits until you press the button, and there is no sound.

## What the model represents

Every shadow is Lambert–Beer attenuation: each centimetre of matter multiplies the beam by e^(−μt), with μ set by hand at 60 kVp and stretched with energy — a photoelectric term (≈E⁻³, strong in heavy atoms) over a weak Compton floor. Tube output grows with kVp². The plate samples a Poisson photon count per pixel, so grain fades as 1/√count; the film curve saturates near 140 photons, which is why too little is fog and too much is a black square. The verdict reads the subject's mean photon count against a window and the shadow contrast (ln of the transmission ratio) against a floor: soft rays can rescue themselves with dose, hard rays wash out, lead beats everything.

The objects are procedural thickness maps: a hand with finger bones and a brass ring, a book with a hidden paperclip, a plank with a hidden nail, a lead disc. The hand at 60 kVp / 12 mA·s reproduces the lesson of the first medical radiograph (Anna Bertha Röntgen's hand, 22 December 1895 — a fifteen-minute exposure then).

## Verification

```sh
node 2026-11-08-barium-glow/test_model.cjs
python3 2026-11-08-barium-glow/test_browser.py
```

The model test covers the attenuation law's monotonicity and ordering, the kVp² output law, deterministic maps with the ring, nail and paperclip in place, contrast falling with voltage, every verdict band (textbook, fog, washed out, black plate, lead-blocked), and invalid inputs. The browser check drives the expose/fix cycle on the deterministic clock, the hand's sweet spot, the cover toggle, lead's blocked verdict, over-exposure, responsive widths and offline operation. The app itself has no dependencies.

## Video

The [Chinese narrated video](video/barium-glow-zh-fish.mp4) has [matching subtitles](video/barium-glow-zh-fish.srt). Reproduction instructions are in [video/README.md](video/README.md).
