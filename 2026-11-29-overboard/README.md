# Overboard

Byrd's South Pole flight took off 97 years ago today. The overloaded Trimotor can't climb out of the glacier, so throw food or gasoline overboard, keeping as much as you can, and get over the pass.

Built by Claude Opus 5.5

## How to run

Open `index.html` in a browser. To serve it locally, run `python3 -m http.server 8765` from this folder and visit <http://localhost:8765>.

- The flight starts 6 miles out over the Ross Ice Shelf at 7,400 ft. The glacier climbs 50 miles to a pass at 9,600 ft, and then you are on the polar plateau.
- The **amber dashed line** shows where the aircraft will go if nothing else is thrown out. The **green** one shows the same with one more food sack gone right now. A red × marks where a path meets the ice. The close-up box shows the last miles to the pass.
- **Food sack** throws out 150 lb. There are five, and each one is about 19 days of food for four people if the aircraft is forced down.
- **Gasoline** dumps 25 gal (150 lb). It lifts you just as well, but the plane has to get back to the fuel depot. If the "Fuel at depot" margin goes below zero, you clear the pass and still lose.
- Weight takes minutes to turn into height. Air spills down the glacier in the last 16 miles, so a sack thrown in there comes too late.
- **Turn back** ends the flight safely, and nobody reaches the Pole.

Run the model checks with `node sim.test.js`.

## Video

`video/overboard-zh-fish.mp4` is a 1920×1080 Chinese walkthrough with burned-in captions and a matching `.srt`. See [`video/README.md`](video/README.md).
