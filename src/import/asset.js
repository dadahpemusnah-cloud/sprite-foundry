  // src/import/asset.js
  var ASSET_VERSION = 1;
  var HISTORY_MAX = 20;
  var HEX3 = /^#[0-9a-f]{6}$/;
  var METHODS = ["auto", "grabcut", "flood", "key", "alpha"];
  var USED = ["grabcut", "flood", "key", "alpha"];
  function encodeBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(s);
  }
  function decodeBase64(text) {
    const s = atob(text), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function packPixels(px, palette, N) {
    const idx = new Uint8Array(px.length);
    for (let p = 0; p < px.length; p++) {
      if (!px[p]) continue;
      const i = palette.indexOf(px[p]);
      if (i < 0) throw new Error("pixel colour not in palette: " + px[p]);
      idx[p] = i + 1;
    }
    return encodeRLE(idx, N, N);
  }
  function unpackPixels(rle, palette) {
    const idx = decodeRLE(rle);
    return Array.from(idx, (v) => {
      if (v > palette.length) throw new Error("invalid mask data");
      return v ? palette[v - 1] : null;
    });
  }
  var sprite = (r) => ({
    N: r.N,
    palette: r.palette.slice(),
    px: packPixels(r.px, r.palette, r.N),
    ...r.work ? { work: { dataUrl: r.work.dataUrl, size: r.work.size } } : {},
    ...r.seg ? { seg: serializeSeg(r.seg) } : {},
    ...r.rig ? { rig: { bones: Object.fromEntries(Object.entries(r.rig.bones).map(([id, b]) => [id, { parent: b.parent, pivot: b.pivot.slice(), auto: b.auto !== false }])), order: r.rig.order.slice(), bleed: r.rig.bleed, ...r.rig.keepUnassigned ? { keepUnassigned: true } : {} } } : {},
    ...r.anims ? { anims: JSON.parse(JSON.stringify(r.anims)) } : {},
    ...r.art ? { art: {
      swaps: Object.fromEntries(Object.entries(r.art.swaps || {}).map(([id, list]) => [id, list.map((a) => ({ name: a.name, px: packPixels(a.px, r.palette, r.N) }))])),
      holes: Object.fromEntries(Object.entries(r.art.holes || {}).map(([id, px]) => [id, packPixels(px, r.palette, r.N)]))
    } } : {},
    ...r.settings ? { settings: { ...r.settings, locked: r.settings.locked ? r.settings.locked.slice() : null } } : {}
  });
  function serializeSeg(g) {
    return {
      size: g.size,
      parts: g.parts.map((p) => ({ id: p.id, label: p.label, missing: !!p.missing, userMade: !!p.userMade })),
      map: encodeRLE(g.map, g.size, g.size),
      extras: g.extras.map((e) => ({ id: e.id, label: e.label, from: e.from, darken: e.darken, userMade: true, mask: encodeRLE(e.mask, g.size, g.size) }))
    };
  }
  function serializeAsset(a, top = true) {
    const s = a.source;
    return {
      version: ASSET_VERSION,
      ...top ? { direction: a.direction || "E", views: (a.views || []).map((v) => ({ direction: v.direction, ...serializeAsset(v, false) })) } : {},
      source: {
        name: s.name,
        type: s.type,
        size: s.size,
        width: s.width,
        height: s.height,
        hash: s.hash,
        bytes: s.bytes ? s.base64 || encodeBase64(s.bytes) : null,
        reduced: s.reduced ? { dataUrl: s.reduced.dataUrl, width: s.reduced.width, height: s.reduced.height } : null
      },
      crop: { ...a.crop },
      place: { ...a.place },
      background: a.background ? {
        method: a.background.method,
        tolerance: a.background.tolerance,
        iterations: a.background.iterations,
        key: a.background.key.slice(),
        clean: a.background.clean,
        used: a.background.used,
        w: a.background.w,
        h: a.background.h,
        raw: a.background.raw ? encodeRLE(a.background.raw, a.background.w, a.background.h) : null,
        hints: a.background.hints ? encodeRLE(a.background.hints, a.background.w, a.background.h) : null
      } : null,
      conversion: { ...a.conversion, locked: a.conversion.locked ? a.conversion.locked.slice() : null },
      rest: a.rest ? sprite(a.rest) : null,
      history: (a.history || []).map((v) => ({ at: v.at, label: v.label, ...sprite(v), settings: { ...v.settings } }))
    };
  }
  var isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  var int2 = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  function sanitizeConversion(c, warnings) {
    const out = { ...DEFAULTS2, locked: null };
    if (!isObj(c)) {
      warnings.push("Imported image: conversion settings were missing; defaults are used.");
      return out;
    }
    const reset = [];
    const take = (k, ok) => {
      if (k in c) {
        if (ok(c[k])) out[k] = c[k];
        else reset.push(k);
      }
    };
    take("height", (v) => HEIGHTS.includes(v));
    take("headroom", (v) => int2(v, 0, 32));
    if (!("floor" in c)) out.floor = 0;
    take("floor", (v) => int2(v, 0, 8));
    take("colours", (v) => int2(v, 2, 32));
    take("palette", (v) => v === "auto" || v === "custom" || typeof v === "string" && Object.prototype.hasOwnProperty.call(PALETTES, v) && v !== "custom");
    take("resample", (v) => v === "average" || v === "majority" || v === "exact");
    take("contrast", (v) => typeof v === "number" && v >= 0 && v <= 0.5);
    take("saturation", (v) => typeof v === "number" && v >= 0 && v <= 0.5);
    take("dither", (v) => typeof v === "boolean");
    take("cleanup", (v) => typeof v === "boolean");
    take("seed", (v) => typeof v === "string" && v.length <= 64);
    if ("locked" in c && c.locked !== null) {
      if (Array.isArray(c.locked) && c.locked.length >= 1 && c.locked.length <= 64 && c.locked.every((h) => typeof h === "string" && HEX3.test(h))) out.locked = c.locked.slice();
      else reset.push("locked");
    }
    if (reset.length) warnings.push(`Imported image: invalid conversion settings were reset: ${reset.join(", ")}.`);
    return out;
  }
  var PART_ID = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
  function readSeg(g, N, where, errors) {
    const bad = (m) => {
      errors.push(`${where}: the body parts are ${m}.`);
      return null;
    };
    if (!isObj(g) || g.size !== N * 4) return bad("invalid (wrong size)");
    if (!Array.isArray(g.parts) || g.parts.length > MAX_PARTS) return bad("invalid");
    const ids = /* @__PURE__ */ new Set();
    for (const p of g.parts) {
      if (!isObj(p) || typeof p.id !== "string" || !PART_ID.test(p.id) || ids.has(p.id) || typeof p.label !== "string" || p.label.length > 80) return bad("invalid (a part name)");
      ids.add(p.id);
    }
    let map;
    try {
      if (!isObj(g.map) || g.map.w !== g.size || g.map.h !== g.size) throw new Error();
      map = decodeRLE(g.map);
    } catch (e) {
      return bad("damaged");
    }
    if (map.some((v) => v !== 0 && v !== UNASSIGNED && v > g.parts.length)) return bad("damaged (unknown part number)");
    const extras = [];
    if (!Array.isArray(g.extras)) return bad("invalid");
    for (const e of g.extras) {
      if (!isObj(e) || typeof e.id !== "string" || !PART_ID.test(e.id) || ids.has(e.id) || !ids.has(e.from) || typeof e.label !== "string" || typeof e.darken !== "number" || e.darken < 0 || e.darken > 1) return bad("invalid (a back limb)");
      let mask;
      try {
        if (e.mask.w !== g.size || e.mask.h !== g.size) throw new Error();
        mask = decodeRLE(e.mask);
        if (mask.some((v) => v > 1)) throw new Error();
      } catch (err) {
        return bad("damaged (a back limb)");
      }
      ids.add(e.id);
      extras.push({ id: e.id, label: e.label, from: e.from, darken: e.darken, userMade: true, mask });
    }
    return { size: g.size, parts: g.parts.map((p) => ({ id: p.id, label: p.label, missing: !!p.missing, userMade: !!p.userMade })), map, extras };
  }
  function readRig(g, seg2, where, errors) {
    const bad = (m) => {
      errors.push(`${where}: the rig is ${m}.`);
      return null;
    };
    if (!isObj(g) || !isObj(g.bones) || !Array.isArray(g.order) || !int2(g.bleed, 0, 4)) return bad("invalid");
    const ids = [...seg2.parts.map((p) => p.id), ...seg2.extras.map((e) => e.id)], bones = {};
    if (Object.keys(g.bones).length !== ids.length || !ids.every((id) => isObj(g.bones[id]))) return bad("out of step with the body parts");
    for (const id of ids) {
      const b = g.bones[id];
      if (!(b.parent === null || ids.includes(b.parent) && b.parent !== id)) return bad(`invalid (the parent of ${id})`);
      if (!Array.isArray(b.pivot) || b.pivot.length !== 2 || !b.pivot.every((v) => typeof v === "number" && v >= 0 && v <= seg2.size)) return bad(`invalid (the joint of ${id})`);
      if (b.auto != null && typeof b.auto !== "boolean") return bad(`invalid (the joint of ${id})`);
      bones[id] = { parent: b.parent, pivot: b.pivot.slice(), auto: b.auto !== false };
    }
    const parts = seg2.parts.map((p) => p.id);
    if (g.order.length !== parts.length || !parts.every((id) => g.order.includes(id))) return bad("invalid (the layer order)");
    const rig = { bones, order: g.order.slice(), bleed: g.bleed };
    if (g.keepUnassigned != null) {
      if (typeof g.keepUnassigned !== "boolean") return bad("invalid (unassigned pixels on purpose)");
      if (g.keepUnassigned) rig.keepUnassigned = true;
    }
    try {
      treeOrder(rig);
    } catch (e) {
      return bad("invalid (the bone tree has a loop)");
    }
    return rig;
  }
  var ART_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,23}$/;
  function readArt(g, out, where, errors) {
    const bad = (m) => {
      errors.push(`${where}: the drawings are ${m}.`);
      return null;
    };
    if (!isObj(g) || !isObj(g.swaps || {}) || !isObj(g.holes || {})) return bad("invalid");
    const parts = new Set(out.seg.parts.map((p) => p.id)), art = { swaps: {}, holes: {} };
    const pixels = (rle, what) => {
      try {
        if (!isObj(rle) || rle.w !== out.N || rle.h !== out.N) throw new Error();
        return unpackPixels(rle, out.palette);
      } catch (e) {
        bad(`damaged (${what})`);
        return null;
      }
    };
    for (const [id, list] of Object.entries(g.swaps || {})) {
      if (!parts.has(id) || !Array.isArray(list) || list.length > 8) return bad(`invalid (drawings of ${id})`);
      const names = /* @__PURE__ */ new Set();
      art.swaps[id] = [];
      for (const a of list) {
        if (!isObj(a) || typeof a.name !== "string" || !ART_NAME.test(a.name) || names.has(a.name)) return bad(`invalid (a drawing name of ${id})`);
        const px = pixels(a.px, `drawing ${a.name} of ${id}`);
        if (!px) return null;
        names.add(a.name);
        art.swaps[id].push({ name: a.name, px });
      }
    }
    for (const [id, rle] of Object.entries(g.holes || {})) {
      if (!parts.has(id)) return bad(`invalid (hidden-area art of ${id})`);
      const px = pixels(rle, `hidden-area art of ${id}`);
      if (!px) return null;
      art.holes[id] = px;
    }
    return art;
  }
  var MAX_ANIMS = 16;
  var MAX_ROOT = 96;
  function readAnims(g, rig, where, errors, art = null) {
    const bad = (m) => {
      errors.push(`${where}: the animations are ${m}.`);
      return null;
    };
    if (!isObj(g) || Object.keys(g).length > MAX_ANIMS) return bad("invalid");
    const out = {}, num3 = (v, m) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= m;
    for (const [name, a] of Object.entries(g)) {
      const w2 = (m) => bad(`invalid (${name}: ${m})`);
      if (!ANIM_NAME.test(name) || name === "pose") return w2("the name");
      if (!isObj(a) || !int2(a.frames, 1, 64) || !(typeof a.fps === "number" && a.fps >= 1 && a.fps <= 60) || typeof a.loop !== "boolean" || !FACINGS.includes(a.facing)) return w2("frames, fps, loop or facing");
      if (!Array.isArray(a.keys) || !a.keys.length || a.keys.length > a.frames) return w2("the keys");
      const keys = [];
      for (const k of a.keys) {
        if (!isObj(k) || !int2(k.t, 0, a.frames - 1) || keys.length && k.t <= keys[keys.length - 1].t || !EASES.includes(k.ease) || !isObj(k.pose)) return w2("a key");
        const p = k.pose, rot = {}, off2 = {};
        if (!isObj(p.rot) || !isObj(p.off) || !Array.isArray(p.root) || p.root.length !== 2 || !p.root.every((v) => Number.isInteger(v) && Math.abs(v) <= MAX_ROOT)) return w2("a pose");
        for (const [id, v] of Object.entries(p.rot)) {
          if (!rig.bones[id] || !num3(v, 720)) return w2("a turn of " + id);
          rot[id] = v;
        }
        for (const [id, v] of Object.entries(p.off)) {
          if (!rig.bones[id] || !Array.isArray(v) || v.length !== 2 || !v.every((x) => num3(x, 256))) return w2("an offset of " + id);
          off2[id] = v.slice();
        }
        const pose2 = { rot, off: off2, root: p.root.slice() };
        if (p.tilt != null) {
          if (!num3(p.tilt, 360)) return w2("a body tilt");
          if (p.tilt) pose2.tilt = p.tilt;
        }
        if (p.flash != null) {
          if (typeof p.flash !== "boolean") return w2("a flash");
          if (p.flash) pose2.flash = true;
        }
        if (p.smear != null) {
          if (!isObj(p.smear)) return w2("a smear");
          for (const [id, v] of Object.entries(p.smear)) if (!rig.bones[id] || typeof v !== "number" || !(v > 1 && v <= SMEAR_MAX)) return w2("the smear of " + id);
          if (Object.keys(p.smear).length) pose2.smear = { ...p.smear };
        }
        if (p.swap != null) {
          if (!isObj(p.swap)) return w2("a drawing choice");
          for (const [id, v] of Object.entries(p.swap)) if (!art || !(art.swaps[id] || []).some((a2) => a2.name === v)) return w2(`the drawing "${v}" of ${id}`);
          if (Object.keys(p.swap).length) pose2.swap = { ...p.swap };
        }
        if (p.order != null) {
          if (!isObj(p.order)) return w2("a draw order");
          for (const [id, v] of Object.entries(p.order)) if (!rig.order.includes(id) || !ORDER_PLACES.includes(v)) return w2("the draw order of " + id);
          if (Object.keys(p.order).length) pose2.order = { ...p.order };
        }
        const key = { t: k.t, ease: k.ease, pose: pose2 };
        if (k.hold != null) {
          if (!int2(k.hold, 0, 63)) return w2("a hold");
          if (k.hold) key.hold = k.hold;
        }
        if (k.ease === "curve") {
          if (!Array.isArray(k.curve) || k.curve.length !== 4 || !k.curve.every((v) => num3(v, 4)) || k.curve[0] < 0 || k.curve[0] > 1 || k.curve[2] < 0 || k.curve[2] > 1) return w2("an easing curve");
          key.curve = k.curve.slice();
        } else if (k.curve != null) return w2("an easing curve");
        keys.push(key);
      }
      out[name] = { frames: a.frames, fps: a.fps, loop: a.loop, facing: a.facing, keys };
      if (a.smooth != null) {
        if (typeof a.smooth !== "boolean") return w2("smooth turns");
        if (a.smooth) out[name].smooth = true;
      }
      if (a.follow != null) {
        if (!isObj(a.follow)) return w2("the secondary motion");
        const follow = {};
        for (const [id, v] of Object.entries(a.follow)) {
          if (!rig.bones[id] || !isObj(v) || !Array.isArray(v.from) || !v.from.length || !v.from.every((b) => typeof b === "string" && rig.bones[b] && b !== id) || !int2(v.delay, 1, MAX_FOLLOW_DELAY) || !(typeof v.amount === "number" && v.amount > 0 && v.amount <= MAX_FOLLOW_AMOUNT)) return w2("the secondary motion of " + id);
          follow[id] = { from: v.from.slice(), delay: v.delay, amount: v.amount };
        }
        if (Object.keys(follow).length) out[name].follow = follow;
      }
    }
    return out;
  }
  function readSprite(r, where, errors) {
    if (!isObj(r) || !HEIGHTS.includes(r.N)) {
      errors.push(`${where}: the sprite size is invalid.`);
      return null;
    }
    if (!Array.isArray(r.palette) || !r.palette.length || r.palette.length > 64 || !r.palette.every((h) => typeof h === "string" && HEX3.test(h))) {
      errors.push(`${where}: the palette is invalid.`);
      return null;
    }
    try {
      if (!isObj(r.px) || r.px.w !== r.N || r.px.h !== r.N) throw new Error();
      const out = { N: r.N, palette: r.palette.slice(), px: unpackPixels(r.px, r.palette) };
      if (r.work != null) {
        if (!isObj(r.work) || r.work.size !== r.N * 4 || typeof r.work.dataUrl !== "string" || !r.work.dataUrl.startsWith("data:image/png;base64,")) {
          errors.push(`${where}: the working image is invalid.`);
          return null;
        }
        out.work = { dataUrl: r.work.dataUrl, size: r.work.size };
      }
      if (r.seg != null) {
        if (!out.work) {
          errors.push(`${where}: body parts are stored without their working image.`);
          return null;
        }
        const seg2 = readSeg(r.seg, r.N, where, errors);
        if (!seg2) return null;
        out.seg = seg2;
      }
      if (r.rig != null) {
        if (!out.seg) {
          errors.push(`${where}: a rig is stored without body parts.`);
          return null;
        }
        const rig = readRig(r.rig, out.seg, where, errors);
        if (!rig) return null;
        out.rig = rig;
      }
      if (r.art != null) {
        if (!out.seg) {
          errors.push(`${where}: drawings are stored without body parts.`);
          return null;
        }
        const art = readArt(r.art, out, where, errors);
        if (!art) return null;
        out.art = art;
      }
      if (r.anims != null) {
        if (!out.rig) {
          errors.push(`${where}: animations are stored without a rig.`);
          return null;
        }
        const anims = readAnims(r.anims, out.rig, where, errors, out.art);
        if (!anims) return null;
        out.anims = anims;
      }
      if (r.settings != null) out.settings = sanitizeConversion(r.settings, []);
      return out;
    } catch (e) {
      errors.push(`${where}: the pixels are damaged.`);
      return null;
    }
  }
  function validateAsset(raw, top = true) {
    const errors = [], warnings = [];
    const fail = (m) => {
      errors.push("Imported image: " + m);
    };
    if (!isObj(raw)) return { errors: ["Imported image: the data is invalid."], warnings, asset: null };
    if (raw.version !== ASSET_VERSION) return { errors: [`Imported image: unsupported data version ${raw.version}.`], warnings, asset: null };
    const s = raw.source;
    let source = null;
    if (!isObj(s)) fail("the source image record is missing.");
    else {
      if (typeof s.name !== "string" || !s.name || s.name.length > 255) fail("the file name is invalid.");
      if (s.type !== "png" && s.type !== "jpeg") fail("the image type is invalid.");
      if (!int2(s.width, 1, MAX_DIM) || !int2(s.height, 1, MAX_DIM)) fail("the image size is invalid.");
      if (!int2(s.size, 1, MAX_BYTES)) fail("the file size is invalid.");
      if (typeof s.hash !== "string" || !/^[0-9a-f]{8}$/.test(s.hash)) fail("the image fingerprint is invalid.");
      let bytes = null, reduced2 = null;
      if (s.bytes != null) {
        try {
          bytes = typeof s.bytes === "string" ? decodeBase64(s.bytes) : null;
        } catch (e) {
          bytes = null;
        }
        if (!bytes) fail("the original image data is not valid base64.");
        else if (bytes.length !== s.size || bytesHash(bytes) !== s.hash) {
          fail("the original image data is damaged (its fingerprint does not match).");
          bytes = null;
        }
      }
      if (s.reduced != null) {
        const r = s.reduced;
        if (isObj(r) && typeof r.dataUrl === "string" && r.dataUrl.startsWith("data:image/png;base64,") && int2(r.width, 1, MASK_MAX_SIDE) && int2(r.height, 1, MASK_MAX_SIDE)) reduced2 = { dataUrl: r.dataUrl, width: r.width, height: r.height };
        else fail("the reduced working copy is invalid.");
      }
      if (s.bytes == null && s.reduced == null) fail("neither the original image nor a working copy is stored.");
      if (!errors.length) source = { name: s.name, type: s.type, size: s.size, width: s.width, height: s.height, hash: s.hash, bytes, base64: bytes ? s.bytes : null, reduced: reduced2 };
    }
    const c = raw.crop;
    let crop2 = null;
    if (!isObj(c) || ![c.x, c.y, c.w, c.h].every(Number.isInteger) || c.x < 0 || c.y < 0 || c.w < 1 || c.h < 1 || source && (c.x + c.w > source.width || c.y + c.h > source.height)) fail("the crop is invalid.");
    else crop2 = { x: c.x, y: c.y, w: c.w, h: c.h };
    const p = raw.place;
    let place = { anchor: "bottom", offsetX: 0, offsetY: 0 };
    if (!isObj(p) || p.anchor !== "bottom" && p.anchor !== "centre" || !int2(p.offsetX, -16, 16) || !int2(p.offsetY, -16, 16)) warnings.push("Imported image: the character position was invalid and was reset.");
    else place = { anchor: p.anchor, offsetX: p.offsetX, offsetY: p.offsetY };
    let background = null;
    const b = raw.background;
    if (b != null) {
      if (!isObj(b) || !METHODS.includes(b.method) || !int2(b.tolerance, 0, 128) || !int2(b.iterations, 1, 10) || !Array.isArray(b.key) || b.key.length !== 3 || !b.key.every((v) => int2(v, 0, 255)) || typeof b.clean !== "boolean" || !(b.used === null || USED.includes(b.used)) || !int2(b.w, 1, MASK_MAX_SIDE) || !int2(b.h, 1, MASK_MAX_SIDE)) fail("the background settings are invalid.");
      else {
        const grid = (rle, max, what) => {
          if (rle == null) return null;
          try {
            if (rle.w !== b.w || rle.h !== b.h) throw new Error();
            const a = decodeRLE(rle);
            if (a.some((v) => v > max)) throw new Error();
            return a;
          } catch (e) {
            fail(`the ${what} is damaged.`);
            return null;
          }
        };
        const rawMask = grid(b.raw, 1, "background mask"), hints = grid(b.hints, 2, "brush layer");
        if (b.used && !rawMask) fail("the background mask is missing.");
        background = { method: b.method, tolerance: b.tolerance, iterations: b.iterations, key: b.key.slice(), clean: b.clean, used: b.used, w: b.w, h: b.h, raw: rawMask, hints: hints || new Uint8Array(b.w * b.h) };
      }
    }
    const conversion = sanitizeConversion(raw.conversion, warnings);
    const rest = raw.rest == null ? null : readSprite(raw.rest, "Imported image: the converted sprite", errors);
    const history = [];
    if (raw.history != null) {
      if (!Array.isArray(raw.history) || raw.history.length > HISTORY_MAX) fail("the version history is invalid.");
      else raw.history.forEach((v, i) => {
        const where = `Imported image: version ${i + 1}`;
        if (!isObj(v) || typeof v.at !== "string" || typeof v.label !== "string" || v.label.length > 200) {
          errors.push(`${where} is invalid.`);
          return;
        }
        const sp = readSprite(v, where, errors);
        if (sp) history.push({ at: v.at, label: v.label, ...sp, settings: sanitizeConversion(v.settings, []) });
      });
    }
    if (errors.length) return { errors, warnings, asset: null };
    const asset = { source, crop: crop2, place, background, conversion, rest, history };
    if (top) {
      const direction = raw.direction ?? "E";
      if (!DIRECTIONS.includes(direction)) return { errors: ["Imported image: the direction is invalid."], warnings, asset: null };
      const views = [], seen = /* @__PURE__ */ new Set([direction]);
      if (raw.views != null && (!Array.isArray(raw.views) || raw.views.length > MAX_VIEWS)) return { errors: ["Imported image: the other directions are invalid."], warnings, asset: null };
      for (const v of raw.views || []) {
        const d = isObj(v) ? v.direction : null;
        if (!DIRECTIONS.includes(d) || seen.has(d)) return { errors: ["Imported image: a direction is invalid or listed twice."], warnings, asset: null };
        seen.add(d);
        const r = validateAsset(v, false);
        const tag = (m) => m.replace(/^Imported image/, "Imported image, direction " + d);
        warnings.push(...r.warnings.map(tag));
        if (!r.asset) return { errors: r.errors.map(tag), warnings, asset: null };
        if (r.asset.rest && rest && r.asset.rest.N !== rest.N) return { errors: [`Imported image, direction ${d}: its sprite is ${r.asset.rest.N} px but the main image's is ${rest.N} px.`], warnings, asset: null };
        views.push({ direction: d, ...r.asset });
      }
      asset.direction = direction;
      asset.views = views;
    }
    return { errors, warnings, asset };
  }
  function versionOf(rest, settings, at = (/* @__PURE__ */ new Date()).toISOString(), n = 1) {
    return {
      at,
      label: `Version ${n} \xB7 ${rest.N} px \xB7 ${new Set(rest.px.filter(Boolean)).size} colours`,
      N: rest.N,
      palette: rest.palette.slice(),
      px: rest.px.slice(),
      ...rest.work ? { work: rest.work } : {},
      ...rest.seg ? { seg: rest.seg } : {},
      ...rest.rig ? { rig: rest.rig } : {},
      ...rest.anims ? { anims: rest.anims } : {},
      ...rest.art ? { art: rest.art } : {},
      settings: { ...settings, locked: settings.locked ? settings.locked.slice() : null }
    };
  }

