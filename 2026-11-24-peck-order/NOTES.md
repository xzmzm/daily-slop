# Peck Order build notes

## Why this project?

*On the Origin of Species* was published on 24 November 1859, in a first printing of 1,250 copies. The date also offered Glidden's barbed wire patent (1874) and the Lucy fossil (1974). Darwin won because natural selection is something you can do to a population with a mouse, and 123 earlier projects had never touched it. [Smithsonian Libraries](https://blog.library.si.edu/blog/2009/11/24/darwins-on-the-origin-of-species-was-published-today-in-1859)

The peppered moth supplied the scene. Manchester's black form was first recorded in 1848 and made up 98% of the city's peppered moths by 1895. Michael Majerus's six-year release study, published after his death, later confirmed that birds eat the conspicuous form more often. [Christ's College Darwin200](https://darwin200.christs.cam.ac.uk/melanism-moths), [Cook et al. 2012](https://research.manchester.ac.uk/en/publications/selective-bird-predation-on-the-peppered-moth-the-last-experiment/)

## How it works

Each moth is one number, its shade from 0 (dark) to 1 (pale). The bark uses the same scale and color ramp, so a moth whose shade equals the bark's is drawn in the bark's base color.

A generation has two steps:

1. **Selection.** Half the flock is eaten, either by your clicks or by a stand-in bird. The stand-in picks without replacement, with weight `0.004 + contrast²`, where contrast is the distance between moth and bark. The random bird gives every moth weight 1.
2. **Inheritance.** Each of the 40 children takes the average of two random survivors, plus Gaussian noise with a standard deviation of 0.11.

Nothing in the code tells moths to move toward the bark. The only reference to the bark's shade is in the bird's choice of meal.

## Interesting notes

My first version used an inheritance noise of 0.045. It adapted neatly to the first bark, then got stuck: ten generations after the switch to soot, the flock averaged 0.61 against a bark of 0.14. Averaging two parents halves the genetic variance each generation, so a well-adapted flock had almost no dark moths left to select. This is the objection Fleeming Jenkin raised against Darwin in 1867, and Mendelian genes answer it because particulate inheritance doesn't blend variation away. I reproduced the objection by accident.

The fix here is a cheat in Mendel's direction: raising the noise to 0.11 keeps enough variation alive. Across 300 seeds, the average gap to the soot bark 20 generations after the flip fell from 0.46 to 0.02. `sim.test.js` now guards that recovery.

The real moth differs in an important way. Its dark form comes mainly from a single dominant allele, so real populations shift between discrete forms instead of sliding along a gray scale. The page footer says so.

The first moths looked like peanuts, because each side was one rounded blob. Splitting them into a forewing and hindwing fixed the silhouette.
