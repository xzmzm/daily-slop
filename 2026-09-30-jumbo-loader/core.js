/* Weight & balance for a simplified 747 freighter. Pure stateless math. */
(function (root) {
  'use strict';

  const OEW = 354000;            // operating empty weight, lb (rounded)
  const OEW_CG = 24.0;           // %MAC of the empty aeroplane
  const MZFW = 526000;           // maximum zero-fuel weight, lb (rounded)
  const LEMAC = 1325.6;          // leading edge of mean aero chord, body inches
  const MAC = 327.8;             // chord length, inches
  const FWD_LOW = 16.0, FWD_RISE = 6.0;   // forward limit: 16 %MAC light -> 22 at MZFW
  const AFT_LOW = 30.0, AFT_DROP = 1.0;   // aft limit: 30 %MAC light -> 29 at MZFW

  // Station arms in body inches: main deck is the upper lobe, belly the lower.
  const MAIN_STATIONS = [620, 760, 900, 1040, 1180, 1320, 1460, 1600, 1740];
  const LOWER_STATIONS = [690, 830, 970, 1110, 1250, 1390, 1530];
  const SLOTS = [
    ...MAIN_STATIONS.map((station, i) => ({id: `m${i}`, deck: 'main', station})),
    ...LOWER_STATIONS.map((station, i) => ({id: `l${i}`, deck: 'lower', station})),
  ];

  const TYPES = {
    machinery: {name: 'Machinery crate', weight: 18000, color: '#7fa8d8'},
    pallet:    {name: 'General pallet',  weight: 8500,  color: '#c9a06a'},
    mail:      {name: 'Mail containers', weight: 4200,  color: '#e0b64f'},
    engine:    {name: 'Spare turbofan',  weight: 9800,  color: '#e07a54'},
    gold:      {name: 'Bullion pallet',  weight: 9500,  color: '#ffd75e'},
    flowers:   {name: 'Flower load',     weight: 2200,  color: '#8fc47a'},
  };

  // Every item must fly. The puzzle is placement, never rejection.
  const MISSIONS = [
    {
      name: 'Rollout rehearsal', brief: 'September 1968, Everett. A demonstration load for the flight-test programme: two machinery crates, three general pallets, one mail run.',
      cargo: ['machinery', 'machinery', 'pallet', 'pallet', 'pallet', 'mail'],
    },
    {
      name: 'Spare-engine ferry', brief: 'A customer\u2019s engine needs delivering and the deck is already heavy. Four machinery crates, the turbofan, and two mail runs.',
      cargo: ['engine', 'machinery', 'machinery', 'machinery', 'machinery', 'mail', 'mail'],
    },
    {
      name: 'Gold run', brief: 'Bullion is small and absurdly dense \u2014 four pallets of it decide the balance by themselves. Flowers are bulky and nearly weightless.',
      cargo: ['gold', 'gold', 'gold', 'gold', 'flowers', 'flowers', 'flowers', 'mail'],
    },
    {
      name: 'Everett ramp', brief: 'Free play. Build any load from the ramp catalog and watch the dot \u2014 the zero-fuel limit will find you before the CG does.',
      cargo: ['pallet', 'mail', 'flowers'], sandbox: true,
    },
  ];

  function fwdLimit(weight) {
    const t = Math.min(1, Math.max(0, (weight - OEW) / (MZFW - OEW)));
    return FWD_LOW + FWD_RISE * t;
  }
  function aftLimit(weight) {
    const t = Math.min(1, Math.max(0, (weight - OEW) / (MZFW - OEW)));
    return AFT_LOW - AFT_DROP * t;
  }
  // items: array of {type, slot} with slot a slot id or null; only placed items count.
  function compute(items) {
    const placed = items.filter(item => item.slot);
    const arms = placed.map(item => SLOTS.find(s => s.id === item.slot).station);
    const weights = placed.map(item => TYPES[item.type].weight);
    const weight = OEW + weights.reduce((a, b) => a + b, 0);
    const emptyArm = LEMAC + OEW_CG / 100 * MAC;
    const moment = OEW * emptyArm + weights.reduce((a, w, i) => a + w * arms[i], 0);
    const cg = (moment / weight - LEMAC) / MAC * 100;
    return {weight, cg, payload: weight - OEW, placed: placed.length, total: items.length};
  }
  function verdict(items) {
    const {weight, cg} = compute(items);
    if (items.length === 0) return {ok: false, kind: 'incomplete', weight, cg,
      fwd: fwdLimit(weight), aft: aftLimit(weight), message: 'The ramp is empty — add cargo from the catalog.'};
    if (weight > MZFW + 1e-9) return {ok: false, kind: 'weight', weight, cg,
      message: `Over maximum zero-fuel weight by ${(weight - MZFW).toLocaleString()} lb — leave cargo on the ramp.`};
    const fwd = fwdLimit(weight), aft = aftLimit(weight);
    if (cg < fwd) return {ok: false, kind: 'nose', weight, cg, fwd, aft,
      message: `Nose-heavy: ${cg.toFixed(1)} %MAC is forward of the ${fwd.toFixed(1)} limit. The nosewheel would squat.`};
    if (cg > aft) return {ok: false, kind: 'tail', weight, cg, fwd, aft,
      message: `Tail-heavy: ${cg.toFixed(1)} %MAC is aft of the ${aft.toFixed(1)} limit. She\u2019d sit on her tail.`};
    const unplaced = items.length - items.filter(item => item.slot).length;
    if (unplaced > 0) return {ok: false, kind: 'incomplete', weight, cg, fwd, aft, unplaced,
      message: unplaced === 1 ? 'One item still on the ramp.' : `${unplaced} items still on the ramp.`};
    return {ok: true, kind: 'ok', weight, cg, fwd, aft,
      message: `Dispatch cleared — ${cg.toFixed(1)} %MAC at ${(weight / 1000).toFixed(0)}k lb. Rotate at 148 knots.`};
  }
  // Adding weight at station s pulls the CG toward that station's %MAC.
  function pullMAC(station) {
    return (station - LEMAC) / MAC * 100;
  }

  const api = {OEW, OEW_CG, MZFW, LEMAC, MAC, SLOTS, TYPES, MISSIONS,
               fwdLimit, aftLimit, compute, verdict, pullMAC};
  if (typeof module !== 'undefined') module.exports = api;
  root.LoaderCore = api;
})(typeof self !== 'undefined' ? self : this);
