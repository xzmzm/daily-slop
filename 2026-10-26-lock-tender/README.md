# Lock Tender

Give a boat a staircase: operate the gates and sluices of a canal lock, and let gravity carry it uphill.

Built by GPT-6.1 Sol

Made on October 26, 2026, the 201st anniversary of the Erie Canal opening.

## How to run

Open `index.html` directly. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. The app works offline and has no dependencies.

## Play

The chamber starts at the wrong level for the approaching boat. Use a **small sluice** to match levels, close it, then open the **big gate** and bring the boat in. Close the gate behind it, change the water level, and leave through the other gate. The prompt under the controls suggests the next move; refused moves explain the interlock.

Try both **Uphill** and **Downhill**. Reset restarts the current direction. All controls support keyboard focus, Enter, and Space. The waterline, boat height, and water admitted from the upper reach update together.

The chamber is an illustrative 30 × 4 m rectangle with a 2.4 m lift. Its full level change takes seven seconds. Gates are schematic; this is a teaching model rather than a reconstruction of an 1825 lock. Reaches hold constant levels, and boat displacement, leakage, turbulence, mooring and real gate mechanics are omitted.

## Checks

```sh
node test_model.cjs
python3 test_browser.py  # requires Playwright and its Chromium browser
```

## Sources

- [New York State Archives — construction and opening](https://www.nysarchivestrust.org/exhibits/erie-canal/construction-opening): the Erie Canal opened October 26, 1825.
- [Canal & River Trust — how locks work](https://canalrivertrust.org.uk/boating/boating-news-and-views/boating-blogs/top-of-the-locks-canal-boat-holiday-destinations): close the gates, change the chamber level with sluices, then move when levels match.
- [U.S. Army Corps of Engineers — locking](https://www.swt.usace.army.mil/Missions/Navigation/Locking.aspx): higher-to-lower passage through a lock.
