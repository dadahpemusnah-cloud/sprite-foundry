  // src/core/palettes.js
  var PALETTES = {
    pico8: { colors: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"] },
    sweetie16: { colors: ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"] },
    endesga32: { colors: ["#be4a2f", "#d77643", "#ead4aa", "#e4a672", "#b86f50", "#733e39", "#3e2731", "#a22633", "#e43b44", "#f77622", "#feae34", "#fee761", "#63c74d", "#3e8948", "#265c42", "#193c3e", "#124e89", "#0099db", "#2ce8f5", "#ffffff", "#c0cbdc", "#8b9bb4", "#5a6988", "#3a4466", "#262b44", "#181425", "#ff0044", "#68386c", "#b55088", "#f6757a", "#e8b796", "#c28569"] },
    gameboy: { colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"], lum: true }
  };
  var qCache = /* @__PURE__ */ new Map();
  var CUSTOM_MAX = 64;
  function setCustomPalette(colors) {
    if (colors && colors.length) PALETTES.custom = { colors: colors.slice() };
    else delete PALETTES.custom;
    qCache.delete("custom");
  }
  function parseHexList(text) {
    const out = [];
    for (const m of String(text).matchAll(/#?\b([0-9a-f]{6})\b/gi)) {
      const c = "#" + m[1].toLowerCase();
      if (!out.includes(c)) out.push(c);
    }
    return out.slice(0, CUSTOM_MAX);
  }
  function quantize(hex, key) {
    const P = PALETTES[key];
    if (!P) return hex;
    let m = qCache.get(key);
    if (!m) {
      m = /* @__PURE__ */ new Map();
      qCache.set(key, m);
    }
    const hit = m.get(hex);
    if (hit) return hit;
    let best = P.colors[0], bd = Infinity;
    if (P.lum) {
      const L = lum(hex) * 0.82 + 30;
      for (const c of P.colors) {
        const d = Math.abs(lum(c) - L);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
    } else {
      const [r12, g1, b1] = hexToRgb(hex);
      for (const c of P.colors) {
        const [r2, g2, b2] = hexToRgb(c), rm = (r12 + r2) / 2;
        const d = (2 + rm / 256) * (r12 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
    }
    m.set(hex, best);
    return best;
  }

