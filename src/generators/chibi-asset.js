  // src/generators/chibi-asset.js
  // V7: a generated chibi as an imported character with 8 directions, each one exactly what the app
  // makes from a 32 px pixel-art PNG converted 1:1 (step 3, exact), with its parts (step 4), joints and
  // drawing order (step 5) and hidden areas (step 7) filled in from the drawing, and its animations.
  var CHIBI_MOTIONS = [
    { id: "idle", fps: 6 },
    { id: "walk", fps: 10 },
    { id: "run", fps: 12 },
    { id: "sneak", fps: 8 }
  ];
  var CHIBI_FRAMES = 8;
  // V7.1: the combat motion that goes with the gear (none without gear)
  var chibiCombat = (d) => d.weapon === "staff" ? { id: "cast", fps: 10 } : d.weapon !== "none" ? { id: "attack", fps: 12 } : d.offhand === "bow" ? { id: "bow", fps: 10 } : null;
  var CHIBI_EXTRA_PARTS = { shield: "shield", bow: "bow" };
  var riggedSettings = (palette, N) => ({ ...DEFAULTS2, height: N, headroom: 0, floor: 0, resample: "exact", cleanup: false, dither: false, contrast: 0, saturation: 0, locked: palette.slice() });
  // V7.2, shared by the generated characters: from one direction's flat picture (px), which part owns
  // each pixel (owner), what each part has behind others (hidden), a drawing order and joints (sprite
  // pixels), the whole imported-character record: the 1:1 conversion, parts, rig, hidden areas, the
  // motions, and the work record of its PNG. page: { png(rgba, w, h), workImage(work) }
  function riggedDirection({ N, px, owner, hidden, order, joints, parents = [], extraParts = {}, motions, combat = null, facing, name, page, fromModel = false, offScale = 1, unclipAll = false, settle: settleFeet = false, steady = [], slide = [], sway = {} }) {
    // at most 64 colours (a project's limit): the least-used ones join their nearest neighbour
    ({ px, hidden } = limitColours(px, hidden, 64));
    // every colour drawn, also those only in hidden areas (a project stores those against the palette)
    const palette = [...new Set([...px, ...Object.values(hidden).flat()].filter(Boolean))];
    const img = { width: N, height: N, data: new Uint8ClampedArray(N * N * 4) };
    px.forEach((c, i) => {
      if (!c) return;
      const n = parseInt(c.slice(1), 16);
      img.data.set([n >> 16 & 255, n >> 8 & 255, n & 255, 255], i * 4);
    });
    const mask = alphaMask(img), settings = riggedSettings(palette, N);
    const r = convertToPixelArt(img, mask, { ...settings, paletteColours: palette, place: { anchor: "bottom", offsetX: 0, offsetY: 0 } });
    const S = r.work.size, B = S / N, rgba = workToRGBA(r.work);
    const present = new Set([...owner.filter(Boolean), ...Object.keys(hidden)]);
    // parts: each work pixel belongs to the part seen at its sprite pixel
    const parts = [...DEFAULT_PARTS.map((p) => ({ ...p, missing: !present.has(p.id) })), ...Object.entries(extraParts).filter(([id]) => present.has(id)).map(([id, label]) => ({ id, label, missing: false, userMade: false }))];
    const index = Object.fromEntries(parts.map((p, i) => [p.id, i + 1])), map = new Uint8Array(S * S);
    for (let t = 0; t < S * S; t++) {
      if (rgba[t * 4 + 3] < 128) continue;
      const id = owner[((t / S | 0) / B | 0) * N + (t % S / B | 0)];
      map[t] = id ? index[id] : UNASSIGNED;
    }
    const seg2 = { size: S, parts, map, extras: [] };
    const rig = syncRig(seg2);
    if (fromModel) rig.fromModel = true;
    for (const [id, [x, y]] of Object.entries(joints)) if (rig.bones[id]) rig.bones[id] = { ...rig.bones[id], pivot: [x * B, y * B], auto: false };
    // gear hangs from its hand, cloaks and robes from the body
    for (const [id, parent] of parents) if (present.has(id) && rig.bones[id]) rig.bones[id].parent = parent;
    // the drawing order of the view; parts it does not draw (the weapon) stay listed, at the back
    rig.order = [...rig.order.filter((id) => !order.includes(id)), ...order.filter((id) => rig.bones[id])];
    const art = { swaps: {}, holes: hidden };
    const rest = { N, palette: r.fullPalette.slice(), px: r.px.slice(), work: page.workImage(r.work), settings, seg: seg2, rig, art };
    const L = prepareLayers(seg2, rgba, rig, art, N), anims = {};
    for (const m of combat ? [...motions, combat] : motions) {
      const loop = m !== combat;
      const a = JSON.parse(JSON.stringify(buildTemplate(templateById(m.id), rest, L, { facing, frames: CHIBI_FRAMES, fps: m.fps, loop })));
      // a big head stays nearly level when the body leans (it reads as falling otherwise)
      for (const k of a.keys) if (k.pose.rot.torso) k.pose.rot.head = Math.round(((k.pose.rot.head || 0) - k.pose.rot.torso * 0.75) * 10) / 10 || void 0;
      // the presets' offsets are sized for a 32 px sprite: a bigger one moves as much, relatively
      if (offScale !== 1) for (const k of a.keys) for (const id of Object.keys(k.pose.off || {})) k.pose.off[id] = k.pose.off[id].map((v) => Math.round(v * offScale));
      let b2 = chibiUnclip(a, rest, L, unclipAll);
      // held items that stay upright while the arm moves (a walking staff): after the clip fitting,
      // which scales every turn
      for (const id of steady) if (rig.bones[id]) for (const k of b2.keys) {
        let t = 0;
        for (let b = rig.bones[id].parent; b && rig.bones[b]; b = rig.bones[b].parent) t += k.pose.rot[b] || 0;
        k.pose.rot[id] = Math.round(-t * 10) / 10;
        if (!k.pose.rot[id]) delete k.pose.rot[id];
      }
      // cloth that swings a little on its own (a cape seen from behind hides the legs' motion)
      for (const [id, amp] of Object.entries(sway)) if (rig.bones[id] && loop) for (const k of b2.keys) {
        const v = Math.round(((k.pose.rot[id] || 0) + amp * (m.id === "idle" ? 0.5 : 1) * Math.cos(2 * Math.PI * k.t / b2.frames)) * 10) / 10;
        if (v) k.pose.rot[id] = v;
        else delete k.pose.rot[id];
      }
      if (settleFeet) b2 = riggedSettle(b2, rest, L);
      if (slide.some((id) => rig.bones[id])) b2 = riggedSlide(b2, rest, L, slide);
      anims[m.id] = JSON.parse(JSON.stringify(b2));
    }
    rest.anims = anims;
    const file = page.png(img.data, N, N);
    const source = { name, type: "png", size: file.bytes.length, width: N, height: N, hash: bytesHash(file.bytes), bytes: file.bytes, base64: file.base64, reduced: null };
    const work = {
      source,
      crop: { x: 0, y: 0, w: N, h: N },
      place: { anchor: "bottom", offsetX: 0, offsetY: 0 },
      background: { method: "alpha", tolerance: 40, iterations: 5, key: [106, 160, 216], clean: false, used: "alpha", w: N, h: N, raw: mask, hints: new Uint8Array(N * N) },
      conversion: { ...settings }
    };
    return { rest, work, rgba, layers: L, drawn: px };
  }
  function limitColours(px, hidden, max) {
    const count = new Map(), add = (c) => c && count.set(c, (count.get(c) || 0) + 1);
    px.forEach(add);
    for (const h of Object.values(hidden)) h.forEach(add);
    if (count.size <= max) return { px, hidden };
    const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)], to = new Map();
    const live = new Map(count);
    while (live.size > max) {
      const [c] = [...live].sort((a, b) => a[1] - b[1])[0], a = rgb(c);
      let best = null, bd = Infinity;
      for (const o of live.keys()) if (o !== c) {
        const b = rgb(o), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      live.set(best, live.get(best) + live.get(c));
      live.delete(c);
      to.set(c, best);
      for (const [k, v] of to) if (v === c) to.set(k, best);
    }
    const map = (c) => c && to.has(c) ? to.get(c) : c;
    return { px: px.map(map), hidden: Object.fromEntries(Object.entries(hidden).map(([k, h]) => [k, h.map(map)])) };
  }
  function chibiDirection(d, dir, page) {
    const v = chibiView(d, dir), c = chibiCompose(v);
    return riggedDirection({ N: CHIBI_N, ...c, order: v.order, joints: v.joints, parents: [["weapon", "handR"], ["shield", "handL"], ["bow", "handL"]], extraParts: CHIBI_EXTRA_PARTS, motions: CHIBI_MOTIONS, combat: chibiCombat(d), facing: FACING_OF[dir], name: `chibi-${d.shape}-${dir.toLowerCase()}.png`, page });
  }
  // V7.1: a chibi's arms are long for its 32 px box: if any frame cuts something off at the edge (an arm
  // held straight out with a bow, a sword swung wide), the arm turns are scaled down in 10% steps until
  // nothing is cut off (at most to half)
  function chibiUnclip(a, rest, L, all = false) {
    const render = (p) => renderRig(L, rest.rig, p, { N: rest.N, palette: rest.palette, settings: rest.settings || void 0 });
    const cut = (anim2) => sampleAnim(anim2).some(({ pose: pose2 }) => Object.keys(render(pose2).stats.clipped || {}).length);
    if (!cut(a)) return a;
    for (let f = 0.9; f >= 0.5 - 1e-9; f -= 0.1) {
      const b = { ...a, keys: a.keys.map((k) => {
        const p = clonePose(k.pose);
        // (all: every turn and nudge, for a figure whose cape or staff reaches the edge)
        for (const id of Object.keys(p.rot)) if (all || /^(upperArm|forearm|hand)[LR]$/.test(id)) p.rot[id] = Math.round(p.rot[id] * f * 10) / 10;
        if (all) for (const id of Object.keys(p.off || {})) p.off[id] = p.off[id].map((v) => Math.round(v * f));
        return { ...k, pose: p };
      }) };
      if (!cut(b) || f < 0.55) return b;
    }
    return a;
  }
  // V7.2: each frame meant to stand on the ground has its lowest foot (or shin) moved onto the rest
  // pose's ground row, measured on the rendered frame (long feet turned by the walk fool the leg sums)
  function riggedSettle(a, rest, L) {
    // the true lowest point of the legs (their hidden pixels too), so a robe or a cape over the legs
    // does not decide where the ground is
    // (measured by the render, which snaps each part to whole pixels; the rig is one made from a model)
    const N = rest.N, low = (p) => {
      const st = renderRig(L, rest.rig, p, { N, palette: rest.palette, settings: rest.settings || void 0 }).stats;
      return st.feet != null ? st.feet : legLow(L, worldMatrices(rest.rig, p, L.size), N);
    };
    const ground = low({}), air = new Set(Object.keys(a.air || {}).map(Number));
    if (ground < 0) return a;
    // a key on every frame (exactly the frames it played before), so frames between keys settle too;
    // only the frames marked as in the air (a run's flight) are left as they are
    // (the sampled poses already carry the follow-through turns, so the keys replace it)
    const frames = sampleAnim(a), keys = frames.map((f, i) => ({ t: i, ease: "linear", pose: clonePose(f.pose) }));
    const { follow, ...plain } = a;
    return { ...plain, ground: keys.map((k) => k.t).filter((t) => !air.has(t)), keys: keys.map((k) => {
      if (air.has(k.t)) return k;
      const p = clonePose(k.pose), y = low(p), d = y - ground;
      if (y >= 0 && d) p.root = [p.root[0], p.root[1] - d];
      return { ...k, pose: p };
    }) };
  }
  // a long held item (a staff) that would leave the frame slides through the hand instead, in whole
  // pixels, up to 16 of them
  function riggedSlide(a, rest, L, ids) {
    const N = rest.N, B = L.size / N, render = (p) => renderRig(L, rest.rig, p, { N, palette: rest.palette, settings: rest.settings || void 0 });
    const cut = (p, id) => (render(a.smooth ? { ...p, smooth: true } : p).stats.clipped || {})[id] || 0;
    const keys = a.follow ? sampleAnim(a).map((f, i) => ({ t: i, ease: "linear", pose: clonePose(f.pose) })) : a.keys;
    const { follow, ...plain } = a;
    return { ...plain, keys: keys.map((k) => {
      const p = clonePose(k.pose);
      for (const id of ids) {
        if (!rest.rig.bones[id] || !cut(p, id)) continue;
        const o = (p.off || {})[id] || [0, 0];
        // the nearest slide (along, then across) that keeps it all in, else the one that cuts off least
        let best = null, least = cut(p, id);
        for (const ax of [1, 0]) for (let d = 1; d <= 16 && least; d++) for (const s of [-1, 1]) {
          const q = clonePose(p);
          q.off = { ...q.off || {}, [id]: ax ? [o[0], o[1] + s * d * B] : [o[0] + s * d * B, o[1]] };
          const n = cut(q, id);
          if (n < least) { best = q; least = n; }
          if (!n) break;
        }
        if (best) Object.assign(p, best);
        // still cut off (a crook held out sideways): tip it a little, up to 30 degrees
        for (let d = 5; d <= 30 && least; d += 5) for (const s of [-1, 1]) {
          const q = clonePose(p);
          q.rot = { ...q.rot, [id]: (q.rot[id] || 0) + s * d };
          const n = cut(q, id);
          if (n < least) { Object.assign(p, q); least = n; break; }
        }
      }
      return { ...k, pose: p };
    }) };
  }
  // the whole character: S is the main image, the other 7 directions are views
  function chibiAsset(shapeSeed, colourSeed, page, cls = "random") {
    const d = chibiDesign(shapeSeed, colourSeed, cls), out = {};
    for (const dir of DIRECTIONS) out[dir] = chibiDirection(d, dir, page);
    const views = {};
    for (const dir of DIRECTIONS) if (dir !== "S") views[dir] = { direction: dir, work: out[dir].work, rest: out[dir].rest, history: [] };
    return { design: d, directions: out, asset: { rest: out.S.rest, history: [], direction: "S", views, work: out.S.work } };
  }
