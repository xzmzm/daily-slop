# WEAF 660

Built by GLM-5.3

An AM-modulation studio for the 104th anniversary of radio's first paid
commercial: **28 Aug 1922, 5:15 pm**, when AT&T's WEAF New York sold ten
minutes of airtime to the Queensboro Corporation for **$50** and Mr.
Blackwell pitched Hawthorne Court apartments in Jackson Heights — the birth
of toll broadcasting, the ancestor of every ad you've ever skipped.

The whole lesson is closed forms:

1. **AM is an identity** — `s = A(1+m·cos ω_m t)·cos ω_c t` is *exactly*
   three spectral lines: a carrier plus sidebands `A·m/2` tall. At `m = 1`
   the sidebands carry exactly **1/3** of the power; above 1 the envelope
   inverts, the spectrum splatters and neighbours suffer.
2. **The crystal detector taxes you m/4** — square-law detection recovers
   the programme at `A²m` and inserts a second harmonic at `A²m²/4`:
   25% distortion at full modulation, by algebra.
3. **The RC load walks a tightrope** — too small and carrier ripple rides
   through (`droop = 1 − e^(−T_c/RC)`), too big and the output sawtooth-cuts
   the envelope: the exact bound is `RC ≤ √(1−m²)/(m·ω_m)`.
4. **One knob, one station** — `f₀ = 1/(2π√LC)`: a 250 µH coil tunes WEAF's
   660 kHz at **232.6 pF**, dead centre of the standard 15–365 pF variable
   capacitor. With `Q = ωL/R ≈ 104` the bandwidth is 6.4 kHz — one station
   just fits, and a neighbour 20 kHz away is only −16 dB away.
5. **Day and night** — the ad aired in daylight: ground wave only, `E ∝ 1/d`.
   After dark the E layer returns a skywave, and the phasor sum
   `√(E_g²+E_s²+2E_gE_s·cos φ)` swings between reinforcement and perfect
   nulls — selective fading, half a wavelength of path difference per swing.

Includes a swept transmitter scope with true envelopes, a three-line
spectrum with splatter, a full crystal-set schematic with tuning dial, the
selectivity curve, a numerically simulated detector (ripple and diagonal
clipping are real output), day/night propagation with a phase wheel and
drifting fade trace, the surviving script of Blackwell's talk, and the
$50 ledger ($5/min; $550 of toll sales by October = exactly eleven
Hawthorne-sized spots; 660 kHz is still on air today as WFAN).

## How to run

```bash
python3 -m http.server 8765        # from the repo root
```

then open <http://localhost:8765/2026-08-28-weaf-660/>. No build step, no
dependencies. Run the exact-formula tests with:

```bash
node --test 2026-08-28-weaf-660/test_physics.mjs
```
