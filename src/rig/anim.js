  // src/rig/anim.js
  var EASES = ["linear", "easeInOut", "step", "easeIn", "easeOut", "curve"];
  var FACINGS = ["right", "left", "front"];
  var ANIM_NAME = /^[a-z][a-z0-9_-]{0,23}$/;
  function bezier([x1, y1, x2, y2], u) {
    const at = (a, b, t2) => 3 * a * t2 * (1 - t2) ** 2 + 3 * b * t2 * t2 * (1 - t2) + t2 ** 3;
    let lo = 0, hi = 1, t = u;
    for (let k = 0; k < 40; k++) {
      t = (lo + hi) / 2;
      if (at(x1, x2, t) < u) lo = t;
      else hi = t;
    }
    return at(y1, y2, t);
  }
  var easeOf = (key, u) => {
    const kind = key.ease;
    return kind === "step" ? 0 : kind === "easeInOut" ? u * u * (3 - 2 * u) : kind === "easeIn" ? u * u : kind === "easeOut" ? 1 - (1 - u) ** 2 : kind === "curve" && key.curve ? bezier(key.curve, u) : u;
  };
  var progress = (k, d, span) => {
    const h = Math.min(k.hold || 0, span - 1);
    return d <= h ? 0 : easeOf(k, (d - h) / (span - h));
  };
  var r1 = (v) => Math.round(v * 10) / 10;
  var emptyPose = () => ({ rot: {}, off: {}, root: [0, 0] });
  function clonePose(p) {
    const out = { rot: { ...p.rot || {} }, off: Object.fromEntries(Object.entries(p.off || {}).map(([k, v]) => [k, v.slice()])), root: (p.root || [0, 0]).slice() };
    if (p.swap && Object.keys(p.swap).length) out.swap = { ...p.swap };
    if (p.tilt) out.tilt = p.tilt;
    if (p.flash) out.flash = true;
    if (p.smear && Object.keys(p.smear).length) out.smear = { ...p.smear };
    if (p.order && Object.keys(p.order).length) out.order = { ...p.order };
    return out;
  }
  function lerpPose(a, b, u) {
    const out = emptyPose();
    for (const id of /* @__PURE__ */ new Set([...Object.keys(a.rot || {}), ...Object.keys(b.rot || {})])) {
      const x = (a.rot || {})[id] || 0, y = (b.rot || {})[id] || 0, d = ((y - x) % 360 + 540) % 360 - 180;
      const v = r1(x + d * u);
      if (v) out.rot[id] = v;
    }
    for (const id of /* @__PURE__ */ new Set([...Object.keys(a.off || {}), ...Object.keys(b.off || {})])) {
      const x = (a.off || {})[id] || [0, 0], y = (b.off || {})[id] || [0, 0], v = [r1(x[0] + (y[0] - x[0]) * u), r1(x[1] + (y[1] - x[1]) * u)];
      if (v[0] || v[1]) out.off[id] = v;
    }
    const ra = a.root || [0, 0], rb = b.root || [0, 0];
    out.root = [Math.round(ra[0] + (rb[0] - ra[0]) * u), Math.round(ra[1] + (rb[1] - ra[1]) * u)];
    if (a.swap && Object.keys(a.swap).length) out.swap = { ...a.swap };
    if (a.order && Object.keys(a.order).length) out.order = { ...a.order };
    const ta = a.tilt || 0, tb = b.tilt || 0, dt = ((tb - ta) % 360 + 540) % 360 - 180, tilt = r1(ta + dt * u);
    if (tilt) out.tilt = tilt;
    return out;
  }
  var MAX_FOLLOW_DELAY = 8;
  var MAX_FOLLOW_AMOUNT = 2;
  function samplePose(anim2, i) {
    const base = keyedPose(anim2, i);
    if (anim2.smooth) base.smooth = true;
    if (!anim2.follow || !Object.keys(anim2.follow).length) return base;
    for (const [id, f] of Object.entries(anim2.follow)) {
      const j = anim2.loop ? ((i - f.delay) % anim2.frames + anim2.frames) % anim2.frames : Math.max(0, i - f.delay);
      const then = keyedPose(anim2, j), turn = (p) => f.from.reduce((t, a) => t + ((p.rot || {})[a] || 0), 0);
      const lag = ((turn(then) - turn(base)) % 360 + 540) % 360 - 180, v = r1((base.rot[id] || 0) + f.amount * lag);
      if (v) base.rot[id] = v;
      else delete base.rot[id];
    }
    return base;
  }
  function setFollow(anim2, rig, id, { delay = 2, amount = 1 } = {}) {
    const follow = { ...anim2.follow || {} };
    const from = [];
    for (let b = rig.bones[id] && rig.bones[id].parent; b && rig.bones[b] && !from.includes(b); b = rig.bones[b].parent) from.push(b);
    delete follow[id];
    if (from.length && amount > 0) follow[id] = { from, delay: Math.max(1, Math.min(MAX_FOLLOW_DELAY, Math.round(delay))), amount: Math.min(MAX_FOLLOW_AMOUNT, r1(amount)) };
    const out = { ...anim2, follow };
    if (!Object.keys(follow).length) delete out.follow;
    return out;
  }
  function keyedPose(anim2, i) {
    const keys = anim2.keys;
    if (!keys.length) return emptyPose();
    let k0 = null, k1 = null;
    for (const k of keys) {
      if (k.t <= i) k0 = k;
      else if (!k1) k1 = k;
    }
    if (!k0) {
      if (!anim2.loop) return clonePose(keys[0].pose);
      k0 = keys[keys.length - 1];
      const span = keys[0].t + anim2.frames - k0.t;
      return lerpPose(k0.pose, keys[0].pose, progress(k0, i + anim2.frames - k0.t, span));
    }
    if (k0.t === i) return clonePose(k0.pose);
    if (!k1) {
      if (!anim2.loop || keys.length === 1) return clonePose(k0.pose);
      const span = keys[0].t + anim2.frames - k0.t;
      return lerpPose(k0.pose, keys[0].pose, progress(k0, i - k0.t, span));
    }
    return lerpPose(k0.pose, k1.pose, progress(k0, i - k0.t, k1.t - k0.t));
  }
  var sampleAnim = (anim2) => Array.from({ length: anim2.frames }, (_, i) => {
    const pose2 = samplePose(anim2, i);
    return pose2.flash ? { pose: pose2, flash: true } : { pose: pose2 };
  });
  function setKey(anim2, t, pose2, easeKind) {
    const old = anim2.keys.find((k) => k.t === t);
    const key = { t, ease: easeKind || (old ? old.ease : "easeInOut"), pose: clonePose(pose2) };
    if (old && old.hold) key.hold = old.hold;
    if (key.ease === "curve") key.curve = old && old.curve ? old.curve.slice() : [0.42, 0, 0.58, 1];
    return { ...anim2, keys: [...anim2.keys.filter((k) => k.t !== t), key].sort((a, b) => a.t - b.t) };
  }
  function setKeyTiming(anim2, t, { hold, curve } = {}) {
    return { ...anim2, keys: anim2.keys.map((k) => {
      if (k.t !== t) return k;
      const n = { ...k };
      if (hold !== void 0) {
        const h = Math.max(0, Math.min(63, Math.round(hold) || 0));
        if (h) n.hold = h;
        else delete n.hold;
      }
      if (curve !== void 0 && k.ease === "curve") n.curve = [clamp01(curve[0]), curve[1], clamp01(curve[2]), curve[3]];
      return n;
    }) };
  }
  var clamp01 = (v) => Math.max(0, Math.min(1, v));
  var deleteKey = (anim2, t) => anim2.keys.length > 1 ? { ...anim2, keys: anim2.keys.filter((k) => k.t !== t) } : anim2;
  function setFrames(anim2, n) {
    n = Math.max(1, Math.min(64, Math.round(n)));
    const keys = anim2.keys.filter((k) => k.t < n);
    return { ...anim2, frames: n, keys: keys.length ? keys : [{ ...anim2.keys[0], t: 0 }] };
  }
  function retime(anim2, n) {
    const keys = anim2.keys, count = keys.length;
    n = Math.min(64, Math.max(count, 1, Math.round(n)));
    if (n === anim2.frames) return anim2;
    const last = keys[count - 1].t, end = !anim2.loop && anim2.frames > 1 && last === anim2.frames - 1;
    const ts = keys.map((k) => Math.round(end ? k.t * (n - 1) / (anim2.frames - 1) : k.t * n / anim2.frames));
    for (let i = 1; i < count; i++) if (ts[i] <= ts[i - 1]) ts[i] = ts[i - 1] + 1;
    for (let i = count - 1; i >= 0; i--) ts[i] = Math.min(ts[i], n - count + i);
    return { ...anim2, frames: n, keys: keys.map((k, i) => {
      const out = { ...k, t: ts[i] };
      if (k.hold) {
        const h = Math.round(k.hold * n / anim2.frames);
        if (h) out.hold = h;
        else delete out.hold;
      }
      return out;
    }) };
  }
  function mirrorPose(p) {
    const swap = (id) => id.replace(/([LR])(Back)?$/, (m, s, b) => (s === "L" ? "R" : "L") + (b || ""));
    const out = emptyPose();
    for (const [id, v] of Object.entries(p.rot || {})) out.rot[swap(id)] = v;
    for (const [id, v] of Object.entries(p.off || {})) out.off[swap(id)] = v.slice();
    out.root = (p.root || [0, 0]).slice();
    if (p.swap) {
      out.swap = {};
      for (const [id, v] of Object.entries(p.swap)) out.swap[swap(id)] = v;
    }
    if (p.tilt) out.tilt = p.tilt;
    if (p.flash) out.flash = true;
    if (p.smear) {
      out.smear = {};
      for (const [id, v] of Object.entries(p.smear)) out.smear[swap(id)] = v;
    }
    return out;
  }
  var has = (rig, id) => !!rig.bones[id];
  function grounded(rig, info, p, extra = 0) {
    const planted = legLift(rig, info, p.rot, "L") <= legLift(rig, info, p.rot, "R") ? "L" : "R", rot = { ...p.rot };
    if (rig.bones["foot" + planted] && extra >= 0) {
      const v = r1(-((rot["thigh" + planted] || 0) + (rot["shin" + planted] || 0)));
      if (v) rot["foot" + planted] = v;
      else delete rot["foot" + planted];
    }
    return { ...p, rot, root: [p.root[0], p.root[1] + sink(rig, info, p.rot) + extra] };
  }
  function pose(rig, rot = {}, off2 = {}, root = [0, 0]) {
    const p = emptyPose();
    for (const [id, v] of Object.entries(rot)) if (has(rig, id) && v) p.rot[id] = r1(v);
    for (const [id, v] of Object.entries(off2)) if (has(rig, id) && (v[0] || v[1])) p.off[id] = v.slice();
    p.root = root.slice();
    return p;
  }
  var D = (facing) => facing === "left" ? -1 : 1;
  function presetIdle(rig, facing = "right") {
    const d = D(facing);
    return { frames: 6, fps: 6, loop: true, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig) },
      { t: 1, ease: "easeInOut", pose: pose(rig, { upperArmL: 2 * d, upperArmR: -2 * d }, { torso: [0, 2] }) },
      { t: 2, ease: "easeInOut", pose: pose(rig, { upperArmL: 4 * d, upperArmR: -4 * d, forearmL: -2 * d, forearmR: -2 * d, head: 2 * d }, { torso: [0, 4] }) },
      { t: 3, ease: "easeInOut", pose: pose(rig, { upperArmL: 5 * d, upperArmR: -5 * d, forearmL: -4 * d, forearmR: -4 * d, head: 2 * d }, { torso: [0, 4] }) },
      { t: 4, ease: "easeInOut", pose: pose(rig, { upperArmL: 3 * d, upperArmR: -3 * d, forearmL: -2 * d, forearmR: -2 * d, head: -1 * d }, { torso: [0, 2] }) },
      { t: 5, ease: "easeInOut", pose: pose(rig, { upperArmL: -2 * d, upperArmR: 2 * d, forearmL: 3 * d, forearmR: 3 * d, head: -2 * d }) }
    ] };
  }
  function presetWalk(rig, facing = "right", info = null, frames = 0) {
    const d = D(facing), I = infoOr(rig, info);
    if (facing === "front") {
      const step2 = (S, O) => pose(
        rig,
        { ["thigh" + S]: S === "L" ? 6 : -6, ["upperArm" + S]: S === "L" ? -4 : 4, ["upperArm" + O]: O === "L" ? 4 : -4 },
        { ["shin" + S]: [0, -6], ["foot" + S]: [0, -8], torso: [0, -2] }
      );
      const contact = pose(rig, {}, { torso: [0, 4] });
      return { frames: 8, fps: 10, loop: true, facing, ground: [0, 2, 4, 6], keys: [
        { t: 0, ease: "easeInOut", pose: contact },
        { t: 2, ease: "easeInOut", pose: step2("L", "R") },
        { t: 4, ease: "easeInOut", pose: contact },
        { t: 6, ease: "easeInOut", pose: step2("R", "L") }
      ] };
    }
    const F = -d;
    const half2 = [
      pose(rig, { thighL: 24 * F, thighR: -20 * F, shinR: -12 * F, shinL: 0, upperArmL: -18 * F, upperArmR: 18 * F, forearmL: 10 * F, forearmR: 6 * F }),
      pose(rig, { thighL: 16 * F, thighR: -14 * F, shinR: -26 * F, upperArmL: -12 * F, upperArmR: 12 * F, forearmR: 10 * F }, { torso: [0, 4] }),
      pose(rig, { thighL: -2 * F, thighR: 10 * F, shinR: -40 * F, footR: 10 * F, upperArmL: 0, upperArmR: 0 }, { torso: [0, 0] }),
      pose(rig, { thighL: -14 * F, shinL: -6 * F, thighR: 20 * F, shinR: -18 * F, upperArmL: 12 * F, upperArmR: -12 * F }, { torso: [0, -4] })
    ];
    // contact, down, passing, up; then the same with the legs swapped: eight checkpoints around the gait cycle
    const cycle = [...half2, ...half2.map(mirrorPose)];
    if (frames && frames !== 8) {
      // another frame count: a pose on every frame, evenly spaced around the cycle (contact and passing
      // land on frames 0, n/4, n/2, 3n/4 when n is a multiple of 4), each planted on the ground itself
      // instead of stretching the 8 keys unevenly
      const keys2 = Array.from({ length: frames }, (_, i) => {
        const u = i * 8 / frames, k = Math.floor(u);
        return { t: i, ease: "linear", pose: grounded(rig, I, lerpPose(cycle[k], cycle[(k + 1) % 8], u - k)) };
      });
      return { frames, fps: 10, loop: true, facing, ground: keys2.map((k) => k.t), keys: keys2 };
    }
    const keys = cycle.map((p, i) => ({ t: i, ease: "linear", pose: grounded(rig, I, p) }));
    return { frames: 8, fps: 10, loop: true, facing, ground: [0, 1, 2, 3, 4, 5, 6, 7], keys };
  }
  function presetAttack(rig, facing = "right") {
    const d = facing === "front" ? 1 : D(facing), F = -d;
    const holder = has(rig, "weapon") ? rig.bones.weapon.parent : "handR";
    const S = holder && /L$/.test(holder) ? "L" : "R", O = S === "L" ? "R" : "L";
    const arm = (up, fore, hand = 0) => ({ ["upperArm" + S]: up * F, ["forearm" + S]: fore * F, ["hand" + S]: hand * F });
    const grip = holder && rig.bones[holder] ? holder : null, chain = [];
    for (let b = grip && rig.bones[grip].parent; b && rig.bones[b] && !chain.includes(b); b = rig.bones[b].parent) chain.push(b);
    const reach = { bones: ["upperArm" + S, "forearm" + S, "hand" + S], parts: ["weapon"], grip, chain };
    const behind = (p) => {
      const order2 = {};
      for (const id of ["upperArm" + S, "forearm" + S, "hand" + S, "weapon"]) if (has(rig, id)) order2[id] = "back";
      return Object.keys(order2).length ? { ...p, order: order2 } : p;
    };
    return { frames: 8, fps: 12, loop: false, facing, ground: [0, 1, 2, 3, 4, 5, 6, 7], reach, keys: [
      { t: 0, ease: "easeOut", pose: pose(rig) },
      { t: 1, ease: "easeOut", pose: behind(pose(rig, { ...arm(-115, 25, 15), torso: 6 * F, head: 3 * F, ["upperArm" + O]: 10 * F }, { torso: [0, 2] })) },
      { t: 2, ease: "easeIn", pose: behind(pose(rig, { ...arm(-145, 35, 25), torso: 9 * F, head: 5 * F, ["upperArm" + O]: 16 * F }, { torso: [0, 2] })) },
      { t: 3, ease: "linear", pose: pose(rig, { ...arm(100, 5, -10), torso: -10 * F, head: -4 * F, ["upperArm" + O]: -15 * F, thighL: 10 * F, thighR: -10 * F }, {}, [d, 0]) },
      { t: 4, ease: "easeOut", pose: pose(rig, { ...arm(80, 0, -15), torso: -12 * F, head: -5 * F, ["upperArm" + O]: -18 * F, thighL: 12 * F, thighR: -12 * F }, { torso: [0, 2] }, [d, 0]) },
      { t: 5, ease: "easeInOut", pose: pose(rig, { ...arm(40, 8, -10), torso: -8 * F, ["upperArm" + O]: -10 * F, thighL: 8 * F, thighR: -8 * F }, { torso: [0, 2] }, [d, 0]) },
      { t: 6, ease: "easeInOut", pose: pose(rig, { ...arm(22, 12, -4), torso: -5 * F, thighL: 5 * F, thighR: -5 * F }, { torso: [0, 1] }) },
      { t: 7, ease: "easeInOut", pose: pose(rig, { ...arm(10, 6), torso: -2 * F, thighL: 2 * F, thighR: -2 * F }) }
    ] };
  }
  var HELD_ITEM = /^(weapon|shield)$/;
  var isLeg = (id) => /^(foot|shin)[LR]$/.test(id || "");
  function groundRow(px, N, owner = null) {
    let all = -1, legs = -1;
    // with no leg in sight, the lowest pixel stands in for the feet; a held weapon or shield does not
    for (let i = px.length - 1; i >= 0 && legs < 0; i--) if (px[i]) {
      const y = i / N | 0;
      if (all < 0 && !(owner && HELD_ITEM.test(owner[i] || ""))) all = y;
      if (owner && isLeg(owner[i])) legs = y;
    }
    return legs >= 0 ? legs : all;
  }
  // the feet of a rendered frame: known exactly for a character made from a model, else as seen
  var feetRow = (r, N) => r.stats && r.stats.feet != null && r.stats.feet >= 0 ? r.stats.feet : groundRow(r.px, N, r.stats && r.stats.owner);
  function bodyInfo(rest) {
    const N = rest.N;
    let top = N, bottom = -1, x0 = N, x1 = -1;
    rest.px.forEach((c, i) => {
      if (c) {
        const x = i % N, y = i / N | 0;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    });
    if (bottom < 0) return { N, top: 0, height: N, left: N / 4, right: N / 4, ground: N - 1 };
    const ground = rest.seg ? groundRow(rest.px, N, spriteTags(rest.seg, rest.px, N)) : bottom;
    return { N, top, height: bottom - top + 1, left: N / 2 - x0, right: x1 + 1 - N / 2, ground };
  }
  var infoOr = (rig, info) => info || { N: 0, top: 4, height: 40, left: 8, right: 8, ground: 47 };
  function legLift(rig, info, rot, s) {
    const hip = rig.bones["thigh" + s], knee = rig.bones["shin" + s];
    if (!hip || !knee) return Infinity;
    const a = (knee.pivot[1] - hip.pivot[1]) / 4, b = info.ground + 1 - knee.pivot[1] / 4;
    const t = (rot["thigh" + s] || 0) * Math.PI / 180, u = t + (rot["shin" + s] || 0) * Math.PI / 180;
    return Math.max(0, a + b - (a * Math.cos(t) + b * Math.cos(u)));
  }
  function sink(rig, info, rot) {
    const m = Math.min(legLift(rig, info, rot, "L"), legLift(rig, info, rot, "R"));
    return Number.isFinite(m) ? Math.round(m) : 0;
  }
  function runReach(rig) {
    const w2 = weaponReach(rig);
    return w2 ? { reach: { ...w2, prefer: "steady" } } : {};
  }
  function presetRun(rig, facing = "right", info = null, frames = 0) {
    const d = D(facing), I = infoOr(rig, info);
    if (facing === "front") {
      const step2 = (S, O) => pose(
        rig,
        { ["thigh" + S]: S === "L" ? 10 : -10, ["upperArm" + S]: S === "L" ? -10 : 10, ["upperArm" + O]: O === "L" ? 10 : -10, forearmL: 20, forearmR: -20 },
        { ["shin" + S]: [0, -10], ["foot" + S]: [0, -12], torso: [0, -2] },
        [0, -1]
      );
      const contact = pose(rig, { forearmL: 20, forearmR: -20 }, { torso: [0, 4] });
      return { frames: 6, fps: 12, loop: true, facing, ground: [0, 3], ...runReach(rig), keys: [
        { t: 0, ease: "easeInOut", pose: contact },
        { t: 1, ease: "easeInOut", pose: step2("L", "R") },
        { t: 3, ease: "easeInOut", pose: contact },
        { t: 4, ease: "easeInOut", pose: step2("R", "L") }
      ] };
    }
    const F = -d;
    const half2 = [
      // contact: front leg reaching, back leg bent behind, arms swinging hard, leaning in
      grounded(rig, I, pose(rig, { torso: -8 * F, thighL: 34 * F, thighR: -26 * F, shinR: -34 * F, upperArmL: -32 * F, upperArmR: 32 * F, forearmL: 60 * F, forearmR: 70 * F })),
      // push: body over the front foot, back leg extending
      grounded(rig, I, pose(rig, { torso: -10 * F, thighL: 12 * F, shinL: -18 * F, thighR: -34 * F, shinR: -12 * F, upperArmL: -15 * F, upperArmR: 15 * F, forearmL: 60 * F, forearmR: 60 * F }, { torso: [0, 3] })),
      // flight: both feet off the ground, legs folding through
      grounded(rig, I, pose(rig, { torso: -8 * F, thighL: -18 * F, shinL: -50 * F, thighR: 26 * F, shinR: -60 * F, upperArmL: 20 * F, upperArmR: -20 * F, forearmL: 70 * F, forearmR: 60 * F }), -2)
    ];
    const cycle = [...half2, ...half2.map(mirrorPose)];
    if (frames && frames !== 6) {
      // another frame count (V7): a pose on every frame, evenly spaced around the 6-pose stride, as the walk does
      const keys2 = Array.from({ length: frames }, (_, i) => {
        const u = i * 6 / frames, k = Math.floor(u);
        return { t: i, ease: "linear", pose: lerpPose(cycle[k], cycle[(k + 1) % 6], u - k) };
      });
      const flight = (i) => [2, 5].includes(Math.round(i * 6 / frames) % 6), air = {};
      keys2.forEach((k) => {
        if (flight(k.t)) air[k.t] = 2;
      });
      return { frames, fps: 12, loop: true, facing, ground: keys2.filter((k) => !flight(k.t)).map((k) => k.t), air, ...runReach(rig), keys: keys2 };
    }
    return { frames: 6, fps: 12, loop: true, facing, ground: [0, 1, 3, 4], air: { 2: 2, 5: 2 }, ...runReach(rig), keys: cycle.map((p, i) => ({ t: i, ease: "linear", pose: p })) };
  }
  // V7: sneak, the walk made slow and low: half-length steps on bent knees, the body leaning in, arms
  // held up and forward (from the front: lower, smaller steps, forearms raised)
  function presetSneak(rig, facing = "right", info = null, frames = 0) {
    const walk = presetWalk(rig, facing, info, frames), I = infoOr(rig, info), d = D(facing), F = -d;
    const keys = walk.keys.map((k) => {
      const p = clonePose(k.pose);
      if (facing === "front") {
        for (const id of Object.keys(p.off)) if (/^(shin|foot)[LR]$/.test(id)) p.off[id] = p.off[id].map((v) => Math.round(v / 2));
        for (const id of Object.keys(p.rot)) if (/^(thigh|upperArm)[LR]$/.test(id)) p.rot[id] = r1(p.rot[id] / 2);
        p.off.torso = [0, ((p.off.torso || [0, 0])[1] > 0 ? 4 : 2)];
        if (has(rig, "forearmL")) p.rot.forearmL = 25;
        if (has(rig, "forearmR")) p.rot.forearmR = -25;
        return { ...k, pose: p };
      }
      p.root = [p.root[0], 0];
      for (const s of ["L", "R"]) {
        delete p.rot["foot" + s];
        const half = (id) => (p.rot[id] || 0) / 2;
        if (has(rig, "thigh" + s)) p.rot["thigh" + s] = r1(half("thigh" + s) + 12 * F);
        if (has(rig, "shin" + s)) p.rot["shin" + s] = r1(half("shin" + s) - 24 * F);
        if (has(rig, "upperArm" + s)) p.rot["upperArm" + s] = r1(half("upperArm" + s) + 16 * F);
        if (has(rig, "forearm" + s)) p.rot["forearm" + s] = r1(45 * F);
      }
      if (has(rig, "torso")) p.rot.torso = r1(-6 * F);
      return { ...k, pose: grounded(rig, I, p) };
    });
    // a weapon in hand is fitted like the run's, so a long blade or staff is not swung out of the frame
    return { ...walk, fps: 8, ...runReach(rig), keys };
  }
  function presetJump(rig, facing = "right", info = null) {
    const I = infoOr(rig, info), up = Math.max(1, I.top - 2), d = facing === "front" ? 1 : D(facing), F = -d;
    if (facing === "front") {
      return { frames: 5, fps: 10, loop: false, facing, ground: [0, 4], keys: [
        { t: 0, ease: "easeInOut", pose: pose(rig, { upperArmL: -15, upperArmR: 15 }, { torso: [0, 6] }) },
        { t: 1, ease: "easeInOut", pose: pose(rig, { upperArmL: 70, upperArmR: -70 }, {}, [0, -Math.ceil(up / 2)]) },
        { t: 2, ease: "easeInOut", pose: pose(rig, { upperArmL: 40, upperArmR: -40, thighL: 15, thighR: -15 }, { shinL: [0, -8], shinR: [0, -8], footL: [0, -10], footR: [0, -10] }, [0, -up]) },
        { t: 3, ease: "easeInOut", pose: pose(rig, { upperArmL: 25, upperArmR: -25 }, {}, [0, -Math.ceil(up / 2)]) },
        { t: 4, ease: "easeInOut", pose: pose(rig, { upperArmL: -10, upperArmR: 10 }, { torso: [0, 4] }) }
      ] };
    }
    const crouch = { torso: -14 * F, thighL: 30 * F, thighR: 26 * F, shinL: -55 * F, shinR: -50 * F, upperArmL: -30 * F, upperArmR: -26 * F };
    return { frames: 5, fps: 10, loop: false, facing, ground: [0, 4], keys: [
      { t: 0, ease: "easeInOut", pose: grounded(rig, I, pose(rig, crouch, { torso: [0, 4] })) },
      { t: 1, ease: "easeInOut", pose: pose(rig, { torso: -4 * F, thighL: -6 * F, thighR: -8 * F, upperArmL: 100 * F, upperArmR: 95 * F, forearmL: 20 * F, forearmR: 20 * F, footL: 15 * F, footR: 15 * F }, {}, [0, -Math.ceil(up / 2)]) },
      { t: 2, ease: "easeInOut", pose: pose(rig, { torso: -8 * F, thighL: 50 * F, thighR: 45 * F, shinL: -80 * F, shinR: -75 * F, upperArmL: 60 * F, upperArmR: 55 * F, forearmL: 40 * F, forearmR: 40 * F }, {}, [0, -up]) },
      { t: 3, ease: "easeInOut", pose: pose(rig, { torso: -4 * F, thighL: 15 * F, thighR: 10 * F, shinL: -20 * F, shinR: -15 * F, upperArmL: 30 * F, upperArmR: 25 * F }, {}, [0, -Math.ceil(up / 2)]) },
      { t: 4, ease: "easeInOut", pose: grounded(rig, I, pose(rig, { ...crouch, upperArmL: 20 * F, upperArmR: 15 * F }, { torso: [0, 3] })) }
    ] };
  }
  function presetHurt(rig, facing = "right") {
    const d = facing === "front" ? 0 : D(facing), F = -(d || 1);
    const back = (v) => facing === "front" ? 0 : v;
    const hit = pose(rig, { torso: back(14 * F), head: facing === "front" ? 8 : 18 * F, upperArmL: back(-25 * F) || 20, upperArmR: back(-20 * F) || -20, forearmL: 30 * F, forearmR: 30 * F }, { torso: [0, 2] }, [-d, 0]);
    hit.flash = true;
    return { frames: 3, fps: 10, loop: false, facing, ground: [0, 1, 2], keys: [
      { t: 0, ease: "easeInOut", pose: hit },
      { t: 1, ease: "easeInOut", pose: pose(rig, { torso: back(9 * F), head: facing === "front" ? -6 : 10 * F, upperArmL: back(-12 * F) || 10, upperArmR: back(-10 * F) || -10, forearmL: 20 * F, forearmR: 20 * F }, { torso: [0, 4] }, [-d, 0]) },
      { t: 2, ease: "easeInOut", pose: pose(rig, { torso: back(3 * F), head: facing === "front" ? 2 : 3 * F, forearmL: 8 * F, forearmR: 8 * F }, { torso: [0, 1] }) }
    ] };
  }
  function presetDeath(rig, facing = "right", info = null) {
    const I = infoOr(rig, info), d = facing === "front" ? 1 : D(facing), F = -d;
    const fall = facing === "front" ? -1 : -d, lieShift = Math.round(I.height / 2) * -fall;
    const back = Math.round(fall < 0 ? I.left : I.right);
    return { frames: 6, fps: 8, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig, { torso: 10 * F, head: 12 * F, upperArmL: -28 * F, upperArmR: -22 * F, forearmL: 20 * F, forearmR: 20 * F }) },
      { t: 1, ease: "easeInOut", pose: pose(rig, { torso: 16 * F, head: 18 * F, upperArmL: -40 * F, upperArmR: -30 * F, forearmL: 30 * F, forearmR: 30 * F, thighL: 12 * F, shinL: -22 * F }, { torso: [0, 3] }, [-d, 0]) },
      { t: 2, ease: "easeInOut", pose: grounded(rig, I, pose(rig, { torso: 10 * F, head: 10 * F, upperArmL: -20 * F, upperArmR: -15 * F, thighL: 35 * F, thighR: 30 * F, shinL: -70 * F, shinR: -60 * F }, { torso: [0, 6] }, [-d, 0])) },
      { t: 3, ease: "easeInOut", pose: { ...pose(rig, { head: 15 * F, upperArmL: 30 * F, upperArmR: 25 * F, thighL: 15 * F, shinL: -25 * F }, {}, [Math.round(lieShift / 2), -Math.round(back * 0.7)]), tilt: 45 * fall } },
      { t: 4, ease: "easeInOut", pose: { ...pose(rig, { head: 8 * F, upperArmL: 12 * F, upperArmR: 8 * F, thighL: 6 * F }, {}, [lieShift, -back]), tilt: 90 * fall } },
      { t: 5, ease: "easeInOut", pose: { ...pose(rig, { head: 4 * F, upperArmL: 6 * F, upperArmR: 4 * F, forearmL: 10 * F, forearmR: 8 * F }, {}, [lieShift, -back]), tilt: 90 * fall } }
    ] };
  }
  function presetCrouch(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      const bend = (k, arms) => grounded(rig, I, pose(rig, { thighL: 10 * k, thighR: -10 * k, shinL: -20 * k, shinR: 20 * k, upperArmL: arms, upperArmR: -arms }, { torso: [0, 4 * k] }));
      return { frames: 4, fps: 10, loop: false, facing, ground: [0, 1, 2, 3], keys: [
        { t: 0, ease: "easeInOut", pose: pose(rig) },
        { t: 1, ease: "easeInOut", pose: bend(1, 6) },
        { t: 2, ease: "easeInOut", pose: bend(2, 10) },
        { t: 3, ease: "easeInOut", pose: bend(2, 6) }
      ] };
    }
    const F = -D(facing);
    const low = (k, arm) => grounded(rig, I, pose(rig, { torso: -12 * k * F, head: 6 * k * F, thighL: 40 * k * F, thighR: 34 * k * F, shinL: -72 * k * F, shinR: -66 * k * F, footL: 32 * k * F, footR: 32 * k * F, upperArmL: arm * F, upperArmR: arm * F, forearmL: 30 * k * F, forearmR: 30 * k * F }, { torso: [0, Math.round(4 * k)] }));
    return { frames: 4, fps: 10, loop: false, facing, ground: [0, 1, 2, 3], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig) },
      { t: 1, ease: "easeInOut", pose: low(3 / 4, 14) },
      { t: 2, ease: "easeInOut", pose: low(1, 24) },
      { t: 3, ease: "easeInOut", pose: low(1, 18) }
    ] };
  }
  function presetWave(rig, facing = "right") {
    const holder = has(rig, "weapon") ? rig.bones.weapon.parent : null;
    const S = holder && /R$/.test(holder) ? "L" : "R";
    const up = facing === "front" ? S === "R" ? -150 : 150 : 150 * -D(facing);
    const sway = facing === "front" ? S === "R" ? -1 : 1 : -D(facing);
    const at = (fore, head) => pose(rig, { ["upperArm" + S]: up, ["forearm" + S]: fore * sway, ["hand" + S]: fore * sway / 2, head: head * sway });
    return { frames: 4, fps: 6, loop: true, facing, ground: [0, 1, 2, 3], keys: [
      { t: 0, ease: "easeInOut", pose: at(25, 2) },
      { t: 1, ease: "easeInOut", pose: at(0, 1) },
      { t: 2, ease: "easeInOut", pose: at(-25, 0) },
      { t: 3, ease: "easeInOut", pose: at(0, 1) }
    ] };
  }
  var armsSide = (F, l, r, fl2 = 0, fr = 0) => ({ upperArmL: l * F, upperArmR: r * F, forearmL: fl2 * F, forearmR: fr * F });
  // V7.1: everything held in a hand (a weapon, a shield, a bow) is kept inside the frame, not only "weapon"
  const heldParts = (rig) => Object.keys(rig.bones).filter((id) => id !== "weapon" && /^hand[LR]$/.test(rig.bones[id].parent || ""));
  function weaponReach(rig) {
    const held = heldParts(rig), holder = has(rig, "weapon") ? rig.bones.weapon.parent : held.length ? rig.bones[held[0]].parent : null;
    if (!holder || !rig.bones[holder]) return null;
    const S = /L$/.test(holder) ? "L" : "R", chain = [];
    for (let b = rig.bones[holder].parent; b && rig.bones[b] && !chain.includes(b); b = rig.bones[b].parent) chain.push(b);
    return { bones: ["upperArm" + S, "forearm" + S, "hand" + S], parts: [...has(rig, "weapon") ? ["weapon"] : [], ...held], grip: holder, chain };
  }
  function armsReach(rig) {
    const w2 = weaponReach(rig);
    return { bones: ["upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR"], parts: ["forearmL", "forearmR", "handL", "handR", "weapon", ...heldParts(rig)], grip: w2 ? w2.grip : null, chain: w2 ? w2.chain : [] };
  }
  var withReach = (anim2, reach) => reach ? { ...anim2, reach } : anim2;
  function presetBlock(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      const guard2 = (k, back) => grounded(rig, I, pose(rig, { upperArmL: -35 * k, upperArmR: 35 * k, forearmL: -110 * k, forearmR: 110 * k, thighL: 4 * k, thighR: -4 * k, shinL: -8 * k, shinR: 8 * k }, { torso: [0, 2 * k] }, [0, back]));
      return withReach({ frames: 4, fps: 10, loop: false, facing, ground: [0, 1, 2, 3], keys: [
        { t: 0, ease: "easeOut", pose: pose(rig) },
        { t: 1, ease: "linear", pose: guard2(1, 0) },
        { t: 2, ease: "easeOut", pose: guard2(1.2, 0) },
        { t: 3, ease: "step", pose: guard2(1, 0) }
      ] }, weaponReach(rig));
    }
    const d = D(facing), F = -d;
    const guard = (k, back) => grounded(rig, I, pose(rig, { ...armsSide(F, 70 * k, 60 * k, 80 * k, 85 * k), torso: 6 * k * F, head: -4 * k * F, thighL: 8 * k * F, thighR: -6 * k * F, shinL: -12 * k * F, shinR: -10 * k * F }, { torso: [0, Math.round(2 * k)] }, [back, 0]));
    return withReach({ frames: 4, fps: 10, loop: false, facing, ground: [0, 1, 2, 3], keys: [
      { t: 0, ease: "easeOut", pose: pose(rig) },
      { t: 1, ease: "linear", pose: guard(1, 0) },
      { t: 2, ease: "easeOut", pose: guard(1.15, -d) },
      { t: 3, ease: "step", pose: guard(1, 0) }
    ] }, weaponReach(rig));
  }
  // V8.0: an attack without a weapon (most uploaded characters carry none): the free arm guards the
  // face, the other winds back, jabs forwards with a lean and a small step, and comes back
  function presetPunch(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      // from the front the jab comes across the body towards the middle at chest height
      const at2 = (r, fr, k) => grounded(rig, I, pose(rig, { upperArmL: -35 * k, forearmL: -110 * k, upperArmR: r, forearmR: fr, thighL: 4 * k, thighR: -4 * k }));
      return withReach({ frames: 6, fps: 12, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
        { t: 0, ease: "easeInOut", pose: pose(rig) },
        { t: 1, ease: "easeIn", pose: at2(-20, 90, 1) },
        { t: 2, ease: "easeOut", pose: at2(70, 40, 1) },
        { t: 3, ease: "linear", pose: at2(65, 35, 1) },
        { t: 4, ease: "easeInOut", pose: at2(20, 60, 0.8) },
        { t: 5, ease: "easeInOut", pose: at2(5, 15, 0.3) }
      ] }, armsReach(rig));
    }
    const d = D(facing), F = -d;
    const at = (r, fr, k, lean, step2 = 0) => grounded(rig, I, pose(rig, { ...armsSide(F, 40 * k, r, 100 * k, fr), torso: lean * F, head: -lean / 2 * F, thighL: 6 * step2 * F, thighR: -6 * step2 * F }));
    return withReach({ frames: 6, fps: 12, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig) },
      { t: 1, ease: "easeIn", pose: at(-35, 100, 1, -3) },
      { t: 2, ease: "easeOut", pose: at(88, 0, 1, 8, 1) },
      { t: 3, ease: "linear", pose: at(85, 5, 1, 7, 1) },
      { t: 4, ease: "easeInOut", pose: at(30, 60, 0.8, 2) },
      { t: 5, ease: "easeInOut", pose: at(10, 15, 0.3, 0) }
    ] }, armsReach(rig));
  }
  function presetCast(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      const at2 = (l, fl2) => grounded(rig, I, pose(rig, { upperArmL: l, upperArmR: -l, forearmL: fl2, forearmR: -fl2 }));
      return withReach({ frames: 6, fps: 10, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
        { t: 0, ease: "easeInOut", pose: pose(rig) },
        { t: 1, ease: "easeIn", pose: at2(-20, -30) },
        { t: 2, ease: "easeOut", pose: at2(150, 20) },
        { t: 3, ease: "linear", pose: at2(95, 0) },
        { t: 4, ease: "easeInOut", pose: at2(85, -10) },
        { t: 5, ease: "easeInOut", pose: at2(15, 5) }
      ] }, armsReach(rig));
    }
    const d = D(facing), F = -d;
    const at = (l, r, fl2, fr, lean, step2 = 0) => grounded(rig, I, pose(rig, { ...armsSide(F, l, r, fl2, fr), torso: lean * F, head: -lean / 2 * F, thighL: 6 * step2 * F, thighR: -6 * step2 * F }));
    return withReach({ frames: 6, fps: 10, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig) },
      { t: 1, ease: "easeIn", pose: at(-40, -45, 60, 60, 8) },
      { t: 2, ease: "easeOut", pose: at(150, 145, 20, 20, 4) },
      { t: 3, ease: "linear", pose: at(90, 88, -5, -5, -10, 1) },
      { t: 4, ease: "easeInOut", pose: at(85, 82, 0, 0, -8, 1) },
      { t: 5, ease: "easeInOut", pose: at(20, 18, 10, 10, -2) }
    ] }, armsReach(rig));
  }
  function presetBow(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    const holder = has(rig, "weapon") ? rig.bones.weapon.parent : null, S = holder && /L$/.test(holder) ? "L" : "R", O = S === "L" ? "R" : "L";
    if (facing === "front") {
      const side = S === "L" ? 1 : -1;
      const at2 = (bow, draw, fore) => grounded(rig, I, pose(rig, { ["upperArm" + S]: bow * side, ["upperArm" + O]: -draw * side, ["forearm" + O]: -fore * side }));
      return withReach({ frames: 6, fps: 10, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
        { t: 0, ease: "easeInOut", pose: pose(rig) },
        { t: 1, ease: "easeOut", pose: at2(70, 30, 60) },
        { t: 2, ease: "easeInOut", pose: at2(85, 60, 120) },
        { t: 3, ease: "step", pose: at2(85, 62, 125) },
        { t: 4, ease: "easeOut", pose: at2(85, 30, 40) },
        { t: 5, ease: "easeInOut", pose: at2(20, 10, 10) }
      ] }, weaponReach(rig));
    }
    const d = D(facing), F = -d;
    const at = (bow, draw, fore, lean) => grounded(rig, I, pose(rig, { ["upperArm" + S]: bow * F, ["forearm" + S]: 0, ["upperArm" + O]: draw * F, ["forearm" + O]: fore * F, torso: lean * F, thighL: 8 * F, thighR: -8 * F }));
    return withReach({ frames: 6, fps: 10, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig) },
      { t: 1, ease: "easeOut", pose: at(80, 70, 40, 0) },
      { t: 2, ease: "easeInOut", pose: at(90, 75, 120, 4) },
      { t: 3, ease: "step", pose: at(90, 72, 130, 5) },
      { t: 4, ease: "easeOut", pose: at(90, 20, 30, 2) },
      { t: 5, ease: "easeInOut", pose: at(20, 10, 10, 0) }
    ] }, weaponReach(rig));
  }
  function presetClimb(rig, facing = "right") {
    const front = facing === "front", F = front ? 1 : -D(facing);
    const reach = (S, O) => {
      const up = front ? S === "L" ? 165 : -165 : 165 * F, pull = front ? O === "L" ? 120 : -120 : 110 * F;
      const knee = front ? { ["shin" + S]: [0, -10], ["foot" + S]: [0, -12], ["thigh" + S]: S === "L" ? 6 : -6 } : { ["thigh" + S]: 50 * F, ["shin" + S]: -80 * F, ["thigh" + O]: 5 * F, ["shin" + O]: -10 * F };
      const o = Object.fromEntries(Object.entries(knee).filter(([, v]) => Array.isArray(v)));
      const r = Object.fromEntries(Object.entries(knee).filter(([, v]) => !Array.isArray(v)));
      return pose(rig, { ["upperArm" + S]: up, ["forearm" + S]: front ? 0 : 10 * F, ["upperArm" + O]: pull, ["forearm" + O]: front ? O === "L" ? 40 : -40 : 50 * F, ...r }, o);
    };
    return withReach({ frames: 4, fps: 6, loop: true, facing, ground: [], keys: [
      { t: 0, ease: "easeInOut", pose: reach("L", "R") },
      { t: 2, ease: "easeInOut", pose: reach("R", "L") }
    ] }, armsReach(rig));
  }
  function presetPush(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      const step2 = (S, k) => grounded(rig, I, pose(rig, { upperArmL: -60, upperArmR: 60, forearmL: -40, forearmR: 40, ["thigh" + S]: S === "L" ? 4 * k : -4 * k }, { ["shin" + S]: [0, -4 * k], ["foot" + S]: [0, -4 * k], torso: [0, 2] }));
      return withReach({ frames: 4, fps: 6, loop: true, facing, ground: [0, 1, 2, 3], keys: [
        { t: 0, ease: "easeInOut", pose: step2("L", 1) },
        { t: 1, ease: "easeInOut", pose: step2("L", 0) },
        { t: 2, ease: "easeInOut", pose: step2("R", 1) },
        { t: 3, ease: "easeInOut", pose: step2("R", 0) }
      ] }, weaponReach(rig));
    }
    const F = -D(facing);
    const lean = (front, back, bend) => grounded(rig, I, pose(rig, { ...armsSide(F, 80, 75, -15, -10), torso: -22 * F, head: 14 * F, thighL: front * F, thighR: back * F, shinL: -bend * F, shinR: -12 * F }));
    return withReach({ frames: 4, fps: 6, loop: true, facing, ground: [0, 1, 2, 3], keys: [
      { t: 0, ease: "easeInOut", pose: lean(22, -28, 28) },
      { t: 1, ease: "easeInOut", pose: lean(12, -20, 14) },
      { t: 2, ease: "easeInOut", pose: mirrorPose(lean(22, -28, 28)) },
      { t: 3, ease: "easeInOut", pose: mirrorPose(lean(12, -20, 14)) }
    ] }, weaponReach(rig));
  }
  function presetSit(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      const at2 = (k, hands = 0) => grounded(rig, I, pose(rig, { thighL: 50 * k, thighR: -50 * k, shinL: -50 * k, shinR: 50 * k, upperArmL: (10 + hands) * k, upperArmR: -(10 + hands) * k, forearmL: -25 * k, forearmR: 25 * k, head: hands ? 2 : 0 }));
      return withReach({ frames: 4, fps: 8, loop: false, facing, ground: [0, 1, 2, 3], keys: [
        { t: 0, ease: "easeInOut", pose: pose(rig) },
        { t: 1, ease: "easeInOut", pose: at2(0.5) },
        { t: 2, ease: "easeOut", pose: at2(1) },
        { t: 3, ease: "step", pose: at2(1, 6) }
      ] }, weaponReach(rig));
    }
    const F = -D(facing);
    const at = (k, settle2 = 0) => grounded(rig, I, pose(rig, { thighL: 85 * k * F, thighR: 80 * k * F, shinL: -85 * k * F, shinR: -80 * k * F, torso: (-6 * k + (k < 1 ? -8 : 0) + settle2) * F, head: -settle2 * F, upperArmL: 25 * k * F, upperArmR: 22 * k * F, forearmL: 30 * k * F, forearmR: 30 * k * F }));
    return withReach({ frames: 4, fps: 8, loop: false, facing, ground: [0, 1, 2, 3], keys: [
      { t: 0, ease: "easeInOut", pose: pose(rig) },
      { t: 1, ease: "easeInOut", pose: at(0.5) },
      { t: 2, ease: "easeOut", pose: at(1) },
      { t: 3, ease: "step", pose: at(1, 6) }
    ] }, weaponReach(rig));
  }
  function presetVictory(rig, facing = "right", info = null) {
    const I = infoOr(rig, info), hop = Math.max(0, Math.min(2, I.top - 1));
    const front = facing === "front", F = front ? 1 : -D(facing);
    const up = (k, pump) => front ? { upperArmL: 160 * k, upperArmR: -160 * k, forearmL: pump, forearmR: -pump } : { ...armsSide(F, 165 * k, 150 * k, pump, pump), head: -6 * k * F };
    const reach = armsReach(rig);
    return { frames: 4, fps: 8, loop: true, facing, ground: [0, 2], reach, keys: [
      { t: 0, ease: "easeOut", pose: grounded(rig, I, pose(rig, up(1, 10), { torso: [0, 2] })) },
      { t: 1, ease: "easeIn", pose: pose(rig, up(1, 0), {}, [0, -hop]) },
      { t: 2, ease: "easeOut", pose: grounded(rig, I, pose(rig, up(0.9, 30), { torso: [0, 3] })) },
      { t: 3, ease: "easeInOut", pose: grounded(rig, I, pose(rig, up(1, 15), { torso: [0, 1] })) }
    ] };
  }
  function presetRoll(rig, facing = "right", info = null) {
    const I = infoOr(rig, info), d = facing === "front" ? 1 : D(facing), F = -d, front = facing === "front";
    const tuck = front ? { thighL: 25, thighR: -25, shinL: -40, shinR: 40, upperArmL: -30, upperArmR: 30, forearmL: -60, forearmR: 60, head: 0 } : { torso: -30 * F, head: -10 * F, thighL: 70 * F, thighR: 65 * F, shinL: -110 * F, shinR: -105 * F, upperArmL: 40 * F, upperArmR: 35 * F, forearmL: 70 * F, forearmR: 70 * F };
    const h = Math.round(I.height * 0.4);
    const rolled = (turn, x) => {
      const a = turn * d * Math.PI / 180, cx = h * Math.sin(a), cy = -h * Math.cos(a);
      return { ...pose(rig, tuck, {}, [Math.round(-cx) + x, Math.round(-h - cy)]), tilt: turn * d };
    };
    const reach = weaponReach(rig);
    return { frames: 6, fps: 12, loop: false, facing, ground: [0, 1, 2, 3, 4, 5], centre: [1, 2, 3], ...reach ? { reach } : {}, keys: [
      { t: 0, ease: "easeIn", pose: grounded(rig, I, pose(rig, tuck)) },
      { t: 1, ease: "linear", pose: rolled(90, 0) },
      { t: 2, ease: "linear", pose: rolled(180, 0) },
      { t: 3, ease: "linear", pose: rolled(270, 0) },
      { t: 4, ease: "easeOut", pose: grounded(rig, I, pose(rig, tuck)) },
      { t: 5, ease: "easeInOut", pose: pose(rig) }
    ] };
  }
  function presetSlide(rig, facing = "right", info = null) {
    const I = infoOr(rig, info);
    if (facing === "front") {
      const low2 = (k) => grounded(rig, I, pose(rig, { thighL: 35 * k, thighR: -35 * k, shinL: -60 * k, shinR: 60 * k, upperArmL: -70 * k, upperArmR: 70 * k, forearmL: -10 * k, forearmR: 10 * k }, { torso: [0, Math.round(3 * k)] }));
      return withReach({ frames: 5, fps: 10, loop: false, facing, ground: [0, 1, 2, 3, 4], keys: [
        { t: 0, ease: "easeIn", pose: pose(rig) },
        { t: 1, ease: "easeOut", pose: low2(0.8) },
        { t: 2, ease: "linear", pose: low2(1) },
        { t: 3, ease: "easeInOut", pose: low2(0.6) },
        { t: 4, ease: "easeInOut", pose: pose(rig) }
      ] }, weaponReach(rig));
    }
    const d = D(facing), F = -d;
    const low = (k, x) => grounded(rig, I, pose(rig, { thighL: 80 * k * F, shinL: -5 * k * F, footL: -20 * k * F, thighR: 40 * k * F, shinR: -120 * k * F, torso: 25 * k * F, head: -15 * k * F, upperArmL: -50 * k * F, upperArmR: -40 * k * F, forearmL: 20 * k * F, forearmR: 20 * k * F }, {}, [x, 0]));
    return withReach({ frames: 5, fps: 10, loop: false, facing, ground: [0, 1, 2, 3, 4], keys: [
      { t: 0, ease: "easeIn", pose: grounded(rig, I, pose(rig, { thighL: 20 * F, thighR: -15 * F, shinR: -20 * F, torso: -8 * F, upperArmL: -20 * F, upperArmR: 20 * F })) },
      { t: 1, ease: "easeOut", pose: low(0.8, d) },
      { t: 2, ease: "linear", pose: low(1, d) },
      { t: 3, ease: "easeInOut", pose: low(0.6, 0) },
      { t: 4, ease: "easeInOut", pose: pose(rig) }
    ] }, weaponReach(rig));
  }
  function presetRunTopDown(rig, facing = "right") {
    const d = D(facing);
    const lift2 = [0, 8, 4], F = -d, frames = [];
    for (const [S, O] of [["L", "R"], ["R", "L"]]) for (let k = 0; k < 3; k++) {
      if (facing === "front") {
        frames.push(pose(
          rig,
          { ["upperArm" + S]: S === "L" ? -8 : 8, ["upperArm" + O]: O === "L" ? 8 : -8 },
          { ["shin" + S]: [0, -lift2[k]], ["foot" + S]: [0, -lift2[k]] }
        ));
      } else {
        const swing = [22, 4, -14][k];
        frames.push(pose(rig, {
          ["thigh" + S]: swing * F,
          ["thigh" + O]: -swing * F,
          ["shin" + O]: (k === 1 ? -30 : -12) * F,
          ["upperArm" + S]: -swing * F,
          ["upperArm" + O]: swing * F,
          forearmL: 40 * F,
          forearmR: 40 * F
        }));
      }
    }
    return withReach({ frames: 6, fps: 12, loop: true, facing, ground: [0, 1, 2, 3, 4, 5], bob: [0, 1, 2, 0, 1, 2], keys: frames.map((p, t) => ({ t, ease: "linear", pose: p })) }, armsReach(rig));
  }
  function presetIdleHeld(rig, facing = "right") {
    const d = D(facing);
    const up = pose(rig, { upperArmL: 2 * d, upperArmR: -2 * d });
    const down = pose(rig, { upperArmL: 6 * d, upperArmR: -6 * d, forearmL: -6 * d, forearmR: -6 * d }, { torso: [0, 4] });
    return { frames: 6, fps: 6, loop: true, facing, ground: [0, 1, 2, 3, 4, 5], keys: [
      { t: 0, ease: "easeInOut", hold: 1, pose: up },
      { t: 3, ease: "easeInOut", hold: 1, pose: down }
    ] };
  }
  function presetHairBounce(rig, facing = "right") {
    const d = D(facing);
    return { frames: 4, fps: 8, loop: true, facing, ground: [0, 1, 2, 3], keys: [
      { t: 0, ease: "linear", pose: pose(rig) },
      { t: 1, ease: "linear", pose: pose(rig, {}, { head: [0, 4] }) },
      { t: 2, ease: "linear", pose: pose(rig, { upperArmL: 3 * d, upperArmR: -3 * d }) },
      { t: 3, ease: "linear", pose: pose(rig, { upperArmL: 3 * d, upperArmR: -3 * d }, { head: [0, 4] }) }
    ] };
  }
  var PRESETS = {
    idle: presetIdle,
    walk: presetWalk,
    attack: presetAttack,
    run: presetRun,
    sneak: presetSneak,
    jump: presetJump,
    hurt: presetHurt,
    death: presetDeath,
    crouch: presetCrouch,
    wave: presetWave,
    block: presetBlock,
    cast: presetCast,
    punch: presetPunch,
    bow: presetBow,
    climb: presetClimb,
    push: presetPush,
    sit: presetSit,
    victory: presetVictory,
    roll: presetRoll,
    slide: presetSlide,
    runTopDown: presetRunTopDown,
    idleHeld: presetIdleHeld,
    hairBounce: presetHairBounce
  };
  function jointWarnings(anim2) {
    if (anim2.facing === "front") return [];
    const d = D(anim2.facing), out = [];
    sampleAnim(anim2).forEach(({ pose: p }, i) => {
      for (const s of ["L", "R"]) {
        const knee = (p.rot["shin" + s] || 0) * d, elbow = (p.rot["forearm" + s] || 0) * d;
        if (knee < -15) out.push({ frame: i, part: "shin" + s, text: `frame ${i + 1}: knee ${s} bends forwards` });
        if (elbow > 15) out.push({ frame: i, part: "forearm" + s, text: `frame ${i + 1}: elbow ${s} bends backwards` });
      }
    });
    return out;
  }
  function applyToTimeline(tl, name, anim2, view = null) {
    const specs = sampleAnim(anim2).map((s) => view ? { ...s, view } : s), old = tl.anims[name];
    const frames = specs.map((spec, i) => {
      const o = old && old.frames[i];
      return { spec, px: o ? o.px : null, dur: o ? o.dur : null, ...o && o.data ? { data: o.data } : {} };
    });
    const order2 = tl.order.includes(name) ? tl.order.slice() : [...tl.order, name];
    const keep = old ? { ...old.mode ? { mode: old.mode } : {}, ...old.repeat ? { repeat: old.repeat } : {} } : {};
    return { order: order2, anims: { ...tl.anims, [name]: { fps: anim2.fps, loop: anim2.loop, ...keep, frames } } };
  }
  function removeFromTimeline(tl, name) {
    if (!tl.anims[name]) return tl;
    const anims = { ...tl.anims };
    delete anims[name];
    return { order: tl.order.filter((n) => n !== name), anims };
  }
  function pruneAnims(anims, rig) {
    if (!anims) return anims;
    const keep = (o) => Object.fromEntries(Object.entries(o).filter(([id]) => rig.bones[id]));
    const follows = (a) => {
      if (!a.follow) return {};
      const f = Object.fromEntries(Object.entries(a.follow).filter(([id, v]) => rig.bones[id] && v.from.every((b) => rig.bones[b])));
      return Object.keys(f).length ? { follow: f } : {};
    };
    const plain = ({ follow, ...x }) => x;
    return Object.fromEntries(Object.entries(anims).map(([n, a]) => [n, { ...plain(a), ...follows(a), keys: a.keys.map((k) => {
      const pose2 = { rot: keep(k.pose.rot), off: keep(k.pose.off), root: k.pose.root.slice() };
      if (k.pose.tilt) pose2.tilt = k.pose.tilt;
      if (k.pose.flash) pose2.flash = true;
      const sw = k.pose.swap && keep(k.pose.swap);
      if (sw && Object.keys(sw).length) pose2.swap = sw;
      const sm = k.pose.smear && keep(k.pose.smear);
      if (sm && Object.keys(sm).length) pose2.smear = sm;
      const od = k.pose.order && keep(k.pose.order);
      if (od && Object.keys(od).length) pose2.order = od;
      return { ...k, pose: pose2 };
    }) }]));
  }
  var REACH_STEPS = [["swing", 1], ["swing", 0.85], ["swing", 0.7], ["steady", 1], ["steady", 0.85], ["steady", 0.7], ["steady", 0.55], ["steady", 0.4], ["swing", 0.55], ["swing", 0.4]];
  function fitPreset(anim2, render, info, out = {}, judge = null) {
    Object.assign(out, { reach: 1, grip: "swing", cut: 0 });
    if (!anim2.reach) return settle(anim2, render, info);
    const { bones, parts, grip, chain = [], prefer } = anim2.reach;
    const cut = (a) => a.keys.reduce((n, k) => {
      const c = render(k.pose).stats.clipped;
      return n + parts.reduce((m, id) => m + (c[id] || 0), 0);
    }, 0);
    let best = null;
    const steps = prefer === "steady" ? [...REACH_STEPS.filter((s) => s[0] === "steady"), ...REACH_STEPS.filter((s) => s[0] === "swing" && s[1] < 1)] : REACH_STEPS;
    for (const [how, f] of prefer === "steady" ? steps : [["swing", 1], ...steps.filter((s) => !(s[0] === "swing" && s[1] === 1))]) {
      if (how === "steady" && !grip) continue;
      const keys = anim2.keys.map((k) => {
        const p = clonePose(k.pose);
        for (const id of bones) if (p.rot[id]) p.rot[id] *= f;
        if (how === "steady") {
          p.rot[grip] = -chain.reduce((t, id) => t + (p.rot[id] || 0), 0);
          if (p.order) {
            for (const id of parts) delete p.order[id];
            if (!Object.keys(p.order).length) delete p.order;
          }
        }
        return { ...k, pose: p };
      });
      const a = settle({ ...anim2, keys }, render, info), n = judge ? judge(a) : cut(a);
      if (judge && !best) out.reason = { weapon: cut(a) > 0, frames: n };
      if (!best || n < best.n) best = { a, n, how, f };
      if (!n) break;
    }
    Object.assign(out, { reach: best.f, grip: best.how, cut: best.n, ...prefer ? { prefer } : {} });
    if (judge && judge.detail && best.n) out.left = judge.detail(best.a);
    return best.a;
  }
  function settle(anim2, render, info) {
    const ground = new Set(anim2.ground || []), air = anim2.air || {}, N = info.N, centre = new Set(anim2.centre || []);
    const mid = N / 2 + ((info.right || 0) - (info.left || 0)) / 2;
    const middle = (px) => {
      let x0 = N, x1 = -1;
      px.forEach((c, i) => {
        if (c) {
          const x = i % N;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      });
      return x1 < 0 ? null : (x0 + x1 + 1) / 2;
    };
    const lowest = (r, p) => groundRow(r.px, N, p.tilt ? null : r.stats.owner);
    const cutBelow = (r, p) => {
      if (!r.px.some((c, i) => c && (i / N | 0) === N - 1)) return 0;
      const legs = !p.tilt && Object.keys(r.stats.drawn || {}).some(isLeg);
      return Object.entries(r.stats.clipped).reduce((a, [id, v]) => a + (!legs || isLeg(id) ? v : 0), 0);
    };
    const keys = anim2.keys.map((k) => {
      let p = clonePose(k.pose), raised = false;
      if (centre.has(k.t)) for (let n = 0; n < 4; n++) {
        const m = middle(render(p).px), dx = m === null ? 0 : Math.round(mid - m);
        if (!dx) break;
        p.root[0] += dx;
      }
      for (let step2 = 0; step2 < 48; step2++) {
        const r = render(p), low = lowest(r, p), cut = cutBelow(r, p);
        if (low < 0) break;
        if (cut) {
          const q = clonePose(p);
          q.root[1] -= 1;
          if (cutBelow(render(q), q) < cut) {
            p = q;
            raised = true;
            continue;
          }
          break;
        }
        const want = ground.has(k.t) ? info.ground : k.t in air ? info.ground - air[k.t] : null;
        if (want !== null && low !== want && !(raised && want > low)) {
          p.root[1] += want - low;
          continue;
        }
        break;
      }
      return { ...k, pose: p };
    });
    const bob = anim2.bob, fitted = bob ? keys.map((k, i) => {
      const moved = k.pose.root[1] - anim2.keys[i].pose.root[1], y = ((bob[k.t] || 0) - moved) * 4;
      const off2 = { ...k.pose.off };
      if (y) off2.torso = [0, y];
      else delete off2.torso;
      return { ...k, pose: { ...k.pose, off: off2 } };
    }) : keys;
    const { ground: _g, air: _a, reach: _r, centre: _c, bob: _b, ...plain } = anim2;
    return { ...plain, keys: fitted };
  }

