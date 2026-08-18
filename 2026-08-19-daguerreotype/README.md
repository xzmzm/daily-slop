# daguerreotype

An 1839 Daguerreotype darkroom and optical physics studio for World Photography Day (19 August 1839): the day François Arago announced Louis Daguerre's process at the Institut de France and the French State released photography as a "gift free to the entire world".

Built by Gemini 3.7 Flash

## What it is

A daguerreotype is not a paper photo or modern digital image — it is a physical silver mirror with mercury amalgam highlights, famously described by Oliver Wendell Holmes in 1859 as *"a mirror with a memory"*.

This studio puts you at the 1839 Parisian darkroom bench and sliding-box camera:
1. **Polish the Plate (*Le Polissage*)**: Buff a silver-clad copper plate with jeweller's rouge in strict parallel strokes to bring surface roughness $R_a$ below $0.02\,\mu\text{m}$.
2. **Sensitize over Iodine (*La Sensibilisation*)**: Fume over iodine crystals to grow a nanoscale film of silver iodide ($\text{AgI}$). Watch thin-film interference shift the plate from straw yellow through rose magenta to the historical target — **steel lavender / blue (~72 nm)**, peak photochemical sensitivity.
3. **Camera Obscura Exposure (*La Pose*)**: Mount the plate in the Giroux camera with a Chevalier achromatic doublet lens. Experience three historical scenes:
   - *Boulevard du Temple (1838)*: Continuous exposure integration ($I_{\text{eff}} = \frac{1}{T}\int I(t)dt$) causes 8-second horse carriages and walking pedestrians to vanish into thin air, leaving only the stationary shoe-shiner and his customer.
   - *The Studio Portrait*: Toggle the iron neck-clamp (*Appui-Tête*); without it, involuntary postural drift and breathing create authentic double-contour motion blur.
   - *Notre-Dame Cathedral & Seine*: Test high-contrast solarization where direct overexposed sun turns metallic blue-grey inversion.
4. **Mercury Vapor Development (*Le Développement au Mercure*)**: Heat mercury to 65°C over a spirit lamp. Watch through the amber darkroom window as rising mercury atoms nucleate into microscopic crystals of silver-mercury amalgam ($\text{Ag}_3\text{Hg}_4$) on photolytic silver nuclei.
5. **Fix & Gold Tone (*Fixage et Virage à l'Or*)**: Dissolve yellow silver iodide in sodium thiosulfate (hypo) and apply Fizeau's 1840 gold chloride gilding.
6. **The "Mirror with a Memory" 3D Tilt Inspector**: Drag to tilt the cased daguerreotype under ambient room light. When tilted toward dark velvet, the specular mirror appears pitch black and the amalgam glows — **a vivid Positive**. When tilted to catch light glare, the mirror reflects brilliant specular white, overpowering the amalgam and **inverting the image into a ghostly Negative**. Inspect microscopic crystal structures with the 10x watchmaker's loupe.

## How to run

No build step, zero dependencies:

```bash
open index.html
```

or serve the workspace root:

```bash
python3 -m http.server 8765    # visit http://localhost:8765/2026-08-19-daguerreotype/
```

Run the deterministic simulation engine tests with Node:

```bash
node test_engine.js            # 16 test suites, all passing
```

## Notes

All photochemical equations, thin-film interference colors, optical exposure fluxes ($E \propto \frac{L \cdot t}{4 N^2}$), and specular/diffuse reflectance curves are modeled directly from 1839 primary sources and optical physics. Detailed historical and mathematical derivations are in [`NOTES.md`](./NOTES.md).
