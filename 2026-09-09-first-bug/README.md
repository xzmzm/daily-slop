# First Bug (1947)

Built by Gemini 3.8 Flash

1947 Harvard Mark II relay computer studio; an electromechanical cross-section, Relay #70's contact bounce, and the moth that gave computing its favorite word.

On the hot late-summer afternoon of Tuesday, September 9, 1947, at 15:45, operators running test sequences on the Harvard Mark II Aiken Relay Calculator in Cambridge encountered a machine halt. Operator William "Bill" Burke opened Panel F and discovered a 2-inch moth beaten to death inside the contact points of Relay #70. The insect was removed with tweezers and taped into the official daily logbook by Grace Hopper with the legendary inscription: *"1545 Relay #70 Panel F (moth) in relay. First actual case of bug being found."*

This studio recreates the electromechanical physics of the 13,000-relay calculator across four interactive benches:

1. **Relay #70 Cross-Section**: A real-time physics simulation of an Aiken 50V DC multi-contact relay. Energize the copper coil ($L = 1.2\,\text{H}, R = 250\,\Omega$), watch magnetic flux pull the steel armature, see silver contact bounce, and observe how the 0.38 mm dielectric thickness of a moth halts the armature at 0.62 mm, preventing closure and leaving an open circuit of $>100\,\text{M}\Omega$.
2. **Panel F Arithmetic & Dual Check Rack**: The 8-bit accumulator register (Relays 64 to 71). Run arithmetic additions at the Mark II's native 125 ms cycle time (8 Hz). When Relay #70 (Bit 6) is jammed by the moth, the dual checking circuit detects the missing 64-value discrepancy, sounds the alarm buzzer, and halts the calculator.
3. **Relay Logic & Full Adder**: Interactive contact network schematics showing how electromechanical switches construct Boolean logic (NOT, AND, OR, XOR via Form-C changeover contacts) and a 1-bit full adder with live current paths and indicator bulbs.
4. **1947 Smithsonian Logbook & Timeline**: High-fidelity recreation of the 15:45 logbook sheet preserved at the Smithsonian National Museum of American History, along with an interactive timeline from Edison's 1878 telegraph "bugs" to Grace Hopper's compilers.

## How to run

No dependencies, no build steps. Pure vanilla HTML5, CSS3, and JavaScript (ES Modules) with Web Audio API sound synthesis.

```bash
# From repo root (never bind port 8000; use 8765 or any free port)
python3 -m http.server 8765
```

Then visit:
[http://localhost:8765/2026-09-09-first-bug/](http://localhost:8765/2026-09-09-first-bug/)

Or run the test suite directly:

```bash
node --test 2026-09-09-first-bug/test_physics.mjs
```
