/* A single idealised pound lock. Lengths in metres, time in illustrative seconds. */
(function (root) {
  'use strict';
  const LIFT = 2.4;
  const AREA = 120; // An illustrative 30 m × 4 m chamber, not an 1825 survey.
  const RATE = 2 * Math.sqrt(LIFT) / 7;
  const EPS = 1e-8;

  class Lock {
    constructor(direction = 'up') { this.reset(direction); }
    reset(direction = this.direction) {
      this.direction = direction === 'down' ? 'down' : 'up';
      this.level = this.direction === 'up' ? LIFT : 0;
      this.boat = this.direction === 'up' ? 'lower' : 'upper';
      this.gates = { lower: false, upper: false };
      this.sluices = { lower: false, upper: false };
      this.moving = null;
      this.admitted = 0;
      this.released = 0;
      this.moves = 0;
    }
    get source() { return this.direction === 'up' ? 'lower' : 'upper'; }
    get destination() { return this.direction === 'up' ? 'upper' : 'lower'; }
    get complete() { return this.boat === this.destination && !this.moving; }
    height(side) { return side === 'upper' ? LIFT : 0; }
    gap(side) { return Math.abs(this.level - this.height(side)); }
    toggleGate(side) {
      if (!Object.hasOwn(this.gates, side)) return this.no('Unknown gate.');
      if (this.moving) return this.no('Let the boat finish crossing before moving a gate.');
      if (!this.gates[side]) {
        if (this.gap(side) > EPS) return this.no(`${this.gap(side).toFixed(2)} m of unequal water holds this gate shut. Match the levels with a sluice first.`);
        if (this.sluices.lower || this.sluices.upper) return this.no('Close the sluices before opening a gate.');
        if (this.gates[side === 'lower' ? 'upper' : 'lower']) return this.no('Close the other gate first.');
      }
      this.gates[side] = !this.gates[side];
      this.moves++;
      return { ok: true };
    }
    toggleSluice(side) {
      if (!Object.hasOwn(this.sluices, side)) return this.no('Unknown sluice.');
      if (!this.sluices[side]) {
        if (this.moving) return this.no('Wait for the boat to stop before changing the water.');
        if (this.gates.lower || this.gates.upper) return this.no('Close both gates before changing the water level.');
        if (this.sluices[side === 'lower' ? 'upper' : 'lower']) return this.no('Close the other sluice first. Otherwise water would run straight through.');
      }
      this.sluices[side] = !this.sluices[side];
      this.moves++;
      return { ok: true };
    }
    moveBoat() {
      if (this.moving) return this.no('The boat is still moving.');
      if (this.complete) return this.no('Passage complete. Try the other direction.');
      const side = this.boat === 'chamber' ? this.destination : this.source;
      if (!this.gates[side]) return this.no(`Open the ${side} gate before moving the boat.`);
      if (this.gap(side) > EPS || this.sluices.lower || this.sluices.upper) return this.no('Match the levels and close the sluices before moving.');
      this.moving = { from: this.boat, to: this.boat === 'chamber' ? this.destination : 'chamber', elapsed: 0, duration: 2.4 };
      this.moves++;
      return { ok: true };
    }
    tick(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (this.moving) {
        this.moving.elapsed = Math.min(this.moving.duration, this.moving.elapsed + dt);
        if (this.moving.elapsed >= this.moving.duration) {
          this.boat = this.moving.to;
          this.moving = null;
        }
      }
      const before = this.level;
      // Exact step for dh/dt = ±RATE√(head): √head falls linearly.
      // This reaches equal levels without overshoot, even after a long frame.
      if (this.sluices.upper) this.level = LIFT - Math.max(0, Math.sqrt(LIFT - before) - RATE * dt / 2) ** 2;
      if (this.sluices.lower) this.level = Math.max(0, Math.sqrt(before) - RATE * dt / 2) ** 2;
      if (this.level < EPS) this.level = 0;
      if (LIFT - this.level < EPS) this.level = LIFT;
      this.admitted += AREA * Math.max(0, this.level - before);
      this.released += AREA * Math.max(0, before - this.level);
    }
    no(reason) { return { ok: false, reason }; }
    guidance() {
      if (this.moving) return { step: this.boat === 'chamber' ? 4 : 2, title: 'Easy does it.', text: 'The boat crosses on level water. Keep the gates still.', target: null };
      if (this.complete) return { step: 5, title: 'Passage complete.', text: `${LIFT.toFixed(1)} metres ${this.direction === 'up' ? 'up' : 'down'}. The water did the lifting. Try the other direction.`, target: null };
      const inside = this.boat === 'chamber';
      const side = inside ? this.destination : this.source;
      const opposite = side === 'lower' ? 'upper' : 'lower';
      const step = inside ? 3 : 1;
      if (inside && this.gates[this.source]) return { step, title: 'Close the gate behind you.', text: 'Seal the chamber before changing its water level.', target: `gate-${this.source}` };
      if (this.gap(side) > EPS) {
        if (this.sluices[opposite]) return { step, title: `Close the ${opposite} sluice.`, text: 'Only one water route should be open at a time.', target: `sluice-${opposite}` };
        if (this.sluices[side]) return { step, title: side === 'upper' ? 'Gravity is filling the chamber.' : 'Gravity is draining the chamber.', text: 'Watch the boat and the waterline. Flow slows as the levels meet.', target: null };
        return { step, title: `Open the ${side} sluice.`, text: side === 'upper' ? 'Let water in from the higher reach.' : 'Let water out into the lower reach.', target: `sluice-${side}` };
      }
      if (this.sluices.lower || this.sluices.upper) {
        const open = this.sluices.lower ? 'lower' : 'upper';
        return { step, title: `Levels matched. Close the ${open} sluice.`, text: 'The water has stopped flowing. Shut the small opening before opening the gate.', target: `sluice-${open}` };
      }
      if (!this.gates[side]) return { step: inside ? 4 : 2, title: `Open the ${side} gate.`, text: 'Equal water levels mean no net water pressure across the gate.', target: `gate-${side}` };
      return { step: inside ? 4 : 2, title: inside ? 'Take the boat out.' : 'Bring the boat inside.', text: inside ? 'The next reach is at the same level as the chamber.' : 'The gate is open and the water is level.', target: 'move' };
    }
  }
  root.LockModel = { Lock, LIFT, AREA, RATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LockModel;
})(typeof window === 'undefined' ? globalThis : window);
