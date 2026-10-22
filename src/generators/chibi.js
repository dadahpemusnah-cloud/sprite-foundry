  // src/generators/chibi.js
  // V7: a chibi character drawn as separate body parts in all 8 directions, from one design. Each part
  // is drawn whole (also where another part covers it), so the rig can move it without holes. The
  // left-facing views are the right-facing ones mirrored with left and right parts swapped: the
  // design is symmetric. 32 px, feet on row 30.
  var CHIBI_N = 32;
  var CHIBI_VERSION = 1;
  var CHIBI_HAIR = ["short", "short", "long", "spiky", "bob", "ponytail", "bun", "bald", "cap"];
  var CHIBI_OUTFIT = ["plain", "plain", "tunic", "vest", "stripe"];
  // where each view is drawn from: its own drawing, or the mirror of the opposite one
  var CHIBI_BASE = { S: "S", N: "N", E: "E", SE: "SE", NE: "NE", W: "E", SW: "SE", NW: "NE" };
  var CHIBI_PARTS = ["thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "head", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR"];
  function chibiDesign(shapeSeed, colourSeed) {
    const rs = seedRng("chibi:" + shapeSeed), rc = seedRng("chibi-colour:" + colourSeed);
    const fantasy = rc.chance(0.12), skin = fantasy ? rc.pick(FANTASY_SKIN) : rc.pick(SKIN);
    const hairHue = rc.pick([28, 22, 40, 48, 8, 275, 200, 330, 0, 120]);
    const hair = ramp(hairHue, rc.range(35, 75), rc.pick([18, 28, 40, 55, 68]));
    const shirtHue = rc() * 360, shirt = ramp(shirtHue, rc.range(40, 75), rc.range(40, 55));
    const accent = ramp((shirtHue + rc.pick([150, 180, 210])) % 360, rc.range(40, 70), rc.range(45, 60));
    const pants = ramp(rc() * 360, rc.range(15, 45), rc.range(24, 38));
    const shoe = ramp(20 + rc() * 25, 35, 22), hat = ramp(rc() * 360, rc.range(45, 70), rc.range(35, 50));
    const eye = rc.pick(["#2a1d1a", "#1d2a4a", "#1f3a24", "#3a1d3a"]);
    return {
      shape: String(shapeSeed),
      colour: String(colourSeed),
      hair: rs.pick(CHIBI_HAIR),
      outfit: rs.pick(CHIBI_OUTFIT),
      sleeves: rs.chance(0.5) ? "long" : "short",
      belt: rs.chance(0.6),
      blush: rs.chance(0.4),
      colours: { skin: { hi: skin[0], base: skin[1], sh: skin[2], sh2: mix(skin[2], "#000000", 0.3) }, hair, shirt, accent, pants, shoe, hat, eye, metal: ramp(44, 70, 55) }
    };
  }
  // the head's outline (hair rows 4-5 included): [y, x0, x1]
  var CHIBI_HEAD = [[4, 11, 20], [5, 10, 21], ...[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((y) => [y, 9, 22]), [16, 10, 21]];
  var CHIBI_SIDE_HEAD = [[4, 11, 19], [5, 10, 20], ...[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((y) => [y, 9, 21]), [16, 10, 20]];
  function chibiCanvas() {
    const layers = {};
    const put = (id, x, y, c) => {
      if (x < 0 || y < 0 || x >= CHIBI_N || y >= CHIBI_N || !c) return;
      (layers[id] = layers[id] || /* @__PURE__ */ new Map()).set(y * CHIBI_N + x, c);
    };
    // a block with light from the upper left: left column hi, right column sh, last row sh
    const block = (id, x0, y0, x1, y1, r, { left = "hi", right = "sh", bottom = null } = {}) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let c = r.base;
        if (bottom && y === y1) c = r[bottom];
        else if (x === x1 && x1 > x0 && right) c = r[right];
        else if (x === x0 && x1 > x0 && left) c = r[left];
        put(id, x, y, c);
      }
    };
    return { layers, put, block };
  }
  // a darker copy of a ramp, for limbs on the far side
  const farRamp = (r) => ({ hi: r.base, base: r.sh, sh: r.sh2, sh2: mix(r.sh2, "#000000", 0.3) });
  function chibiLeg(cv, s, x, r, { far = false, toe = 0 } = {}) {
    const pants = far ? farRamp(r.pants) : r.pants, shoe = far ? farRamp(r.shoe) : r.shoe;
    cv.block("thigh" + s, x, 25, x + 3, 26, pants);
    cv.block("shin" + s, x, 27, x + 3, 28, pants, { bottom: "sh" });
    cv.block("foot" + s, x + Math.min(0, toe), 29, x + 3 + Math.max(0, toe), 30, shoe, { bottom: "sh" });
  }
  function chibiArm(cv, s, x, d, { far = false, edge = null } = {}) {
    const C = d.colours, sleeve = far ? farRamp(C.shirt) : C.shirt, skin = far ? farRamp(C.skin) : C.skin;
    cv.block("upperArm" + s, x, 17, x + 1, 20, sleeve);
    cv.block("forearm" + s, x, 21, x + 1, 22, d.sleeves === "long" ? sleeve : skin);
    cv.block("hand" + s, x, 23, x + 1, 24, skin, { bottom: "sh" });
    // an arm in front of the body carries a dark edge on its back side, so it reads against the shirt
    if (edge !== null) for (let y = 18; y <= 22; y++) cv.put(y <= 20 ? "upperArm" + s : "forearm" + s, edge, y, C.shirt.sh2);
  }
  function chibiBody(cv, d, x0, x1, { collar = null } = {}) {
    const C = d.colours, tunic = d.outfit === "tunic";
    cv.block("torso", x0, 17, x1, 22, C.shirt);
    if (d.outfit === "vest") for (let y = 17; y <= 22; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) cv.put("torso", x, y, x === x1 ? C.accent.sh : C.accent.base);
    if (d.outfit === "stripe") for (let x = x0; x <= x1; x++) cv.put("torso", x, 20, x === x1 ? C.accent.sh : C.accent.base);
    if (collar !== null) for (const x of [collar, collar + 1]) cv.put("torso", x, 17, C.skin.base);
    cv.block("pelvis", x0, 23, x1, 24, tunic ? C.shirt : C.pants, { bottom: tunic ? "sh" : null });
    if (d.belt) for (let x = x0; x <= x1; x++) cv.put("pelvis", x, 23, x === (x0 + x1 >> 1) ? C.metal.base : C.shoe.sh);
  }
  // skin of the head plus hair, for one view; `hairAt(x, y)` says which head pixels are hair
  function chibiHead(cv, d, rows, hairAt, face) {
    const C = d.colours, bald = d.hair === "bald", capped = d.hair === "cap", H = capped ? C.hat : C.hair;
    for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) {
      const hair = !bald && hairAt(x, y);
      if (!hair && y < 6 && !bald) continue;
      if (hair) cv.put("head", x, y, y <= 5 && x < x1 - 2 ? H.hi : x === x1 || y === 16 ? H.sh : H.base);
      else cv.put("head", x, y, x === x1 || y === 16 ? C.skin.sh : y === 6 || x === x0 ? C.skin.hi : C.skin.base);
    }
    if (face) face(C);
  }
  function chibiEye(cv, C, x, w2 = 2) {
    for (let y = 11; y <= 13; y++) for (let i = 0; i < w2; i++) cv.put("head", x + i, y, y === 12 && i === 0 ? "#ffffff" : y === 13 ? C.eye : mix(C.eye, "#000000", 0.4));
  }
  // extra hair outside the head outline (spikes, long sides, ponytail, bun) for one view
  function chibiHairExtra(cv, d, view) {
    const C = d.colours, H = d.hair === "cap" ? C.hat : C.hair, put = (x, y, c = H.base) => cv.put("head", x, y, c);
    if (d.hair === "spiky") for (const [x, y] of [[11, 3], [12, 2], [13, 3], [15, 3], [16, 2], [17, 2], [18, 3], [20, 3], [21, 4]]) put(x, y, y === 2 ? H.hi : H.base);
    if (d.hair === "bun") for (const [x, y] of [[14, 2], [15, 2], [16, 2], [17, 2], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3], [15, 1], [16, 1]]) put(x, y, y < 3 ? H.hi : H.base);
    if (d.hair === "cap") {
      // the brim points the way the character faces
      const brim = { S: [8, 23], N: null, E: [16, 24], SE: [10, 24], NE: [18, 23] }[view];
      if (brim) for (let x = brim[0]; x <= brim[1]; x++) put(x, 8, H.sh);
    }
    if (d.hair === "long") {
      const sides = { S: [[8, 9], [22, 23]], N: [[8, 23]], E: [[8, 11]], SE: [[8, 9], [23, 23]], NE: [[8, 21]] }[view];
      for (const [a, b] of sides) for (let x = a; x <= b; x++) for (let y = 8; y <= 20; y++) if (view === "N" || view === "NE" || view === "E" || y >= 10 || x === 8 || x === 23) put(x, y, x === b && b > 20 ? H.sh : y >= 19 ? H.sh : H.base);
    }
    if (d.hair === "ponytail") {
      const tail = { N: [[15, 16]], NE: [[13, 14]], E: [[7, 8]], SE: [[8, 8]], S: [] }[view];
      for (const [a, b] of tail) for (let x = a; x <= b; x++) for (let y = 9; y <= 19; y++) put(x, y, y > 16 ? H.sh : H.base);
    }
    if (d.hair === "bob") {
      const sides = { S: [8, 23], SE: [8, 23], E: [8, null], NE: [8, 23], N: [8, 23] }[view];
      for (let y = 8; y <= 15; y++) {
        if (sides[0] !== null) put(sides[0], y, H.base);
        if (sides[1] !== null) put(sides[1], y, H.sh);
      }
    }
  }
  // which head pixels are hair: per view and style
  function chibiHairMask(d, view) {
    const len = d.hair === "long" || d.hair === "bob" ? 14 : 11;
    return {
      S: (x, y) => y <= 7 || y === 8 && x % 3 !== 1 || (x <= 9 || x >= 22) && y <= len,
      N: (x, y) => y <= 15,
      E: (x, y) => y <= 7 || x <= 15 && y <= (d.hair === "short" || d.hair === "spiky" || d.hair === "cap" ? 13 : 15) || y === 8 && x >= 16 && x <= 20 && x % 2 === 0,
      SE: (x, y) => y <= 7 || y === 8 && x % 3 !== 2 || x <= 12 && y <= Math.max(len, 12) || x >= 22 && y <= 9,
      NE: (x, y) => !(x >= 20 && y >= 10 && y <= 15)
    }[view];
  }
  function chibiDraw(d, view) {
    const cv = chibiCanvas(), C = d.colours;
    const front = (eyes, mouth, far = 2) => (C2) => {
      eyes.forEach((x, i) => chibiEye(cv, C2, x, i === eyes.length - 1 ? far : 2));
      if (mouth !== null) cv.put("head", mouth, 15, C2.skin.sh);
      if (d.blush) for (const x of [eyes[0] - 1, eyes[eyes.length - 1] + 2]) cv.put("head", x, 14, mix(C2.skin.base, "#ff6f8a", 0.35));
    };
    let order, pivots;
    if (view === "S" || view === "N") {
      const back = view === "N", R = back ? 21 : 9, Lx = back ? 9 : 21;
      chibiLeg(cv, back ? "L" : "R", 12, C);
      chibiLeg(cv, back ? "R" : "L", 16, C);
      chibiBody(cv, d, 11, 20, { collar: back ? null : 15 });
      chibiArm(cv, "R", R, d);
      chibiArm(cv, "L", Lx, d);
      chibiHead(cv, d, CHIBI_HEAD, chibiHairMask(d, view), back ? null : front([12, 18], 15));
      if (!back) cv.put("head", 16, 15, C.skin.sh);
      chibiHairExtra(cv, d, view);
      order = ["thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR", "head"];
      pivots = { R: [R + 1, 17.5], L: [Lx + 1, 17.5], legR: back ? 18 : 14, legL: back ? 14 : 18 };
    } else if (view === "E") {
      chibiLeg(cv, "L", 13, C, { far: true, toe: 1 });
      chibiArm(cv, "L", 16, d, { far: true });
      chibiLeg(cv, "R", 15, C, { toe: 1 });
      chibiBody(cv, d, 12, 19);
      chibiArm(cv, "R", 15, d, { edge: 14 });
      chibiHead(cv, d, CHIBI_SIDE_HEAD, chibiHairMask(d, view), (C2) => {
        chibiEye(cv, C2, 18);
        if (d.blush) cv.put("head", 17, 14, mix(C2.skin.base, "#ff6f8a", 0.35));
      });
      chibiHairExtra(cv, d, view);
      order = ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "head", "upperArmR", "forearmR", "handR"];
      pivots = { R: [16, 17.5], L: [17, 17.5], legR: 17, legL: 15 };
    } else if (view === "SE") {
      chibiLeg(cv, "L", 16, C, { far: true, toe: 1 });
      chibiArm(cv, "L", 20, d, { far: true });
      chibiLeg(cv, "R", 12, C, { toe: 1 });
      chibiBody(cv, d, 11, 19, { collar: 16 });
      chibiArm(cv, "R", 9, d);
      chibiHead(cv, d, CHIBI_HEAD, chibiHairMask(d, view), front([15, 20], 19, 1));
      chibiHairExtra(cv, d, view);
      order = ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "upperArmR", "forearmR", "handR", "head"];
      pivots = { R: [10, 17.5], L: [21, 17.5], legR: 14, legL: 18 };
    } else {
      chibiLeg(cv, "L", 12, C, { far: true, toe: 1 });
      chibiArm(cv, "L", 10, d, { far: true });
      chibiLeg(cv, "R", 16, C, { toe: 1 });
      chibiBody(cv, d, 12, 20);
      chibiArm(cv, "R", 21, d);
      chibiHead(cv, d, CHIBI_HEAD, chibiHairMask(d, view), null);
      chibiHairExtra(cv, d, view);
      order = ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "upperArmR", "forearmR", "handR", "head"];
      pivots = { R: [22, 17.5], L: [11, 17.5], legR: 18, legL: 14 };
    }
    // joints in sprite pixels (edges between pixels): shoulder, elbow, wrist; hip, knee, ankle; neck, waist
    const joints = { pelvis: [16, 24], torso: [16, 23], head: [16, 17] };
    for (const s of ["L", "R"]) {
      const [ax] = pivots[s];
      Object.assign(joints, { ["upperArm" + s]: [ax, 17.5], ["forearm" + s]: [ax, 21], ["hand" + s]: [ax, 23] });
      const lx = pivots["leg" + s];
      Object.assign(joints, { ["thigh" + s]: [lx, 25], ["shin" + s]: [lx, 27], ["foot" + s]: [lx, 29] });
    }
    return { layers: cv.layers, order, joints };
  }
  const swapSide = (id) => id.replace(/([LR])$/, (m, s) => s === "L" ? "R" : "L");
  // one finished view: the drawing for `dir`, mirrored for the left-facing ones
  function chibiView(d, dir) {
    const base = CHIBI_BASE[dir], v = chibiDraw(d, base);
    if (base === dir) return v;
    const N = CHIBI_N, layers = {}, joints = {};
    for (const [id, m] of Object.entries(v.layers)) {
      const out = /* @__PURE__ */ new Map();
      for (const [i, c] of m) out.set((i / N | 0) * N + (N - 1 - i % N), c);
      layers[swapSide(id)] = out;
    }
    for (const [id, [x, y]] of Object.entries(v.joints)) joints[swapSide(id)] = [N - x, y];
    return { layers, order: v.order.map(swapSide), joints };
  }
  // the view's flat picture: each pixel shows the front-most part drawn there; `hidden` keeps, per part,
  // its pixels that other parts cover (the rig's hidden areas)
  function chibiCompose(v) {
    const N = CHIBI_N, px = new Array(N * N).fill(null), owner = new Array(N * N).fill(null);
    for (const id of v.order) for (const [i, c] of v.layers[id] || []) {
      px[i] = c;
      owner[i] = id;
    }
    const hidden = {};
    for (const id of v.order) {
      const m = v.layers[id];
      if (!m) continue;
      const h = new Array(N * N).fill(null);
      let n = 0;
      for (const [i, c] of m) if (owner[i] !== id) {
        h[i] = c;
        n++;
      }
      if (n) hidden[id] = h;
    }
    return { px, owner, hidden };
  }
