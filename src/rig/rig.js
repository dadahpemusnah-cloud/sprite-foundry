  // src/rig/rig.js
  var BONES = {
    pelvis: null,
    torso: "pelvis",
    head: "torso",
    upperArmL: "torso",
    forearmL: "upperArmL",
    handL: "forearmL",
    upperArmR: "torso",
    forearmR: "upperArmR",
    handR: "forearmR",
    thighL: "pelvis",
    shinL: "thighL",
    footL: "shinL",
    thighR: "pelvis",
    shinR: "thighR",
    footR: "shinR",
    weapon: "handR",
    cloak: "pelvis"
  };
  var JOINTS = {
    pelvis: "hips (root)",
    torso: "waist",
    head: "neck",
    upperArmL: "shoulder L",
    forearmL: "elbow L",
    handL: "wrist L",
    upperArmR: "shoulder R",
    forearmR: "elbow R",
    handR: "wrist R",
    thighL: "hip L",
    shinL: "knee L",
    footL: "ankle L",
    thighR: "hip R",
    shinR: "knee R",
    footR: "ankle R",
    weapon: "grip"
  };
  var HOLDERS = ["handR", "handL", "torso", "pelvis"];
  var UNASSIGNED_LAYER = "unassigned";
  var TOP_JOINTS = /^(upperArm|thigh)[LR]$/;
  var jointName = (id) => JOINTS[id] || (/Back$/.test(id) ? (JOINTS[id.slice(0, -4)] || id) + " (back copy)" : id + " pivot");
  var pixelsOf = (seg2, test) => {
    const out = [];
    for (let t = 0; t < seg2.map.length; t++) if (test(t)) out.push(t);
    return out;
  };
  var ownerTest = (seg2, id) => {
    const k = partIndex(seg2, id);
    if (k) return (t) => seg2.map[t] === k;
    const e = seg2.extras.find((x) => x.id === id);
    return e ? (t) => e.mask[t] === 1 : () => false;
  };
  function nearestHand(seg2) {
    const w2 = partIndex(seg2, "weapon"), size = seg2.size;
    if (!w2) return null;
    const wpx = [];
    for (let t = 0; t < seg2.map.length; t++) if (seg2.map[t] === w2) wpx.push(t);
    if (!wpx.length) return null;
    let best = null, bd = Infinity;
    for (const hand of ["handR", "handL"]) {
      const k = partIndex(seg2, hand);
      if (!k) continue;
      let sx = 0, sy = 0, n = 0;
      for (let t = 0; t < seg2.map.length; t++) if (seg2.map[t] === k) {
        sx += t % size;
        sy += t / size | 0;
        n++;
      }
      if (!n) continue;
      const cx = sx / n, cy = sy / n;
      let d = Infinity;
      for (let i = 0; i < wpx.length; i += Math.max(1, wpx.length >> 9)) d = Math.min(d, Math.hypot(wpx[i] % size - cx, (wpx[i] / size | 0) - cy));
      if (d < bd) {
        bd = d;
        best = hand;
      }
    }
    return best;
  }
  function defaultParent(seg2, id) {
    const has2 = (p) => p && (partIndex(seg2, p) || seg2.extras.some((e) => e.id === p));
    const extra = seg2.extras.find((e) => e.id === id);
    if (extra) {
      const sp = defaultParent(seg2, extra.from);
      return has2(sp && sp + "Back") ? sp + "Back" : sp;
    }
    if (id === "weapon") {
      const h = nearestHand(seg2);
      if (h) return h;
    }
    if (id in BONES) {
      let p = BONES[id];
      while (p && !has2(p)) p = BONES[p];
      return p || null;
    }
    return has2("torso") ? "torso" : has2("pelvis") ? "pelvis" : null;
  }
  function treeOrder(rig) {
    const out = [], state2 = {};
    const visit = (id, path) => {
      if (state2[id] === 2) return;
      if (state2[id] === 1) throw new Error("The bone tree has a loop at " + id + ".");
      state2[id] = 1;
      const p = rig.bones[id] && rig.bones[id].parent;
      if (p && rig.bones[p]) visit(p);
      state2[id] = 2;
      out.push(id);
    };
    for (const id of Object.keys(rig.bones)) visit(id);
    return out;
  }
  function centroid(ts, size) {
    let x = 0, y = 0;
    for (const t of ts) {
      x += t % size + 0.5;
      y += (t / size | 0) + 0.5;
    }
    return ts.length ? [x / ts.length, y / ts.length] : null;
  }
  function suggestPivot(seg2, id, parent) {
    const size = seg2.size, mine = pixelsOf(seg2, ownerTest(seg2, id));
    if (!mine.length) return parent ? suggestPivot(seg2, parent, null) : [size / 2, size / 2];
    if (!parent) return centroid(mine, size);
    const base = /Back$/.test(id) ? id.slice(0, -4) : id;
    const theirs = ownerTest(seg2, parent);
    if (TOP_JOINTS.test(base)) {
      let top = size, bottom = -1;
      const widths = /* @__PURE__ */ new Map();
      for (const t of mine) {
        const y = t / size | 0;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        widths.set(y, (widths.get(y) || 0) + 1);
      }
      const ws = [...widths.values()].sort((a, b) => a - b), w2 = Math.max(2, ws[ws.length >> 1]), half2 = top + (bottom - top) / 2;
      const touch2 = [];
      for (const t of mine) {
        const x = t % size, y = t / size | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
          if (theirs(Y * size + X)) touch2.push([x + 0.5 + dx / 2, y + 0.5 + dy / 2]);
        }
      }
      const c0 = touch2.reduce((m, p) => Math.min(m, p[1]), Infinity);
      if (c0 <= half2) {
        const near = touch2.filter((p) => p[1] <= c0 + w2);
        return [near.reduce((s, p) => s + p[0], 0) / near.length, near.reduce((s, p) => s + p[1], 0) / near.length];
      }
      return [centroid(mine.filter((t) => (t / size | 0) <= top + 2), size)[0], top + w2 / 2];
    }
    let sx = 0, sy = 0, n = 0;
    for (const t of mine) {
      const x = t % size, y = t / size | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
        if (theirs(Y * size + X)) {
          sx += x + 0.5 + dx / 2;
          sy += y + 0.5 + dy / 2;
          n++;
        }
      }
    }
    if (n) return [sx / n, sy / n];
    return nearestTo(mine, theirs, size) || centroid(mine, size);
  }
  function nearestTo(ts, theirs, size) {
    const dist = new Int32Array(size * size).fill(-1), q = [];
    for (let t = 0; t < dist.length; t++) if (theirs(t)) {
      dist[t] = 0;
      q.push(t);
    }
    if (!q.length) return null;
    for (let h = 0; h < q.length; h++) {
      const t = q[h], x = t % size;
      for (const u of [x > 0 ? t - 1 : -1, x < size - 1 ? t + 1 : -1, t - size, t + size]) if (u >= 0 && u < dist.length && dist[u] < 0) {
        dist[u] = dist[t] + 1;
        q.push(u);
      }
    }
    let best = Infinity;
    for (const t of ts) best = Math.min(best, dist[t]);
    return centroid(ts.filter((t) => dist[t] <= best + 1), size);
  }
  function syncRig(seg2, prev = null) {
    const ids = [...seg2.parts.map((p) => p.id), ...seg2.extras.map((e) => e.id)], bones = {};
    for (const id of ids) {
      const old = prev && prev.bones[id];
      const parent = old && (old.parent === null || ids.includes(old.parent)) && old.parent !== id ? old.parent : defaultParent(seg2, id);
      const fixed = old && old.auto === false;
      bones[id] = { parent, pivot: fixed ? old.pivot.slice() : suggestPivot(seg2, id, parent), auto: !fixed };
    }
    const rig = { bones, order: [], bleed: prev ? prev.bleed : 2, ...prev && prev.keepUnassigned ? { keepUnassigned: true } : {} };
    try {
      treeOrder(rig);
    } catch (e) {
      for (const id of ids) bones[id].parent = defaultParent(seg2, id);
    }
    const parts = seg2.parts.map((p) => p.id);
    const order2 = prev ? prev.order.filter((id) => parts.includes(id)) : [];
    for (const [i, id] of parts.entries()) {
      if (order2.includes(id)) continue;
      const before = parts.slice(0, i).reverse().find((p) => order2.includes(p));
      order2.splice(before ? order2.indexOf(before) + 1 : prev ? order2.length : 0, 0, id);
    }
    rig.order = order2;
    return rig;
  }
  function suggestAll(seg2, rig) {
    const next = { ...rig, bones: {} };
    for (const [id, b] of Object.entries(rig.bones)) next.bones[id] = { parent: b.parent, pivot: suggestPivot(seg2, id, b.parent), auto: true };
    return next;
  }
  function setParent(rig, id, parent) {
    if (!rig.bones[id] || parent !== null && !rig.bones[parent] || parent === id) throw new Error("Unknown part.");
    const next = { ...rig, bones: { ...rig.bones, [id]: { ...rig.bones[id], parent } } };
    treeOrder(next);
    return next;
  }
  function setPivot(rig, id, [x, y], size) {
    const c = (v) => Math.max(0, Math.min(size, Math.round(v * 2) / 2));
    return { ...rig, bones: { ...rig.bones, [id]: { ...rig.bones[id], pivot: [c(x), c(y)], auto: false } } };
  }
  var ORDER_PLACES = ["front", "back"];
  function effectiveOrder(order2, place) {
    if (!place || !Object.keys(place).length) return order2;
    const back = order2.filter((id) => place[id] === "back"), front = order2.filter((id) => place[id] === "front");
    return [...back, ...order2.filter((id) => place[id] !== "back" && place[id] !== "front"), ...front];
  }
  function moveLayer(rig, id, delta) {
    const o = rig.order.slice(), i = o.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= o.length) return rig;
    [o[i], o[j]] = [o[j], o[i]];
    return { ...rig, order: o };
  }
  var mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  var ID2 = [1, 0, 0, 1, 0, 0];
  var rotAbout = (deg2, [px, py]) => {
    if (!deg2) return ID2;
    const r = deg2 * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [c, s, -s, c, px - c * px + s * py, py - s * px - c * py];
  };
  var apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  }
  function worldMatrices(rig, pose2 = {}, size = null) {
    const rot = pose2.rot || {}, off2 = pose2.off || {}, root = pose2.root || [0, 0], W = {};
    const rootM = mul([1, 0, 0, 1, root[0] * 4, root[1] * 4], size && pose2.tilt ? rotAbout(pose2.tilt, [size / 2, size]) : ID2);
    for (const id of treeOrder(rig)) {
      const b = rig.bones[id], o = off2[id] || [0, 0];
      const local = mul(rotAbout(rot[id] || 0, b.pivot), [1, 0, 0, 1, o[0], o[1]]);
      W[id] = mul(b.parent ? W[b.parent] : rootM, local);
    }
    W[UNASSIGNED_LAYER] = rootM;
    return W;
  }
  function bleedRing(seg2, rgba, owns, bleed) {
    const size = seg2.size, ring = /* @__PURE__ */ new Map();
    if (!bleed) return ring;
    let front = [];
    const src = /* @__PURE__ */ new Map();
    for (let t = 0; t < seg2.map.length; t++) if (owns(t)) {
      src.set(t, t);
      front.push(t);
    }
    for (let step2 = 0; step2 < bleed; step2++) {
      const next = [];
      for (const t of front) {
        const x = t % size, y = t / size | 0, from = src.get(t);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (!dx && !dy || X < 0 || Y < 0 || X >= size || Y >= size) continue;
          const u = Y * size + X;
          if (src.has(u) || !seg2.map[u]) continue;
          src.set(u, from);
          ring.set(u, from);
          next.push(u);
        }
      }
      front = next;
    }
    return ring;
  }
  function bbox2(ts, size) {
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (const t of ts) {
      const x = t % size, y = t / size | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
  }
  function prepareLayers(seg2, rgba, rig, art = null, N = null) {
    const S = seg2.size, L = { size: S, rgba, layers: {} };
    const add = (id, owns, darken = 0, ringOf = true) => {
      const ts = pixelsOf(seg2, owns), ring = ringOf ? bleedRing(seg2, rgba, owns, rig.bleed) : /* @__PURE__ */ new Map();
      L.layers[id] = { owns, src: rgba, darken, ts, box: bbox2(ts, S), ringBox: bbox2([...ring.keys()], S), ring, alts: {}, hole: null };
    };
    for (const p of seg2.parts) add(p.id, ownerTest(seg2, p.id));
    for (const e of seg2.extras) add(e.id, ownerTest(seg2, e.id), e.darken, false);
    add(UNASSIGNED_LAYER, (t) => seg2.map[t] === UNASSIGNED, 0, false);
    L.extras = seg2.extras.map((e) => e.id);
    if (art && N) {
      const B = S / N;
      const layerOf = (px, keep) => {
        const src = new Uint8ClampedArray(S * S * 4), ts = [];
        for (let t = 0; t < S * S; t++) {
          const c = px[((t / S | 0) / B | 0) * N + (t % S / B | 0)];
          if (!c || !keep(t)) continue;
          const n = parseInt(c.slice(1), 16);
          src[t * 4] = n >> 16 & 255;
          src[t * 4 + 1] = n >> 8 & 255;
          src[t * 4 + 2] = n & 255;
          src[t * 4 + 3] = 255;
          ts.push(t);
        }
        return { src, ts, owns: (t) => src[t * 4 + 3] === 255, box: bbox2(ts, S), darken: 0 };
      };
      for (const [id, list] of Object.entries(art.swaps || {})) if (L.layers[id]) for (const a of list) L.layers[id].alts[a.name] = layerOf(a.px, () => true);
      for (const [id, px] of Object.entries(art.holes || {})) {
        const k = partIndex(seg2, id);
        if (!k || !L.layers[id]) continue;
        L.layers[id].hole = layerOf(px, (t) => seg2.map[t] !== 0 && seg2.map[t] !== k);
      }
    }
    return L;
  }
  var REAL = 1;
  var RING = 2;
  var HOLE = 3;
  var BACK = 4;
  var SWAP = 5;
  var SMEAR = 6;
  var MADE = { [SWAP]: "drawing", [HOLE]: "hidden area", [BACK]: "back limb", [SMEAR]: "smear", [RING]: "joint fill" };
  var MADE_ORDER = [SWAP, HOLE, BACK, SMEAR, RING];
  var SMEAR_MAX = 4;
  function stretchAbout(pivot, box, f) {
    let vx = (box[0] + box[2]) / 2 - pivot[0], vy = (box[1] + box[3]) / 2 - pivot[1];
    const len = Math.hypot(vx, vy);
    if (len < 1e-6) {
      vx = 0;
      vy = 1;
    } else {
      vx /= len;
      vy /= len;
    }
    const k = f - 1, a = 1 + k * vx * vx, b = k * vx * vy, d = 1 + k * vy * vy;
    return [a, b, b, d, pivot[0] - a * pivot[0] - b * pivot[1], pivot[1] - b * pivot[0] - d * pivot[1]];
  }
  var SNAP_LIMIT = 2;
  function snapToPixels(M, pivot, box) {
    const p = apply(M, pivot), t = [p[0] - pivot[0], p[1] - pivot[1]];
    if (M[0] === 1 && M[1] === 0 && M[2] === 0 && M[3] === 1 && t.every((v) => v % 4 === 0)) return M;
    if (box) for (const c of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) {
      const q = apply(M, c);
      if (Math.hypot(q[0] - c[0] - t[0], q[1] - c[1] - t[1]) >= SNAP_LIMIT) return M;
    }
    const r = (v) => Math.sign(v) * Math.round(Math.abs(v) / 4) * 4 || 0;
    return [1, 0, 0, 1, r(t[0]), r(t[1])];
  }
  var restCache = /* @__PURE__ */ new WeakMap();
  function restParts(L, rig, N, palette, settings) {
    let c = restCache.get(L);
    if (c && c.rig === rig && c.N === N && c.palette === palette && c.settings === settings) return c;
    const r = renderRig(L, rig, {}, { N, palette, settings }), parts = {};
    for (let i = 0; i < N * N; i++) {
      const id = r.stats.owner[i];
      if (!id || !r.px[i]) continue;
      (parts[id] = parts[id] || []).push(i);
    }
    c = { rig, N, palette, settings, pics: {}, drawn: r.stats.drawn };
    for (const [id, list] of Object.entries(parts)) {
      let x0 = N, y0 = N, x1 = -1, y1 = -1;
      for (const i of list) {
        const x = i % N, y = i / N | 0;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      const w2 = x1 - x0 + 1, h = y1 - y0 + 1, px = new Array(w2 * h).fill(null);
      for (const i of list) px[((i / N | 0) - y0) * w2 + i % N - x0] = r.px[i];
      c.pics[id] = { px, w: w2, h, x0, y0, up: null, count: list.length };
    }
    restCache.set(L, c);
    return c;
  }
  function renderRig(L, rig, pose2, { N, palette, settings = DEFAULTS2 }) {
    const S = L.size, out = new Uint8ClampedArray(S * S * 4), origin = new Uint8Array(S * S), W = worldMatrices(rig, pose2, S), snapped = [];
    for (const id of Object.keys(W)) {
      const lay = L.layers[id], b = rig.bones[id], M = W[id];
      const n = snapToPixels(M, b ? b.pivot : [S / 2, S], lay && lay.box);
      if (n !== M) {
        W[id] = n;
        if (id !== UNASSIGNED_LAYER && (M[0] !== 1 || M[1] !== 0 || M[4] !== n[4] || M[5] !== n[5])) snapped.push(id);
      }
    }
    const ids = Object.keys(L.layers), who = new Int16Array(S * S).fill(-1);
    const smooth2 = pose2 && pose2.smooth ? restParts(L, rig, N, palette, settings) : null, Bk = S / N;
    const swap = pose2 && pose2.swap || {}, smear = pose2 && pose2.smear || {}, drawn = {}, clipped = {};
    const draw = (id, kind) => {
      const base = L.layers[id];
      if (!base) return;
      let lay = base, mark = kind;
      if (kind === HOLE) {
        lay = base.hole;
        if (!lay) return;
      } else if ((kind === REAL || kind === SMEAR) && swap[id] && base.alts[swap[id]]) {
        lay = base.alts[swap[id]];
        mark = kind === SMEAR ? SMEAR : SWAP;
      } else if (kind === REAL && L.extras.includes(id)) mark = BACK;
      const box = kind === RING ? lay.ringBox : lay.box;
      if (!box) return;
      const M0 = W[id] || W[UNASSIGNED_LAYER], M = kind === SMEAR ? mul(M0, stretchAbout(rig.bones[id].pivot, lay.box, smear[id])) : M0, inv = invert(M);
      const pic = smooth2 && kind === REAL && lay === base && (M[0] !== 1 || M[1] !== 0) && smooth2.pics[id];
      let recol = null;
      if (pic) {
        if (!pic.up) pic.up = upscale8(pic.px, pic.w, pic.h);
        const a = M[0], b = M[1], c = M[2], d2 = M[3], e = M[4] / Bk, f = M[5] / Bk;
        const turned = rotsprite(pic.px, pic.w, pic.h, [a, b, c, d2, a * pic.x0 + c * pic.y0 + e, b * pic.x0 + d2 * pic.y0 + f], N, N, pic.up);
        recol = new Int32Array(N * N).fill(-1);
        for (let i = 0; i < N * N; i++) if (turned[i]) recol[i] = parseInt(turned[i].slice(1), 16);
      }
      const pts = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].map((p) => apply(M, p));
      const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])))), x1 = Math.min(S, Math.ceil(Math.max(...pts.map((p) => p[0]))));
      const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])))), y1 = Math.min(S, Math.ceil(Math.max(...pts.map((p) => p[1]))));
      const k = 1 - lay.darken, d = kind === RING ? base.src : lay.src, me = ids.indexOf(id);
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const sx = Math.floor(inv[0] * (x + 0.5) + inv[2] * (y + 0.5) + inv[4]), sy = Math.floor(inv[1] * (x + 0.5) + inv[3] * (y + 0.5) + inv[5]);
        if (sx < 0 || sy < 0 || sx >= S || sy >= S) continue;
        let s = sy * S + sx;
        if (kind === RING) {
          const from = lay.ring.get(s);
          if (from === void 0) continue;
          s = from;
        } else if (!lay.owns(s)) continue;
        const t = y * S + x;
        const rv = recol ? recol[(y / Bk | 0) * N + (x / Bk | 0)] : -1;
        if (rv >= 0) {
          out[t * 4] = rv >> 16 & 255;
          out[t * 4 + 1] = rv >> 8 & 255;
          out[t * 4 + 2] = rv & 255;
        } else {
          out[t * 4] = d[s * 4] * k;
          out[t * 4 + 1] = d[s * 4 + 1] * k;
          out[t * 4 + 2] = d[s * 4 + 2] * k;
        }
        out[t * 4 + 3] = 255;
        origin[t] = mark;
        who[t] = me;
        n++;
      }
      if (kind === REAL && id !== UNASSIGNED_LAYER) {
        drawn[id] = n;
        let c = 0;
        for (const s of lay.ts) {
          const [X, Y] = apply(M, [s % S + 0.5, (s / S | 0) + 0.5]);
          if (X < 0 || Y < 0 || X >= S || Y >= S) c++;
        }
        if (c) clipped[id] = c;
      }
    };
    const order2 = effectiveOrder(rig.order, pose2 && pose2.order);
    for (const id of order2) draw(id, RING);
    for (const id of order2) draw(id, HOLE);
    draw(UNASSIGNED_LAYER, REAL);
    for (const id of L.extras) draw(id, REAL);
    for (const id of order2) {
      if (smear[id] > 1 && rig.bones[id]) draw(id, SMEAR);
      draw(id, REAL);
    }
    const { px } = pixelsFromWork(workFromRGBA(out, S), N, palette, { ...DEFAULTS2, ...settings });
    const shows = { [RING]: 0, [HOLE]: 0, [BACK]: 0, [SWAP]: 0, [SMEAR]: 0 }, B = S / N, owner = new Array(N * N).fill(null), made = new Array(N * N).fill(null);
    for (let i = 0; i < N * N; i++) {
      if (!px[i]) continue;
      const x = i % N, y = i / N | 0, seen = /* @__PURE__ */ new Set(), count = /* @__PURE__ */ new Map();
      for (let yy = 0; yy < B; yy++) for (let xx = 0; xx < B; xx++) {
        const t = (y * B + yy) * S + x * B + xx, o = origin[t];
        if (o > REAL) seen.add(o);
        if (who[t] >= 0) count.set(who[t], (count.get(who[t]) || 0) + 1);
      }
      for (const o of seen) shows[o]++;
      if (seen.size) made[i] = MADE[MADE_ORDER.find((o) => seen.has(o))];
      let best = -1, bn = 0;
      for (const [w2, c] of count) if (c > bn || c === bn && w2 < best) {
        best = w2;
        bn = c;
      }
      if (best >= 0) owner[i] = ids[best];
    }
    return { px, work: out, stats: { bleedPixels: shows[RING], holePixels: shows[HOLE], backPixels: shows[BACK], swapPixels: shows[SWAP], smearPixels: shows[SMEAR], drawn, clipped, owner, snapped, made } };
  }

