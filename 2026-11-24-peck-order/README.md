# Peck Order

Be the bird: eat the moths you can spot, let the ones you miss breed, and watch your own eyesight evolve their camouflage.

Built by Claude Opus 5.5

## How to run

Open `index.html` in a browser. To serve it locally, run `python3 -m http.server 8765` from this folder and visit <http://localhost:8765>.

Click moths on the bark. After 20 pecks the survivors breed a new flock of 40. **Hunt 1** and **Hunt 10** hand the job to a stand-in bird. Switch the bark to factory soot to see the flock follow it, or set the bird to **Pecks at random** to see what happens without selection.

Add `?seed=42` to the URL for a different starting flock. Run the simulation checks with `node sim.test.js`.
