  // src/rig/check.js
  var BODY = /* @__PURE__ */ new Set(["torso", "head", "pelvis"]);
  function bodyPoint(px, owner, N, feet = null) {
    const cols = [];
    px.forEach((c, i) => {
      if (c && BODY.has(owner[i])) cols.push(i % N);
    });
    cols.sort((a, b) => a - b);
    return { mid: cols.length ? cols[cols.length >> 1] : null, y1: feet != null && feet >= 0 ? feet : groundRow(px, N, owner) };
  }
  var GROUNDED = /^(idle|walk)/;
  function holes(px, N) {
    const seen = new Uint8Array(N * N), out = [];
    for (let s = 0; s < N * N; s++) {
      if (px[s] || seen[s]) continue;
      const q = [s], members = [];
      seen[s] = 1;
      let border = false;
      while (q.length) {
        const t = q.pop(), x = t % N, y = t / N | 0;
        members.push(t);
        if (!x || !y || x === N - 1 || y === N - 1) border = true;
        for (const u of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, y > 0 ? t - N : -1, y < N - 1 ? t + N : -1]) if (u >= 0 && !px[u] && !seen[u]) {
          seen[u] = 1;
          q.push(u);
        }
      }
      if (!border) out.push(members);
    }
    return out;
  }
  function movedCopy(rest, px, N) {
    if (rest.every((c, i) => c === px[i])) return false;
    const flip = rest.map((_, i) => rest[(i / N | 0) * N + (N - 1 - i % N)]);
    if (flip.every((c, i) => c === px[i])) return true;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (!dx && !dy) continue;
      let ok = true;
      for (let y = 0; y < N && ok; y++) for (let x = 0; x < N; x++) {
        const X = x - dx, Y = y - dy, v = X >= 0 && Y >= 0 && X < N && Y < N ? rest[Y * N + X] : null;
        if (v !== px[y * N + x]) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }
  function strayPieces(px, owner, N, gap = 2) {
    const R = 1 + gap, lab = new Int32Array(N * N).fill(-1), comps = [];
    for (let i = 0; i < N * N; i++) {
      if (!px[i] || lab[i] >= 0) continue;
      const c = comps.length, q = [i], parts = /* @__PURE__ */ new Set();
      lab[i] = c;
      let size = 0;
      while (q.length) {
        const u = q.pop(), x = u % N, y = u / N | 0;
        size++;
        if (owner[u]) parts.add(owner[u]);
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const X = x + dx, Y = y + dy, v = Y * N + X;
          if (X >= 0 && Y >= 0 && X < N && Y < N && px[v] && lab[v] < 0) {
            lab[v] = c;
            q.push(v);
          }
        }
      }
      comps.push({ size, parts });
    }
    if (!comps.length) return [];
    const big = comps.reduce((b, c, k) => c.size > comps[b].size ? k : b, 0);
    return comps.filter((c, k) => k !== big);
  }
  var apartPieces = (px, owner, N, which, gap = 2) => strayPieces(px, owner, N, gap).filter((c) => [...c.parts].some((p) => which.has(p))).length;
  function rigContext({ rest, rig, render, base = render({ rot: {}, off: {}, root: [0, 0] }) }) {
    const N = rest.N;
    return {
      N,
      rig,
      base,
      restHoles: new Set(holes(base.px, N).flat()),
      jointAt: (pose2) => {
        const W = worldMatrices(rig, pose2, N * 4);
        return Object.entries(rig.bones).map(([id, b]) => [id, apply(W[id], b.pivot).map((v) => v / 4)]);
      }
    };
  }
  function poseFindings(ctx, r, pose2, label) {
    const { N, rig, base, restHoles } = ctx, px = r.px, st = r.stats, out = [], add = (level, code, message, part) => out.push(part ? { level, code, message, part } : { level, code, message });
    const movedAway = (h, around) => {
      const o = base.stats && base.stats.owner;
      return !o || h.some((t) => o[t] && !around.has(o[t]));
    };
    const cut = Object.values(st.clipped).reduce((s, v) => s + v, 0);
    if (cut) add("warning", "clipped", `${label}: ${Math.ceil(cut / 16)} px of the character fall outside the sprite and are cut off (${Object.keys(st.clipped).join(", ")}). Turn the part less, or give the sprite more headroom in step 3.`);
    for (const [id, n] of Object.entries(st.drawn)) {
      const n0 = base.stats.drawn[id] || 0;
      if (n0 >= 64 && Math.abs(n / n0 - 1) > 0.15 && !st.clipped[id]) add("warning", "proportion", `${label}: ${id} is drawn ${Math.round(Math.abs(n / n0 - 1) * 100)}% ${n < n0 ? "smaller" : "larger"} than at rest.`);
    }
    const joints = ctx.jointAt(pose2), owner = st.owner || [];
    for (const h of holes(px, N)) {
      if (h.length < 2 || h.every((t) => restHoles.has(t))) continue;
      const around = /* @__PURE__ */ new Set();
      for (const t of h) {
        const x = t % N;
        for (const u of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, t - N, t + N]) if (u >= 0 && u < N * N && owner[u]) around.add(owner[u]);
      }
      const near = joints.find(([id, [x, y]]) => around.size === 2 && around.has(id) && rig.bones[id].parent && around.has(rig.bones[id].parent) && h.some((t) => Math.hypot(t % N + 0.5 - x, (t / N | 0) + 0.5 - y) <= 3));
      if (near) add("warning", "joint-gap", `${label}: a ${h.length} px gap opens at the ${near[0]} joint. Raise the joint fill in step 5 or paint the hidden area in step 7.`, near[0]);
      else if (h.filter((t) => base.px[t]).length * 2 >= h.length && movedAway(h, around)) add("info", "uncovered", `${label}: a ${h.length} px hole opens inside ${[...around].join(", ")} that the still image does not have. If it should be filled, paint the hidden area of ${[...around].join(" or ")} in step 7.`);
    }
    const notes = [[st.bleedPixels, "joint fill"], [st.holePixels, "painted hidden area"], [st.backPixels, "user-made back limb"], [st.swapPixels, "alternate drawing"], [st.smearPixels, "user-made smear"]].filter(([n]) => n);
    if (notes.length) add("info", "not-in-image", `${label} shows ${notes.map(([n, w2]) => `${n} px of ${w2}`).join(", ")} (not in the image).`);
    return out;
  }
  function checkRig({ timeline: timeline2, rest, rig, render, framePx = null, allowed = [] }) {
    const findings = [], N = rest.N, add = (level, code, anim2, frame, message) => findings.push({ level, code, anim: anim2, frame, message });
    const label = (a, i) => `${a} frame ${i + 1}`;
    const base = render({ rot: {}, off: {}, root: [0, 0] });
    const restRow = feetRow(base, N);
    const palette = /* @__PURE__ */ new Set([...rest.palette, ...allowed]);
    const ctx = rigContext({ rest, rig, render, base });
    const baseStray = strayPieces(base.px, base.stats.owner || [], N).reduce((n, c) => n + c.size, 0);
    const moving = /* @__PURE__ */ new Set();
    for (const name of timeline2.order) {
      const a = timeline2.anims[name];
      if (!a || !a.frames.some((f) => f.spec && f.spec.pose)) continue;
      const grounded2 = GROUNDED.test(name), tolerance = /^idle/.test(name) ? 0 : 1;
      moving.clear();
      let prevRoot = null, prevPx = null, prevPose = null;
      a.frames.forEach((fr, i) => {
        const pose2 = fr.spec && fr.spec.pose;
        if (pose2) {
          for (const [id, v] of Object.entries(pose2.rot || {})) if (v) moving.add(id);
          for (const [id, v] of Object.entries(pose2.off || {})) if (v[0] || v[1]) moving.add(id);
        }
        if (fr.px) {
          if (framePx) {
            const bad = new Set(framePx(name, i).filter((c) => c && !palette.has(c)));
            if (bad.size) add("warning", "palette", name, i, `${label(name, i)} (edited by hand) uses ${bad.size} colour${bad.size > 1 ? "s" : ""} outside the sprite's palette (${[...bad].slice(0, 3).join(", ")}${bad.size > 3 ? ", \u2026" : ""}).`);
          }
          prevRoot = null;
          prevPx = null;
          prevPose = null;
          return;
        }
        if (!pose2) return;
        const r = render(pose2), px = r.px, st = r.stats;
        const out = poseFindings(ctx, r, pose2, label(name, i));
        for (const f of out.filter((f2) => f2.code === "clipped" || f2.code === "proportion")) add(f.level, f.code, name, i, f.message);
        if (grounded2) {
          const row = feetRow(r, N);
          if (row >= 0 && Math.abs(row - restRow) > tolerance) add("warning", "ground", name, i, `${label(name, i)}: the feet ${row < restRow ? "leave" : "sink below"} the ground line by ${Math.abs(row - restRow)} px.`);
          const root = pose2.root || [0, 0];
          if (prevRoot && Math.max(Math.abs(root[0] - prevRoot[0]), Math.abs(root[1] - prevRoot[1])) > 1) add("warning", "body-jump", name, i, `${label(name, i)}: the whole body jumps ${Math.max(Math.abs(root[0] - prevRoot[0]), Math.abs(root[1] - prevRoot[1]))} px from the frame before.`);
          prevRoot = root;
        }
        for (const f of out.filter((f2) => f2.code === "joint-gap" || f2.code === "uncovered")) add(f.level, f.code, name, i, f.message);
        if (movedCopy(base.px, px, N)) add("warning", "moved-copy", name, i, `${label(name, i)} is the still image moved or mirrored as one block, not a new pose.`);
        const strays = strayPieces(px, st.owner || [], N), extra = strays.reduce((n, c) => n + c.size, 0) - baseStray;
        if (extra >= 2) {
          const turned = (id) => {
            for (let k = id, d = 0; k && d < 32; k = rig.bones[k] && rig.bones[k].parent, d++) if ((pose2.rot || {})[k] || ((pose2.off || {})[k] || [0, 0]).some(Boolean)) return true;
            return false;
          };
          const parts = [...new Set(strays.flatMap((c) => [...c.parts]))], moving2 = parts.filter(turned), list = (l) => l.slice(0, 3).join(", ") + (l.length > 3 ? ", \u2026" : "");
          if (moving2.length) add("warning", "apart", name, i, `${label(name, i)}: ${list(moving2)} ${moving2.length > 1 ? "come" : "comes"} away from the body (${extra} px apart from it). Turn the part less, or check its joint in step 5.`);
          else add("warning", "left-behind", name, i, `${label(name, i)}: ${extra} px of ${list(parts)} ${parts.length > 1 ? "are" : "is"} left standing apart from the body while the parts around ${parts.length > 1 ? "them" : "it"} move. ${parts.length > 1 ? "They" : "It"} may belong to a moving part (step 4), or a hidden area may need painting (step 7).`);
        }
        if (prevPx && prevPose && JSON.stringify(prevPose) !== JSON.stringify(pose2) && px.reduce((n, c, k) => n + (c !== prevPx[k]), 0) <= 1) add("warning", "same-frame", name, i, `${label(name, i)} looks the same as the frame before: the motion between them is too small to show. Make the keys differ more, or use fewer frames.`);
        prevPx = px;
        prevPose = pose2;
        for (const f of out.filter((f2) => f2.code === "not-in-image")) add(f.level, f.code, name, i, f.message);
      });
      if (moving.size < 2) add("warning", "few-parts", name, null, `${name} moves ${moving.size ? "only " + [...moving].join(", ") : "no parts"}: it would look like the still image moved. Turn at least two parts.`);
    }
    return findings;
  }

