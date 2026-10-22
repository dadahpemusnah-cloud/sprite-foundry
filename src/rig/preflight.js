  // src/rig/preflight.js
  var PIVOT_SLACK = 2;
  var HANDS = ["handL", "handR"];
  // V7.2: a part's hidden area (painted in step 7, or drawn by a generator) counts as the part: a cape
  // seen in two pieces either side of the legs is one cape, a shoulder under a cloak is still on the arm
  function withHidden(seg2, layers, id) {
    const hole = layers.layers[id] && layers.layers[id].hole, k = partIndex(seg2, id);
    if (!hole || !k) return seg2;
    const map = seg2.map.slice();
    for (const t of hole.ts) if (map[t]) map[t] = k;
    return { ...seg2, map };
  }
  function nearest(layer, size, [x, y]) {
    let best = Infinity;
    for (const t of layer.hole ? [...layer.ts, ...layer.hole.ts] : layer.ts) {
      const d = Math.hypot(t % size + 0.5 - x, (t / size | 0) + 0.5 - y);
      if (d < best) best = d;
    }
    return best;
  }
  var fmt = (n) => n.toLocaleString("en");
  function comesAway(layers, id, parent, [px, py]) {
    const size = layers.size, n = size * size, dist = new Int32Array(n).fill(-1), q = new Int32Array(n);
    let h = 0, tl = 0;
    for (const t of layers.layers[parent].ts) {
      dist[t] = 0;
      q[tl++] = t;
    }
    while (h < tl) {
      const u = q[h++], x = u % size;
      for (const v of [x > 0 ? u - 1 : -1, x < size - 1 ? u + 1 : -1, u - size, u + size]) if (v >= 0 && v < n && dist[v] < 0) {
        dist[v] = dist[u] + 1;
        q[tl++] = v;
      }
    }
    const mine = layers.layers[id].ts, step2 = Math.max(1, mine.length >> 10);
    const gap = (a) => {
      const c = Math.cos(a), s = Math.sin(a);
      let m = Infinity;
      for (let i = 0; i < mine.length; i += step2) {
        const t = mine[i], dx = t % size + 0.5 - px, dy = (t / size | 0) + 0.5 - py, X = Math.floor(px + dx * c - dy * s), Y = Math.floor(py + dx * s + dy * c);
        if (X >= 0 && Y >= 0 && X < size && Y < size) m = Math.min(m, dist[Y * size + X]);
      }
      return m;
    };
    return Math.max(gap(Math.PI / 2), gap(-Math.PI / 2)) - gap(0);
  }
  function preflight({ rest, layers, template = null, labelOf = (id) => id }) {
    const items = [], rig = rest.rig, seg2 = rest.seg, B = layers.size / rest.N;
    const add = (id, state3, title, message, fix = null) => items.push({ id, state: state3, title, message, fix });
    const c = counts(seg2), un = c.unassigned;
    if (!un) add("pixels", "ready", "Pixels in parts", `All ${fmt(c.character)} working pixels belong to a part.`);
    else if (rig.keepUnassigned) add("pixels", "ready", "Pixels in parts", `${fmt(un)} of ${fmt(c.character)} working pixels are unassigned on purpose: they move with the whole body and never turn.`, { step: "parts", what: "unassigned" });
    else add("pixels", "attention", "Pixels in parts", `${fmt(un)} of ${fmt(c.character)} working pixels are unassigned: they move with the whole body and never turn, so they stay behind when a limb moves. Assign them in step 4 (they are shown in pink there), or mark them as intended.`, { step: "parts", what: "unassigned" });
    const loose = seg2.parts.map((p) => [p.id, looseParts(withHidden(seg2, layers, p.id), p.id, { bridge: 3 * B, minPx: B * B })]).filter(([, l]) => l.length);
    if (!loose.length) add("pieces", "ready", "Parts in one piece", "No part has a piece cut off from the rest of it.");
    else {
      const [id, l] = loose[0], more = loose.slice(1).map(([i]) => labelOf(i)), px = Math.ceil(l[0] / (B * B));
      add("pieces", "attention", "Parts in one piece", (id === "weapon" ? `Part of the weapon (${px} px) is cut off from the rest of it: it would move on its own.` : `${labelOf(id)} has a piece (${px} px) cut off from the rest of it: it turns with ${labelOf(id)} although it is somewhere else, so it moves where it does not belong.`) + (more.length ? ` (${more.length} more: ${more.slice(0, 3).join(", ")}${more.length > 3 ? ", \u2026" : ""}.)` : "") + ` Assign it to the part it belongs to in step 4.`, { step: "parts", part: id });
    }
    let loop = null;
    try {
      treeOrder(rig);
    } catch (e) {
      loop = e.message;
    }
    const drawn = (id) => !!(layers.layers[id] && layers.layers[id].ts.length);
    const roots = Object.entries(rig.bones).filter(([id, b]) => !b.parent && drawn(id)).map(([id]) => id);
    const lost = Object.entries(rig.bones).filter(([, b]) => b.parent && !rig.bones[b.parent]).map(([id]) => id);
    if (loop) add("hierarchy", "attention", "Bone hierarchy", loop + " Choose another parent in step 5.", { step: "rig", control: "parent" });
    else if (lost.length) add("hierarchy", "attention", "Bone hierarchy", `${lost.map(labelOf).join(", ")} hang${lost.length > 1 ? "" : "s"} from a part that no longer exists. Choose a parent in step 5.`, { step: "rig", joint: lost[0], control: "parent" });
    else if (roots.length > 1) {
      const main = roots.includes("pelvis") ? "pelvis" : roots[0], extra = roots.filter((r2) => r2 !== main);
      add("hierarchy", "attention", "Bone hierarchy", `${extra.map(labelOf).join(", ")} ${extra.length > 1 ? "have" : "has"} no parent, so ${extra.length > 1 ? "they move" : "it moves"} only with the whole body, not with ${labelOf(main)}. Choose a parent in step 5 if ${extra.length > 1 ? "they belong" : "it belongs"} to the body.`, { step: "rig", joint: extra[0], control: "parent" });
    } else add("hierarchy", "ready", "Bone hierarchy", `Every part hangs from ${roots.length ? labelOf(roots[0]) : "the body"} through its parents; no loops.`);
    const far = [], outside = [], away = [];
    for (const [id, b] of Object.entries(rig.bones)) {
      if (!drawn(id)) continue;
      const [x, y] = b.pivot;
      if (x < 0 || y < 0 || x > layers.size || y > layers.size) {
        outside.push(id);
        continue;
      }
      const own = nearest(layers.layers[id], layers.size, b.pivot) / B;
      let par = 0, lim = PIVOT_SLACK;
      // joints that come from a 3D figure are where the limbs really turn: the 2D guess of where two
      // parts touch, or of what a quarter turn would open, is not a fair test of them (it is still
      // checked that they sit on their part)
      if (b.parent && !rig.fromModel) {
        const sug = suggestPivot(withHidden(seg2, layers, id), id, b.parent), box = layers.layers[id].box;
        lim = Math.max(PIVOT_SLACK, Math.max(box[2] - box[0], box[3] - box[1]) / B / 4);
        par = Math.hypot(x - sug[0], y - sug[1]) / B;
      }
      if (own > PIVOT_SLACK || par > lim) far.push({ id, d: Math.max(own, par / lim * PIVOT_SLACK), own, par, parent: b.parent });
      if (b.parent && drawn(b.parent) && !loop && !rig.fromModel) {
        const d = comesAway(layers, id, b.parent, b.pivot);
        if (d > (rig.bleed || 0) + B) away.push({ id, d, parent: b.parent });
      }
    }
    if (outside.length) add("pivots", "attention", "Joint pivots", `The ${outside.map(jointName).join(", ")} joint${outside.length > 1 ? "s are" : " is"} outside the image. Drag ${outside.length > 1 ? "them" : "it"} back in step 5, or press Suggest joints.`, { step: "rig", joint: outside[0], control: "joint" });
    else if (far.length) {
      far.sort((a, b) => b.d - a.d);
      const f = far[0], what = f.own > PIVOT_SLACK ? `${Math.round(f.own)} px from the ${labelOf(f.id)}` : `${Math.round(f.par)} px from where the ${labelOf(f.id)} meets the ${labelOf(f.parent)}`;
      add("pivots", "attention", "Joint pivots", `The ${jointName(f.id)} joint is ${what}: the part would swing around a point off the joint.${far.length > 1 ? ` (${far.length - 1} more: ${far.slice(1, 4).map((x) => jointName(x.id)).join(", ")}${far.length > 4 ? ", \u2026" : ""}.)` : ""} Drag it onto the joint in step 5, or press Suggest joints.`, { step: "rig", joint: f.id, control: "joint" });
    } else if (away.length) {
      away.sort((a, b) => b.d - a.d);
      const f = away[0];
      add("pivots", "attention", "Joint pivots", `The ${jointName(f.id)} joint is off the body: turned a quarter turn, the ${labelOf(f.id)} comes ${Math.round(f.d / B)} px away from the ${labelOf(f.parent)}.${away.length > 1 ? ` (${away.length - 1} more: ${away.slice(1, 4).map((x) => jointName(x.id)).join(", ")}${away.length > 4 ? ", \u2026" : ""}.)` : ""} Press Suggest joints, or drag it to where the ${labelOf(f.id)} meets the ${labelOf(f.parent)} in step 5.`, { step: "rig", joint: f.id, control: "joint" });
    } else add("pivots", "ready", "Joint pivots", `Every joint sits on its part, near where it meets the part it hangs from.`);
    const weaponDrawn = drawn("weapon"), holder = rig.bones.weapon && rig.bones.weapon.parent;
    if (!template) {
      const present = presentParts(rest, layers), off2 = TEMPLATES.map((t) => [t, checkTemplate(t, rig, present)]).filter(([, c2]) => !c2.ok);
      add("motion", "na", "Parts for the motion", `No motion chosen. ${TEMPLATES.length - off2.length} of ${TEMPLATES.length} template motions fit this rig${off2.length ? `; not available: ${off2.slice(0, 4).map(([t, c2]) => `${t.name} (${c2.reason})`).join(", ")}${off2.length > 4 ? `, and ${off2.length - 4} more` : ""}` : ""}.`, { step: "motion" });
    } else {
      const chk = checkTemplate(template, rig, presentParts(rest, layers));
      if (chk.ok) add("motion", "ready", "Parts for the motion", `${template.name}: every part it moves is here.`);
      else add("motion", "attention", "Parts for the motion", `${template.name}: ${chk.reason}`, chk.missing.length ? { step: "parts", part: chk.missing[0] } : { step: "rig", joint: "weapon", control: "holder" });
    }
    const swings = template && template.requires(rig).includes("weapon");
    if (!weaponDrawn) add("weapon", swings ? "attention" : "na", "Weapon in hand", swings ? `${template.name} swings a weapon, but there is no weapon part with pixels. Paint the weapon as its own part in step 4.` : "No weapon part.", swings ? { step: "parts", part: "weapon" } : null);
    else if (HANDS.includes(holder)) add("weapon", "ready", "Weapon in hand", `The weapon hangs from ${labelOf(holder)}, so it follows the hand.`);
    else add("weapon", swings ? "attention" : "ready", "Weapon in hand", swings ? `The weapon must hang from a hand (step 5, rig): ${template.name} swings it, but it hangs from ${holder ? labelOf(holder) : "nothing"}.` : `The weapon hangs from ${holder ? labelOf(holder) : "nothing"} (fine for a sheathed weapon). Motions that swing it need it in a hand.`, { step: "rig", joint: "weapon", control: "holder" });
    const r = loop ? null : renderRig(layers, rig, {}, { N: rest.N, palette: rest.palette, settings: rest.settings || void 0 });
    const diff = r ? r.px.reduce((n, v, i) => n + (v !== rest.px[i]), 0) : 0;
    if (!r) add("rest", "attention", "Rest pose", "The rest pose cannot be drawn until the loop in the bone hierarchy is fixed.", { step: "rig", control: "parent" });
    else if (!diff) add("rest", "ready", "Rest pose", "The rest pose matches the converted sprite exactly.");
    else add("rest", "attention", "Rest pose", `The rest pose DIFFERS from the converted sprite in ${diff} pixel${diff > 1 ? "s" : ""}. Frames drawn by the rig will not start from your image; undo the last rig change in step 5, or convert the image again in step 3.`, { step: "rig", control: "rest" });
    const state2 = items.some((i) => i.state === "attention") ? "attention" : "ready";
    return { state: state2, items };
  }

