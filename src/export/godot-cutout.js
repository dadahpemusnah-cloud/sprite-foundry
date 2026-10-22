  // src/export/godot-cutout.js
  var D8 = [...D4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function cutParts({ frame, F, pad, N, owner, z, alone = {} }) {
    const rank = (id) => z.indexOf(id), own = new Array(F * F).fill(null);
    const ownerAt = (X, Y) => {
      const x = X - pad, y = Y - pad;
      return x >= 0 && y >= 0 && x < N && y < N ? owner[y * N + x] : null;
    };
    for (let i = 0; i < F * F; i++) if (frame[i]) own[i] = ownerAt(i % F, i / F | 0);
    for (let i = 0; i < F * F; i++) {
      if (!frame[i] || own[i]) continue;
      const X = i % F, Y = i / F | 0;
      for (const dirs of [D4, D8]) {
        let best = null;
        for (const [dx, dy] of dirs) {
          const o = ownerAt(X + dx, Y + dy);
          if (o && (!best || rank(o) > rank(best))) best = o;
        }
        if (best) {
          own[i] = best;
          break;
        }
      }
      if (!own[i]) own[i] = UNASSIGNED_LAYER;
    }
    const pts = {};
    const put = (id, i, c) => (pts[id] = pts[id] || []).push([i % F, i / F | 0, c]);
    for (let i = 0; i < F * F; i++) if (frame[i]) put(own[i], i, frame[i]);
    for (const [id, px] of Object.entries(alone)) for (let s = 0; s < N * N; s++) {
      if (!px[s]) continue;
      const i = ((s / N | 0) + pad) * F + s % N + pad;
      if (frame[i] && own[i] !== id && rank(own[i]) > rank(id)) put(id, i, px[s]);
    }
    const out = {};
    for (const [id, list] of Object.entries(pts)) out[id] = picture(list);
    return out;
  }
  function partAlone(L, rig, id, { N, palette, settings }, pose2 = {}) {
    const one = { ...L, layers: { [id]: L.layers[id] }, extras: [] };
    return renderRig(one, { ...rig, order: [id] }, pose2, { N, palette, settings }).px;
  }
  var picture = (list) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (const [x, y] of list) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const w2 = x1 - x0 + 1, h = y1 - y0 + 1, px = new Array(w2 * h).fill(null);
    for (const [x, y, c] of list) px[(y - y0) * w2 + x - x0] = c;
    return { x: x0, y: y0, w: w2, h, px };
  };
  function shareBox(pics) {
    const x0 = Math.min(...pics.map((p) => p.x)), y0 = Math.min(...pics.map((p) => p.y));
    const x1 = Math.max(...pics.map((p) => p.x + p.w)), y1 = Math.max(...pics.map((p) => p.y + p.h)), w2 = x1 - x0, h = y1 - y0;
    return pics.map((p) => {
      const px = new Array(w2 * h).fill(null);
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) px[(y + p.y - y0) * w2 + x + p.x - x0] = p.px[y * p.w + x];
      return { x: x0, y: y0, w: w2, h, px };
    });
  }
  var TRANSITION = { linear: 1, easeIn: 2, easeOut: 0.5, step: 0 };
  var f6 = (v) => {
    const s = String(+(+v).toFixed(6));
    return s === "-0" ? "0" : s;
  };
  var deg = (d) => d * Math.PI / 180;
  var fl = (v) => {
    const s = f6(v);
    return /[.e]/.test(s) ? s : s + ".0";
  };
  var nodeName = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, "_");
  function playPlan(anim2, play2) {
    const n = anim2.frames, d = play2.durationsMs.slice(0, n), even2 = d.every((v) => v === d[0]);
    const pp = play2.mode === "pingpong" && play2.loop && n >= 3 && even2;
    const native = pp || play2.mode === "forward" && (play2.loop || (play2.repeat || 1) <= 1);
    const frames = native ? Array.from({ length: n }, (_, i) => i) : playSequence(n, play2);
    const times = [];
    let t = 0;
    for (const f of frames) {
      times.push(t / 1e3);
      t += d[f];
    }
    return { frames, times, length: pp ? times[n - 1] : t / 1e3, loopMode: pp ? 2 : play2.loop ? 1 : 0, native, pingpong: pp, durs: d };
  }
  function breakpoints(anim2, plan, exactProp) {
    const n = anim2.frames, keys = anim2.keys, bp = /* @__PURE__ */ new Map();
    if (!keys.length) return /* @__PURE__ */ new Map([[0, 1]]);
    const wrap = anim2.loop && !plan.pingpong;
    const evenOver = (a, b) => {
      for (let f = a; f < b; f++) if (plan.durs[f % n] !== plan.durs[a % n]) return false;
      return true;
    };
    const bake = (a, b) => {
      for (let f = a; f < b; f++) if (!bp.has(f % n)) bp.set(f % n, 1);
    };
    if (plan.pingpong) {
      bake(0, keys[0].t);
      bake(keys[keys.length - 1].t, n);
    }
    keys.forEach((k, j) => {
      const next = j + 1 < keys.length ? keys[j + 1].t : wrap ? keys[0].t + n : null;
      if (next === null) {
        bp.set(k.t, bp.get(k.t) ?? 1);
        return;
      }
      if (k.ease in TRANSITION && exactProp && evenOver(k.t, next)) {
        const h = Math.min(k.hold || 0, next - k.t - 1);
        if (h > 0) {
          bp.set(k.t, 0);
          bp.set((k.t + h) % n, TRANSITION[k.ease]);
        } else bp.set(k.t, TRANSITION[k.ease]);
      } else bake(k.t, next);
    });
    return bp;
  }
  function trackKeys(anim2, plan, poses, get, kind, exact) {
    const raw = plan.frames.map((f) => get(poses[f]));
    let keys;
    if (kind === "discrete") {
      keys = [];
      raw.forEach((v, j) => {
        if (!j || !same(v, raw[j - 1])) keys.push({ time: plan.times[j], value: v, trans: 1 });
      });
      return keys;
    }
    if (plan.native) {
      const bp = breakpoints(anim2, plan, exact);
      keys = [...bp.keys()].sort((a, b) => a - b).map((f) => ({ time: plan.times[f], value: raw[f], trans: bp.get(f) }));
    } else keys = raw.map((value, j) => ({ time: plan.times[j], value, trans: 1 }));
    if (kind === "angle") for (let j = 1; j < keys.length; j++) {
      const p = keys[j - 1].value;
      keys[j].value = p + (((keys[j].value - p) % 360 + 540) % 360 - 180);
    }
    if (keys.every((k) => same(k.value, keys[0].value))) keys = [{ time: 0, value: keys[0].value, trans: 1 }];
    return keys;
  }
  var same = (a, b) => Array.isArray(a) ? a[0] === b[0] && a[1] === b[1] : a === b;
  function godotCutoutScene({ name, scale = 1, pivot, pad, N, B, rig, pics, z, boxes = {}, anims }) {
    const bones = treeOrder(rig).filter((id) => rig.bones[id]);
    const tilt = [pad + N / 2 - pivot.x, pad + N - pivot.y];
    const path = {};
    for (const id of bones) {
      const p = rig.bones[id].parent;
      path[id] = (p ? path[p] + "/move/" : "Motion/Tilt/") + nodeName(id);
    }
    const pivotOf2 = (id) => rig.bones[id].pivot.map((v) => v / B);
    const ext = [], extId = /* @__PURE__ */ new Map();
    const tex = (file) => {
      if (!extId.has(file)) {
        extId.set(file, `${ext.length + 1}_tex`);
        ext.push(file);
      }
      return `ExtResource("${extId.get(file)}")`;
    };
    for (const p of Object.values(pics)) {
      tex(p.file);
      for (const f of Object.values(p.alts || {})) tex(f);
    }
    const sampled = anims.map(({ anim: anim2 }) => Array.from({ length: anim2.frames }, (_, i) => samplePose(anim2, i)));
    const used = { rot: /* @__PURE__ */ new Set(), off: /* @__PURE__ */ new Set(), swap: /* @__PURE__ */ new Set(), smear: /* @__PURE__ */ new Set(), tilt: false, root: false };
    for (const poses of sampled) for (const p of poses) {
      for (const [id, v] of Object.entries(p.rot)) if (v && rig.bones[id]) used.rot.add(id);
      for (const [id, v] of Object.entries(p.off)) if ((v[0] || v[1]) && rig.bones[id]) used.off.add(id);
      for (const id of Object.keys(p.swap || {})) if (pics[id] && pics[id].alts && pics[id].alts[p.swap[id]]) used.swap.add(id);
      for (const id of Object.keys(p.smear || {})) if (pics[id] && rig.bones[id] && boxes[id]) used.smear.add(id);
      if (p.tilt) used.tilt = true;
      if (p.root[0] || p.root[1]) used.root = true;
    }
    const smearM = (id, f) => {
      const m = stretchAbout(rig.bones[id].pivot, boxes[id], f);
      return [m[0], m[1], m[2], m[3]];
    };
    const props = [];
    for (const id of bones) if (used.rot.has(id)) props.push({ path: path[id] + ":rotation", kind: "angle", get: (p) => p.rot[id] || 0, rest: 0, part: id, fmt: (v) => fl(deg(v)) });
    for (const id of bones) if (used.off.has(id)) props.push({ path: path[id] + "/move:position", kind: "vec", get: (p) => {
      const o = p.off[id] || [0, 0];
      return [o[0] / B, o[1] / B];
    }, rest: [0, 0], fmt: vec });
    if (used.tilt) props.push({ path: "Motion/Tilt:rotation", kind: "angle", get: (p) => p.tilt || 0, rest: 0, fmt: (v) => fl(deg(v)) });
    if (used.root) props.push({ path: "Motion:position", kind: "discrete", get: (p) => p.root.slice(), rest: [0, 0], fmt: vec });
    for (const id of bones) if (used.swap.has(id)) props.push({ path: path[id] + "/move/sprite:texture", kind: "discrete", get: (p) => p.swap && p.swap[id] && pics[id].alts[p.swap[id]] || pics[id].file, rest: pics[id].file, fmt: tex });
    const zIn = (p) => {
      const order2 = effectiveOrder(rig.order, p.order), list = z.filter((id) => !rig.order.includes(id)).concat(order2);
      return (id) => 2 * Math.max(0, list.indexOf(id)) + 1;
    };
    const zRest = zIn({});
    for (const id of bones) if (pics[id] && rig.order.includes(id) && sampled.some((poses) => poses.some((p) => zIn(p)(id) !== zRest(id)))) {
      props.push({ path: path[id] + "/move/sprite:z_index", kind: "discrete", get: (p) => zIn(p)(id), rest: zRest(id), fmt: (v) => String(v) });
      if (used.smear.has(id)) props.push({ path: path[id] + "/move/smear:z_index", kind: "discrete", get: (p) => zIn(p)(id) - 1, rest: zRest(id) - 1, fmt: (v) => String(v) });
    }
    for (const id of bones) if (used.smear.has(id)) {
      props.push({ path: path[id] + "/move/smear:visible", kind: "discrete", get: (p) => !!(p.smear && p.smear[id] > 1), rest: false, fmt: (v) => String(v) });
      props.push({ path: path[id] + "/move/smear:transform", kind: "discrete", get: (p) => (p.smear && p.smear[id] > 1 ? smearM(id, p.smear[id]) : [1, 0, 0, 1]).join(","), rest: "1,0,0,1", fmt: (v) => `Transform2D(${v.split(",").map(f6).join(", ")}, 0, 0)` });
    }
    const notes = {}, subs = [];
    const trackText = (k, prop, keys) => [
      `tracks/${k}/type = "value"`,
      `tracks/${k}/imported = false`,
      `tracks/${k}/enabled = true`,
      `tracks/${k}/path = NodePath("${prop.path}")`,
      `tracks/${k}/interp = 1`,
      `tracks/${k}/loop_wrap = true`,
      `tracks/${k}/keys = {`,
      `"times": PackedFloat32Array(${keys.map((x) => f6(x.time)).join(", ")}),`,
      `"transitions": PackedFloat32Array(${keys.map((x) => f6(x.trans)).join(", ")}),`,
      `"update": ${prop.kind === "discrete" ? 1 : 0},`,
      `"values": [${keys.map((x) => prop.fmt(x.value)).join(", ")}]`,
      "}"
    ];
    subs.push(["Animation_RESET", ['resource_name = "RESET"', "length = 0.001", ...props.flatMap((p, k) => trackText(k, p, [{ time: 0, value: p.rest, trans: 1 }]))]]);
    anims.forEach(({ name: an, anim: anim2, play: play2 }, a) => {
      const plan = playPlan(anim2, play2), poses = sampled[a], why = [];
      if (poses.some((p) => p.flash)) why.push("flash frames");
      if (!plan.native) why.push(`written in play order (${play2.mode}${play2.loop ? "" : `, ${play2.repeat || 1}\xD7`})`);
      if (why.length) notes[an] = why;
      const body = [`resource_name = "${an}"`, `length = ${f6(plan.length)}`, ...plan.loopMode ? [`loop_mode = ${plan.loopMode}`] : [], `step = ${f6(1 / anim2.fps)}`];
      props.forEach((p, k) => body.push(...trackText(k, p, trackKeys(anim2, plan, poses, p.get, p.kind, !(p.part && anim2.follow && anim2.follow[p.part])))));
      subs.push([`Animation_${a + 1}`, body]);
    });
    const L = [`[gd_scene load_steps=${ext.length + subs.length + 2} format=3]`, ""];
    ext.forEach((f, i) => L.push(`[ext_resource type="Texture2D" path="${f}" id="${i + 1}_tex"]`));
    L.push("");
    for (const [id, body] of subs) L.push(`[sub_resource type="Animation" id="${id}"]`, ...body, "");
    L.push('[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]', "_data = {", [["RESET", "Animation_RESET"], ...anims.map((x, a) => [x.name, `Animation_${a + 1}`])].map(([n, id]) => `&"${n}": SubResource("${id}")`).join(",\n"), "}", "");
    L.push(`[node name="${nodeName(name)}" type="Node2D"]`, "texture_filter = 1", `scale = Vector2(${f6(scale)}, ${f6(scale)})`, "");
    L.push('[node name="Motion" type="Node2D" parent="."]', "");
    L.push('[node name="Tilt" type="Node2D" parent="Motion"]', `position = Vector2(${f6(tilt[0])}, ${f6(tilt[1])})`, "");
    const sprite3 = (nm, parent, pic, zi, origin, extra = []) => L.push(
      `[node name="${nm}" type="Sprite2D" parent="${parent}"]`,
      ...extra,
      `z_index = ${zi}`,
      "z_as_relative = false",
      `texture = ${tex(pic.file)}`,
      "centered = false",
      `offset = Vector2(${f6(pic.x - pad - origin[0])}, ${f6(pic.y - pad - origin[1])})`,
      ""
    );
    const zOf = (id) => 2 * Math.max(0, z.indexOf(id)) + 1;
    if (pics[UNASSIGNED_LAYER]) sprite3("unassigned", "Motion/Tilt", pics[UNASSIGNED_LAYER], zOf(UNASSIGNED_LAYER), [N / 2, N]);
    for (const id of bones) {
      const p = rig.bones[id].parent, pv = pivotOf2(id), base = p ? pivotOf2(p) : [N / 2, N];
      L.push(`[node name="${nodeName(id)}" type="Node2D" parent="${path[id].split("/").slice(0, -1).join("/")}"]`, `position = Vector2(${f6(pv[0] - base[0])}, ${f6(pv[1] - base[1])})`, "");
      L.push(`[node name="move" type="Node2D" parent="${path[id]}"]`, "");
      if (pics[id] && used.smear.has(id)) sprite3("smear", path[id] + "/move", pics[id], zOf(id) - 1, pv, ["visible = false"]);
      if (pics[id]) sprite3("sprite", path[id] + "/move", pics[id], zOf(id), pv);
    }
    L.push('[node name="AnimationPlayer" type="AnimationPlayer" parent="."]', "libraries = {", '&"": SubResource("AnimationLibrary_1")', "}", "");
    return { text: L.join("\n"), notes };
  }
  var vec = (v) => `Vector2(${f6(v[0])}, ${f6(v[1])})`;

