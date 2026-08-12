# chiral-lab — a handedness studio

Built by GLM-5.2

A small interactive studio for **chirality** — the property of an object that
cannot be superimposed on its mirror image (your two hands are the canonical
example). Built for **International Left-Handers Day, August 13**.

Pick an object — a hand, a helix, a propeller, a tetrahedral molecule, a snail
shell, or a flat letter F — and you'll see it (violet) next to its mirror image,
the *enantiomer* (cyan). **Drag to rotate the mirror and try to superimpose it
on the original.** A live meter shows your RMSD alignment gap, the closest any
rotation can get (the *rotation floor*, computed by the Kabsch algorithm), and
the gap a single reflection would close (always ≈ 0).

The punchline, shown as a readout: a reflection has determinant **−1**, every
rotation has determinant **+1**, so reflection·rotation is always −1 and can
never be the identity — which is *why no amount of turning will ever superimpose
a chiral object on its mirror*. Toggle **"allow one reflection"** and the
enantiomer snaps perfectly onto the original — the single move your wrist is
physically incapable of.

There is a teaching twist: a flat letter F is **chiral in 2D** (no in-plane turn
aligns its mirror) but **achiral in 3D** (flip it over). Toggle **2D mode** and
watch the rotation floor jump.

## How to run

Vanilla HTML/CSS/JS, no build step, no dependencies.

```
open index.html
```

…or serve it (the canvas needs no server, but a server avoids any file:// quirks):

```
python3 -m http.server 8765 --directory /path/to/daily-slop
# then open http://127.0.0.1:8765/2026-08-13-chiral-lab/
```

## Engine tests

The linear algebra (rotation/reflection matrices, a 3×3 Jacobi eigensolve, SVD,
Kabsch optimal alignment, and chirality classification) is pure and
node-testable:

```
node test_engine.js          # 57 assertions
```

## Files

| file | what |
| --- | --- |
| `engine.js` | pure math: matrices, parity, Jacobi/SVD, Kabsch, chirality, object generators |
| `app.js` | canvas 3-D rendering, trackball drag, live RMSD, controls |
| `test_engine.js` | node assertion suite |
| `index.html` / `style.css` | layout + dark "optics bench" styling |
| `NOTES.md` | the why, the math, the dead ends |
| `video/` | the Fish Audio 哈基米 Chinese narration video + renderer |

See [`NOTES.md`](./NOTES.md) for the determinant/parity proof, the Kabsch
derivation, the 2D-vs-3D F surprise, and why the tetrahedron's arms had to differ.
