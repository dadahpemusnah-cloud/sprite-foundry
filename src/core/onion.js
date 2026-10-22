  // src/core/onion.js
  var ONION_MAX = 3;
  var ONION_FADE = 0.6;
  function onionFrames(n, i, { back = 1, ahead = 0, loop = true, opacity = 0.3, aheadRatio = 0.5 } = {}) {
    const out = [], seen = /* @__PURE__ */ new Set([i]);
    const at = (d) => {
      const j = i + d;
      if (j >= 0 && j < n) return j;
      return loop ? (j % n + n) % n : null;
    };
    for (let k = 1; k <= Math.min(ONION_MAX, back); k++) {
      const j = at(-k);
      if (j === null || seen.has(j)) continue;
      seen.add(j);
      out.push({ frame: j, side: "back", alpha: opacity * ONION_FADE ** (k - 1) });
    }
    for (let k = 1; k <= Math.min(ONION_MAX, ahead); k++) {
      const j = at(k);
      if (j === null || seen.has(j)) continue;
      seen.add(j);
      out.push({ frame: j, side: "ahead", alpha: opacity * aheadRatio * ONION_FADE ** (k - 1) });
    }
    return out.reverse();
  }
  var TINT = { back: [230, 40, 60], ahead: [40, 90, 230] };

