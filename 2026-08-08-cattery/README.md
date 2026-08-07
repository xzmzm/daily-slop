# cattery

Built by GLM-5.2

**中文视频（Fish Audio 哈基米）：** [cattery-zh-fish.mp4](./video/cattery-zh-fish.mp4) · [字幕文件](./video/cattery-zh-fish.srt)

本机 TTS 备份版：[cattery-zh.mp4](./video/cattery-zh.mp4)

A **Mendelian cat-coat genetics sandbox** for International Cat Day (August 8).
Pick a mother and a father, mate them, and each kitten's coat is **rendered
procedurally from its genotype** — every patch, stripe, dilution and white
sock drawn straight off the genes it inherited. The Punnett square for the
orange locus and the expected-vs-actual phenotype ratios update live with
every cross.

The headline: **orange pigment is X-linked**, so a tortoiseshell cat (one
orange X, one black X) needs *two* X chromosomes — which is why torties are
almost always female. You can watch it fall out of the cross.

## What you can do

- **Breed cats** — choose a mother and father from ten hand-written presets
  (a tortoiseshell, a calico, a blue, a dominant-white, a chocolate, …) and
  generate a litter of any size.
- **Read each kitten** — every coat is drawn from its genes: eumelanin base
  (black / chocolate), dilution (black→blue, chocolate→lilac, orange→cream),
  tabby banding (agouti), tortoiseshell mosaicking, calico (tortie + white),
  bicolor white spotting, dominant-white epistasis, and longhair.
- **Compare expected vs. actual** — the analytic Mendelian ratios for the
  cross sit beside a live marker showing what *this* litter actually produced,
  so you can see sampling variance against the theory.
- **Read the orange Punnett square** — the classic 2×2 with the X-linked
  twist: daughters in one row (father's X), sons in the other (father's Y),
  and a plain-English explanation of why no cell produces a tortoiseshell male.
- **Press Space to re-mate** for a fresh litter from the same parents.

## How to run

No build step, no dependencies:

```
python3 -m http.server 8765
```

then open <http://localhost:8765/2026-08-08-cattery/>.

(Any free port works — just avoid 8000, which is reserved on this machine.)

## The seven loci

| Locus | Name | Inheritance | Effect |
| --- | --- | --- | --- |
| **O** | Orange | **X-linked** | O makes orange pigment replace black. Source of the tortoiseshell pattern. |
| **B** | Brown | autosomal | B = black eumelanin; b = chocolate. |
| **A** | Agouti | autosomal | A = tabby banding shows; aa = solid. |
| **D** | Dilute | recessive | dd fades pigment: black→blue, chocolate→lilac, orange→cream. |
| **S** | White spotting | **incomplete dom.** | Ss = bicolor; SS = high white. The heterozygote is intermediate. |
| **W** | Dominant white | **epistatic** | W_ masks all pigment — a fully white cat. |
| **L** | Hair length | recessive | ll = longhair. A simple recessive, like Mendel's peas. |

## Verification

The genetics engine is asserted in Node against hand-computed Mendelian
expectations — autosomal Punnett squares, X-linked orange crosses, the
tortie-is-female result over 4000 kittens, dominant-white epistasis ratios,
dilution, and probability distributions that sum to exactly 1. Run it with:

```
node test_engine.js
```
