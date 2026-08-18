# Notes: 1839 Daguerreotype Studio & The Mirror with a Memory

## Why this project?

On **August 19, 1839**, at a joint session of the French Académie des Sciences and Académie des Beaux-Arts in Paris, François Arago presented the secret details of Louis Daguerre's photographic process to a thunderstruck public. The French government had purchased the invention from Daguerre and Niépce's heir for lifetime pensions, declaring photography a grand humanitarian and scientific gift: *"Free to the whole world."* August 19 has since been celebrated globally as **World Photography Day**.

Most modern digital photo filters simulate "vintage sepia tone" or "grain", but a real 1839 Daguerreotype is fundamentally different:
1. It has **no grain** — the image is made of sub-micron crystal amalgam particles bound directly onto polished silver.
2. It has **no negative intermediate** — each plate is a unique, direct-positive physical object.
3. Most magically, it is a **physical optical hologram-like paradox**: depending on the angle you hold it relative to the light, the polished mirror background switches between pitch black and blinding glare, causing the image to flip back and forth between a brilliant positive and a ghostly negative.

This build sets out to simulate the exact physical, optical, and chemical reality of the 1839 process in an interactive, tactile studio.

---

## How it works

### 1. Thin-Film Interference of Silver Iodide (La Sensibilisation)
When a polished silver plate is exposed to gaseous iodine ($I_2$) at room temperature, it grows a nanoscale film of silver iodide ($\text{AgI}$):
$$2\,\text{Ag} + \text{I}_2 \longrightarrow 2\,\text{AgI}$$

The optical thickness $n \cdot d$ (where $n_{\text{AgI}} \approx 2.21$) produces thin-film interference. For normal incidence with a phase shift $\pi$ at the air-$\text{AgI}$ boundary:
$$2\,n\,d = (m + \tfrac{1}{2})\lambda$$

As thickness $d$ grows:
- **0–15 nm**: Bare silver mirror (virtually zero photochemical speed).
- **20–30 nm**: Pale straw yellow (first sensitivity threshold, ~30% speed).
- **35–50 nm**: Golden orange (~60% speed).
- **50–65 nm**: Rose magenta (~85% speed).
- **65–85 nm**: **Steel lavender / blue** (peak sensitivity peak ~100%, discovered empirically by Daguerre & Arago).
- **>85 nm**: Olive green (second-order interference, prone to rapid solarization and speed drop).

### 2. Time-Integrated Exposure & The Boulevard du Temple Paradox
The photon flux reaching the plate through an achromatic doublet of focal ratio $N = f/D$ is:
$$E = \frac{L_{\text{scene}} \cdot t_{\text{exp}} \cdot S_{\text{plate}}}{4\,N^2}$$

For a scene containing moving elements, the apparent intensity at any sensor coordinate $(x,y)$ over a long exposure $T$ is the continuous time integral:
$$I_{\text{apparent}}(x,y) = \frac{1}{T} \int_0^T I_{\text{world}}(x,y,t)\,dt$$

- A horse-drawn omnibus crossing the frame in $t_{\text{stay}} = 8\,\text{s}$ during a $T = 240\,\text{s}$ exposure contributes $\frac{8}{240} \approx 3.3\%$ of the total exposure, effectively vanishing beneath the background cobblestones.
- The famous shoe-shiner and his client on the sidewalk of Boulevard du Temple remained stationary for $t_{\text{stay}} \ge 200\,\text{s}$ ($>80\%$ of $T$), allowing their photolytic silver latent image to build up above the nucleation threshold.

### 3. Latent Image & Mercury Vapor Nucleation (Ag₃Hg₄)
Light absorbed by $\text{AgI}$ crystals liberates free silver atoms via photolysis:
$$\text{AgI} + h\nu \longrightarrow \text{Ag}^0 + \text{I}$$

These $\text{Ag}^0$ speckles form an invisible *latent image*. In the heated fuming box at $65^\circ\text{C}$ (149°F), mercury vapors rise and condense selectively onto the metallic silver clusters, precipitating microscopic crystals of **silver-mercury amalgam ($\text{Ag}_3\text{Hg}_4$)**:
$$3\,\text{Ag}^0 + 4\,\text{Hg}_{(\text{g})} \longrightarrow \text{Ag}_3\text{Hg}_4$$

- The amalgam microcrystals (0.1 to 2.0 $\mu\text{m}$ across) scatter incident light diffusely with a Lambertian reflectance $R_{\text{diff}} \approx 65\%$.
- Unexposed areas remain flat specular silver mirror ($R_{\text{spec}} \approx 96\%$).
- If heated past $80^\circ\text{C}$ or fumed longer than 2 minutes, excess mercury condenses indiscriminately across the shadows, producing a ruinous chalky grey chemical fog.

### 4. Dual-Reflectance Specular Inversion (The Positive/Negative Flip)
The apparent luminance of a point on the plate viewed at tilt angle $\theta$ under ambient illumination $E_{\text{amb}}$ and environment luminance $L_{\text{env}}(\theta)$ is:
$$L_{\text{pixel}} = (1 - a) \cdot R_{\text{spec}} \cdot L_{\text{env}}(\theta) + a \cdot R_{\text{diff}} \cdot \left(\frac{E_{\text{amb}}}{\pi}\right)$$
where $a \in [0, 1]$ is the local amalgam crystal density.

- **Positive mode ($L_{\text{env}} \approx 0$)**: When tilting the plate toward a dark coat or dark velvet case lining, $L_{\text{env}} \approx 0$. Shadows ($a=0$) reflect nothing ($L \approx 0$, velvety black), while highlights ($a=1$) scatter ambient light ($L \approx R_{\text{diff}} \frac{E_{\text{amb}}}{\pi}$, brilliant white).
- **Negative inversion mode ($L_{\text{env}} \gg E_{\text{amb}}$)**: When tilting the plate to catch the specular reflection of a window or lamp, $L_{\text{env}}$ surges. Shadows ($a=0$) reflect blinding specular glare ($L \approx 0.96 \cdot L_{\text{env}}$), completely overpowering the diffuse scattering of the amalgam ($L \approx 0.65 \cdot \frac{E_{\text{amb}}}{\pi}$), causing the shadows to look brighter than the highlights!

---

## Interesting notes & historical quirks

1. **The British Patent Scandal**: While France declared photography "free to the whole world", Daguerre had secretly sent his agent Miles Berry to London to patent the process in England and Wales just 5 days before Arago's speech (British Patent No. 8194, August 14, 1839). For over a decade, British photographers had to pay exorbitant licensing fees to Daguerre until the patent lapsed, which ironically spurred William Henry Fox Talbot and Frederick Scott Archer to invent competing paper (Calotype) and glass (Collodion) alternatives!
2. **The Appui-Tête (Iron Neck-Clamp)**: In 1839, portrait exposures took between 2 and 7 minutes under bright skylights. Sitters sat in heavy iron clamps gripping the base of their skull to prevent breathing and postural sway from ruining the plate with ghostly double contours.
3. **Fizeau's 1840 Gold Toning Breakthrough**: Early daguerreotypes were extremely fragile (the mercury amalgam could be wiped off with a feather) and had low shadow contrast. In 1840, Hippolyte Fizeau introduced gold chloride ($\text{AuCl}_3$) toning: boiling the plate in gold-hypo solution replaced surface silver with metallic gold, doubling the contrast and permanently sealing the image against atmospheric sulfur.
4. **Why Digital Displays Miss the Magic**: On a standard RGB monitor, an image is either a positive or a negative bitmap. By computing real-time angular reflectance vectors across the 3D plate normal, this app reproduces the authentic 19th-century tactile experience of tilting a daguerreotype in your hands.
