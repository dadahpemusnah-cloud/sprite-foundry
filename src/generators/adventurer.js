  // src/generators/adventurer.js
  // V7.2 (preview): a taller "Adventurer" body at 48 px (head about a third of the height), with 5-tone
  // materials (cloth, leather, metal, skin, wood) shaded by shape, dark rims where parts overlap, cloaks
  // and robes as parts of their own, and class props. Like the chibi, every part is drawn whole in
  // S, N, E, SE, NE; W, SW, NW mirror the shapes (not the shading: the light always comes from the upper
  // left) and gear is placed after mirroring so it stays in its own hand.
  var ADV_N = 48;
  var ADV_BASE = { S: "S", N: "N", E: "E", SE: "SE", NE: "NE", W: "E", SW: "SE", NW: "NE" };
  var ADV_FACING = { S: 0, N: 0, E: 1, W: -1, SE: 1, SW: -1, NE: 1, NW: -1 };
  // a 5-tone material from hue, saturation, lightness: sh2 (deepest) .. hi2 (glint)
  function advMat(h, s, l, { gloss = false } = {}) {
    const r = ramp(h, s, l);
    return gloss ? { ...r, hi2: mix(r.hi2, "#ffffff", 0.45), sh2: mix(r.sh2, "#000000", 0.25) } : r;
  }
  const advFar = (m) => ({ hi2: m.hi, hi: m.base, base: m.sh, sh: m.sh2, sh2: mix(m.sh2, "#000000", 0.35) });
  // rows of a shape: [y, x0, x1]
  function advTaper(y0, y1, l0, r0, l1, r1) {
    const out = [];
    for (let y = y0; y <= y1; y++) {
      const u = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      out.push([y, Math.round(l0 + (l1 - l0) * u), Math.round(r0 + (r1 - r0) * u)]);
    }
    return out;
  }
  function advEllipse(cx, cy, rx, ry) {
    const out = [];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const v = (y + 0.5 - cy) / ry;
      if (Math.abs(v) > 1) continue;
      const dx = rx * Math.sqrt(1 - v * v), x0 = Math.round(cx - dx), x1 = Math.round(cx + dx) - 1;
      if (x1 >= x0) out.push([y, x0, x1]);
    }
    return out;
  }
  // the parts of `rows` where test(x, y) holds, as rows again
  function advMask(rows, test) {
    const out = [];
    for (const [y, x0, x1] of rows) {
      let a = null;
      for (let x = x0; x <= x1 + 1; x++) {
        const on = x <= x1 && test(x, y);
        if (on && a === null) a = x;
        if (!on && a !== null) {
          out.push([y, a, x - 1]);
          a = null;
        }
      }
    }
    return out;
  }
  // a thick straight line (for blades, staffs, antlers) as single pixels: [[x, y, t]] with t 0..1 across
  function advLine(x0, y0, x1, y1, w2 = 1) {
    const out = [], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1, seen = new Set();
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      for (let k = 0; k < w2; k++) {
        const key = x + k + "," + y;
        if (!seen.has(key)) {
          seen.add(key);
          out.push([x + k, y, w2 === 1 ? 0.5 : k / (w2 - 1)]);
        }
      }
    }
    return out;
  }
  // the class designs: materials and what each part is made of
  var ADV_CLASSES = {
    fighter: { label: "Fighter", hair: "short", head: "helmet", body: "plate", cloak: "cape", skirt: null, weapon: "longsword", offhand: "none", beard: false },
    wizard: { label: "Wizard", hair: "long", head: "wizard", body: "robe", cloak: null, skirt: "robe", weapon: "orbstaff", offhand: "none", beard: true },
    druid: { label: "Druid", hair: "short", head: "antlerhood", body: "leather", cloak: "cloak", skirt: null, weapon: "crook", offhand: "none", beard: true }
  };
  function advDesign(shapeSeed, colourSeed, cls = "fighter") {
    const rc = seedRng("adv-colour:" + colourSeed), K = ADV_CLASSES[cls] || ADV_CLASSES.fighter, id = ADV_CLASSES[cls] ? cls : "fighter";
    const skin = rc.pick(SKIN), hairHue = rc.pick([28, 22, 40, 8, 0]);
    const M = {
      skin: { hi2: mix(skin[0], "#ffffff", 0.3), hi: skin[0], base: skin[1], sh: skin[2], sh2: mix(skin[2], "#000000", 0.3) },
      hair: advMat(hairHue, rc.range(35, 60), rc.pick([22, 30, 42, 55])),
      white: advMat(40, 8, 84),
      metal: advMat(215, 10, 60, { gloss: true }),
      gold: advMat(44, 75, 52, { gloss: true }),
      leather: advMat(28, 40, 32),
      wood: advMat(30, 42, 34),
      boot: advMat(25, 30, 22),
      pants: advMat(rc() * 360, 18, 26),
      eye: rc.pick(["#3b2a20", "#24406a", "#2f5a2c"])
    };
    if (id === "fighter") Object.assign(M, { cloth: advMat(rc.pick([0, 352, 215, 275]), 62, 36), trim: M.gold });
    if (id === "wizard") Object.assign(M, { cloth: advMat(rc.pick([225, 260, 200]), 55, 40), trim: M.gold, glow: advMat(rc.pick([200, 190, 280]), 90, 60, { gloss: true }) });
    if (id === "druid") Object.assign(M, { cloth: advMat(rc.pick([110, 95, 130]), 32, 32), trim: M.leather });
    return { cls: id, shape: String(shapeSeed), ...K, M };
  }
  // the geometry of one base view: parts as shapes (rows + material), details as pixels
  function advDraw(d, view) {
    const M = d.M, shapes = [], marks = [];
    const S = (id, rows, m, o = {}) => shapes.push({ id, rows, m, ...o });
    const mark = (id, x, y, c) => marks.push({ id, x, y, c });
    const side = view === "E", back = view === "N" || view === "NE", three = view === "SE" || view === "NE";
    // body layout: x positions of the parts, per view
    const L = {
      S: { torso: [16, 31, 18, 29], arm: { R: 13, L: 31 }, leg: { R: 19, L: 24 }, head: [23.5, 5.6], far: {} },
      N: { torso: [16, 31, 18, 29], arm: { R: 31, L: 13 }, leg: { R: 24, L: 19 }, head: [23.5, 5.6], far: {} },
      E: { torso: [19, 29, 20, 28], arm: { R: 23, L: 25 }, leg: { R: 23, L: 21 }, head: [24, 5.2], far: { L: true } },
      SE: { torso: [17, 30, 19, 29], arm: { R: 14, L: 30 }, leg: { R: 19, L: 24 }, head: [24, 5.6], far: { L: true } },
      NE: { torso: [17, 30, 19, 29], arm: { R: 30, L: 15 }, leg: { R: 24, L: 19 }, head: [24, 5.6], far: { L: true } }
    }[view];
    const mat = (s, m) => L.far[s] ? advFar(m) : m;
    // legs: thigh, shin, boot
    const toe = side || three ? 1 : 0;
    for (const s of ["R", "L"]) {
      const x = L.leg[s], w2 = side ? 4 : 4;
      S("thigh" + s, advTaper(32, 37, x, x + w2, x, x + w2 - 1), mat(s, d.body === "plate" ? M.pants : M.pants));
      S("shin" + s, advTaper(38, 43, x, x + w2 - 1, x, x + w2 - 1), mat(s, d.body === "plate" ? M.metal : M.boot), { plates: d.body === "plate" });
      S("foot" + s, [[44, x, x + w2 - 1 + toe], [45, x - (toe ? 0 : 1), x + w2 + toe], [46, x - (toe ? 0 : 1), x + w2 + toe]], mat(s, d.body === "plate" ? M.metal : M.boot));
    }
    // torso and pelvis
    const [tl, tr, wl, wr] = L.torso, body = d.body === "plate" ? M.metal : d.body === "robe" ? M.cloth : M.leather;
    S("torso", [[18, tl + 1, tr - 1], ...advTaper(19, 28, tl, tr, wl, wr)], body, { plates: d.body === "plate", folds: d.body === "robe" });
    S("pelvis", advTaper(29, 31, wl, wr, wl, wr), d.body === "robe" ? M.cloth : d.body === "plate" ? M.cloth : M.leather);
    // arms: upper arm, forearm, hand
    for (const s of ["R", "L"]) {
      const x = L.arm[s], sleeve = d.body === "plate" ? M.metal : d.body === "robe" ? M.cloth : M.cloth;
      S("upperArm" + s, advTaper(19, 25, x, x + 3, x, x + 3), mat(s, sleeve));
      S("forearm" + s, d.body === "robe" ? advTaper(26, 31, x, x + 3, x - 1, x + 4) : advTaper(26, 31, x, x + 3, x, x + 2), mat(s, d.body === "plate" ? M.metal : d.body === "robe" ? M.cloth : M.leather));
      S("hand" + s, advTaper(32, 34, x, x + 2, x, x + 2), mat(s, d.body === "plate" ? M.metal : M.skin));
    }
    // a robe's skirt over the legs (feet show below), a cape or cloak behind the body
    if (d.skirt) S("robe", side ? advTaper(31, 43, wl, wr, wl - 1, wr + 1) : advTaper(31, 43, wl, wr, wl - 3, wr + 3), M.cloth, { folds: true });
    if (d.cloak) {
      const c = d.cloak === "cape" ? M.cloth : M.cloth;
      const rows = { S: advTaper(18, 41, 15, 32, 13, 34), N: advTaper(18, 42, 15, 32, 13, 34), E: advTaper(18, 41, 17, 22, 13, 21), SE: advTaper(18, 41, 15, 30, 13, 31), NE: advTaper(18, 42, 16, 31, 14, 33) }[view];
      S("cloak", rows, back ? c : advFar(c), { folds: true });
    }
    // the head: skull, neck, face, then hair or headwear over it
    const [hcx, hrx] = L.head, head = advEllipse(hcx, 10.5, hrx, 6.6);
    S("head", [...head, [17, 22, 25], [18, 22, 25]], M.skin, { round: true });
    const hairM = d.hair === "long" && d.cls === "wizard" ? M.white : M.hair;
    const fx = { S: 0, SE: 2, E: 4 }[view];
    if (!back) {
      // eyes (white and iris), brows, nose, mouth
      const eyes = view === "S" ? [20, 26] : view === "SE" ? [22, 27] : [27];
      for (const [i, x] of eyes.entries()) {
        const narrow = view === "SE" && i === 1;
        mark("head", x, 11, narrow ? M.eye : "#f4f1ea");
        if (!narrow) mark("head", x + 1, 11, M.eye);
        mark("head", x, 12, mix(M.eye, "#000000", 0.35));
        if (!narrow) mark("head", x + 1, 12, M.eye);
        for (const k of narrow ? [0] : [0, 1]) mark("head", x + k, 9, mix(hairM.sh, "#000000", 0.2));
      }
      const nose = view === "S" ? 23 : view === "SE" ? 26 : 29;
      mark("head", nose, 13, M.skin.sh);
      if (side) mark("head", nose, 12, M.skin.base);
      const mouth = view === "S" ? 23 : view === "SE" ? 25 : 27;
      for (const k of side ? [0] : [0, 1]) mark("head", mouth + k, 15, M.skin.sh2);
    }
    // hair under the headwear
    const hairRows = advMask(head, { S: (x, y) => y <= 7 || (x <= 18 || x >= 29) && y <= 12, N: (x, y) => y <= 15, E: (x, y) => y <= 7 || x <= 24 && y <= 14, SE: (x, y) => y <= 7 || x <= 20 && y <= 13, NE: (x, y) => !(x >= 27 && y >= 9) }[view]);
    if (d.head !== "antlerhood") S("hair", hairRows, hairM);
    if (d.hair === "long") S("hair", { S: [...advTaper(10, 22, 17, 18, 17, 18), ...advTaper(10, 22, 29, 30, 29, 30)], N: advTaper(12, 24, 18, 29, 19, 28), E: advTaper(10, 23, 18, 21, 18, 21), SE: advTaper(10, 22, 18, 19, 18, 19), NE: advTaper(12, 24, 18, 28, 19, 27) }[view], hairM);
    if (d.beard && !back) S("hair", view === "S" ? (d.cls === "wizard" ? [...advTaper(14, 22, 19, 28, 22, 25), [23, 23, 24]] : advTaper(14, 17, 19, 28, 21, 26)) : view === "SE" ? (d.cls === "wizard" ? advTaper(14, 22, 21, 29, 24, 27) : advTaper(14, 17, 21, 29, 23, 27)) : (d.cls === "wizard" ? advTaper(14, 21, 24, 29, 25, 27) : advTaper(14, 17, 24, 29, 25, 28)), hairM);
    // headwear
    if (d.head === "helmet") {
      const helm = advEllipse(hcx, 10.2, hrx + 1, 7.4);
      S("hair", advMask(helm, { S: (x, y) => y <= 8 || (x <= 19 || x >= 28) && y <= 15, N: () => true, E: (x, y) => y <= 8 || x <= 23, SE: (x, y) => y <= 8 || x <= 21 || x >= 29 && y <= 12, NE: (x, y) => !(x >= 28 && y >= 10) }[view]), M.metal);
      if (view === "S") for (let y = 8; y <= 12; y++) mark("hair", 23, y, M.metal.base), mark("hair", 24, y, M.metal.sh);
      // a brow band of darker steel
      for (const [y, a, b] of helm) if (y === 8) for (let x = a; x <= b; x++) if (!(back ? false : x >= 23 && x <= 24)) mark("hair", x, y, M.metal.sh);
      if (view === "SE") for (let y = 8; y <= 12; y++) mark("hair", 25, y, M.metal.sh);
      // a plume on top
      S("hair", { S: advTaper(1, 4, 22, 25, 22, 25), N: advTaper(1, 4, 22, 25, 22, 25), E: advTaper(1, 4, 20, 24, 21, 25), SE: advTaper(1, 4, 21, 25, 22, 25), NE: advTaper(1, 4, 22, 26, 22, 25) }[view], M.cloth);
    } else if (d.head === "wizard") {
      const tipX = view === "E" ? 18 : view === "N" || view === "NE" ? 28 : 19;
      const cone = [];
      for (let y = 0; y <= 6; y++) {
        const u = y / 6, cx = tipX + (hcx - 0.5 - tipX) * Math.sqrt(u), hw = 0.5 + u * 5.5;
        cone.push([y, Math.round(cx - hw), Math.round(cx + hw)]);
      }
      S("hair", cone, M.cloth);
      S("hair", [[7, Math.round(hcx - 10), Math.round(hcx + 9)], [8, Math.round(hcx - 9), Math.round(hcx + 8)]], M.cloth);
      for (let x = Math.round(hcx - 6); x <= Math.round(hcx + 5); x++) mark("hair", x, 6, M.trim.base);
    } else if (d.head === "antlerhood") {
      S("hair", advMask([...head, ...advTaper(3, 4, 18, 29, 17, 30), ...advTaper(10, 19, 16, 31, 15, 32)], { S: (x, y) => !(x >= 19 && x <= 28 && y >= 7 && y <= 17), N: () => true, E: (x, y) => !(x >= 24 && y >= 7 && y <= 17), SE: (x, y) => !(x >= 21 && x <= 30 && y >= 7 && y <= 17), NE: (x, y) => !(x >= 29 && y >= 9 && y <= 15) }[view]), M.cloth);
      // antlers: a branching line on each side of the hood
      const ant = (bx, dir2) => [...advLine(bx, 4, bx + dir2 * 4, 0), ...advLine(bx + dir2 * 2, 2, bx + dir2 * 1, -1 + 1), ...advLine(bx + dir2 * 3, 1, bx + dir2 * 5, 1)];
      const bases = { S: [[19, -1], [28, 1]], N: [[19, -1], [28, 1]], E: [[21, -1], [26, 1]], SE: [[20, -1], [28, 1]], NE: [[19, -1], [27, 1]] }[view];
      for (const [bx, s] of bases) for (const [x, y] of ant(bx, s)) mark("hair", x, y, y <= 1 ? M.white.base : M.white.sh);
    }
    // class details on the body
    if (d.body === "plate" && !back) {
      // a tabard down the middle, with a gold trim
      const mid = view === "S" ? 23 : view === "SE" ? 24 : 26;
      for (let y = 21; y <= 31; y++) for (const k of side ? [0, 1] : [0, 1, 2]) mark(y <= 28 ? "torso" : "pelvis", mid - (side ? 0 : 1) + k, y, k === 0 ? M.cloth.hi : M.cloth.base);
      for (const x of side ? [mid, mid + 1] : [mid - 1, mid, mid + 1]) mark("pelvis", x, 31, M.trim.base);
    }
    if (d.body === "robe" || d.body === "leather") for (let x = wl; x <= wr; x++) mark("pelvis", x, 29, d.body === "robe" ? M.trim.base : M.boot.sh);
    if (d.body === "plate") for (const s of ["R", "L"]) {
      // pauldrons: rounded plates on the shoulders
      const x = L.arm[s];
      S("upperArm" + s, [[18, x, x + 3], [19, x - 1, x + 4], [20, x - 1, x + 4], [21, x, x + 3]], mat(s, M.metal));
    }
    const orders = {
      S: ["cloak", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "robe", "torso", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR", "head", "hair"],
      N: ["thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "robe", "torso", "cloak", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR", "head", "hair"],
      E: ["cloak", "upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "robe", "torso", "head", "hair", "upperArmR", "forearmR", "handR"],
      SE: ["cloak", "upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "robe", "torso", "upperArmR", "forearmR", "handR", "head", "hair"],
      NE: ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "robe", "torso", "cloak", "upperArmR", "forearmR", "handR", "head", "hair"]
    };
    // joints (sprite pixels, at pixel edges)
    const joints = { pelvis: [24, 31], torso: [24, 29], head: [24, 18], robe: [24, 31], cloak: [24, 19] };
    for (const s of ["R", "L"]) {
      const ax = L.arm[s] + 2, lx = L.leg[s] + 2;
      Object.assign(joints, { ["upperArm" + s]: [ax, 19.5], ["forearm" + s]: [ax, 26], ["hand" + s]: [ax - 0.5, 32], ["thigh" + s]: [lx, 32], ["shin" + s]: [lx, 38], ["foot" + s]: [lx, 44] });
    }
    return { shapes, marks, order: orders[view], joints };
  }
  const advSwap = (id) => id.replace(/([LR])$/, (m, s) => s === "L" ? "R" : "L");
  // mirror a base view's geometry (shapes, details, joints) for a left-facing direction
  function advMirror(v) {
    const N = ADV_N, mx = (x) => N - 1 - x;
    return {
      shapes: v.shapes.map((s) => ({ ...s, id: advSwap(s.id), rows: s.rows.map(([y, a, b]) => [y, mx(b), mx(a)]) })),
      marks: v.marks.map((m) => ({ ...m, id: advSwap(m.id), x: mx(m.x) })),
      order: v.order.map(advSwap),
      joints: Object.fromEntries(Object.entries(v.joints).map(([id, [x, y]]) => [advSwap(id), [N - x, y]]))
    };
  }
  // shade one shape into its layer: light from the upper left; each row's span is lit on its left,
  // turns away on its right; round shapes also darken towards their bottom; a dark rim on the right
  // and bottom edges separates the part from what is behind it
  function advShade(put, s) {
    const m = s.m, ys = s.rows.map((r) => r[0]), top = Math.min(...ys), bottom = Math.max(...ys);
    const has = new Set(s.rows.flatMap(([y, a, b]) => Array.from({ length: b - a + 1 }, (_, i) => (a + i) + "," + y)));
    for (const [y, x0, x1] of s.rows) for (let x = x0; x <= x1; x++) {
      const w2 = x1 - x0 + 1, t = w2 <= 1 ? 0.5 : (x - x0) / (w2 - 1), v = bottom === top ? 0.5 : (y - top) / (bottom - top);
      let k = t < 0.2 ? 3 : t < 0.62 ? 2 : t < 0.86 ? 1 : 0;
      if (s.round) k = Math.max(0, Math.min(3, k - (v > 0.78 ? 1 : 0) + (v < 0.18 && t < 0.62 ? 1 : 0)));
      if (y === top && t < 0.5 && w2 > 2) k = Math.min(4, k + 1);
      const rim = !has.has(x + 1 + "," + y) && x > x0 || !has.has(x + "," + (y + 1)) && y > top;
      if (rim && k > 0) k = Math.min(k, 1) - (w2 > 3 ? 1 : 0);
      // cloth hangs in folds: a darker line every few columns, deepening towards the hem
      if (s.folds && w2 > 6 && v > 0.25 && (x - x0) % 4 === 3 && x < x1 - 1) k = Math.max(0, k - (v > 0.6 ? 2 : 1));
      // plate armour: a seam between plates every few rows, a glint at the top left
      if (s.plates && (y - top) % 4 === 3 && y < bottom) k = Math.max(0, k - 1);
      if (s.plates && y - top === 1 && t > 0.1 && t < 0.3) k = 4;
      put(s.id, x, y, [m.sh2, m.sh, m.base, m.hi, m.hi2][Math.max(0, k)]);
    }
  }
  // gear, placed into the finished (possibly mirrored) view by its hand
  function advGear(d, dir, layers, order, joints) {
    const N = ADV_N, M = d.M, f = ADV_FACING[dir];
    const put = (id, x, y, c) => {
      if (x >= 0 && y >= 0 && x < N && y < N) (layers[id] = layers[id] || /* @__PURE__ */ new Map()).set(y * N + x, c);
    };
    const box = (id) => {
      let x0 = N, x1 = -1, y1 = -1;
      for (const i of layers[id].keys()) {
        x0 = Math.min(x0, i % N);
        x1 = Math.max(x1, i % N);
        y1 = Math.max(y1, i / N | 0);
      }
      return { x0, x1, y1, cx: (x0 + x1) / 2, out: x0 + x1 < N - 1 ? -1 : 1 };
    };
    if (d.weapon === "none") return;
    const h = box("handR"), side = dir === "E" || dir === "W", o = side ? f : h.out, gx = Math.round(h.cx), gy = 33;
    const lineInto = (pts, mtl, edge = false) => {
      for (const [x, y, t] of pts) put("weapon", x, y, edge ? (t < 0.5 ? mtl.hi2 : mtl.sh) : t < 0.34 ? mtl.hi : t < 0.67 ? mtl.base : mtl.sh);
    };
    if (d.weapon === "longsword") {
      // held up and out at an angle: a broad blade, a cross guard at the fist, a pommel below it
      const tip = side ? [gx + f * 9, gy - 15] : [gx + o * 8, gy - 16];
      lineInto(advLine(gx, gy - 2, tip[0], tip[1], 2), M.metal, true);
      for (const [x, y] of advLine(gx - 2, gy - 1, gx + 2, gy - 1)) put("weapon", x, y, M.gold.base);
      put("weapon", gx, gy + 2, M.gold.sh);
      for (const y of [gy, gy + 1]) put("weapon", gx, y, M.leather.base);
    } else {
      // a staff taller than the character, through the fist: an orb, or a crook, on top
      const x = side ? gx + f : gx + o * 2;
      for (let y = 6; y <= 45; y++) put("weapon", x, y, y % 5 === 0 ? M.wood.sh : M.wood.base), put("weapon", x + 1, y, M.wood.sh);
      if (d.weapon === "orbstaff") {
        for (const [y, a, b] of advEllipse(x + 1, 3.5, 2.4, 2.4)) for (let xx = a; xx <= b; xx++) put("weapon", xx, y, xx === a || y <= 2 ? M.glow.hi2 : xx === b ? M.glow.sh : M.glow.base);
      } else for (const [xx, y] of [...advLine(x, 6, x - o * 2, 3), ...advLine(x - o * 2, 3, x - o * 4, 4), ...advLine(x - o * 4, 4, x - o * 4, 6)]) put("weapon", xx, y, M.wood.base);
    }
    joints.weapon = [gx + 0.5, gy];
    order.splice(order.indexOf("upperArmR"), 0, "weapon");
  }
  // one finished view: base geometry (mirrored for left-facing directions), shaded, with details and gear.
  // Hair and headwear are drawn into the head part (it moves with the head)
  function advView(d, dir) {
    const base = ADV_BASE[dir], g0 = advDraw(d, base), g = base === dir ? g0 : advMirror(g0), layers = {};
    const put = (id, x, y, c) => {
      const pid = id === "hair" ? "head" : id;
      if (x >= 0 && y >= 0 && x < ADV_N && y < ADV_N && c) (layers[pid] = layers[pid] || /* @__PURE__ */ new Map()).set(y * ADV_N + x, c);
    };
    for (const id of g.order) for (const s of g.shapes) if (s.id === id) advShade(put, s);
    for (const m of g.marks) put(m.id, m.x, m.y, m.c);
    const order = g.order.filter((id) => id !== "hair" && layers[id]), joints = { ...g.joints };
    advGear(d, dir, layers, order, joints);
    return { layers, order, joints };
  }
  function advCompose(v) {
    const N = ADV_N, px = new Array(N * N).fill(null), owner = new Array(N * N).fill(null);
    for (const id of v.order) for (const [i, c] of v.layers[id] || []) {
      px[i] = c;
      owner[i] = id;
    }
    return { px, owner };
  }
