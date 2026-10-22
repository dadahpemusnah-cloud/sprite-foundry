  // src/generators/creature.js
  function genCreature(N, rs, rc) {
    const hw = N / 2;
    let g, bb;
    for (let tries = 0; tries < 24; tries++) {
      g = new Uint8Array(N * N);
      const cy = N * rs.range(0.5, 0.6), ry = N * rs.range(0.36, 0.48), rx = hw * rs.range(0.72, 0.98);
      for (let y = 0; y < N; y++) for (let x = 0; x < hw; x++) {
        const dx = (x + 0.5 - hw) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        const p = d < 1 ? 0.55 + 0.4 * (1 - d) : d < 1.8 ? 0.14 : 0;
        const v = rs() < p ? 1 : 0;
        g[y * N + x] = v;
        g[y * N + N - 1 - x] = v;
      }
      g = smooth(smooth(g, N, 5, 4), N, 5, 4);
      g = largest(g, N);
      bb = bbox(g, N);
      if (bb.count > N * N * 0.2 && bb.w >= N * 0.5 && bb.h >= N * 0.5) break;
    }
    const s = makeSprite("creature", N);
    const hue = rc() * 360, sat = rc.range(45, 80), L = rc.range(44, 60);
    const R = ramp(hue, sat, L), R2 = ramp(hue + rc.pick([150, 180, -120, 40, -40]), sat * 0.9, L + 8);
    shadeBlob(s, g, () => R, "body");
    const occ = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !!g[y * N + x];
    const interior = (x, y) => occ(x, y) && D4.every(([dx, dy]) => occ(x + dx, y + dy));
    const pattern = rc.pick(["plain", "belly", "spots", "stripes"]);
    if (pattern === "belly") {
      const ecx = hw, ecy = bb.maxY - bb.h * 0.28, erx = Math.max(1.5, bb.w * 0.24), ery = Math.max(1.5, bb.h * 0.22);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (interior(x, y) && ((x + 0.5 - ecx) / erx) ** 2 + ((y + 0.5 - ecy) / ery) ** 2 <= 1) setPx(s, x, y, interior(x, y - 1) ? R2.base : R2.hi, "body");
    } else if (pattern === "spots") {
      const n = Math.max(2, Math.round(N / 4));
      for (let k = 0; k < n; k++) {
        const x = rc.int(0, hw - 1), y = rc.int(bb.minY, bb.maxY);
        if (interior(x, y)) {
          setPx(s, x, y, R2.base, "body");
          setPx(s, N - 1 - x, y, R2.base, "body");
        }
      }
    } else if (pattern === "stripes") {
      for (let y = bb.minY + 2; y < bb.maxY; y += 3) for (let x = 0; x < N; x++) if (interior(x, y)) setPx(s, x, y, R.sh, "body");
    }
    const rowHalf = (y) => {
      let w2 = 0;
      for (let x = hw - 1; x >= 0 && occ(x, y); x--) w2++;
      return w2;
    };
    const cands = [];
    for (let y = bb.minY + 1; y <= bb.minY + bb.h * 0.5; y++) if (rowHalf(y) >= 3 && rowHalf(y + 1) >= 2) cands.push(y);
    const ey = cands.length ? cands[Math.floor(rs() * Math.ceil(cands.length / 2))] : bb.minY + Math.round(bb.h * 0.35);
    const eyeS = N >= 24 ? 2 : 1, eyeH = eyeS + 1;
    const pupil = hsl(toward(hue, 245, 60), 40, 10), white = "#f6f4ee";
    const drawEye = (x0, w2) => {
      for (let dy = 0; dy < eyeH; dy++) for (let dx = 0; dx < w2; dx++) setPx(s, x0 + dx, ey + dy, dy === eyeH - 1 ? pupil : white, "eye");
    };
    if (rs.chance(0.2)) drawEye(hw - eyeS, eyeS * 2);
    else {
      const ex = rs.int(0, Math.max(0, Math.min(rowHalf(ey) - 2 - eyeS, Math.floor(hw * 0.5))));
      const lx = hw - 1 - ex - (eyeS - 1);
      drawEye(lx, eyeS);
      drawEye(N - lx - eyeS, eyeS);
    }
    if (rs.chance(0.65)) {
      const my = ey + eyeH + 1, mw = rs.int(0, Math.min(2, Math.max(0, rowHalf(my) - 2)));
      if (rowHalf(my) >= 2) {
        for (let x = hw - 1 - mw; x <= hw + mw; x++) if (interior(x, my)) setPx(s, x, my, pupil, "body");
        if (rs.chance(0.5) && interior(hw - 1 - mw, my + 1)) {
          setPx(s, hw - 1 - mw, my + 1, white, "body");
          setPx(s, hw + mw, my + 1, white, "body");
        }
      }
    }
    const legRows = Math.max(1, Math.round(bb.h * 0.22));
    for (let i = 0; i < N * N; i++) {
      const y = i / N | 0;
      if (s.px[i] && s.tag[i] === "body" && y > bb.maxY - legRows) s.tag[i] = i % N < hw ? "legL" : "legR";
    }
    s.order = ["legL", "legR", "body", "eye"];
    s.meta.lid = R.base;
    s.meta.bb = bb;
    s.meta.outline = hsl(toward(hue, 245, 40), 45, 12);
    s.meta.desc = `${pattern} \xB7 ${bb.w}\xD7${bb.h} px body`;
    const U = ["body", "eye"];
    const up = (k) => Math.min(k, bb.minY) ? -Math.min(k, bb.minY) : 0, down = (k) => Math.min(k, N - 1 - bb.maxY);
    s.anims = {
      idle: [{}, { d: off(U, 0, 1) }, { d: off(U, 0, 1) }, { blink: true }],
      walk: [{ d: { legL: [0, -1] } }, { d: off(U, 0, 1) }, { d: { legR: [0, -1] } }, { d: off(U, 0, 1) }],
      hop: [{ d: off(U, 0, 1) }, { g: [0, up(1)] }, { g: [0, up(2)], d: { legL: [0, -1], legR: [0, -1] } }, { g: [0, up(1)] }, { d: off(U, 0, 1) }],
      attack: [{ d: off(U, 0, 1) }, { g: [0, up(2)] }, { g: [0, down(1)], fx: "impact" }, { g: [0, down(1)] }, {}],
      hurt: [{ flash: true, g: [-1, 0] }, { g: [1, 0], blink: true }, { flash: true }, {}]
    };
    s.post = (spec, put) => {
      if (spec.fx !== "impact") return;
      const c = "#fff3b0";
      for (const [x, y] of [[bb.minX - 2, bb.maxY], [bb.minX - 1, bb.maxY - 2], [bb.minX - 2, bb.maxY - 3], [bb.maxX + 2, bb.maxY], [bb.maxX + 1, bb.maxY - 2], [bb.maxX + 2, bb.maxY - 3]]) put(x, y, c);
    };
    return s;
  }

