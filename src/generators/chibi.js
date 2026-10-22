  // src/generators/chibi.js
  // V7: a chibi character drawn as separate body parts in all 8 directions, from one design. Each part
  // is drawn whole (also where another part covers it), so the rig can move it without holes. The body
  // of the left-facing views is the right-facing one mirrored with left and right parts swapped (the
  // body is symmetric); gear is drawn afterwards in its own hand, so a sword stays in the right hand.
  // 32 px, feet on row 30.
  var CHIBI_N = 32;
  var CHIBI_VERSION = 2;
  var CHIBI_HAIR = ["short", "short", "long", "spiky", "bob", "ponytail", "bun", "bald"];
  var CHIBI_OUTFIT = ["plain", "plain", "tunic", "vest", "stripe"];
  var CHIBI_EYES = ["round", "round", "dot", "tall", "sleepy"];
  var CHIBI_MOUTH = ["line", "smile", "smile", "open"];
  // V7.1: a class sets the gear, headwear and look; "random" picks a class from the shape seed
  var CHIBI_CLASSES = {
    villager: { label: "Villager", hat: ["none", "none", "cap", "headband"], weapon: ["none"], offhand: ["none"] },
    knight: { label: "Knight", hat: ["helmet"], weapon: ["sword"], offhand: ["shield"], outfit: ["tunic", "plain"], shirt: [215, 18, 58] },
    mage: { label: "Mage", hat: ["wizard"], weapon: ["staff"], offhand: ["none"], outfit: ["tunic"], sleeves: "long", shirt: [265, 55, 45] },
    archer: { label: "Archer", hat: ["hood", "cap", "none"], weapon: ["none"], offhand: ["bow"], outfit: ["vest", "plain"], shirt: [110, 40, 42], build: 0 },
    rogue: { label: "Rogue", hat: ["bandana", "hood"], weapon: ["dagger"], offhand: ["none"], outfit: ["vest", "plain"], shirt: [230, 20, 30] },
    warrior: { label: "Warrior", hat: ["headband", "none"], weapon: ["axe", "sword"], offhand: ["none", "shield"], build: 1, sleeves: "short" },
    zombie: { label: "Zombie", hat: ["none"], weapon: ["none"], offhand: ["none"], eyes: ["dot"], mouth: ["open"], skin: "zombie", outfit: ["stripe", "plain"] }
  };
  var CHIBI_RANDOM = ["villager", "villager", "knight", "mage", "archer", "rogue", "warrior", "zombie"];
  // where each view's body is drawn from: its own drawing, or the mirror of the opposite one
  var CHIBI_BASE = { S: "S", N: "N", E: "E", SE: "SE", NE: "NE", W: "E", SW: "SE", NW: "NE" };
  // which way each view faces across the screen: right (1), left (-1), or towards or away from the viewer (0)
  var CHIBI_FACING = { S: 0, N: 0, E: 1, W: -1, SE: 1, SW: -1, NE: 1, NW: -1 };
  var CHIBI_PARTS = ["thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "head", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR"];
  function chibiDesign(shapeSeed, colourSeed, cls = "random") {
    const rs = seedRng("chibi:" + shapeSeed), rc = seedRng("chibi-colour:" + colourSeed);
    const id = CHIBI_CLASSES[cls] ? cls : rs.pick(CHIBI_RANDOM), K = CHIBI_CLASSES[id];
    const fantasy = rc.chance(0.12), skin = K.skin === "zombie" ? rc.pick([FANTASY_SKIN[0], ["#b8c99a", "#8fa874", "#64794f"]]) : fantasy ? rc.pick(FANTASY_SKIN) : rc.pick(SKIN);
    const hairHue = rc.pick([28, 22, 40, 48, 8, 275, 200, 330, 0, 120]);
    const hair = ramp(hairHue, rc.range(35, 75), rc.pick([18, 28, 40, 55, 68]));
    const shirtHue = K.shirt ? K.shirt[0] + rc.range(-12, 12) : rc() * 360;
    const shirt = K.shirt ? ramp(shirtHue, K.shirt[1] + rc.range(-8, 8), K.shirt[2] + rc.range(-5, 5)) : ramp(shirtHue, rc.range(40, 75), rc.range(40, 55));
    const accent = ramp((shirtHue + rc.pick([150, 180, 210])) % 360, rc.range(40, 70), rc.range(45, 60));
    const pants = ramp(rc() * 360, rc.range(15, 45), rc.range(24, 38));
    const shoe = ramp(20 + rc() * 25, 35, 22), hat = ramp(K.shirt ? shirtHue : rc() * 360, rc.range(45, 70), rc.range(35, 50));
    const eye = rc.pick(["#2a1d1a", "#1d2a4a", "#1f3a24", "#3a1d3a"]), wood = ramp(28, 45, 36), gem = ramp(rc() * 360, 85, 58);
    const pick = (list, fallback) => rs.pick(list || fallback);
    return {
      shape: String(shapeSeed),
      colour: String(colourSeed),
      cls: id,
      hair: rs.pick(CHIBI_HAIR),
      hat: pick(K.hat),
      outfit: pick(K.outfit, CHIBI_OUTFIT),
      sleeves: K.sleeves || (rs.chance(0.5) ? "long" : "short"),
      belt: rs.chance(0.6),
      blush: K.skin !== "zombie" && rs.chance(0.4),
      eyes: pick(K.eyes, CHIBI_EYES),
      mouth: pick(K.mouth, CHIBI_MOUTH),
      glasses: K.skin !== "zombie" && rs.chance(0.1),
      freckles: K.skin !== "zombie" && rs.chance(0.15),
      build: K.build ?? (rs.chance(0.25) ? 1 : 0),
      weapon: pick(K.weapon),
      offhand: pick(K.offhand),
      colours: { skin: { hi: skin[0], base: skin[1], sh: skin[2], sh2: mix(skin[2], "#000000", 0.3) }, hair, shirt, accent, pants, shoe, hat, eye, metal: ramp(215, 12, 62), gold: ramp(44, 70, 55), wood, gem }
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
    if (d.belt) for (let x = x0; x <= x1; x++) cv.put("pelvis", x, 23, x === (x0 + x1 >> 1) ? C.gold.base : C.shoe.sh);
  }
  // skin of the head plus hair, for one view; `hairAt(x, y)` says which head pixels are hair
  function chibiHead(cv, d, rows, hairAt, face) {
    const C = d.colours, bald = d.hair === "bald", H = C.hair;
    for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) {
      const hair = !bald && hairAt(x, y);
      if (!hair && y < 6 && !bald) continue;
      if (hair) cv.put("head", x, y, y <= 5 && x < x1 - 2 ? H.hi : x === x1 || y === 16 ? H.sh : H.base);
      else cv.put("head", x, y, x === x1 || y === 16 ? C.skin.sh : y === 6 || x === x0 ? C.skin.hi : C.skin.base);
    }
    if (face) face(C);
  }
  // one eye at column x (w2 wide), in the design's style
  function chibiEye(cv, d, x, w2 = 2) {
    const C = d.colours, dark = mix(C.eye, "#000000", 0.4);
    for (let i = 0; i < w2; i++) {
      const at = (y, c) => cv.put("head", x + i, y, c);
      if (d.eyes === "dot") for (const y of [12, 13]) at(y, dark);
      else if (d.eyes === "sleepy") at(12, dark);
      else if (d.eyes === "tall") for (let y = 10; y <= 13; y++) at(y, y === 11 && i === 0 ? "#ffffff" : y >= 12 ? C.eye : dark);
      else for (let y = 11; y <= 13; y++) at(y, y === 12 && i === 0 ? "#ffffff" : y === 13 ? C.eye : dark);
    }
  }
  function chibiFace(cv, d, eyes, mouth, far = 2) {
    const C = d.colours, put = (x, y, c) => cv.put("head", x, y, c);
    eyes.forEach((x, i) => chibiEye(cv, d, x, i === eyes.length - 1 ? far : 2));
    if (mouth !== null) {
      const lip = d.cls === "zombie" ? mix(C.skin.sh2, "#000000", 0.3) : C.skin.sh;
      if (d.mouth === "open") {
        put(mouth, 15, mix(C.skin.sh2, "#000000", 0.5));
        put(mouth + 1, 15, mix(C.skin.sh2, "#000000", 0.5));
      } else {
        put(mouth, 15, lip);
        put(mouth + 1, 15, lip);
        if (d.mouth === "smile") {
          put(mouth - 1, 14, lip);
          put(mouth + 2, 14, lip);
        }
      }
    }
    if (d.blush) for (const x of [eyes[0] - 1, eyes[eyes.length - 1] + 2]) put(x, 14, mix(C.skin.base, "#ff6f8a", 0.35));
    if (d.freckles) for (const x of [eyes[0], eyes[eyes.length - 1] + 1]) put(x, 15, C.skin.sh);
    if (d.glasses) {
      const g = "#2b2b33";
      for (const x of eyes) for (let i = -1; i <= 2; i++) {
        put(x + i, 10, g);
        put(x + i, 14, g);
      }
      for (const x of eyes) for (const y of [11, 12, 13]) {
        put(x - 1, y, g);
        put(x + 2, y, g);
      }
    }
  }
  // extra hair outside the head outline (spikes, long sides, ponytail, bun) for one view
  function chibiHairExtra(cv, d, view) {
    const H = d.colours.hair, put = (x, y, c = H.base) => cv.put("head", x, y, c);
    const covered = d.hat === "helmet" || d.hat === "wizard" || d.hat === "hood";
    if (d.hair === "spiky" && !covered) for (const [x, y] of [[11, 4], [12, 3], [13, 4], [15, 4], [16, 3], [17, 3], [18, 4], [20, 4], [21, 4]]) put(x, y, y === 3 ? H.hi : H.base);
    if (d.hair === "bun" && !covered) for (const [x, y] of [[14, 3], [15, 3], [16, 3], [17, 3], [13, 4], [14, 4], [15, 4], [16, 4], [17, 4], [18, 4]]) put(x, y, y < 4 ? H.hi : H.base);
    if (d.hair === "long" && d.hat !== "hood") {
      const sides = { S: [[8, 9], [22, 23]], N: [[8, 23]], E: [[8, 11]], SE: [[8, 9], [23, 23]], NE: [[8, 21]] }[view];
      for (const [a, b] of sides) for (let x = a; x <= b; x++) for (let y = 8; y <= 20; y++) if (view === "N" || view === "NE" || view === "E" || y >= 10 || x === 8 || x === 23) put(x, y, x === b && b > 20 ? H.sh : y >= 19 ? H.sh : H.base);
    }
    if (d.hair === "ponytail" && d.hat !== "hood") {
      const tail = { N: [[15, 16]], NE: [[13, 14]], E: [[7, 8]], SE: [[8, 8]], S: [] }[view];
      for (const [a, b] of tail) for (let x = a; x <= b; x++) for (let y = 9; y <= 19; y++) put(x, y, y > 16 ? H.sh : H.base);
    }
    if (d.hair === "bob" && d.hat !== "hood" && d.hat !== "helmet") {
      const sides = { S: [8, 23], SE: [8, 23], E: [8, null], NE: [8, 23], N: [8, 23] }[view];
      for (let y = 8; y <= 15; y++) {
        if (sides[0] !== null) put(sides[0], y, H.base);
        if (sides[1] !== null) put(sides[1], y, H.sh);
      }
    }
  }
  // V7.1: headwear, drawn over the head for one view
  function chibiHat(cv, d, view) {
    const C = d.colours, put = (x, y, c) => cv.put("head", x, y, c), rows = view === "E" ? CHIBI_SIDE_HEAD : CHIBI_HEAD;
    const shade = (r, x, y, x1) => y <= 4 && x < x1 - 2 ? r.hi : x === x1 ? r.sh : r.base;
    const over = (r, test) => {
      for (const [y, x0, x1] of rows) for (let x = x0; x <= x1; x++) if (test(x, y)) put(x, y, shade(r, x, y, x1));
    };
    const hat = d.hat;
    if (hat === "cap") {
      over(C.hat, (x, y) => y <= 7);
      // the brim points the way the character faces
      const brim = { S: [8, 23], N: null, E: [16, 24], SE: [10, 24], NE: [18, 23] }[view];
      if (brim) for (let x = brim[0]; x <= brim[1]; x++) put(x, 8, C.hat.sh);
    } else if (hat === "helmet") {
      const M = C.metal;
      over(M, { S: (x, y) => y <= 8 || (x <= 9 || x >= 22) && y <= 12, N: (x, y) => y <= 13, E: (x, y) => y <= 8 || x <= 14 && y <= 13, SE: (x, y) => y <= 8 || x <= 11 && y <= 12, NE: (x, y) => !(x >= 20 && y >= 9) }[view]);
      for (let x = 12; x <= 19; x++) put(x, 3, M.hi);
      if (view === "S") for (const y of [9, 10]) put(15, y, M.sh), put(16, y, M.sh);
      if (view === "SE") for (const y of [9, 10]) put(18, y, M.sh);
      if (view !== "N" && view !== "NE") for (let x = view === "E" ? 9 : 9; x <= (view === "E" ? 21 : 22); x++) put(x, 8, M.sh);
    } else if (hat === "wizard") {
      const H = C.hat, tip = view === "E" ? 1 : view === "N" || view === "NE" ? 0 : 0;
      // nothing above row 3: a run lifts the body up to 3 px, and the sprite has no room above row 0
      const cone = [[3, 13, 16], [4, 11, 19], [5, 10, 21]];
      for (const [y, a, b] of cone) for (let x = a + tip; x <= b + tip; x++) put(x, y, x === b + tip ? H.sh : y === 4 ? C.gold.base : x === a + tip ? H.hi : H.base);
      for (let x = 7; x <= 24; x++) put(x, 6, x === 24 ? H.sh2 : H.sh);
    } else if (hat === "hood") {
      const H = C.hat;
      over(H, { S: (x, y) => y <= 7 || x <= 10 || x >= 21, N: () => true, E: (x, y) => y <= 7 || x <= 14, SE: (x, y) => y <= 7 || x <= 11 || x >= 22, NE: (x, y) => !(x >= 20 && y >= 9) }[view]);
      for (let y = 8; y <= 17; y++) for (const x of { S: [8, 23], N: [8, 23], E: [8], SE: [8, 23], NE: [8, 23] }[view]) put(x, y, x > 20 ? H.sh : H.base);
    } else if (hat === "headband" || hat === "bandana") {
      const A = C.accent, top = hat === "bandana";
      if (top) over(A, (x, y) => y <= 6);
      for (const [y, x0, x1] of rows) if (y === 7) for (let x = x0; x <= x1; x++) put(x, y, x === x1 ? A.sh : A.base);
      const knot = { N: [[15, 8], [16, 8], [15, 9], [16, 10]], NE: [[13, 8], [13, 9], [12, 10]], E: [[8, 7], [8, 8], [7, 8], [8, 9]], SE: [[8, 8], [8, 9]], S: [] }[view];
      for (const [x, y] of knot) put(x, y, A.sh);
    }
  }
  // which head pixels are hair: per view and style
  function chibiHairMask(d, view) {
    const len = d.hair === "long" || d.hair === "bob" ? 14 : 11;
    return {
      S: (x, y) => y <= 7 || y === 8 && x % 3 !== 1 || (x <= 9 || x >= 22) && y <= len,
      N: (x, y) => y <= 15,
      E: (x, y) => y <= 7 || x <= 15 && y <= (d.hair === "short" || d.hair === "spiky" ? 13 : 15) || y === 8 && x >= 16 && x <= 20 && x % 2 === 0,
      SE: (x, y) => y <= 7 || y === 8 && x % 3 !== 2 || x <= 12 && y <= Math.max(len, 12) || x >= 22 && y <= 9,
      NE: (x, y) => !(x >= 20 && y >= 10 && y <= 15)
    }[view];
  }
  function chibiDraw(d, view) {
    const cv = chibiCanvas(), C = d.colours, w2 = d.build || 0;
    const head = (rows, face) => {
      chibiHead(cv, d, rows, chibiHairMask(d, view), face);
      chibiHairExtra(cv, d, view);
      chibiHat(cv, d, view);
    };
    let order, pivots;
    if (view === "S" || view === "N") {
      const back = view === "N", R = back ? 21 + w2 : 9 - w2, Lx = back ? 9 - w2 : 21 + w2;
      chibiLeg(cv, back ? "L" : "R", 12, C);
      chibiLeg(cv, back ? "R" : "L", 16, C);
      chibiBody(cv, d, 11 - w2, 20 + w2, { collar: back ? null : 15 });
      chibiArm(cv, "R", R, d);
      chibiArm(cv, "L", Lx, d);
      head(CHIBI_HEAD, back ? null : () => chibiFace(cv, d, [12, 18], 15));
      order = ["thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR", "head"];
      pivots = { R: R + 1, L: Lx + 1, legR: back ? 18 : 14, legL: back ? 14 : 18 };
    } else if (view === "E") {
      chibiLeg(cv, "L", 13, C, { far: true, toe: 1 });
      chibiArm(cv, "L", 16, d, { far: true });
      chibiLeg(cv, "R", 15, C, { toe: 1 });
      chibiBody(cv, d, 12 - w2, 19);
      chibiArm(cv, "R", 15, d, { edge: 14 });
      head(CHIBI_SIDE_HEAD, () => chibiFace(cv, d, [18], null));
      order = ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "head", "upperArmR", "forearmR", "handR"];
      pivots = { R: 16, L: 17, legR: 17, legL: 15 };
    } else if (view === "SE") {
      chibiLeg(cv, "L", 16, C, { far: true, toe: 1 });
      chibiArm(cv, "L", 20 + w2, d, { far: true });
      chibiLeg(cv, "R", 12, C, { toe: 1 });
      chibiBody(cv, d, 11 - w2, 19 + w2, { collar: 16 });
      chibiArm(cv, "R", 9 - w2, d);
      head(CHIBI_HEAD, () => chibiFace(cv, d, [15, 20], 18, 1));
      order = ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "upperArmR", "forearmR", "handR", "head"];
      pivots = { R: 10 - w2, L: 21 + w2, legR: 14, legL: 18 };
    } else {
      chibiLeg(cv, "L", 12, C, { far: true, toe: 1 });
      chibiArm(cv, "L", 10 - w2, d, { far: true });
      chibiLeg(cv, "R", 16, C, { toe: 1 });
      chibiBody(cv, d, 12 - w2, 20 + w2);
      chibiArm(cv, "R", 21 + w2, d);
      head(CHIBI_HEAD, null);
      order = ["upperArmL", "forearmL", "handL", "thighL", "shinL", "footL", "thighR", "shinR", "footR", "pelvis", "torso", "upperArmR", "forearmR", "handR", "head"];
      pivots = { R: 22 + w2, L: 11 - w2, legR: 18, legL: 14 };
    }
    // joints in sprite pixels (edges between pixels): shoulder, elbow, wrist; hip, knee, ankle; neck, waist
    const joints = { pelvis: [16, 24], torso: [16, 23], head: [16, 17] };
    for (const s of ["L", "R"]) {
      const ax = pivots[s];
      Object.assign(joints, { ["upperArm" + s]: [ax, 17.5], ["forearm" + s]: [ax, 21], ["hand" + s]: [ax, 23] });
      const lx = pivots["leg" + s];
      Object.assign(joints, { ["thigh" + s]: [lx, 25], ["shin" + s]: [lx, 27], ["foot" + s]: [lx, 29] });
    }
    return { layers: cv.layers, order, joints };
  }
  const swapSide = (id) => id.replace(/([LR])$/, (m, s) => s === "L" ? "R" : "L");
  // V7.1: weapons in the right hand, a shield or a bow in the left, drawn into the finished view so each
  // stays in its own hand; gear on a hand behind the body is drawn behind it
  function chibiGear(d, dir, v) {
    const N = CHIBI_N, C = d.colours, f = CHIBI_FACING[dir], layers = v.layers, joints = { ...v.joints }, order = v.order.slice();
    const box = (id) => {
      let x0 = N, x1 = -1;
      for (const i of layers[id].keys()) {
        x0 = Math.min(x0, i % N);
        x1 = Math.max(x1, i % N);
      }
      return { x0, x1, out: x0 + x1 < N - 1 ? -1 : 1 };
    };
    const put = (id, x, y, c) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      (layers[id] = layers[id] || /* @__PURE__ */ new Map()).set(y * N + x, c);
    };
    const near = (s) => order.indexOf("hand" + s) > order.indexOf("torso");
    if (d.weapon !== "none") {
      const h = box("handR"), M = C.metal, W = C.wood, side = f !== 0 && Math.abs(f) === 1 && (dir === "E" || dir === "W");
      const col = h.out < 0 ? h.x0 : h.x1;
      if (d.weapon === "staff") {
        // taller than the character, a gem on top: upright beside the body, or from the side leaning
        // forwards through the fist so it passes in front of the face
        const at = (y) => side ? Math.round((f > 0 ? h.x1 : h.x0) + f * (24 - y) / 2) : col + h.out;
        // its foot stops short of the ground row: the idle sway and the body's bob move it down
        for (let y = side ? 9 : 7; y <= (side ? 28 : 29); y++) put("weapon", at(y), y, y % 4 === 0 ? W.sh : W.base);
        const top = side ? 8 : 6, gx = at(top);
        for (const [dx, dy] of [[0, 0], [-1, -1], [0, -1], [1, -1], [0, -2]]) put("weapon", gx + dx, top + dy, dy === -2 ? C.gem.hi : C.gem.base);
      } else if (side) {
        // held forwards, level with the hand
        const g = f > 0 ? h.x1 + 1 : h.x0 - 1, len = d.weapon === "dagger" ? 3 : 6;
        for (let y = 23; y <= 25; y++) put("weapon", g, y, d.weapon === "axe" ? W.base : C.gold.base);
        for (let k = 1; k <= len; k++) put("weapon", g + f * k, 24, d.weapon === "axe" && k < len - 1 ? W.base : k === len ? M.hi : M.base);
        if (d.weapon === "axe") for (const [dx, dy] of [[len - 1, -2], [len - 1, -1], [len, -1], [len - 1, 0], [len, 0], [len - 1, 1], [len, 1], [len - 1, 2]]) put("weapon", g + f * dx, 24 + dy, dy < 0 ? M.hi : M.base);
      } else {
        // point down at the side: a pommel above the fist, a guard below it, the blade down to the ground
        const len = d.weapon === "dagger" ? 2 : 4;
        put("weapon", col, 22, C.gold.base);
        for (const y of [23, 24]) put("weapon", col, y, W.base);
        if (d.weapon === "axe") {
          for (let y = 25; y <= 28; y++) put("weapon", col, y, W.base);
          for (const [dx, dy] of [[1, 26], [1, 27], [1, 28], [2, 27]]) put("weapon", col + h.out * dx, dy, dy === 26 ? M.hi : M.base);
        } else {
          for (const dx of [-1, 0, 1]) put("weapon", col + dx, 25, C.gold.sh);
          for (let k = 1; k <= len; k++) put("weapon", col, 25 + k, k === len ? M.sh : M.hi);
        }
      }
      joints.weapon = [col + 0.5, 24];
      order.splice(order.indexOf("upperArmR"), 0, "weapon");
    }
    if (d.offhand !== "none") {
      const h = box("handL"), id = d.offhand === "shield" ? "shield" : "bow", side = dir === "E" || dir === "W";
      if (d.offhand === "shield") {
        const x0 = side ? (f > 0 ? h.x1 + 1 : h.x0 - 3) : h.out < 0 ? h.x0 - 2 : h.x1 - 1, M = C.metal, A = C.accent;
        for (let y = 20; y <= 26; y++) for (let x = x0; x < x0 + 4; x++) {
          const rim = y === 20 || y === 26 || x === x0 || x === x0 + 3;
          if ((y === 26) && (x === x0 || x === x0 + 3)) continue;
          put(id, x, y, rim ? (x === x0 + 3 ? M.sh : M.base) : near("L") || side ? A.base : A.sh);
        }
        put(id, x0 + 1, 22, C.gold.base);
        put(id, x0 + 2, 22, C.gold.base);
        put(id, x0 + 1, 23, C.gold.sh);
        put(id, x0 + 2, 23, C.gold.sh);
      } else {
        // a bow, held upright: seen edge-on from the front and back, from the side with its string
        // next to the fist and the wood beyond it
        const W = C.wood, o = side ? f : h.out, x = side ? (f > 0 ? h.x1 + 2 : h.x0 - 2) : h.out < 0 ? h.x1 : h.x0;
        for (let y = 20; y <= 27; y++) put(id, x, y, W.base);
        put(id, x + o, 19, W.sh);
        put(id, x + o, 28, W.sh);
        if (side) for (let y = 20; y <= 27; y++) put(id, x - o, y, "#e8e2d0");
      }
      joints[id] = [(d.offhand === "shield" ? (h.x0 + h.x1 + 1) / 2 : (h.x0 + h.x1 + 1) / 2), 24];
      // a shield is worn on the outside of the arm, in front of it; a bow is behind the fist
      order.splice(d.offhand === "shield" ? order.indexOf("handL") + 1 : order.indexOf("upperArmL"), 0, id);
    }
    return { layers, order, joints };
  }
  // one finished view: the drawing for `dir`, mirrored for the left-facing ones, with its gear
  function chibiView(d, dir) {
    const base = CHIBI_BASE[dir], v = chibiDraw(d, base);
    if (base === dir) return chibiGear(d, dir, v);
    const N = CHIBI_N, layers = {}, joints = {};
    for (const [id, m] of Object.entries(v.layers)) {
      const out = /* @__PURE__ */ new Map();
      for (const [i, c] of m) out.set((i / N | 0) * N + (N - 1 - i % N), c);
      layers[swapSide(id)] = out;
    }
    for (const [id, [x, y]] of Object.entries(v.joints)) joints[swapSide(id)] = [N - x, y];
    return chibiGear(d, dir, { layers, order: v.order.map(swapSide), joints });
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
