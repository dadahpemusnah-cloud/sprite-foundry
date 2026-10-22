  // src/core/project.js
  var PROJECT_FORMAT = "sprite-foundry-project";
  var PROJECT_VERSION = 12;
  var HEX5 = /^#[0-9a-f]{6}$/i;
  var SETTING_KEYS = Object.keys(DEFAULTS);
  function serializeProject({ state: state2, sprite: sprite3, timeline: timeline2, rows, edited: edited2, asset = null, workshop = null, variants: variants2 = [], savedAt = (/* @__PURE__ */ new Date()).toISOString() }) {
    const colours = [], colourIdx = /* @__PURE__ */ new Map();
    const ci = (c) => {
      if (!c) return -1;
      let i = colourIdx.get(c);
      if (i === void 0) {
        i = colours.length;
        colours.push(c);
        colourIdx.set(c, i);
      }
      return i;
    };
    const tags = [], tagIdx = /* @__PURE__ */ new Map();
    const ti = (t) => {
      if (!t) return -1;
      let i = tagIdx.get(t);
      if (i === void 0) {
        i = tags.length;
        tags.push(t);
        tagIdx.set(t, i);
      }
      return i;
    };
    const settings = {};
    for (const k of SETTING_KEYS) settings[k] = state2[k];
    const px = sprite3.px.map(ci), tag = sprite3.tag.map(ti);
    const anims = {};
    for (const name of timeline2.order) {
      const a = timeline2.anims[name];
      anims[name] = { fps: a.fps, loop: a.loop, ...a.mode ? { mode: a.mode } : {}, ...a.repeat ? { repeat: a.repeat } : {}, frames: a.frames.map((f) => ({ spec: f.spec ? JSON.parse(JSON.stringify(f.spec)) : null, px: f.px ? f.px.map(ci) : null, dur: f.dur, ...f.data ? { data: JSON.parse(JSON.stringify(f.data)) } : {} })) };
    }
    return {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      app: "Sprite Foundry",
      savedAt,
      settings,
      generator: { type: TYPES[state2.type] && TYPES[state2.type].rigged && sprite3.type === "imported" ? state2.type : sprite3.type, N: sprite3.N, shapeSeed: sprite3.seedShape, colorSeed: sprite3.seedColor, heroVersion: sprite3.type === "hero" ? HERO_GENERATOR_VERSION : null, version: GENERATOR_VERSIONS[TYPES[state2.type] && TYPES[state2.type].rigged && sprite3.type === "imported" ? state2.type : sprite3.type] },
      colours,
      sprite: { edited: !!edited2, order: sprite3.order.slice(), tags, px, tag, meta: JSON.parse(JSON.stringify(sprite3.meta)) },
      timeline: { order: timeline2.order.slice(), anims },
      export: { rows: rows.slice() },
      asset: asset ? serializeAsset(asset) : null,
      workshop: workshop ? serializeWorkshop(workshop) : null,
      variants: copyVariants(variants2)
      // V2 (format 9)
    };
  }
  function migrateProject(raw) {
    const notes = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The file does not contain a project object.");
    let data = raw;
    if (data.format === void 0 && data.version === void 0 && ("type" in data || "shape" in data)) {
      data = { format: PROJECT_FORMAT, version: 0, settings: raw };
    }
    if (data.format !== PROJECT_FORMAT) throw new Error("This is not a Sprite Foundry project file.");
    if (!Number.isInteger(data.version) || data.version < 0) throw new Error("The project version is missing or invalid.");
    if (data.version > PROJECT_VERSION) throw new Error(`This project was saved by a newer version of Sprite Foundry (format ${data.version}; this app reads up to ${PROJECT_VERSION}). Update the app to open it.`);
    if (data.version === 0) {
      const s = data.settings || {};
      data = {
        format: PROJECT_FORMAT,
        version: 1,
        app: "Sprite Foundry",
        savedAt: null,
        settings: s,
        generator: { type: s.type, N: s.size, shapeSeed: s.shape, colorSeed: s.color, heroVersion: null },
        colours: [],
        sprite: null,
        timeline: null,
        export: null
      };
      notes.push("Older settings-only format: the sprite was rebuilt from its seeds.");
    }
    if (data.version === 1) data = { ...data, version: 2, asset: null };
    if (data.version === 2) data = { ...data, version: 3, workshop: null };
    if (data.version === 3) {
      const a = data.asset && typeof data.asset === "object" && !Array.isArray(data.asset) ? data.asset : null;
      const anims = a && a.rest && a.rest.anims && typeof a.rest.anims === "object" ? Object.values(a.rest.anims) : [];
      data = { ...data, version: 4, asset: a ? { ...a, direction: directionFromFacing(anims[0] && anims[0].facing), views: [] } : data.asset };
    }
    if (data.version === 4) data = { ...data, version: 5 };
    if (data.version === 5) data = { ...data, version: 6 };
    if (data.version === 6) data = { ...data, version: 7 };
    if (data.version === 7) data = { ...data, version: 8 };
    if (data.version === 8) data = { ...data, version: 9 };
    if (data.version === 9) data = { ...data, version: 10 };
    if (data.version === 10) data = { ...data, version: 11 };
    if (data.version === 11) data = { ...data, version: 12 };
    return { data, notes };
  }
  function validateProject(raw, types = TYPES) {
    const errors = [], warnings = [];
    let data;
    try {
      const m = migrateProject(raw);
      data = m.data;
      warnings.push(...m.notes);
    } catch (e) {
      return { errors: [e.message], warnings, project: null };
    }
    const settings = sanitizeSettings(data.settings, types);
    const given = data.settings && typeof data.settings === "object" ? data.settings : {};
    const reset = SETTING_KEYS.filter((k) => k in given && JSON.stringify(given[k]) !== JSON.stringify(settings[k]));
    if (reset.length) warnings.push(`Invalid settings were reset to defaults: ${reset.join(", ")}.`);
    const g = data.generator;
    let gN = null;
    if (!g || typeof g !== "object") errors.push("Generator information is missing.");
    else {
      if (!types[g.type]) errors.push(`Unknown sprite type "${g.type}".`);
      else {
        const T = types[g.type], N = T.fixedSize || g.N;
        if (T.fixedSize ? g.N !== T.fixedSize : !(T.sizeFromAsset ? HEIGHTS : SIZES).includes(g.N)) errors.push(`Sprite size ${g.N} is not valid for ${g.type}.`);
        if (g.type !== settings.type) errors.push(`The settings say "${settings.type}" but the sprite is "${g.type}".`);
        if (!T.fixedSize && !T.sizeFromAsset && g.N !== settings.size) errors.push(`The settings size ${settings.size} does not match the sprite size ${g.N}.`);
        if (typeof g.shapeSeed !== "string" || typeof g.colorSeed !== "string") errors.push("Seeds are missing.");
        if (g.type === "hero" && g.heroVersion != null && g.heroVersion !== HERO_GENERATOR_VERSION) warnings.push(`Made with RPG Hero generator v${g.heroVersion}; this app uses v${HERO_GENERATOR_VERSION}. Saved pixels are kept; regenerated parts may differ.`);
        const savedVersion = Number.isInteger(g.version) ? g.version : 1;
        if (g.type !== "hero" && data.sprite != null && savedVersion !== GENERATOR_VERSIONS[g.type]) warnings.push(`Made with ${types[g.type].label} generator v${savedVersion}; this app uses v${GENERATOR_VERSIONS[g.type]}. The saved pose and animation frames are kept exactly as saved; newly generated sprites use the updated motions.`);
        gN = N;
      }
    }
    const colours = data.colours ?? [];
    if (!Array.isArray(colours) || colours.length > 65536 || colours.some((c) => typeof c !== "string" || !HEX5.test(c))) errors.push("The colour table is invalid.");
    const nc = Array.isArray(colours) ? colours.length : 0;
    const validIdx = (arr, len, max) => Array.isArray(arr) && arr.length === len && arr.every((v) => Number.isInteger(v) && v >= -1 && v < max);
    let base = null;
    if (data.sprite != null && gN) {
      const s = data.sprite, N = gN;
      if (typeof s !== "object") errors.push("Sprite data is invalid.");
      else {
        if (!Array.isArray(s.tags) || s.tags.some((t) => typeof t !== "string")) errors.push("Sprite part tags are invalid.");
        if (!validIdx(s.px, N * N, nc)) errors.push(`Base pose pixels must be ${N}\xD7${N} colour indices.`);
        if (!validIdx(s.tag, N * N, Array.isArray(s.tags) ? s.tags.length : 0)) errors.push(`Base pose part tags must be ${N}\xD7${N} tag indices.`);
        if (!Array.isArray(s.order) || s.order.some((t) => typeof t !== "string")) errors.push("Sprite layer order is invalid.");
        if (s.meta != null && (typeof s.meta !== "object" || Array.isArray(s.meta))) errors.push("Sprite metadata is invalid.");
        if (!errors.length) base = { edited: !!s.edited, order: s.order, meta: s.meta || null, px: s.px.map((i) => i < 0 ? null : colours[i]), tag: s.tag.map((i) => i < 0 ? null : s.tags[i]) };
      }
    }
    let timeline2 = null;
    if (data.timeline != null && gN) {
      const t = data.timeline, F = gN + 2 * PAD;
      if (typeof t !== "object" || !Array.isArray(t.order) || !t.anims || typeof t.anims !== "object") errors.push("Timeline data is invalid.");
      else {
        if (new Set(t.order).size !== t.order.length) errors.push("The animation order lists an animation twice.");
        const anims = {};
        for (const name of t.order) {
          const a = t.anims[name];
          if (typeof name !== "string" || !a || typeof a !== "object") {
            errors.push(`Animation "${name}" is listed but missing.`);
            continue;
          }
          if (a.fps != null && !(typeof a.fps === "number" && a.fps >= 1 && a.fps <= 60)) errors.push(`${name}: animation FPS must be 1\u201360.`);
          if (typeof a.loop !== "boolean") errors.push(`${name}: the loop setting is missing.`);
          if (!Array.isArray(a.frames) || !a.frames.length) {
            errors.push(`${name} has no frames.`);
            continue;
          }
          const frames = [];
          a.frames.forEach((f, i) => {
            const where = `${name} frame ${i + 1}`;
            if (!f || typeof f !== "object") {
              errors.push(`${where} is invalid.`);
              return;
            }
            if (f.spec != null && (typeof f.spec !== "object" || Array.isArray(f.spec))) errors.push(`${where}: the pose description is invalid.`);
            if (f.px != null && !validIdx(f.px, F * F, nc)) errors.push(`${where}: stored pixels must be ${F}\xD7${F} colour indices.`);
            if (f.spec == null && f.px == null) errors.push(`${where} has neither a pose nor stored pixels.`);
            if (f.dur != null && !(typeof f.dur === "number" && f.dur >= 10 && f.dur <= 1e4)) errors.push(`${where}: duration must be 10\u201310000 ms.`);
            const fd = readFrameData(f.data, F);
            if (fd.error) errors.push(`${where}: ${fd.error}.`);
            frames.push({ spec: f.spec ?? null, px: Array.isArray(f.px) ? f.px.map((k) => k < 0 ? null : colours[k]) : null, dur: f.dur ?? null, ...fd.data ? { data: fd.data } : {} });
          });
          if (a.mode != null && !(PLAY_MODES.includes(a.mode) && a.mode !== "forward")) errors.push(`${name}: the playback direction is invalid.`);
          if (a.repeat != null && !(Number.isInteger(a.repeat) && a.repeat >= 2 && a.repeat <= MAX_REPEAT)) errors.push(`${name}: the repeat count must be 2\u2013${MAX_REPEAT}.`);
          anims[name] = { fps: a.fps ?? null, loop: !!a.loop, ...a.mode ? { mode: a.mode } : {}, ...a.repeat ? { repeat: a.repeat } : {}, frames };
        }
        const extra = Object.keys(t.anims).filter((n) => !t.order.includes(n));
        if (extra.length) warnings.push(`Ignored animations not in the animation order: ${extra.join(", ")}.`);
        timeline2 = { order: t.order.slice(), anims };
      }
    }
    let rows = null;
    if (data.export && Array.isArray(data.export.rows)) {
      const known = timeline2 ? timeline2.order : null;
      rows = data.export.rows.filter((r) => typeof r === "string" && (!known || known.includes(r)));
      if (rows.length !== data.export.rows.length) warnings.push("Some sheet rows referred to missing animations and were dropped.");
    }
    let asset = null;
    if (data.asset != null) {
      const a = validateAsset(data.asset);
      errors.push(...a.errors);
      warnings.push(...a.warnings);
      asset = a.asset;
    }
    if (gN && types[g.type].sizeFromAsset) {
      if (!asset || !asset.rest) errors.push("The imported character's converted image is missing.");
      else if (asset.rest.N !== gN) errors.push(`The imported character is ${asset.rest.N} px but the sprite says ${gN} px.`);
    }
    let workshop = null;
    if (data.workshop != null) {
      const w2 = validateWorkshop(data.workshop);
      errors.push(...w2.errors);
      workshop = w2.workshop;
    }
    const vr = readVariants(data.variants);
    if (vr.error) errors.push(`The ${vr.error} are damaged.`);
    if (errors.length) return { errors, warnings, project: null };
    return { errors, warnings, project: { settings, generator: { type: g.type, N: gN, shapeSeed: g.shapeSeed, colorSeed: g.colorSeed }, base, timeline: timeline2, rows, asset, workshop, variants: vr.variants } };
  }
  function restoreProject(project) {
    const st = project.settings, g = project.generator;
    const opts2 = g.type === "hero" ? { cls: st.heroClass, locks: st.heroLocks, colourCls: st.lockColours ? st.heroColourClass : null } : TYPES[g.type].sizeFromAsset ? { asset: project.asset } : {};
    const sprite3 = generate(g.type, g.N, g.shapeSeed, g.colorSeed, opts2);
    if (project.base) {
      sprite3.px = project.base.px.slice();
      sprite3.tag = project.base.tag.slice();
      sprite3.order = project.base.order.slice();
      if (project.base.meta) sprite3.meta = { ...sprite3.meta, ...project.base.meta };
    }
    const timeline2 = project.timeline || createTimeline(sprite3);
    const rows = project.rows ?? timeline2.order.slice();
    const keepSize = TYPES[g.type].fixedSize || TYPES[g.type].sizeFromAsset;
    return { state: { ...st, type: g.type, shape: g.shapeSeed, color: g.colorSeed, size: keepSize ? st.size : g.N }, sprite: sprite3, timeline: timeline2, rows, edited: project.base ? project.base.edited : false, asset: project.asset || null, workshop: project.workshop || null, variants: copyVariants(project.variants) };
  }

