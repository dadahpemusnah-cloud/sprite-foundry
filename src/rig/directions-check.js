  // src/rig/directions-check.js
  var LIMBS2 = ["upperArm", "forearm", "hand", "thigh", "shin", "foot"];
  var LABEL = { upperArm: "upper arm", forearm: "forearm", hand: "hand", thigh: "thigh", shin: "shin", foot: "foot" };
  function shapeOf(pts) {
    if (pts.length < 2) return pts.length ? { length: 1, thickness: 1, n: pts.length } : null;
    let mx = 0, my = 0;
    for (const [x, y] of pts) {
      mx += x;
      my += y;
    }
    mx /= pts.length;
    my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) {
      sxx += (x - mx) ** 2;
      syy += (y - my) ** 2;
      sxy += (x - mx) * (y - my);
    }
    const ang = Math.atan2(2 * sxy, sxx - syy) / 2, ux = Math.cos(ang), uy = Math.sin(ang);
    let lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) {
      const t = (x - mx) * ux + (y - my) * uy;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    const length = Math.round(hi - lo) + 1;
    return { length, thickness: Math.round(pts.length / length * 10) / 10, n: pts.length };
  }
  function measureRest({ N, px, owner }) {
    let top = -1;
    for (let i = 0; i < N * N; i++) if (px[i]) {
      top = i / N | 0;
      break;
    }
    const feet = groundRow(px, N, owner), parts = {};
    for (let i = 0; i < N * N; i++) {
      const id = owner && owner[i];
      if (!px[i] || !id) continue;
      (parts[id] = parts[id] || []).push([i % N, i / N | 0]);
    }
    const limbs = {};
    for (const k of LIMBS2) {
      const sides = ["L", "R"].map((s) => ({ s, m: parts[k + s] ? shapeOf(parts[k + s]) : null })).filter((x) => x.m);
      if (!sides.length) continue;
      const best = sides.sort((a, b) => b.m.length - a.m.length || b.m.n - a.m.n)[0];
      limbs[k] = { ...best.m, side: best.s };
    }
    return { top, feet, height: top >= 0 && feet >= 0 ? feet - top + 1 : 0, limbs };
  }
  function checkDirections(views) {
    const main = views.find((v) => v.main);
    if (!main) return [];
    const m = measureRest(main), out = [];
    const add = (dir, message) => out.push({ level: "warning", code: "direction", anim: null, frame: null, message: `Direction ${dir}: ${message}` });
    for (const v of views) {
      if (v === main || v.N !== main.N) continue;
      const r = measureRest(v);
      if (Math.abs(r.top - m.top) > 1) add(v.dir, `the head top is ${Math.abs(r.top - m.top)} px ${r.top < m.top ? "higher" : "lower"} than in ${main.dir}.`);
      if (r.feet >= 0 && m.feet >= 0 && Math.abs(r.feet - m.feet) > 1) add(v.dir, `the feet stand ${Math.abs(r.feet - m.feet)} px ${r.feet < m.feet ? "higher" : "lower"} than in ${main.dir}.`);
      if (r.height && m.height && Math.abs(r.height - m.height) > 1) add(v.dir, `the character is ${r.height} px tall; in ${main.dir} ${m.height} px.`);
      for (const k of LIMBS2) {
        const a = m.limbs[k], b = r.limbs[k];
        if (!a || !b) continue;
        const dl = b.length - a.length, dt = b.thickness - a.thickness;
        if (Math.abs(dl) > Math.max(2, 0.15 * a.length)) add(v.dir, `the ${LABEL[k]} (${b.side === "L" ? "left" : "right"}) is ${b.length} px long; in ${main.dir} ${a.length} px (${dl > 0 ? "longer" : "shorter"}).`);
        if (Math.abs(dt) > Math.max(2, 0.25 * a.thickness)) add(v.dir, `the ${LABEL[k]} (${b.side === "L" ? "left" : "right"}) is ${b.thickness} px thick; in ${main.dir} ${a.thickness} px (${dt > 0 ? "thicker" : "thinner"}).`);
      }
    }
    return out;
  }

