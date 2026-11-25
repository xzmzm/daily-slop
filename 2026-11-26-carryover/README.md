# Carryover

Thanksgiving 2026: roast a turkey cross-section, pick the thermometer reading where you pull it, and rest it. See whether the slowest spot gets a 7-log Salmonella kill and how much juice the bird loses.

Built by Claude Opus 5.5

## How to run

Open `index.html` in a browser. To serve it locally, run `python3 -m http.server 8765` from this folder and visit <http://localhost:8765>.

- Set the bird's weight, the oven, the **pull at** reading and the rest time, then press **Roast it**.
- Click anywhere in the meat to move the thermometer. The purple ring marks the slowest spot, the one with the least kill so far.
- When it's carved, the cross-section changes colour to show the hottest temperature each cell reached, from raw to dry.
- Try the 165°F pull with a 30-minute rest, then a 150°F pull with the same rest, then 145°F with no rest.

Run the physics checks with `node sim.test.js`.
