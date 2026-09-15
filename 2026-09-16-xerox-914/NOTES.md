# NOTES — The Scorch Machine (Xerox 914)

## Why this project?

16 September 1959 is the day Haloid-Xerox showed the Model 914 to the press at the
Sherry-Netherland Hotel in New York, on live television — and one of the two demo machines
caught fire. That conjunction (the machine that invented the office as we know it, literally
burning during its debut) beat the other candidates for the day: GM's founding (1908), the
Mayflower (1620), and Jobs's iCEO appointment (1997 — and yesterday's project was already a
1997 story). The recent streak had been hardware anniversaries — RAMAC, Kilby's chip, Luna 2 —
and a copier studio fits that lineage while being a genuinely new concept for this workspace:
nothing earlier touched electrophotography, and the closest neighbour (2026-08-19
daguerreotype) is photochemistry, a completely different mechanism.

The hook that made it irresistible: the fires are not a footnote, they are the physics.
Heavy-coverage originals (pages of zeros and O's) worked the fuser hardest, and Xerox shipped
a little extinguisher with each machine — informally the "scorch eliminator."

## How it works

Everything on screen comes from closed-form electrophotography, in `engine.js`:

**Corona charging.** A thin wire at kilovolts breaks down the air when its surface field
passes Peek's law, E₀ = 30(1 + 0.301/√r) kV/cm. For an 80 µm wire 8 mm from the drum that is
about 5.55 kV — the machine runs 6.5 kV. The wire-plane field is the coaxial result,
E = V/(r·ln 2h/r); thin wires concentrate the field, which is the whole trick.

**The photoconductor.** The vacuum-deposited amorphous selenium layer is a parallel-plate
capacitor: 45 µm gives 124 pF/cm² and σ = 1.12 mC/m² at +900 V. Dark decay is Maxwell
relaxation, τ = ρε ≈ 56 s at 10¹⁴ Ω·cm — the latent image only needs to survive half a
revolution (4.29 s at 7 copies a minute), so selenium clears that bar by a factor of ten.
Photodischarge is photon bookkeeping: one absorbed photon, one electron–hole pair, one unit of
plate charge neutralised, which integrates to **312.3 V per erg/cm² of 480 nm light at η = 1**
(0.6 eV... precisely: ΔV = (e·η·λ/hc)·(d/ε)·fluence). The discharge runs linearly down to a
trapping residual Vr. Past the ~610 nm band edge the modelled quantum efficiency is zero —
selenium is blind to red, which is why xerographic darkrooms had red safelights.

**Development.** The 914 poured a cascade of glass beads wearing triboelectrically charged
toner over the drum. Toner releases when qE beats image-force adhesion:
E ≥ q/(16πε₀r²) = (q/m)·ρ·r/(12ε₀), linear in radius — which is why toner is ~10 µm (fine
enough to release, coarse enough not to be dust). Deposited mass follows neutralisation
theory, M/A = ε₀E/(q/m): with 712 V of contrast across a 307 µm effective gap
(g + d/εr), that is 2.32 V/µm and 0.51 mg/cm² — about 1.59 statistical monolayers, 80 %
coverage, OD 0.67. The background must sit below the release threshold or the page fogs;
that pins exposure to ≥ 1.42 erg/cm² at the default η and λ.

**The economy.** The 1959 lease ($95/month, 2,000 copies included, ~4¢ after) beats a 35¢
Photostat from 49 copies a month and a 15¢ Verifax from 137. The mimeograph is the honest
counterpoint: it stays cheaper for long runs of one original forever — the 914 won by
skipping the stencil and the 39 manual steps of the Model A, not on pennies.

## Interesting notes — what is documented and what is modelled

Documented anchors (Wikipedia "Xerox 914", "Xerography", "Chester Carlson"; Smithsonian;
The Henry Ford; Office Museum; Owen, *Copies in Seconds*):

- 16 Sep 1959 demo at the Sherry-Netherland, live TV, one machine caught fire; deliveries
  from March 1960; 9×14 in copies, ~650 lb, 7 copies/minute, up to 100,000 copies/month.
- $27,500 purchase (set because the US government buys but never rents); $95/month lease
  with 2,000 copies included then ~4¢; the 1965 metered rental $25 + 10¢/copy; consumables
  ~5¢/copy; ~two-thirds of 1965 revenue (~$243 M) credited to the 914; 95 % of the
  plain-paper market by 1970; production 1960–1977, Smithsonian holds unit #517.
- Fires fed by copy-heavy originals (zeros and O's); the "scorch eliminator"; Ralph Nader's
  office reported three fires in four months.
- Carlson & Kornei, 22 Oct 1938, Astoria: sulfur on zinc, handkerchief charge, "10.-22.-38
  ASTORIA." in India ink, lycopodium, wax paper, heat. 39-step Model A (1949). Kornei
  forfeited 10 % for nothing, later got 100 shares (over $1 M by 1972). Carlson's royalty
  ~1/16 ¢ per copy 1956–65, $150 M+ given away.

Modelled, with textbook values but not factory data: the selenium thickness (45 µm),
εr = 6.3, dark resistivity (10¹⁴ Ω·cm), corona geometry (80 µm wire, 8 mm gap — Wikipedia
gives 6–13 mm), toner q/m (4 µC/g), radius (4 µm), density (1.1 g/cm³), the 1.9 V/µm van der
Waals release floor, development gap (300 µm), solid OD 2, packing 0.55, and transfer
efficiency (80 %). The scorch gauge is an explicitly dramatised knob: honest thermodynamics
says melting the toner on a solid 9×14 copy costs only 70.5 J (8.2 W at 7 cpm) — the real
fires were the fuser nip scorching paper, so the gauge rates dark fraction × developed mass
against a design level and lights up above 40 %.

Two things the tests caught me getting wrong: the corona onset *voltage* grows with wire
radius even though the onset *field* falls (I had the inequality backwards), and starved
exposure should be diagnosed as fog before blankness — the background field releases toner
even when the image field can't, so the regime check had to be reordered.

Dead end worth remembering: the first version modelled photodischarge with no spectral
cutoff, so red light discharged selenium just fine. The 610 nm band edge is now test-guarded.

The memo original on the platen says "Treat her gently. She knows when you are afraid of
her" — a paraphrase of a real service rep's warning quoted in the 914's oral history.
