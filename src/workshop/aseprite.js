  // src/workshop/aseprite.js
  var MARK = "sprite-foundry";
  var ours = (ud) => {
    if (!ud || !ud.text) return null;
    try {
      const o = JSON.parse(ud.text);
      return o && o[MARK] === 1 ? o : null;
    } catch (e) {
      return null;
    }
  };
  var auto = (fps) => Math.round(1e3 / fps);
  function workshopToAseprite(ws) {
    const ids = layerIds(ws), clips = clipList(ws), frames = [], tags = [], first = /* @__PURE__ */ new Map();
    clips.forEach((c, k) => {
      const from = frames.length;
      c.frames.forEach((f) => {
        const j = first.get(f.layers), idx = frames.length;
        const cels = j !== void 0 ? ids.flatMap((id, li) => f.layers[id].some(Boolean) ? [{ layer: li, link: j }] : []) : ids.map((id, li) => ({ layer: li, px: f.layers[id] }));
        if (j === void 0) first.set(f.layers, idx);
        frames.push({ dur: f.dur ?? auto(c.fps), cels });
      });
      const mode = c.mode || "forward";
      tags.push({
        name: rowOf(ws, c),
        from,
        to: frames.length - 1,
        dir: mode,
        repeat: asepriteRepeat(mode, c.loop, c.repeat || 1),
        userData: { text: JSON.stringify({ [MARK]: 1, animation: c.name, dir: c.dir, fps: c.fps, own: c.frames.flatMap((f, i) => f.dur != null ? [i] : []), ...k === (ws.active || 0) ? { active: true } : {} }) }
      });
    });
    return {
      w: ws.size.w,
      h: ws.size.h,
      palette: ws.palette.slice(),
      layers: ws.layers.map((L) => ({ name: L.name, visible: !ws.view.hidden.includes(L.id), editable: !ws.view.locked.includes(L.id), userData: { text: JSON.stringify({ [MARK]: 1, id: L.id }) } })),
      frames,
      tags
    };
  }
  var clean = (s, rule, fallback) => {
    let t = String(s || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^[^a-z]+/, "").slice(0, 24);
    if (!rule.test(t)) t = fallback;
    return t;
  };
  var unique = (name, taken, max = 24) => {
    let n = name, k = 2;
    while (taken.has(n)) n = name.slice(0, max - String(k).length - 1) + "_" + k++;
    taken.add(n);
    return n;
  };
  function asepriteToWorkshop(doc, fileName = "sprite") {
    const notes = [];
    for (const [kind, n2] of Object.entries(doc.unsupported || {})) notes.push(kind === "semi-transparent pixels" ? `${n2} semi-transparent pixels were made solid (50% or more) or clear.` : `Left out: ${kind}${n2 > 1 ? ` (${n2})` : ""}.`);
    const S = SIZES2.find((s) => s >= doc.w && s >= doc.h);
    if (!S) throw new Error(`The sprite is ${doc.w}\xD7${doc.h} px; the Workshop draws up to ${SIZES2[SIZES2.length - 1]}\xD7${SIZES2[SIZES2.length - 1]}.`);
    const dx = Math.floor((S - doc.w) / 2), dy = S - doc.h;
    if (S !== doc.w || S !== doc.h) notes.push(`The ${doc.w}\xD7${doc.h} sprite was placed at the bottom centre of a ${S}\xD7${S} canvas.`);
    const groups = [];
    const all = doc.layers.map((L, i) => {
      const level = L.level || 0;
      groups.length = level;
      const up = groups.slice();
      if (L.type === "group") groups[level] = L;
      return { L, i, path: [...up.map((g) => g.name), L.name].join("/"), visible: L.visible && up.every((g) => g.visible) };
    });
    const image = all.filter((x) => x.L.type === "image");
    if (!image.length) throw new Error("The Aseprite file has no image layers.");
    if (image.length > MAX_LAYERS) throw new Error(`The Aseprite file has ${image.length} image layers; the Workshop holds up to ${MAX_LAYERS}. Merge some in Aseprite first.`);
    const takenIds = /* @__PURE__ */ new Set(), takenNames = /* @__PURE__ */ new Set();
    const layers = image.map(({ L, path, visible }) => {
      const m = ours(L.userData), id = unique(m && LAYER_ID.test(m.id) && !takenIds.has(m.id) ? m.id : clean(String(path || "").replace(/[-/]/g, "_"), LAYER_ID, "layer").slice(0, 20), takenIds);
      let name = String(path || "").trim().slice(0, 24) || "Layer";
      let k = 2;
      while (takenNames.has(name.toLowerCase())) name = (path || "Layer").trim().slice(0, 21) + " " + k++;
      takenNames.add(name.toLowerCase());
      return { id, name, hidden: !visible, locked: !L.editable, at: L };
    });
    const slot = new Map(image.map(({ i }, k) => [i, k]));
    const n = S * S, blankPx = () => new Array(n).fill(null), place = (px) => {
      const out = blankPx();
      for (let y = 0; y < doc.h; y++) for (let x = 0; x < doc.w; x++) out[(y + dy) * S + x + dx] = px[y * doc.w + x];
      return out;
    };
    const pics = [];
    doc.frames.forEach((fr, fi) => {
      const own = fr.cels.filter((c) => slot.has(c.layer));
      const links = own.filter((c) => c.link !== void 0), targets = new Set(links.map((c) => c.link));
      if (own.length && links.length === own.length && targets.size === 1 && [...targets][0] < fi && pics[[...targets][0]]) {
        pics.push(pics[[...targets][0]]);
        return;
      }
      const lay = Object.fromEntries(layers.map((l) => [l.id, null]));
      for (const c of own) {
        const id = layers[slot.get(c.layer)].id;
        if (c.link !== void 0) {
          const src = pics[c.link];
          if (src) lay[id] = src[id];
        } else lay[id] = place(c.px);
      }
      for (const l of layers) if (!lay[l.id]) lay[l.id] = blankPx();
      pics.push(lay);
    });
    const tags = doc.tags.filter((t) => t.from <= t.to && t.from < doc.frames.length);
    const covered = new Set(tags.flatMap((t) => Array.from({ length: Math.min(t.to, doc.frames.length - 1) - t.from + 1 }, (_, k) => t.from + k)));
    const spans = tags.map((t) => ({ t, m: ours(t.userData), frames: Array.from({ length: Math.min(t.to, doc.frames.length - 1) - t.from + 1 }, (_, k) => t.from + k) }));
    const rest = doc.frames.map((_, i) => i).filter((i) => !covered.has(i));
    if (rest.length) {
      spans.push({ t: { name: tags.length ? "untagged" : "anim", dir: "forward", repeat: 0 }, m: null, frames: rest });
      if (tags.length) notes.push(`${rest.length} frame${rest.length > 1 ? "s" : ""} outside every tag became the animation "untagged".`);
    }
    if (spans.length > MAX_CLIPS) throw new Error(`The file has ${spans.length} tags; the Workshop holds up to ${MAX_CLIPS} animations.`);
    const dirSet = (() => {
      if (!spans.every((s) => s.m && typeof s.m.dir === "string" && typeof s.m.animation === "string")) return null;
      const byAnim = /* @__PURE__ */ new Map();
      for (const s of spans) byAnim.set(s.m.animation, [...byAnim.get(s.m.animation) || [], s.m.dir]);
      const sets = Object.values(DIRECTION_SETS).map((d) => d.join());
      const one = [...byAnim.values()].map((d) => d.slice().sort().join());
      const match = sets.find((set) => one.every((d) => d === set.split(",").slice().sort().join()));
      return match ? match.split(",") : null;
    })();
    const taken = /* @__PURE__ */ new Set();
    const clips = spans.map(({ t, m, frames }) => {
      if (frames.length > MAX_FRAMES) throw new Error(`The tag "${t.name}" has ${frames.length} frames; a Workshop animation holds up to ${MAX_FRAMES}.`);
      const mode = PLAY_MODES.includes(t.dir) ? t.dir : "forward", r = fromAsepriteRepeat(mode, t.repeat);
      if (r.odd) notes.push(`The ping-pong tag "${t.name}" ends at its far end in Aseprite (repeat ${t.repeat}); here it comes back to its first frame.`);
      const durs = frames.map((i) => doc.frames[i].dur || 100);
      let fps = m && Number.isInteger(m.fps) && m.fps >= 1 && m.fps <= 60 ? m.fps : null;
      if (!fps) {
        const counts2 = /* @__PURE__ */ new Map();
        for (const d of durs) counts2.set(d, (counts2.get(d) || 0) + 1);
        const common = [...counts2].sort((a2, b) => b[1] - a2[1] || a2[0] - b[0])[0][0];
        fps = Math.min(60, Math.max(1, Math.round(1e3 / common)));
      }
      const own = new Set(m && Array.isArray(m.own) ? m.own : durs.flatMap((d, k) => d !== auto(fps) ? [k] : []));
      const base = dirSet ? m.animation : clean(m ? m.animation : t.name, CLIP_NAME, "anim"), dir = dirSet ? m.dir : "S";
      let finalName = base;
      for (let k = 2; taken.has(finalName + "|" + dir); k++) finalName = base.slice(0, 20) + "_" + k;
      taken.add(finalName + "|" + dir);
      if (!dirSet && finalName !== t.name) notes.push(`The tag "${t.name}" is the animation "${finalName}".`);
      return {
        name: finalName,
        dir,
        fps,
        loop: r.loop,
        ...mode !== "forward" ? { mode } : {},
        ...!r.loop && r.repeat > 1 ? { repeat: r.repeat } : {},
        frames: frames.map((i, k) => ({ dur: own.has(k) ? Math.min(1e4, Math.max(10, durs[k])) : null, layers: pics[i] })),
        active: !!(m && m.active)
      };
    });
    const clipOf = /* @__PURE__ */ new Map();
    let crossed = 0;
    clips.forEach((c, k) => c.frames.forEach((f) => {
      const at = clipOf.get(f.layers);
      if (at === void 0) clipOf.set(f.layers, k);
      else if (at !== k) crossed++;
    }));
    if (crossed) notes.push(`${crossed} linked frame${crossed > 1 ? "s" : ""} in another tag became ${crossed > 1 ? "copies" : "a copy"} (the same pixels): the Workshop links frames within one animation.`);
    let palette = [...new Set(doc.palette)];
    if (!palette.length) {
      const used = /* @__PURE__ */ new Set();
      for (const p of pics) for (const id in p) for (const c of p[id]) if (c) used.add(c);
      palette = [...used];
    }
    if (palette.length > MAX_COLOURS) {
      notes.push(`The palette has ${palette.length} colours; the first ${MAX_COLOURS} were kept (pixels keep their colours).`);
      palette = palette.slice(0, MAX_COLOURS);
    }
    if (!palette.length) palette = ["#000000"];
    const a = Math.max(0, clips.findIndex((c) => c.active)), ws = newWorkshop({ size: S, palette });
    ws.layers = layers.map((l) => ({ id: l.id, name: l.name }));
    ws.view = { ...ws.view, hidden: layers.filter((l) => l.hidden).map((l) => l.id), locked: layers.filter((l) => l.locked).map((l) => l.id) };
    ws.directions = dirSet || ["S"];
    ws.clips = clips.map((c, k) => k === a ? { name: c.name, dir: c.dir } : { name: c.name, dir: c.dir, frames: c.frames, fps: c.fps, loop: c.loop, ...c.mode ? { mode: c.mode } : {}, ...c.repeat ? { repeat: c.repeat } : {} });
    ws.active = a;
    ws.frames = clips[a].frames;
    ws.fps = clips[a].fps;
    ws.loop = clips[a].loop;
    delete ws.mode;
    delete ws.repeat;
    if (clips[a].mode) ws.mode = clips[a].mode;
    if (clips[a].repeat) ws.repeat = clips[a].repeat;
    const exportName = String(fileName).replace(/\.(aseprite|ase)$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^[^a-z0-9]+/i, "").replace(/-+$/, "").slice(0, 32);
    if (/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(exportName)) ws.export = { ...ws.export, name: exportName };
    const v = validateWorkshop(JSON.parse(JSON.stringify(serializeWorkshop(ws))));
    if (v.errors.length) throw new Error("The Aseprite file could not become a workshop: " + v.errors.join(" "));
    return { workshop: v.workshop, notes };
  }

