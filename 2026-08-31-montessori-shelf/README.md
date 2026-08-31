# Montessori's Shelf · 蒙台梭利的教具架

Built by GLM-5.3

An interactive studio of the **Montessori early-math materials** for Maria
Montessori's **156th birthday** (born 31 Aug 1870 at Chiaravalle, Italy — she
opened the first *Casa dei Bambini* in Rome's San Lorenzo slum on
6 Jan 1907). The pedagogy is famous; what this studio catalogues is the
**exact arithmetic hiding inside the materials**, because every one of them
is a closed form you can hold:

- **The bank game (golden beads).** A *category vector* counts loose beads,
  ten-bars, hundred-squares and thousand-cubes. Its value
  `V = u + 10t + 100h + 1000k` is **invariant under every exchange**
  10-of-a-kind ⇄ 1-of-the-next-kind, and dynamic addition is nothing but
  combine-then-canonicalize — the schoolbook carry is literally a trip to
  the bank. Watch 3567 + 2795 make three trips, or 9999 + 1 ripple four
  times into a single ten-thousand.
- **The pink tower.** Ten cubes with edges 1..10 cm and volumes 1³..10³ —
  whose sum is exactly **T² = 55² = 3025 cm³** (Nicomachus's theorem), and
  55 is precisely the number rods' total length. The proof plate beside the
  tower tiles a 55×55 square with nested L-gnomons whose areas are exactly
  1³, 2³, …, 10³, because `T(n)² − T(n−1)² = n·(T(n)+T(n−1)) = n³`.
- **The binomial cube.** Eight wooden pieces fill a box of volume
  `(a+b)³ = a³ + 3a²b + 3ab² + b³` — count them: 1 + 1 + 3 + 3 = 8.
  Slide the box open, layer by layer.
- **The trinomial cube.** Twenty-seven pieces fill
  `(a+b+c)³ = Σa³ + 3Σ_sym(a²b) + 6abc` — 3 cubes + 18 prisms + 6 corner
  blocks. Both boxes here are cut at a = 6, b = 4 and a = 5, b = 3, c = 2,
  so each box is exactly 10 cm on a side: **1000 cm³ — the very volume of
  the pink tower's largest cube.**
- **The history tab.** From Chiaravalle 1870 to the 1915 San Francisco
  glass classroom, three Nobel Peace Prize nominations, and the famous
  former Montessori children.

## How to run

No build step, no dependencies:

```bash
open index.html                       # or
python3 -m http.server 8765           # then visit the folder
```

Run the exact-formula tests with:

```bash
node --test test_materials.mjs        # 10 tests, all exact (BigInt-checked)
```

## Controls

- Pick a **preset** (儿童之家 1907 · 连环四换 · 静态加法 · 第一课 8+7 · 粉红塔),
  or type your own two addends (0..9999).
- **摆盘** lays both quantities as physical bead material on the work mat,
  **合并** slides tray B onto tray A, **去银行** performs every exchange —
  the total value never moves.
- Tabs: **粉红塔** (Σn³ = 55² with the gnomon proof plate), **(a+b)³ 的木盒**
  (binomial/trinomial cube with an explode slider), **银行账本** (the
  vertical addition with every carry annotated), **1870 → 今天** (timeline).

The bench is a pure function of the simulation clock
(`window.__demo.step(dt)`), which is how the video renderer drives it.
