  // src/parts/legend.js
  var GLYPHS = {
    K: ["skin", "hi"],
    S: ["skin", "base"],
    s: ["skin", "sh"],
    H: ["hair", "hi"],
    A: ["hair", "base"],
    a: ["hair", "sh"],
    C: ["cloth", "hi"],
    P: ["cloth", "base"],
    p: ["cloth", "sh"],
    q: ["cloth", "sh2"],
    T: ["cloth2", "hi"],
    R: ["cloth2", "base"],
    r: ["cloth2", "sh"],
    L: ["leather", "base"],
    l: ["leather", "sh"],
    B: ["boots", "base"],
    b: ["boots", "sh"],
    W: ["metal", "hi2"],
    I: ["metal", "hi"],
    N: ["metal", "base"],
    n: ["metal", "sh"],
    U: ["gold", "hi"],
    O: ["gold", "base"],
    o: ["gold", "sh"],
    D: ["wood", "base"],
    d: ["wood", "sh"],
    J: ["gem", "hi2"],
    G: ["gem", "base"],
    g: ["gem", "sh"]
  };
  var FIXED = { E: "#1c1828", X: "#ffffff", Y: "#e8433a", Q: "#d8d0b8" };
  function glyphColour(ch, colours) {
    if (FIXED[ch]) return FIXED[ch];
    const g = GLYPHS[ch];
    if (!g) return void 0;
    const m = colours[g[0]];
    return m ? m[g[1]] : void 0;
  }

