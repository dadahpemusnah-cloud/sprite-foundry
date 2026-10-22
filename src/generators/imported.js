  // src/generators/imported.js
  var IMPORTED_GENERATOR_VERSION = 1;
  function importedTags(rest, px) {
    if (!rest.seg) return { tag: px.map((c) => c ? "body" : null), order: ["body"] };
    const tag = spriteTags(rest.seg, px, rest.N).map((t, i) => px[i] ? t || "unassigned" : null);
    const missing = new Set(rest.seg.parts.filter((p) => p.missing).map((p) => p.id));
    return { tag, order: ["unassigned", ...rest.rig ? rest.rig.order.filter((id) => !missing.has(id)) : partOrder(rest.seg)] };
  }
  function rigFrameFor(rest, L) {
    if (!rest.rig || !L) return null;
    const cache2 = /* @__PURE__ */ new Map();
    const result = (pose2) => {
      const key = JSON.stringify(pose2);
      let r = cache2.get(key);
      if (!r) {
        r = renderRig(L, rest.rig, pose2, { N: rest.N, palette: rest.palette, settings: rest.settings || void 0 });
        r.work = null;
        if (cache2.size > 256) cache2.clear();
        cache2.set(key, r);
      }
      return r;
    };
    const frame = (pose2) => result(pose2).px;
    frame.result = result;
    return frame;
  }
  function genImported(N, rs, rc, opts2 = {}) {
    const rest = opts2.asset && opts2.asset.rest;
    if (!rest) throw new Error("An Imported sprite needs a converted image (Image to pixel art, step 3).");
    const s = makeSprite("imported", rest.N);
    s.px = rest.px.slice();
    const t = importedTags(rest, s.px);
    s.tag = t.tag;
    s.order = t.order;
    const darkest = rest.palette.slice().sort((a, b) => lum(a) - lum(b))[0] || "#000000";
    s.meta.outline = mix(darkest, "#000000", 0.5);
    s.meta.desc = "Imported image";
    s.meta.motion = "still";
    s.anims = { pose: [{}] };
    s.animMeta = { pose: { loop: true } };
    for (const [name, a] of Object.entries(rest.anims || {})) {
      s.anims[name] = sampleAnim(a);
      s.animMeta[name] = { fps: a.fps, loop: a.loop };
    }
    if (opts2.rigLayers) s.rigFrame = rigFrameFor(rest, opts2.rigLayers);
    return s;
  }

