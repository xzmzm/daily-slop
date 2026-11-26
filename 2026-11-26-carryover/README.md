# Carryover

Thanksgiving 2026: roast a toy turkey cross-section, pick the thermometer reading where you pull it, and rest it. Watch carryover heat, a modelled Salmonella kill, and juice loss. It is not a food-safety check.

Built by Claude Opus 5.5

## How to run

Open `index.html` in a browser. To serve it locally, run `python3 -m http.server 8765` from this folder and visit <http://localhost:8765>.

- Set the bird's weight, the oven, the **pull at** reading and the rest time, then press **Roast it**.
- Click anywhere in the meat to move the thermometer. The purple ring marks the slowest spot, the one with the least kill so far.
- When it's carved, the cross-section changes colour to show the hottest temperature each cell reached, from raw to dry.
- Try the 165°F pull with a 30-minute rest, then a 150°F pull with the same rest, then 145°F with no rest. Lower pulls show how the model behaves; they are not a cooking recommendation.

Run the physics checks with `node sim.test.js`.

## Food-safety note

This is a 2D toy model of a breast slice. Its "model target met" verdict does not mean a real turkey is safe to eat. For a real bird, follow the [USDA](https://ask.fsis.usda.gov/article/What-is-the-internal-temperature-and-cooking-time-for-turkey): use a food thermometer and check that the thickest part of the breast and the innermost parts of the thigh and wing reach at least 165°F.
