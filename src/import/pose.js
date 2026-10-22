  // src/import/pose.js
  // V8.0b: body parts and joints from a body pose. A pose is 33 landmarks (MediaPipe Pose: normalised
  // x, y and a visibility), found by a model in the browser or clicked by a person. The joints become
  // the rig's pivots; every pixel of the character goes to the body part whose bone it is nearest to,
  // limbs first (an arm across the chest is in front of it).
  // Landmark numbers (MediaPipe): 0 nose, 7/8 ears, 11/12 shoulders, 13/14 elbows, 15/16 wrists,
  // 17/18 pinkies, 19/20 index fingers, 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 toes.
  // Odd numbers are the person's left. The app's L and R are the sides of the picture (L on the left).
  var POSE_SIDE = {
    a: { shoulder: 11, elbow: 13, wrist: 15, pinky: 17, index: 19, hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31, ear: 7 },
    b: { shoulder: 12, elbow: 14, wrist: 16, pinky: 18, index: 20, hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32, ear: 8 }
  };
  // the joints a person is asked to click (C) when the model finds no pose or is unsure, in this order
  var POSE_CLICKS = [
    ["head", "the top of the head"], ["neck", "the neck"],
    ["shoulderL", "the shoulder on the left of the picture"], ["elbowL", "the elbow on the left"], ["wristL", "the wrist on the left"],
    ["shoulderR", "the shoulder on the right of the picture"], ["elbowR", "the elbow on the right"], ["wristR", "the wrist on the right"],
    ["hipL", "the hip on the left"], ["kneeL", "the knee on the left"], ["ankleL", "the ankle on the left"],
    ["hipR", "the hip on the right"], ["kneeR", "the knee on the right"], ["ankleR", "the ankle on the right"]
  ];
  var POSE_KEY = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"];
  var POSE_MIN_VIS = 0.5;
  const pAdd = (a, b) => [a[0] + b[0], a[1] + b[1]], pSub = (a, b) => [a[0] - b[0], a[1] - b[1]], pMul = (a, k) => [a[0] * k, a[1] * k];
  const pMid = (a, b) => pMul(pAdd(a, b), 0.5), pLen = (a) => Math.hypot(a[0], a[1]);
  // landmarks (normalised to the image) -> named joints in work pixels, L and R by side of the picture
  function poseJoints(lm, S) {
    const at = (i) => [lm[i].x * S, lm[i].y * S], vis = (i) => lm[i].visibility == null ? 1 : lm[i].visibility;
    const side = (s) => Object.fromEntries(Object.entries(POSE_SIDE[s]).map(([k, i]) => [k, at(i)]));
    const a = side("a"), b = side("b"), ax = a.shoulder[0] + a.hip[0], bx = b.shoulder[0] + b.hip[0];
    const [L, R, sL, sR] = ax < bx ? [a, b, "a", "b"] : [b, a, "b", "a"];
    const key = [...POSE_KEY.map((k) => POSE_SIDE[sL][k]), ...POSE_KEY.map((k) => POSE_SIDE[sR][k])];
    const tip = (s) => pAdd(s.wrist, pMul(pSub(pMid(s.index, s.pinky), s.wrist), 1.6));
    const ears = pMid(L.ear, R.ear), neck = pMid(L.shoulder, R.shoulder), nose = at(0);
    // the head: from the ears up by as much as from the shoulders to the ears (hair on top)
    const headC = pMid(ears, nose), up = pSub(headC, neck), head = pAdd(headC, pMul(up, 0.8));
    const j = { head, headC, neck, vis: Math.min(...key.map(vis)) };
    for (const [s, X] of [["L", L], ["R", R]]) {
      for (const k of ["shoulder", "elbow", "wrist", "hip", "knee", "ankle", "heel", "toe"]) j[k + s] = X[k];
      j["hand" + s] = tip(X);
    }
    return j;
  }
  // clicked joints (C) -> the same named joints; hands and feet are guessed from the arm and leg
  function clickedJoints(pts) {
    const j = { ...pts, vis: 1 };
    j.headC = pAdd(pts.head, pMul(pSub(pts.neck, pts.head), 0.45));
    for (const s of ["L", "R"]) {
      j["hand" + s] = pAdd(pts["wrist" + s], pMul(pSub(pts["wrist" + s], pts["elbow" + s]), 0.45));
      const shin = pSub(pts["ankle" + s], pts["knee" + s]), out = s === "L" ? -1 : 1;
      j["heel" + s] = pAdd(pts["ankle" + s], pMul(shin, 0.12));
      j["toe" + s] = pAdd(j["heel" + s], [out * pLen(shin) * 0.3, 0]);
    }
    return j;
  }
  // the clickable joints of a pose (to show and drag them)
  const poseClickPoints = (j) => Object.fromEntries(POSE_CLICKS.map(([k]) => [k, j[k].slice()]));
  // is the pose usable? (found, sure enough, upright enough to animate)
  function poseProblem(j) {
    if (!j) return "no body was found in the picture";
    if (j.vis < POSE_MIN_VIS) return `the model is unsure of some joints (${Math.round(j.vis * 100)}% sure)`;
    const hips = pMid(j.hipL, j.hipR);
    if (!(hips[1] > j.neck[1])) return "the body is not upright (the hips are not below the shoulders)";
    if (pLen(pSub(j.shoulderL, j.shoulderR)) < 2) return "the shoulders are on top of each other";
    return "";
  }
  function segDist(p, a, b) {
    const ab = pSub(b, a), l2 = ab[0] * ab[0] + ab[1] * ab[1], t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2)) : 0;
    return pLen(pSub(p, pAdd(a, pMul(ab, t))));
  }
  // signed distance to a convex polygon (negative inside)
  function polyDist(p, poly) {
    let inside = true, d = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], e = pSub(b, a), w = pSub(p, a);
      if (e[0] * w[1] - e[1] * w[0] < 0) inside = false;
      d = Math.min(d, segDist(p, a, b));
    }
    return inside ? -d : d;
  }
  // which part each opaque pixel belongs to: ids in a work-sized array (null for background)
  function posePartMap(j, alpha, S) {
    const u = Math.max(pLen(pSub(j.shoulderL, j.shoulderR)), pLen(pSub(j.hipL, j.hipR)) * 1.3, S * 0.05);
    const limbs = [];
    for (const s of ["L", "R"]) limbs.push(
      ["hand" + s, j["wrist" + s], j["hand" + s], 0.17 * u],
      ["forearm" + s, j["elbow" + s], j["wrist" + s], 0.17 * u],
      ["upperArm" + s, j["shoulder" + s], j["elbow" + s], 0.2 * u],
      ["foot" + s, j["ankle" + s], j["toe" + s], 0.16 * u],
      ["shin" + s, j["knee" + s], j["ankle" + s], 0.22 * u],
      ["thigh" + s, j["hip" + s], j["knee" + s], 0.28 * u]
    );
    const neckTop = pAdd(j.neck, pMul(pSub(j.headC, j.neck), 0.35));
    const head = ["head", neckTop, j.head, 0.5 * u];
    // the trunk: shoulders to hips, a little wider; the pelvis is its lowest quarter and below
    const o = (p, q, k) => pAdd(p, pMul(pSub(p, q), k));
    const sL = o(j.shoulderL, j.shoulderR, 0.05), sR = o(j.shoulderR, j.shoulderL, 0.05), hL = o(j.hipL, j.hipR, 0.25), hR = o(j.hipR, j.hipL, 0.25);
    const trunk = [sL, sR, hR, hL], waist = pAdd(pMid(sL, sR), pMul(pSub(pMid(hL, hR), pMid(sL, sR)), 0.78));
    const down = pSub(pMid(hL, hR), pMid(sL, sR));
    const out = new Array(S * S).fill(null);
    for (let t = 0; t < S * S; t++) {
      if (alpha[t * 4 + 3] < 128) continue;
      const p = [t % S + 0.5, (t / S | 0) + 0.5];
      let best = null, cost = Infinity;
      // limbs and the head in front, in this order, when the pixel is on them
      for (const [id, a, b, r] of [...limbs, head]) {
        const c = segDist(p, a, b) / r;
        if (c < 1 && !best) best = id;
        if (c < cost) cost = c;
      }
      if (best) {
        out[t] = best;
        continue;
      }
      const td = polyDist(p, trunk) / (0.35 * u), below = (p[0] - waist[0]) * down[0] + (p[1] - waist[1]) * down[1] > 0;
      if (td <= 0 || td < cost) {
        out[t] = below ? "pelvis" : "torso";
        continue;
      }
      // anything else (a coat tail, a sleeve, hair): the nearest part
      let near = null, nc = Infinity;
      for (const [id, a, b, r] of [...limbs, head]) {
        const c = segDist(p, a, b) / r;
        if (c < nc) {
          nc = c;
          near = id;
        }
      }
      out[t] = near;
    }
    return out;
  }
  // the rig's pivots in work pixels: each part turns about the joint it hangs from
  function posePivots(j) {
    const hips = pMid(j.hipL, j.hipR);
    const piv = { pelvis: hips, torso: pAdd(hips, pMul(pSub(j.neck, hips), 0.22)), head: pAdd(j.neck, pMul(pSub(j.headC, j.neck), 0.25)) };
    for (const s of ["L", "R"]) Object.assign(piv, {
      ["upperArm" + s]: j["shoulder" + s], ["forearm" + s]: j["elbow" + s], ["hand" + s]: j["wrist" + s],
      ["thigh" + s]: j["hip" + s], ["shin" + s]: j["knee" + s], ["foot" + s]: j["ankle" + s]
    });
    return Object.fromEntries(Object.entries(piv).map(([k, v]) => [k, [Math.round(v[0]), Math.round(v[1])]]));
  }
  // a segmentation (step 4) from the part map; parts without pixels are kept (the weapon) but empty
  function poseSegmentation(j, rgba, S) {
    const seg2 = newSegmentation(rgba, S), ids = posePartMap(j, rgba, S);
    for (let t = 0; t < S * S; t++) if (seg2.map[t]) seg2.map[t] = partIndex(seg2, ids[t]) || UNASSIGNED;
    return seg2;
  }
  // a rig whose pivots are the pose's joints (fixed: they do not follow later part edits)
  function poseRig(seg2, j, prev = null) {
    const rig = syncRig(seg2, prev), piv = posePivots(j);
    for (const [id, p] of Object.entries(piv)) if (rig.bones[id]) rig.bones[id] = { ...rig.bones[id], pivot: p, auto: false };
    return rig;
  }
