# NOTES — chiral-lab

## Why this project

Today is **August 13 — International Left-Handers Day** (since 1992; ~10 % of
people are left-handed). "Handedness" is the everyday word for **chirality**: an
object is chiral if it cannot be superimposed on its mirror image. Your left and
right hands are the textbook example, and once you see it you see chirality
everywhere — helices, propellers, molecules, snail shells, amino acids. None of
the prior 20 daily builds touched symmetry, group theory, or parity, so this was
a clean lane.

The one-sentence version of the whole app: **a left hand is a right hand seen
through a mirror, and never the other way around.** The job was to make *why*
that's true tangible, in a way you can drag.

## How it works

### The proof (one line, and it really is enough)

A reflection is a linear map with **determinant −1** (it flips orientation).
Every rotation has **determinant +1**. The composition "reflect, then rotate"
therefore has determinant (−1)·(+1) = **−1**, which can never equal the identity
(det +1). So **no sequence of rotations can ever undo a reflection.** If the
only thing separating an object from its mirror is a reflection — i.e. the
object is chiral — then no amount of turning will superimpose them. That is the
whole of handedness, and the engine asserts it directly: `det(reflect·rotate) = −1`
for every sampled rotation, and `reflect·rotate` is never the identity.

The app shows the determinants live and, more viscerally, shows you *failing* to
superimpose the mirror by dragging it.

### How "the closest a turn can get" is computed — Kabsch

For two point clouds P (the original) and Q (the mirror image), the best rigid
alignment of Q onto P is the **Kabsch** problem. Centre both, form the 3×3
covariance

```
H = Σ_k  q_k · p_kᵀ
```

take its SVD `H = U Σ Vᵀ`, and the optimal orthogonal map is `R = V Uᵀ`. That
`R` might be a *reflection* (det −1) — the best possible map if you allow one.
To force a **proper rotation** (det +1, the only thing wrists can do), insert a
sign correction:

```
d = sign(det(V Uᵀ)),     R_proper = V · diag(1, 1, d) · Uᵀ
```

The SVD itself comes from a **Jacobi eigendecomposition** of the 3×3 symmetric
`HᵀH` (right singular vectors are its eigenvectors; singular values are √eigenvalues;
left singular vectors are `U = H V Σ⁻¹`). For 3×3 that's a handful of Jacobi
sweeps — bulletproof and dependency-free.

The two RMSDs that fall out are the whole demo:

- **`rmsdRaw`** (unrestricted map, det ±1): for a mirror pair this is **≈ 0** —
  a reflection always finishes the job.
- **`rmsd`** (proper rotation, det +1): the **rotation floor**. ≈ 0 for an
  achiral object, bounded away from 0 for a chiral one.

The **gap** between them is the chirality. The meter plots your current RMSD
against the floor; toggle *allow one reflection* and the cyan enantiomer snaps
onto the violet original (the improper map), collapsing the gap to 0.

## Interesting notes (the honest part)

### The regular tetrahedron is achiral — first false positive

My first `tetrahedralMolecule()` put four *identical* arms at the tetrahedron's
vertices. That's a regular tetrahedron, and a regular tetrahedron **is achiral**
(it has mirror symmetries: a plane through one edge and the midpoint of the
opposite edge reflects it onto itself). The test flagged it achiral, which would
have been an embarrassing bug for the canonical chiral example. A tetrahedral
carbon is only a stereocentre when its **four substituents differ** — so the arms
now have distinct lengths (1.7 / 1.3 / 1.05 / 0.75) and distinct terminal blobs.
With four different groups the mirror genuinely won't superimpose. This is
exactly the rule from organic chemistry, and the engine enforces it by geometry.

### The cube trap — why the achiral control is a flat F, not a cube

A cube is obviously achiral as an *object*. But Kabsch works on **index-paired**
points (a fixed correspondence), and reflecting a cube permutes its vertices in a
way no proper rotation reproduces under that fixed labelling — so a labelled cube
tests "chiral" even though an unlabelled cube is achiral. Rather than fight the
labelling, I made the achiral control a **flat letter F**: every shape lying in
the z = 0 plane is automatically achiral in 3D, because
`R_y(π) · Ref_yz` acts as the identity on z = 0 (the flip about the y-axis undoes
the x-mirror exactly for planar points). That same F then delivers the best
teaching moment in the app…

### Chirality depends on how much room you have to move (2D vs 3D)

A flat F is **chiral in 2D** — no in-plane turn aligns its mirror (the engine's
exact 2D Procrustes, θ\* = atan2(Σ qx·py − qy·px, Σ qx·px + qy·py), bottoms out
above zero). But it is **achiral in 3D** — flip it over about an in-plane axis
and it lands perfectly on the original. Toggle *2D mode* and the rotation floor
jumps from ≈ 0 to a big positive number. Chirality isn't just a property of the
object; it's a property of the object *plus the motions you're allowed*.

### The helix test I got backwards

My first helix test asserted "mirror(right helix) cannot be aligned to a left
helix by rotation." That's wrong: mirroring a right-handed helix yields *another
left-handed* helix — same twist sense as the generated left one — so a proper
rotation **does** align them (rmsd ≈ 0). The genuinely unalignable pair is
mirror(right) vs **right** itself (opposite handedness). Fixed; it's now a nicer
demonstration: same-handedness helices align by turning, opposite-handedness ones
never do.

### Why a hand is chiral but a paper hand isn't

The `hand()` generator puts the thumb on the **+z face only** — a one-sided
protrusion. That front/back asymmetry is the entire source of the hand's
chirality. (The flat letter F, by contrast, has no z-extent, so it's achiral in
3D — you can flip it.) A paper cutout of a hand you can flip over; a real hand,
with a palm and a back, you cannot. That's the day's whole point in one object.

## Things left out of scope

- **Group-theoretic symmetry detection** (finding the actual symmetry group of a
  point cloud) — overkill when "does the best proper rotation hit zero?" answers
  the chirality question directly.
- **Permutation-invariant chirality** (the cube's true achirality) — would need
  Hungarian-algorithm point matching; the flat-F family sidesteps it cleanly.
- A real ball-and-stick chemistry renderer — the tetrahedral centre is rendered
  as a point cloud, which is enough to see the four different arms and their
  mirror.
- CP violation / why the universe prefers one handedness — mentioned in the
  census card (homochirality of amino acids, thalidomide) but not modelled.
  That's a story for another day.
