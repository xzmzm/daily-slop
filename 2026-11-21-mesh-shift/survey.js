'use strict';

const survey = (() => {
  const count = 72;
  const bands = [10, 20, 30, 40, 50];

  function createSchool() {
    let seed = 109;
    function next() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    return Array.from({ length: count }, () => {
      const length = Math.round(12 + 44 * (next() + next()) / 2);
      return { length, roll: next(), offsetX: next(), offsetY: next() };
    });
  }

  function summarize(school, mesh) {
    const fish = school.map(member => {
      const probability = 1 / (1 + Math.exp((mesh * 5 - member.length) / 4));
      return { ...member, retained: member.roll < probability };
    });
    const bins = bands.map(min => ({ min, school: 0, sample: 0 }));
    let retained = 0;
    let totalLength = 0;
    for (const member of fish) {
      const bin = bins[Math.floor(member.length / 10) - 1];
      bin.school++;
      if (member.retained) {
        bin.sample++;
        retained++;
        totalLength += member.length;
      }
    }
    return { fish, bins, retained, mean: retained ? totalLength / retained : null };
  }

  return { createSchool, summarize };
})();
