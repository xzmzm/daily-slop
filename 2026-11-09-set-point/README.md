# Set Point

At 5:16 pm on 9 November 1965 one relay set at 375 MW tripped a line out of Niagara and 30 million people lost power. Pick the set point and the evening surge, then run the cascade.

Built by Claude Opus 5.5

## How to run

Open `index.html` directly in a browser. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. Everything runs on your own device.

## Try it

- **Backup relay set point** applies to all five Beck–Toronto lines. **1963 setting · 375** is what was in the relays that night. **Raised · 500** is an illustrative setting after the fix.
- **Toronto load swing** is the short rise in demand at 5:16:11. The steady flow on line 1 is 356 MW, and a +100 MW swing takes it to 376 MW, 0.8 MW over.
- **Run** plays the cascade a step at a time. Line colours show loading against each line's limit, tripped lines go dashed, and a city's lamp goes out when its island can't make enough power.

With the 1963 setting, the five lines trip in 2.4 seconds, Toronto goes dark, the surplus from Beck and Niagara overloads the lines east, and New York and New England collapse: 28.2 million people on this board. At 400 MW the same swing rides through.

The 375 MW setting, the 356 MW reading, the five lines and 5:16:11 pm are real. The buses, reactances, other limits, generation, the size of the swing and the times after the first trip are invented. This is a teaching model, not the 1965 network.

## Tests

From the repository root, run `python3 2026-11-09-set-point/test_browser.py` (Python Playwright with Chromium).
