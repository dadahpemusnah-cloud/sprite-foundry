  // src/workshop/model.js
  var WORKSHOP_VERSION = 6;
  var REF_MAX = 512;
  var REF_BYTES = 3e6;
  var REF_LIMITS = { opacity: [0.05, 1], x: [-512, 512], y: [-512, 512], scale: [0.1, 8] };
  var REF_IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
  function referenceRect(ws) {
    const r = ws.reference;
    if (!r) return null;
    const k = Math.min(ws.size.w / r.w, ws.size.h / r.h) * r.scale, w2 = r.w * k, h = r.h * k;
    return { x: (ws.size.w - w2) / 2 + r.x, y: (ws.size.h - h) / 2 + r.y, w: w2, h };
  }
  var clampRef = (k, v) => {
    const [a, b] = REF_LIMITS[k];
    return Math.max(a, Math.min(b, v));
  };
  function setReference(ws, ref) {
    const next = nextWorkshop(ws);
    if (!ref) {
      delete next.reference;
      return ws.reference ? next : ws;
    }
    if (!REF_IMAGE.test(ref.image) || ref.image.length > REF_BYTES || !(Number.isInteger(ref.w) && Number.isInteger(ref.h) && ref.w >= 1 && ref.h >= 1 && ref.w <= REF_MAX && ref.h <= REF_MAX)) throw new Error("The reference image must be a PNG or JPEG of at most " + REF_MAX + " px a side.");
    next.reference = { image: ref.image, w: ref.w, h: ref.h, opacity: 0.5, visible: true, x: 0, y: 0, scale: 1 };
    return next;
  }
  function setReferenceView(ws, patch) {
    if (!ws.reference) return ws;
    const r = { ...ws.reference };
    for (const k of ["opacity", "x", "y", "scale"]) if (patch[k] !== void 0 && Number.isFinite(patch[k])) r[k] = +clampRef(k, patch[k]).toFixed(3);
    if (patch.visible !== void 0) r.visible = !!patch.visible;
    if (JSON.stringify(r) === JSON.stringify(ws.reference)) return ws;
    const next = nextWorkshop(ws);
    next.reference = r;
    return next;
  }
  var MAX_RAMPS = 16;
  var MAX_LAYERS = 8;
  var MAX_CLIPS = 32;
  var LAYER_ID = /^[a-z][a-z0-9_]{0,23}$/;
  var CLIP_NAME = /^[a-z][a-z0-9_-]{0,23}$/;
  var DIRECTION_SETS = { 1: ["S"], 4: ["S", "E", "N", "W"], 8: ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] };
  var DEFAULT_LAYERS = [{ id: "rear", name: "Rear" }, { id: "body", name: "Body" }, { id: "front", name: "Front" }];
  var layerIds = (ws) => (ws.layers || DEFAULT_LAYERS).map((l) => l.id);
  var SIZES2 = [32, 48, 64, 96];
  var LAYERS = ["rear", "body", "front"];
  var LIGHTS = ["top-left", "top", "top-right"];
  var ZOOMS = [2, 3, 4, 6, 8, 12, 16, 24];
  var MAX_FRAMES = 64;
  var MAX_COLOURS = 64;
  var HEX4 = /^#[0-9a-f]{6}$/;
  var SHADING_RAMPS = {
    outline: ["#1a1423", "#3b2f45"],
    skin: ["#ffe0c2", "#f2b98c", "#c98463", "#8a4f3d"],
    red: ["#ff8a80", "#d9413a", "#9c2430", "#5e1424"],
    blue: ["#9ad0ff", "#4f8fd9", "#2f579c", "#1d2f5e"],
    metal: ["#f2f4f7", "#b8c1cc", "#7b8794", "#4a5361"],
    wood: ["#e0b071", "#b07a3e", "#7a4f2a", "#4a2f1c"],
    extra: ["#2b2b3a", "#ffffff"]
    // a ground shadow and a sparkle white
  };
  var DEFAULT_PALETTE = [].concat(...Object.values(SHADING_RAMPS));
  var blank = (n) => new Array(n).fill(null);
  var blankFrame = (size, ids = LAYERS) => ({ dur: null, layers: Object.fromEntries(ids.map((l) => [l, blank(size.w * size.h)])) });
  function newWorkshop({ size = 48, palette = DEFAULT_PALETTE } = {}) {
    if (!SIZES2.includes(size)) throw new Error("unsupported size " + size);
    const s = { w: size, h: size };
    return {
      version: WORKSHOP_VERSION,
      size: s,
      palette: palette.slice(),
      fps: 8,
      loop: true,
      frames: [blankFrame(s)],
      layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
      directions: ["S"],
      clips: [{ name: "idle", dir: "S" }],
      active: 0,
      ramps: [],
      variants: [],
      view: { zoom: size <= 48 ? 12 : size <= 64 ? 8 : 6, grid: true, isoGuide: true, onion: true, onionNext: false, light: "top-left", hidden: [], locked: [] },
      export: { cellW: size, cellH: size, columns: 0, spacing: 0, margin: 0, scale: 1, name: "sprite" }
    };
  }
  var nextWorkshop = (w2) => ({
    ...w2,
    size: { ...w2.size },
    palette: w2.palette.slice(),
    view: { ...w2.view, hidden: (w2.view.hidden || []).slice(), locked: (w2.view.locked || []).slice() },
    export: { ...w2.export },
    frames: w2.frames.slice(),
    layers: (w2.layers || DEFAULT_LAYERS).slice(),
    directions: (w2.directions || ["S"]).slice(),
    clips: (w2.clips || [{ name: "anim", dir: "S" }]).slice(),
    ramps: (w2.ramps || []).slice()
  });
  var copyFrames = (frames) => {
    const memo = /* @__PURE__ */ new Map();
    return frames.map((f) => {
      let layers = memo.get(f.layers);
      if (!layers) {
        layers = Object.fromEntries(Object.keys(f.layers).map((l) => [l, f.layers[l].slice()]));
        memo.set(f.layers, layers);
      }
      return { dur: f.dur, layers };
    });
  };
  var cloneWorkshop = (w2) => ({
    ...w2,
    size: { ...w2.size },
    palette: w2.palette.slice(),
    view: { ...w2.view, hidden: (w2.view.hidden || []).slice(), locked: (w2.view.locked || []).slice() },
    export: { ...w2.export },
    frames: copyFrames(w2.frames),
    layers: (w2.layers || DEFAULT_LAYERS).map((l) => ({ ...l })),
    directions: (w2.directions || ["S"]).slice(),
    clips: (w2.clips || [{ name: "anim", dir: "S" }]).map((c) => c.frames ? { ...c, frames: copyFrames(c.frames) } : { ...c }),
    active: w2.active || 0,
    ramps: (w2.ramps || []).map((r) => r.slice()),
    variants: copyVariants(w2.variants),
    ...w2.mirrored ? { mirrored: { ...w2.mirrored } } : {},
    ...w2.reference ? { reference: { ...w2.reference } } : {},
    ...w2.slices && w2.slices.length ? { slices: w2.slices.map((x) => ({ ...x, center: x.center ? { ...x.center } : null })) } : {}
  });
  function composite(frame, hidden = {}) {
    const ids = Object.keys(frame.layers), n = frame.layers[ids[0]].length, out = blank(n);
    for (const l of ids) {
      if (hidden[l]) continue;
      const px = frame.layers[l];
      for (let i = 0; i < n; i++) if (px[i]) out[i] = px[i];
    }
    return out;
  }
  var frameDuration = (w2, i) => w2.frames[i].dur ?? Math.round(1e3 / w2.fps);
  function createHistory(limit = 100) {
    const undo2 = [], redo2 = [];
    return {
      // call before a change with the state it is about to replace
      push(w2) {
        undo2.push(w2);
        if (undo2.length > limit) undo2.shift();
        redo2.length = 0;
      },
      undo(current) {
        if (!undo2.length) return null;
        redo2.push(current);
        return undo2.pop();
      },
      redo(current) {
        if (!redo2.length) return null;
        undo2.push(current);
        return redo2.pop();
      },
      clear() {
        undo2.length = 0;
        redo2.length = 0;
      },
      get canUndo() {
        return undo2.length > 0;
      },
      get canRedo() {
        return redo2.length > 0;
      }
    };
  }
  function encodeLayer(px, idx) {
    const out = [];
    let prev = null, n = 0;
    for (const c of px) {
      const v = c ? idx(c) : -1;
      if (v === prev) n++;
      else {
        if (n) out.push(n, prev);
        prev = v;
        n = 1;
      }
    }
    if (n) out.push(n, prev);
    return out;
  }
  function decodeLayer(runs, colours, length) {
    if (!Array.isArray(runs) || runs.length % 2) return null;
    const out = [];
    for (let k = 0; k < runs.length; k += 2) {
      const n = runs[k], v = runs[k + 1];
      if (!Number.isInteger(n) || n < 1 || !Number.isInteger(v) || v < -1 || v >= colours.length || out.length + n > length) return null;
      const c = v < 0 ? null : colours[v];
      for (let j = 0; j < n; j++) out.push(c);
    }
    return out.length === length ? out : null;
  }
  function serializeWorkshop(w2) {
    const colours = [], at = /* @__PURE__ */ new Map();
    const idx = (c) => {
      let i = at.get(c);
      if (i === void 0) {
        i = colours.length;
        colours.push(c);
        at.set(c, i);
      }
      return i;
    };
    w2.palette.forEach(idx);
    const ids = layerIds(w2), enc = (frames2) => {
      const first = /* @__PURE__ */ new Map();
      return frames2.map((f, i) => {
        if (first.has(f.layers)) return { dur: f.dur, link: first.get(f.layers) };
        first.set(f.layers, i);
        return { dur: f.dur, layers: Object.fromEntries(ids.map((l) => [l, encodeLayer(f.layers[l], idx)])) };
      });
    };
    const frames = enc(w2.frames);
    const play2 = (c) => ({ ...c.mode && c.mode !== "forward" ? { mode: c.mode } : {}, ...c.repeat > 1 ? { repeat: c.repeat } : {} });
    const clips = (w2.clips || [{ name: "anim", dir: "S" }]).map((c, i) => i === (w2.active || 0) ? { name: c.name, dir: c.dir } : { name: c.name, dir: c.dir, fps: c.fps, loop: c.loop, ...play2(c), frames: enc(c.frames) });
    return {
      version: WORKSHOP_VERSION,
      size: { ...w2.size },
      colours,
      palette: w2.palette.length,
      fps: w2.fps,
      loop: w2.loop,
      ...play2(w2),
      frames,
      view: { ...w2.view },
      export: { ...w2.export },
      layers: (w2.layers || DEFAULT_LAYERS).map((l) => ({ ...l })),
      directions: (w2.directions || ["S"]).slice(),
      clips,
      active: w2.active || 0,
      ramps: (w2.ramps || []).map((r) => r.slice()),
      variants: copyVariants(w2.variants),
      ...w2.mirrored && Object.keys(w2.mirrored).length ? { mirrored: { ...w2.mirrored } } : {},
      ...w2.reference ? { reference: { ...w2.reference } } : {},
      ...w2.slices && w2.slices.length ? { slices: w2.slices.map((x) => ({ ...x, center: x.center ? { ...x.center } : null })) } : {}
    };
  }
  function validateWorkshop(raw) {
    const errors = [], bad = (m) => {
      errors.push(`The 2.5D workshop data is damaged (${m}).`);
      return { workshop: null, errors };
    };
    const isObj2 = (v3) => v3 && typeof v3 === "object" && !Array.isArray(v3), int3 = (v3, a, b) => Number.isInteger(v3) && v3 >= a && v3 <= b;
    if (!isObj2(raw)) return bad("not an object");
    if (![1, 2, 3, 4, 5, WORKSHOP_VERSION].includes(raw.version)) return bad(`unknown version ${raw.version}`);
    const ramps = raw.version >= 4 && raw.ramps !== void 0 ? raw.ramps : [];
    const vr = readVariants(raw.version >= 4 ? raw.variants : void 0);
    if (vr.error) return bad(vr.error);
    if (!Array.isArray(ramps) || ramps.length > MAX_RAMPS || !ramps.every((r) => Array.isArray(r) && r.length >= 2 && r.length <= 9 && r.every((c) => typeof c === "string" && HEX4.test(c)))) return bad("colour ramps");
    const v2 = raw.version >= 2;
    const playOf = (c, where) => {
      if (c.mode != null && !(PLAY_MODES.includes(c.mode) && c.mode !== "forward")) return { error: where + "playback direction" };
      if (c.repeat != null && !(Number.isInteger(c.repeat) && c.repeat >= 2 && c.repeat <= MAX_REPEAT)) return { error: where + "repeat count" };
      return { play: { ...c.mode ? { mode: c.mode } : {}, ...c.repeat ? { repeat: c.repeat } : {} } };
    };
    const top = playOf(raw, "");
    if (top.error) return bad(top.error);
    let layers = DEFAULT_LAYERS.map((l) => ({ ...l }));
    if (v2) {
      if (!Array.isArray(raw.layers) || !raw.layers.length || raw.layers.length > MAX_LAYERS || !raw.layers.every((l) => isObj2(l) && typeof l.id === "string" && LAYER_ID.test(l.id) && typeof l.name === "string" && l.name.trim() && l.name.length <= 24) || new Set(raw.layers.map((l) => l.id)).size !== raw.layers.length) return bad("layers");
      layers = raw.layers.map((l) => ({ id: l.id, name: l.name }));
    }
    const ids = layers.map((l) => l.id);
    const s = raw.size;
    if (!isObj2(s) || !SIZES2.includes(s.w) || s.h !== s.w) return bad("size");
    if (!Array.isArray(raw.colours) || raw.colours.length > 4096 || !raw.colours.every((c) => typeof c === "string" && HEX4.test(c))) return bad("colours");
    if (!int3(raw.palette, 0, Math.min(MAX_COLOURS, raw.colours.length))) return bad("palette");
    if (!(typeof raw.fps === "number" && raw.fps >= 1 && raw.fps <= 60) || typeof raw.loop !== "boolean") return bad("fps or loop");
    const n = s.w * s.h;
    const readFrames = (list, where = "") => {
      if (!Array.isArray(list) || !list.length || list.length > MAX_FRAMES) return { error: where + "frames" };
      const out = [];
      for (const [i, f] of list.entries()) {
        if (!isObj2(f) || !(f.dur === null || int3(f.dur, 10, 1e4))) return { error: `${where}frame ${i + 1}` };
        if (f.link !== void 0) {
          if (raw.version < 3 || f.layers !== void 0 || !int3(f.link, 0, i - 1)) return { error: `${where}frame ${i + 1}, link` };
          out.push({ dur: f.dur, layers: out[f.link].layers });
          continue;
        }
        if (!isObj2(f.layers)) return { error: `${where}frame ${i + 1}` };
        const lay = {};
        for (const l of ids) {
          const px = decodeLayer(f.layers[l], raw.colours, n);
          if (!px) return { error: `${where}frame ${i + 1}, ${l} layer` };
          lay[l] = px;
        }
        if (Object.keys(f.layers).length !== ids.length) return { error: `${where}frame ${i + 1}, layers` };
        out.push({ dur: f.dur, layers: lay });
      }
      return { frames: out };
    };
    const rf = readFrames(raw.frames);
    if (rf.error) return bad(rf.error);
    const frames = rf.frames;
    let directions2 = ["S"], clips = [{ name: "anim", dir: "S" }], active = 0;
    if (v2) {
      const sets = Object.values(DIRECTION_SETS).map((d) => d.join());
      if (!Array.isArray(raw.directions) || !sets.includes(raw.directions.join())) return bad("directions");
      directions2 = raw.directions.slice();
      if (!Array.isArray(raw.clips) || !raw.clips.length || raw.clips.length > MAX_CLIPS || !int3(raw.active, 0, raw.clips.length - 1)) return bad("animations");
      clips = [];
      for (const [i, c] of raw.clips.entries()) {
        if (!isObj2(c) || typeof c.name !== "string" || !CLIP_NAME.test(c.name) || !directions2.includes(c.dir)) return bad(`animation ${i + 1}`);
        if (i === raw.active) {
          clips.push({ name: c.name, dir: c.dir });
          continue;
        }
        const fr = readFrames(c.frames, `animation ${c.name} ${c.dir}, `);
        if (fr.error) return bad(fr.error);
        if (!(typeof c.fps === "number" && c.fps >= 1 && c.fps <= 60) || typeof c.loop !== "boolean") return bad(`animation ${c.name} ${c.dir}, fps or loop`);
        const pc = playOf(c, `animation ${c.name} ${c.dir}, `);
        if (pc.error) return bad(pc.error);
        clips.push({ name: c.name, dir: c.dir, fps: c.fps, loop: c.loop, ...pc.play, frames: fr.frames });
      }
      if (new Set(clips.map((c) => c.name + "/" + c.dir)).size !== clips.length) return bad("an animation listed twice");
      active = raw.active;
    }
    const v = raw.view, e = raw.export;
    if (!isObj2(v) || !ZOOMS.includes(v.zoom) || ![v.grid, v.isoGuide, v.onion].every((b) => typeof b === "boolean") || !LIGHTS.includes(v.light)) return bad("view settings");
    const layerList2 = (x) => x === void 0 ? [] : Array.isArray(x) && x.every((l) => ids.includes(l)) && new Set(x).size === x.length ? ids.filter((l) => x.includes(l)) : null;
    const hidden = layerList2(v.hidden), locked = layerList2(v.locked);
    if (!hidden || !locked) return bad("hidden or locked layers");
    if (v.onionNext !== void 0 && typeof v.onionNext !== "boolean") return bad("view settings");
    if (v.onionBack !== void 0 && !int3(v.onionBack, 1, 3) || v.onionAhead !== void 0 && !int3(v.onionAhead, 1, 3) || v.onionTint !== void 0 && v.onionTint !== "none" && v.onionTint !== "redblue" || v.onionOpacity !== void 0 && !(typeof v.onionOpacity === "number" && v.onionOpacity >= 0.1 && v.onionOpacity <= 0.9)) return bad("onion skin settings");
    if (v.previewScale !== void 0 && ![1, 2, 4].includes(v.previewScale)) return bad("live preview size");
    const onionOpts = Object.fromEntries(["onionBack", "onionAhead", "onionTint", "onionOpacity", "previewScale"].filter((k) => v[k] !== void 0).map((k) => [k, v[k]]));
    if (!isObj2(e) || !int3(e.cellW, s.w, 512) || !int3(e.cellH, s.h, 512) || !int3(e.columns, 0, MAX_FRAMES) || !int3(e.spacing, 0, 64) || !int3(e.margin, 0, 64) || !int3(e.scale, 1, 8)) return bad("export settings");
    if (e.name !== void 0 && !(typeof e.name === "string" && /^[a-z0-9][a-z0-9_-]{0,31}$/i.test(e.name))) return bad("export name");
    let mirrored = null;
    if (raw.version >= 5 && raw.mirrored != null) {
      const pairs = { E: "W", W: "E", SE: "SW", SW: "SE", NE: "NW", NW: "NE" };
      if (!isObj2(raw.mirrored) || !Object.entries(raw.mirrored).every(([k, from]) => {
        const [n2, d] = k.split("|");
        return pairs[d] === from && clips.some((c) => c.name === n2 && c.dir === d);
      })) return bad("mirror marks");
      if (Object.keys(raw.mirrored).length) mirrored = { ...raw.mirrored };
    }
    let reference = null;
    if (raw.version >= 6 && raw.reference != null) {
      const r = raw.reference, inside = (k, v3) => typeof v3 === "number" && Number.isFinite(v3) && v3 >= REF_LIMITS[k][0] && v3 <= REF_LIMITS[k][1];
      if (!isObj2(r) || typeof r.image !== "string" || !REF_IMAGE.test(r.image) || r.image.length > REF_BYTES || !int3(r.w, 1, REF_MAX) || !int3(r.h, 1, REF_MAX) || typeof r.visible !== "boolean" || !["opacity", "x", "y", "scale"].every((k) => inside(k, r[k]))) return bad("reference image");
      reference = { image: r.image, w: r.w, h: r.h, opacity: r.opacity, visible: r.visible, x: r.x, y: r.y, scale: r.scale };
    }
    const sl = raw.version >= 6 ? readSlices(raw.slices, s) : { slices: [] };
    if (sl.error) return bad(sl.error);
    return {
      workshop: {
        version: WORKSHOP_VERSION,
        size: { w: s.w, h: s.h },
        palette: raw.colours.slice(0, raw.palette),
        fps: raw.fps,
        loop: raw.loop,
        ...top.play,
        frames,
        view: { zoom: v.zoom, grid: v.grid, isoGuide: v.isoGuide, onion: v.onion, onionNext: v.onionNext ?? false, ...onionOpts, light: v.light, hidden, locked },
        export: { cellW: e.cellW, cellH: e.cellH, columns: e.columns, spacing: e.spacing, margin: e.margin, scale: e.scale, name: e.name ?? "sprite" },
        layers,
        directions: directions2,
        clips,
        active,
        ramps: ramps.map((r) => r.map((c) => c.toLowerCase())),
        variants: vr.variants,
        ...mirrored ? { mirrored } : {},
        ...reference ? { reference } : {},
        ...sl.slices.length ? { slices: sl.slices } : {}
      },
      errors
    };
  }

