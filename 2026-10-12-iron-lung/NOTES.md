# Notes: Iron Lung

## Why this project?

On October 12, 1928 the Drinker respirator was first used on a patient, at
Boston Children's Hospital. Most accounts say the patient was an
eight-year-old girl with polio, close to death from respiratory failure, who
was breathing again within a minute of being sealed in. The machine was
built by Philip Drinker and Louis Agassiz Shaw at Harvard from a sheet-iron
box and the blowers of two vacuum cleaners. (Sources disagree on the
patient's identity; one names an adult Harvard student treated at a
different hospital. I kept the child from the most common account and did
not use a name.)

What made it a good one-hour lab is that the mechanism is counter-intuitive
and still small: the machine never pushes air into anybody. It lowers the
pressure around the body and lets the room's air do the rest. That is one
differential equation, and it is enough to show three things that mattered
in polio wards: you need enough pull, fast shallow breaths are a trap, and
the machine is only as reliable as its power supply. The power cut is the
interactive hook: the user becomes the motor.

Other October 12 candidates were Columbus's landfall (navigation, but
September 24 was already dead reckoning in an airship) and the Day of Six
Billion in 1999 (population curves, which felt like a chart rather than a
toy). Nothing earlier in this workspace is about breathing or medicine.

## How it works

**The lung.** One compartment: volume V above resting, compliance C,
resistance R. The mouth is at room pressure, the tank applies Ptank to the
outside of the chest, and the child's own muscles add Pmus:

    dV/dt = (Pmus − Ptank − V/C) / R

With Ptank negative, V rises toward −C·Ptank with time constant R·C. For an
eight-year-old I used C = 15 mL/cmH₂O and R = 20 cmH₂O·s/L, so τ = 0.3 s and
a −12 cmH₂O pull held for 1.2 s fills 98% of 180 mL.

**The tank.** The motor holds a target of −amp for the first 40% of each
cycle and 0 for the rest; the tank pressure follows that target with a
150 ms lag, which rounds the square wave the way a real bellows does. Hand
mode uses the same target, driven by whether the button is held.

**Breaths.** A breath starts when inspiratory flow passes 10 mL/s and ends
when flow turns negative; the volume drawn in is the tidal volume. Anything
under 30 mL is not counted. Each breath delivers max(0, VT − 50 mL) to the
alveoli, into a leaky integrator with a 4 s window, which gives alveolar
ventilation in L/min.

**Blood.** CO₂ relaxes toward 0.863 × 110 mL/min ÷ VA (the alveolar
ventilation equation, capped at 100 mmHg). Alveolar O₂ is
0.21 × (760 − 47) − PaCO₂/0.8, arterial O₂ is that minus 8 mmHg and follows
with a 6 s lag, and saturation comes from the Severinghaus curve. Face and
lip colour blend toward blue-grey as saturation falls below 96%.

## Interesting notes

- **The weak child's own breaths broke the breath counter.** At 10% strength
  the child still makes 12 mL flutters 24 times a minute. With the first
  threshold (8 mL), those flutters were counted between pump breaths, so at
  12 pulls a minute the display showed 23 breaths of 12 mL. Raising the
  threshold to 30 mL fixed it, and it is physically fair: a 12 mL breath
  never gets past the dead space anyway.
- **Healthy wasn't healthy at first.** With 11 cmH₂O of muscle pressure the
  unaided full-strength child sat at a CO₂ of 53, "not enough air".
  13 cmH₂O gives 150 mL at 24 a minute and 41 mmHg.
- **The fast-shallow trap is the best moment.** 40/min at −8 cmH₂O moves
  3.3 L/min, 20/min at −12 moves 3.5 L/min; nearly the same. But
  (82 − 50) × 40 = 1.3 L/min reaches the lungs versus (174 − 50) × 20 =
  2.5. CO₂ goes to 73 on the first and 40 on the second. I put "air moved"
  and "air reaching the lungs" side by side for exactly this.
- **Time is compressed in the blood, not in the breaths.** Body CO₂ stores
  take several minutes to change. Run honestly, the "within a minute"
  recovery would take several minutes. The breaths run in real time; the CO₂ response
  has a 6 s time constant, which the footnote and README say. I started
  at 25 s, then 10 s; both times the video render failed its own checks:
  the child was still blue half a minute after the motor started, and the
  fast-shallow scene's CO₂ never visibly rose before the narration moved on.
  A 4 s ventilation window and a 100 mmHg cap on CO₂ made the recovery fit.
- **Saturation floor.** With no ventilation at all, alveolar O₂ goes to
  zero and the readout said 0%. I floor arterial O₂ at 20 mmHg (about 32%),
  which is grim enough.
- The pressure trace went off the top of the canvas on the first run: I
  had the sign backwards, so "down = below room" drew upward.
- Left out: the neck-collar leak, cuirass and positive-pressure ventilators,
  a timeline of the 1950s epidemics, and the Emerson redesign. The hand
  lever is the only nod to later machines.
