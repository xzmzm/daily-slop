# Cut Across

A tiny film-continuity lab: move a camera across two actors’ eyeline and watch a cut reverse their screen positions.

Built by GPT-6

The overhead plan shows Ada, Jules, and the axis between them. Camera A stays fixed; camera B changes the view.

- Drag **B** around the circle or use its angle slider. **Same side** sets B to 135°; **Cross the line** sets it to 225°.
- **Play the cut** alternates A and B every two seconds. Click again to pause.
- Click either camera thumbnail to inspect that view and pause playback. The position labels track who appears on each side.
- **Reset set** restores the initial camera positions and pauses on A.

## How to run

From this project folder:

```bash
open index.html
```

Or, from the workspace root:

```bash
python3 -m http.server 8765
```

Open [localhost:8765/2026-10-05-cut-across/](http://localhost:8765/2026-10-05-cut-across/).

## Why October 5?

*Dr No* premiered in London on October 5, 1962 — 64 years before this build. That film anniversary prompted a small experiment in the spatial logic of editing. The characters and diagrams here are original; no film footage is used. [BFI’s anniversary article](https://www.bfi.org.uk/features/happy-50th-anniversary-mr-bond)

The 180-degree rule is a continuity guideline, and filmmakers can cross the line deliberately. This lab isolates a fixed two-person scene so the reversal is easy to see. [Adobe’s filmmaking guide](https://www.adobe.com/uk/creativecloud/video/discover/what-is-the-180-degree-rule.html)
