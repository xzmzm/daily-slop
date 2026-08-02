# Heraldic Forge — Notes

## Why this project?

I wanted something completely different from the previous 10 days (procedural
landscapes, physics simulations, astronomy, decision theory, liminal spaces).
Heraldry is a rich visual system with strict formal rules — perfect for a
generative toy. Plus, who doesn't love the idea of forging their own medieval
coat of arms?

## How it works

### Tincture rule
The core rule of heraldry: **no colour on colour, no metal on metal**. The two
metals are *Or* (gold) and *Argent* (silver/white); the five colours are
*Gules* (red), *Azure* (blue), *Sable* (black), *Vert* (green), and *Purpure*
(purple). Every time the generator picks a field tincture, the contrasting
element (charge, border) is forced to the opposite category. Furs (*Ermine*,
*Vair*, etc.) count as metals for this rule.

### Field divisions
13 division types are available: *per fess*, *per pale*, *per bend*, *per bend
sinister*, *per saltire*, *quarterly*, *gyronny of eight*, *per chevron*, *per
pile*, *paly of six*, *barry of six*, and *chequy*. Each is drawn by clipping
to the shield outline, then painting two alternating tinctures in the correct
geometric pattern.

### Charges
19 different charges are drawn procedurally on Canvas: lion rampant, eagle
displayed, fleur-de-lis, mullet (star), crescent, cross, escarbuncle, sword,
horseshoe, tower, tree, rose, martlet, sun in splendour, annulet, key, dragon
passant, and pellet. Small charges (stars, crescents, pellets, roses,
annulets, martlets) randomly appear in groups of 1–3.

Each charge is a hand-coded Canvas path — no external images or fonts. The
proportions are loosely inspired by real heraldic depictions but stylized for
clarity at the shield's scale.

### Fur patterns
*Ermine* and *Erminois* use a grid of small teardrop-shaped spots on a
contrasting background. *Vair* and *Counter-Vair* use alternating bell-shaped
shields in two tinctures — a classic medieval pattern that originally
represented squirrel fur.

### Border variations
7 border styles: plain bordure, engrailed, invected, indented, wavy, double
tressure, and fleury. The decorative borders are drawn as modulated strokes
along the shield outline.

### Crests and mottoes
6 crest types sit above the shield on a heraldic torse (wreath): crown, helm,
eagle, lion, three ostrich plumes, and mullet. 28 Latin motto phrases are
included.

### Blazon generation
Every coat of arms produces a proper heraldic blazon — the formal written
description. For example: *"Azure and Or, per pale. a lion rampant Gules. a
bordure engrailed Sable. For a crest: On a wreath, a crown Vert. 'Fortis et
Fidelis'."* This uses real heraldic vocabulary.

## Interesting notes

- The **crescent** drawing was the trickiest charge. I initially used
  `globalCompositeOperation = 'destination-out'` to cut a circle out of another
  circle, but this erased the entire shield background behind it. Fixed by using
  the Canvas `evenodd` fill rule instead, which cleanly subtracts the inner
  circle path.

- Similarly, the **tree** initially used `globalCompositeOperation = 'multiply'`
  for inner shading — same problem. Replaced with a simple darker solid color
  derived from the charge tincture.

- The **dragon** was a last-minute addition — I originally had the charge named
  "bezier" internally as a joke (drawing it with bezier curves), then decided to
  make it an actual dragon passant with fire breath.

- **Martlets** are heraldisms' bird-without-feet — real medieval heralds omitted
  feet to represent swift, continuous flight. I kept this detail.

- The shield shape itself uses a classic heater shield profile: flat top, straight
  sides tapering to a rounded point at the bottom, created with quadratic Bezier
  curves.
