/* Pure minimum-raggedness line breaker. Also loaded by the Node tests. */
(function (root) {
  function layout(widths, space, limit, optimal = false) {
    const n = widths.length;
    if (!n) return {lines: [], score: 0};
    const prefix = [0];
    widths.forEach(w => prefix.push(prefix[prefix.length - 1] + w));
    const length = (i, j) => prefix[j] - prefix[i] + space * (j - i - 1);
    const cost = (i, j) => j === n ? 0 : Math.pow(limit - length(i, j), 2);
    const next = Array(n);
    if (optimal) {
      const best = Array(n + 1).fill(Infinity); best[n] = 0;
      for (let i = n - 1; i >= 0; i--) {
        for (let j = i + 1; j <= n; j++) {
          if (j > i + 1 && length(i, j) > limit) break;
          const candidate = cost(i, j) + best[j];
          if (candidate < best[i]) {best[i] = candidate; next[i] = j;}
        }
      }
    } else {
      for (let i = 0; i < n;) {
        let j = i + 1;
        while (j < n && length(i, j + 1) <= limit) j++;
        next[i] = j; i = j;
      }
    }
    const lines = []; let score = 0;
    for (let i = 0; i < n;) {
      const j = next[i]; lines.push({start: i, end: j, width: length(i, j)});
      score += cost(i, j); i = j;
    }
    return {lines, score};
  }
  root.LineBreak = {layout};
  if (typeof module !== 'undefined') module.exports = {layout};
})(globalThis);
