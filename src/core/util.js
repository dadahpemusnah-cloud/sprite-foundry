  // src/core/util.js
  var PAD = 2;
  var D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  var even = (n) => 2 * Math.round(n / 2);

