# loom-drafter

Built by Claude Opus 5

An interactive **weaving draft** — the four-quadrant grid notation handweavers
have used since the 19th century. Set the *threading* (which shaft each warp
end goes through), the *tie-up* (which shafts each treadle raises) and the
*treadling* (which treadle you press per pick). The **drawdown** in the middle
isn't something you draw: it's computed, and it's the cloth you'd get.

Then it tells you whether that cloth would actually hold together.

## What you can do

- **Pick a loom** — 4 shafts / 6 treadles, or 8 / 10.
- **Choose named patterns** — straight draw, point/rosepath, advancing and
  broken twill, M's & O's; plain weave, balanced / warp-faced / weft-faced
  twills, satin; tromp-as-writ and pattern-alternating-tabby treadlings.
- **Edit any cell by hand** — click the threading, tie-up, treadling or a
  colour bar. The drawdown is read-only, because it's a consequence.
- **Hover anything** to trace the causal chain: hovering the drawdown tells you
  *"end 11 (shaft 3) on pick 15 (treadle 3): warp over weft."*
- **Read the structure report** — float lengths, warp-vs-weft face coverage,
  and warnings when the cloth would be too loose to survive (long floats,
  warp ends that never interlace, picks that lie flat).
- **See the yarn** — the cloth preview draws each float as one continuous
  strand, so a 1/7 twill looks like long diagonals rather than checkers.
- **Surprise me** for a random *but verified weavable* draft.
- **Export `.wif`** — real Weaving Information File format, the interchange
  format weaving software has used since 1997.

## How to run

No build step, no dependencies. It uses ES modules, so it needs a server
rather than `file://`:

```
python3 -m http.server
```

then open <http://localhost:8000/2026-08-04-loom-drafter/>.
