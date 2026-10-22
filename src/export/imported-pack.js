  // src/export/imported-pack.js
  function rigFrames(ia) {
    const main = rigFrameFor(ia.rest, ia.layers(null)), views = {};
    for (const v of ia.views) if (v.rest) {
      const fn = rigFrameFor(v.rest, ia.layers(v.dir));
      if (fn) views[v.dir] = fn;
    }
    if (!main && !Object.keys(views).length) return void 0;
    const frame = (pose2, view) => {
      const fn = view ? views[view] : main;
      return fn ? fn(pose2) : null;
    };
    frame.result = main ? main.result : null;
    frame.resultFor = (d) => views[d] ? views[d].result : null;
    return frame;
  }
  var rigged = (ctx, ia) => ctx.sprite.type === "imported" && ctx.sprite.rigFrame && ctx.sprite.rigFrame.result && ia.rest && ia.rest.rig;
  function importedFindings(ctx, ia, pixel) {
    if (!rigged(ctx, ia)) return null;
    const { sprite: sprite3, timeline: timeline2 } = ctx, rf = sprite3.rigFrame;
    const only = (view) => {
      const order2 = timeline2.order.filter((n) => (timeline2.anims[n].frames[0].spec || {}).view === view || !view && !(timeline2.anims[n].frames[0].spec || {}).view);
      return { order: order2, anims: timeline2.anims };
    };
    const check = (view, rest, render) => checkRig({ timeline: only(view), rest, rig: rest.rig, render, framePx: pixel, allowed: [sprite3.meta.outline, "#000000", "#ffffff"] });
    const out = check(void 0, ia.rest, rf.result);
    for (const v of ia.views) {
      const r = rf.resultFor && rf.resultFor(v.dir);
      if (v.rest && v.rest.rig && r) out.push(...check(v.dir, v.rest, r));
    }
    const restOf = (fn) => {
      const r = fn({ rot: {}, off: {}, root: [0, 0] });
      return { px: r.px, owner: r.stats.owner };
    };
    const views = [{ dir: ia.main, main: true, N: ia.rest.N, ...restOf(rf.result) }];
    for (const v of ia.views) {
      const r = rf.resultFor && rf.resultFor(v.dir);
      if (v.rest && v.rest.rig && r) views.push({ dir: v.dir, main: false, N: v.rest.N, ...restOf(r) });
    }
    if (views.length > 1) out.push(...checkDirections(views));
    return { findings: out, dirs: views.map((v) => v.dir) };
  }
  function importedSource(ctx, ia, rows, pixel) {
    if (ctx.sprite.type !== "imported" || !ia.rest) return null;
    const { timeline: timeline2 } = ctx, rest = ia.rest, seg2 = rest.seg, art = rest.art || { swaps: {}, holes: {} };
    const inRows = (f) => f.anim && rows.includes(f.anim);
    const found = importedFindings(ctx, ia, pixel);
    const notes = (found && found.findings || []).filter((f) => f.code === "not-in-image" && inRows(f)).map((f) => ({ animation: f.anim, frame: f.frame, note: f.message }));
    const editedFrames = [];
    for (const n of rows) timeline2.anims[n].frames.forEach((f, i) => {
      if (f.px) editedFrames.push({ animation: n, frame: i });
    });
    const animsOf = (r) => Object.keys(r && r.anims || {});
    return {
      kind: "imported image",
      image: ia.image,
      conversion: rest.settings ? { height: rest.N, colours: rest.palette.length, palette: rest.settings.locked ? "locked" : rest.settings.palette, downsample: rest.settings.resample } : { height: rest.N },
      rig: !!rest.rig,
      animatedByRig: rows.filter((n) => rest.anims && rest.anims[n] || ia.views.some((v) => v.rest && animsOf(v.rest).some((a) => rowName(a, v.dir, ia.main) === n))),
      ...ia.views.length ? { directions: [
        { direction: ia.main, main: true, rows: rows.filter((n) => rest.anims && rest.anims[n]) },
        ...ia.views.map((v) => ({ direction: v.dir, image: v.image, rows: rows.filter((n) => animsOf(v.rest).some((a) => rowName(a, v.dir, ia.main) === n)) }))
      ] } : {},
      limits: "Rig animation turns and moves parts of one image. It cannot show sides, views or details the image does not have; frames listed under notInImage show pixels made by the app (joint fill) or by you (drawings, hidden areas, back limbs).",
      userMade: {
        backLimbs: seg2 ? seg2.extras.map((e) => e.id) : [],
        drawings: Object.fromEntries(Object.entries(art.swaps).map(([id, l]) => [id, l.map((d) => d.name)])),
        hiddenAreas: Object.keys(art.holes)
      },
      editedFrames,
      notInImage: notes
    };
  }
  function importedCutout(ctx, ia, rows, base) {
    const { sprite: sprite3, timeline: timeline2, state: state2 } = ctx;
    if (!rigged(ctx, ia)) return [];
    const out = [], F = frameSizeOf(sprite3), safe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "_"), opts2 = { outline: state2.outline, pal: state2.palette };
    for (const view of [null, ...ia.views.map((v) => v.dir)]) {
      const rest = view ? ia.views.find((v) => v.dir === view).rest : ia.rest, L = ia.layers(view);
      const result = view ? sprite3.rigFrame.resultFor(view) : sprite3.rigFrame.result;
      if (!rest || !rest.rig || !L || !result) continue;
      const anims = Object.entries(rest.anims || {}).map(([n, anim2]) => ({ n, anim: anim2, row: view ? rowName(n, view, ia.main) : n })).filter((a) => rows.includes(a.row) && timeline2.anims[a.row]);
      if (!anims.length) continue;
      const opt = { N: rest.N, palette: rest.palette, settings: rest.settings || void 0 }, z = [UNASSIGNED_LAYER, ...L.extras, ...rest.rig.order];
      const cut = (pose2, alone) => cutParts({ frame: renderFrame(sprite3, { pose: pose2, ...view ? { view } : {} }, opts2), F, pad: PAD, N: rest.N, owner: result(pose2).stats.owner, z, alone });
      const parts = cut({}, Object.fromEntries(rest.rig.order.map((id) => [id, partAlone(L, rest.rig, id, opt)])));
      const dir = `${base}_rig${view ? "_" + view.toLowerCase() : ""}`, pics = {}, images = {};
      for (const [id, p] of Object.entries(parts)) {
        const names = id !== UNASSIGNED_LAYER ? Object.keys(L.layers[id] && L.layers[id].alts || {}) : [];
        const alts = names.map((name) => {
          const pose2 = { swap: { [id]: name } };
          return cut(pose2, { [id]: partAlone(L, rest.rig, id, opt, pose2) })[id] || { ...p, px: p.px.map(() => null) };
        });
        const all = names.length ? shareBox([p, ...alts]) : [p], file = `${safe(id)}.png`;
        images[file] = all[0];
        pics[id] = { ...all[0], file: `res://${dir}/${file}`, alts: {} };
        names.forEach((name, k) => {
          const f = `${safe(id)}__${safe(name)}.png`;
          images[f] = all[k + 1];
          pics[id].alts[name] = `res://${dir}/${f}`;
        });
      }
      const boxes = Object.fromEntries(Object.entries(L.layers).map(([id, l]) => [id, l.box]));
      const scene = godotCutoutScene({
        name: base,
        scale: state2.scale,
        pivot: pivotOf(sprite3),
        pad: PAD,
        N: rest.N,
        B: L.size / rest.N,
        rig: rest.rig,
        pics,
        z,
        boxes,
        anims: anims.map(({ n, anim: anim2, row }) => {
          const tl = timeline2.anims[row];
          return { name: n, anim: anim2, play: { mode: modeOf(tl), loop: tl.loop, repeat: repeatOf(tl), durationsMs: tl.frames.map((_, i) => frameDurationMs(timeline2, row, i, state2.fps)) } };
        })
      });
      const edited2 = anims.filter((a) => timeline2.anims[a.row].frames.some((fr) => fr.px)).map((a) => a.n);
      out.push({ direction: view || ia.main, scene: `${dir}.tscn`, dir, parts: Object.keys(images), images, text: scene.text, notes: scene.notes, edited: edited2 });
    }
    return out;
  }

