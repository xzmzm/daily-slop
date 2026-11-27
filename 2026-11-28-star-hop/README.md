# Star Hop

Mariner 4 launched for Mars 62 years ago today. Roll the spacecraft around the Sun line, read the roll map, set the brightness gate and send roll overrides until its sensor holds Canopus through the dust.

Built by Claude Opus 5.5

## How to run

Open `index.html` in a browser. To serve it locally, run `python3 -m http.server 8765` from this folder and visit <http://localhost:8765>.

- The mission clock starts at launch, 28 Nov 1964 14:22 UTC. About six hours later the spacecraft has the Sun and starts rolling to look for Canopus.
- The top dial is the sky around the Sun line. The blue ring is everything the sensor can see as it rolls, and the slit is where it is looking now. The roll map underneath plots what the sensor has measured at each roll angle, beside the catalog's prediction.
- **Brightness gate** sets which signals count as Canopus. With the gate on, a lock that drifts outside the window is dropped and the roll starts again. **Off** accepts anything above a faint floor and never drops a lock for being too bright.
- **Roll override** makes the sensor leave the current object and roll to the next one it will accept.
- Every command takes about 30 minutes of mission time to reach the spacecraft.
- The midcourse burn on 4 Dec 16:46 needs 9.6 hours of unbroken Canopus lock. If the lock isn't steady, the burn slips a day. After the third missed window, it's scrubbed.

Run the model checks with `node sim.test.js`.

## Video

`video/star-hop-zh-fish.mp4` is a 1920×1080 Chinese walkthrough with burned-in captions and a matching `.srt`. See [`video/README.md`](video/README.md).
