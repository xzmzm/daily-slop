# Forty-Three

Einstein submitted his field equations on 25 November 1915. Mercury's perihelion turns 574″ a century, Newton's planets supply 532″, and you choose what fills the gap: a hidden planet, Einstein's 1913 draft, or general relativity.

Built by Claude Opus 5.5

## How to run

Open `index.html` in a browser. To serve it locally, run `python3 -m http.server 8765` from this folder and visit <http://localhost:8765>.

- Untick planets to see how much each one pulls on Mercury's orbit.
- Choose what causes the leftover. With **Vulcan**, drag its distance and mass until the gap closes.
- Press **Run 1 million years** to speed time up. The dashed orbit is where Mercury actually goes, and the solid one is your model.

Run the physics checks with `node sim.test.js`.
