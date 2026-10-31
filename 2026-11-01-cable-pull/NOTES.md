# Cable Pull — notes

## Why this project?

The Mackinac Bridge opened to traffic on November 1, 1957, joining Michigan's Upper and Lower Peninsulas across the Straits of Mackinac. Its main span is 3,800 feet between towers; the entire crossing is about five miles including approaches. The [Mackinac Bridge Authority's facts and figures](https://www.mackinacbridge.org/history/facts-figures/) gives both the opening date and span. The [American Society of Civil Engineers](https://www.asce.org/about-civil-engineering/history-and-heritage/historic-landmarks/mackinac-bridge) describes the bridge's aerodynamic features and distinguishes main span from total length.

The gallery has explored other engineering ideas, but not the tradeoff in the shape of a suspension cable. A deceptively flat cable makes a nice question: if the road weighs the same, why should the cable have to pull harder?

## How it works

The experiment keeps the main span fixed at 3,800 feet, or 1,158.24 metres. It treats one cable as weightless and flexible, supported at equal heights, with a vertical load `w` distributed uniformly per metre of *horizontal span*. Under these assumptions the cable is a parabola. At its lowest point the cable is horizontal. Taking moments of the load on half the span about a tower gives the horizontal component of tension `H = wL² / (8f)`, where `L` is span and `f` is dip. `w` is entered in kN/m; dividing by 1,000 converts the result from kN to MN. The horizontal component is constant along the ideal cable. The total tension at a tower is larger because it also has a vertical component; the readout intentionally shows only the horizontal component.

The drawing samples the parabola at 81 points and hangs 23 vertical lines from it to a fixed road. The 200 m comparison uses the *current* load, so the ratio is always `200 / f`. Doubling dip from 100 m to 200 m halves horizontal pull. Raising the load doubles the pull when its value doubles. The bridge illustration is schematic: its vertical scale is exaggerated for readability and the side cables are decorative, not included in the calculation.

## Interesting notes

- The 100 m and 200 m dips and the 20–100 kN/m load range were chosen for the demonstration. They are not measurements or design loads for the Mackinac Bridge.
- A freely hanging cable under its own weight makes a catenary, not exactly this parabola. The parabolic result assumes the deck's load is uniform per horizontal metre and neglects cable weight.
- The historical bridge has two main cables, side spans, stiffening trusses, aerodynamic details and many other considerations. A single-span force diagram cannot establish whether any real bridge is safe.
- It is the horizontal component that halves as the dip doubles. The resultant cable tension at the tower also includes the vertical reaction, so it does not generally halve.
