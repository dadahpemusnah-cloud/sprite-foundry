  // src/ui/made-tint.js
  var MADE_COLOUR = { "joint fill": "#ff9f1c", "hidden area": "#2ec4b6", "drawing": "#e71d36", "back limb": "#9b5de5", "smear": "#f15bb5" };
  function tintMade(ctx, made, N, x0, y0, z) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    made.forEach((k, i) => {
      if (!k) return;
      ctx.fillStyle = MADE_COLOUR[k];
      ctx.fillRect(x0 + i % N * z, y0 + (i / N | 0) * z, z, z);
    });
    ctx.restore();
  }
  function madeSummary(made) {
    const n = {};
    for (const k of made) if (k) n[k] = (n[k] || 0) + 1;
    return Object.entries(n).map(([k, v]) => `${v} px ${k}`).join(", ");
  }
  function madeLegend() {
    return Object.entries(MADE_COLOUR).map(([k, c]) => {
      const s = document.createElement("span");
      s.className = "made-key";
      const b = document.createElement("i");
      b.style.background = c;
      s.append(b, " " + k);
      return s;
    });
  }

