  // src/core/rng.js
  function seedRng(str) {
    let h = 2166136261 >>> 0;
    for (const ch of String(str)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    const r = () => {
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.range = (lo, hi) => lo + r() * (hi - lo);
    return r;
  }

