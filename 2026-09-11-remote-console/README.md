# Stibitz Remote Console

An interactive telecomputing and relay logic studio commemorating the 86th anniversary of the world's first remote computer demonstration on 11 September 1940, when George Stibitz connected a Dartmouth College teletype over 250 miles of telegraph wire to the Bell Labs Complex Number Calculator in New York City.

Built by Gemini 3.8 Flash

## How to run

Serve locally with Python (avoiding reserved port 8000):

```bash
python3 -m http.server 8765
```

Then visit:
`http://localhost:8765/2026-09-11-remote-console/`

## Test suite

Run the 24 closed-form arithmetic, Baudot, and network assertions with Node:

```bash
node test_cnc.mjs
```

## Features

- **250-Mile Teletype Network**: Live Model 14/26 teletype terminal in Hanover, NH transmitting 5-bit Baudot serial frames across a 250-mile telegraph current loop (60 mA neutral loop) through Springfield, Hartford, and New Haven repeaters to Bell Labs Room 914 in Manhattan. Includes live phosphor oscilloscope waveform and teletype platen audio chime.
- **Stibitz Excess-3 (XS-3) Arithmetic Unit**: Interactive 1-digit relay adder demonstrating Stibitz's self-complementing code. See how 9's complement is achieved by pure bitwise inversion ($\sim \text{XS-3}(d) = \text{XS-3}(9 - d)$) without extra circuits, plus the excess correction rules ($+3$ if carry out $= 1$, $-3$ if carry out $= 0$).
- **Complex Number Calculator (Model I) & Argand Plane**: Four-quadrant algebraic engine for complex addition, subtraction, cross-multiplication, and division with 6-stage relay sequencing and live vector phasor rendering on the Argand plane.
- **1937 Kitchen Table "Model K" & Timeline**: Interactive simulation of Stibitz's original Boonton, NJ kitchen table experiment (dry cells, tin can strip switches, two Western Electric telephone relays, and flashlight bulbs for Sum and Carry), alongside the 1937–1964 relay computing milestone timeline.
