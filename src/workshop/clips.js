  // src/workshop/clips.js
  var play = (c) => ({ ...c.mode && c.mode !== "forward" ? { mode: c.mode } : {}, ...c.repeat > 1 ? { repeat: c.repeat } : {} });
  var setPlay = (o, c) => {
    delete o.mode;
    delete o.repeat;
    Object.assign(o, play(c));
    return o;
  };
  function clipList(ws) {
    const a = ws.active || 0;
    return (ws.clips || [{ name: "anim", dir: "S" }]).map((c, i) => i === a ? { name: c.name, dir: c.dir, frames: ws.frames, fps: ws.fps, loop: ws.loop, ...play(ws) } : c);
  }
  var animationNames = (ws) => [...new Set((ws.clips || []).map((c) => c.name))];
  var clipIndex = (ws, name, dir) => (ws.clips || []).findIndex((c) => c.name === name && c.dir === dir);
  var rowOf = (ws, c) => (ws.directions || ["S"]).length > 1 ? `${c.name}_${c.dir.toLowerCase()}` : c.name;
  function selectClip(ws, i) {
    const a = ws.active || 0;
    if (i === a || !ws.clips[i]) return ws;
    const next = nextWorkshop(ws), old = next.clips[a], c = next.clips[i];
    next.clips[a] = { name: old.name, dir: old.dir, frames: ws.frames, fps: ws.fps, loop: ws.loop, ...play(ws) };
    next.clips[i] = { name: c.name, dir: c.dir };
    next.frames = c.frames.slice();
    next.fps = c.fps;
    next.loop = c.loop;
    next.active = i;
    setPlay(next, c);
    return next;
  }
  var fresh = (ws, frames) => Array.from({ length: frames }, () => blankFrame(ws.size, layerIds(ws)));
  function addAnimation(ws, name) {
    name = String(name || "").trim().toLowerCase();
    if (!CLIP_NAME.test(name)) throw new Error("An animation name starts with a letter and uses lower-case letters, digits, - or _ (up to 24).");
    if (animationNames(ws).includes(name)) throw new Error(`There is already an animation called ${name}.`);
    const dirs = ws.directions || ["S"];
    if (ws.clips.length + dirs.length > MAX_CLIPS) throw new Error(`Up to ${MAX_CLIPS} animations \xD7 directions.`);
    const next = nextWorkshop(ws);
    for (const dir of dirs) next.clips.push({ name, dir, frames: fresh(ws, 1), fps: ws.fps, loop: true });
    const cur2 = ws.clips[ws.active || 0];
    return selectClip(next, clipIndex(next, name, dirs.includes(cur2.dir) ? cur2.dir : dirs[0]));
  }
  var MIRROR_OF = { E: "W", W: "E", SE: "SW", SW: "SE", NE: "NW", NW: "NE" };
  var flipX = (px, w2, h) => {
    const out = new Array(px.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) out[y * w2 + (w2 - 1 - x)] = px[y * w2 + x];
    return out;
  };
  var symmetric = (px, w2, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w2 / 2; x++) if (px[y * w2 + x] !== px[y * w2 + (w2 - 1 - x)]) return false;
    return true;
  };
  var mirrorKey = (name, dir) => name + "|" + dir;
  function asymmetricLayers(ws, name) {
    const front = clipList(ws).find((c) => c.name === name && c.dir === "S");
    if (!front || !front.frames[0]) return null;
    return ws.layers.filter((l) => !symmetric(front.frames[0].layers[l.id], ws.size.w, ws.size.h)).map((l) => l.name);
  }
  function mirrorDirection(ws, name, from) {
    const to = MIRROR_OF[from];
    if (!to) throw new Error("Only side and three-quarter views can be mirrored: E \u2194 W, SE \u2194 SW, NE \u2194 NW.");
    const list = clipList(ws), src = list.find((c) => c.name === name && c.dir === from), k = list.findIndex((c) => c.name === name && c.dir === to);
    if (!src) throw new Error(`The animation ${name} has no direction ${from}.`);
    if (k < 0) throw new Error(`The animation ${name} has no direction ${to}: choose 4 or 8 directions first.`);
    const memo = /* @__PURE__ */ new Map(), { w: w2, h } = ws.size;
    const frames = src.frames.map((fr) => {
      let l = memo.get(fr.layers);
      if (!l) {
        l = Object.fromEntries(Object.entries(fr.layers).map(([id, px]) => [id, flipX(px, w2, h)]));
        memo.set(fr.layers, l);
      }
      return { dur: fr.dur, layers: l };
    });
    const next = nextWorkshop(ws);
    if (k === (ws.active || 0)) {
      next.frames = frames;
      next.fps = src.fps;
      next.loop = src.loop;
      setPlay(next, src);
    } else next.clips[k] = { name, dir: to, frames, fps: src.fps, loop: src.loop, ...play(src) };
    next.mirrored = { ...ws.mirrored || {}, [mirrorKey(name, to)]: from };
    delete next.mirrored[mirrorKey(name, from)];
    return { ws: next, to, asymmetric: asymmetricLayers(ws, name) };
  }
  var keepMarks = (ws, rename = {}) => {
    const out = {};
    for (const [k, from] of Object.entries(ws.mirrored || {})) {
      const [n, d] = k.split("|"), name = rename[n] || n;
      if (ws.clips.some((c) => c.name === name && c.dir === d)) out[mirrorKey(name, d)] = from;
    }
    if (Object.keys(out).length) ws.mirrored = out;
    else delete ws.mirrored;
    return ws;
  };
  function renameAnimation(ws, from, to) {
    to = String(to || "").trim().toLowerCase();
    if (to === from) return ws;
    if (!CLIP_NAME.test(to)) throw new Error("An animation name starts with a letter and uses lower-case letters, digits, - or _ (up to 24).");
    if (animationNames(ws).includes(to)) throw new Error(`There is already an animation called ${to}.`);
    const next = nextWorkshop(ws);
    next.clips = next.clips.map((c) => c.name === from ? { ...c, name: to } : c);
    return keepMarks(next, { [from]: to });
  }
  function deleteAnimation(ws, name) {
    const names = animationNames(ws);
    if (names.length <= 1 || !names.includes(name)) return ws;
    const keepName = names.find((n) => n !== name), cur2 = ws.clips[ws.active || 0];
    let next = ws.clips[ws.active || 0].name === name ? selectClip(ws, clipIndex(ws, keepName, cur2.dir) >= 0 ? clipIndex(ws, keepName, cur2.dir) : clipIndex(ws, keepName, ws.clips.find((c) => c.name === keepName).dir)) : ws;
    const active = next.clips[next.active];
    next = nextWorkshop(next);
    next.clips = next.clips.filter((c) => c.name !== name);
    next.active = next.clips.findIndex((c) => c.name === active.name && c.dir === active.dir);
    return keepMarks(next);
  }
  function setDirections(ws, count) {
    const dirs = DIRECTION_SETS[count];
    if (!dirs) throw new Error("Directions are 1, 4 or 8.");
    if (dirs.join() === (ws.directions || ["S"]).join()) return ws;
    const names = animationNames(ws);
    if (names.length * dirs.length > MAX_CLIPS) throw new Error(`Up to ${MAX_CLIPS} animations \xD7 directions: ${names.length} animations in ${count} directions is too many.`);
    const all = clipList(ws), cur2 = all[ws.active || 0], next = nextWorkshop(ws);
    next.directions = dirs.slice();
    next.clips = [];
    for (const name of names) {
      const mine = all.filter((c2) => c2.name === name), model = mine[0];
      for (const dir of dirs) {
        const have = mine.find((c2) => c2.dir === dir);
        next.clips.push(have ? { name, dir, frames: have.frames, fps: have.fps, loop: have.loop, ...play(have) } : { name, dir, frames: fresh(ws, model.frames.length), fps: model.fps, loop: model.loop, ...play(model) });
      }
    }
    let a = next.clips.findIndex((c2) => c2.name === cur2.name && c2.dir === cur2.dir);
    if (a < 0) a = next.clips.findIndex((c2) => c2.name === cur2.name && c2.dir === "S");
    const c = next.clips[a];
    next.frames = c.frames.slice();
    next.fps = c.fps;
    next.loop = c.loop;
    next.active = a;
    setPlay(next, c);
    next.clips[a] = { name: c.name, dir: c.dir };
    return keepMarks(next);
  }
  function drawnClipsLost(ws, count) {
    const dirs = DIRECTION_SETS[count] || [];
    return clipList(ws).filter((c) => !dirs.includes(c.dir) && c.frames.some((f) => Object.values(f.layers).some((px) => px.some(Boolean)))).map((c) => `${c.name} ${c.dir}`);
  }
  function everyFrame(ws, fn) {
    const next = nextWorkshop(ws), memo = /* @__PURE__ */ new Map();
    const map = (f) => {
      let l = memo.get(f.layers);
      if (!l) {
        l = fn(f).layers;
        memo.set(f.layers, l);
      }
      return { ...f, layers: l };
    };
    next.frames = next.frames.map(map);
    next.clips = next.clips.map((c) => c.frames ? { ...c, frames: c.frames.map(map) } : c);
    return next;
  }
  var slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^[^a-z]+/, "").slice(0, 20) || "layer";
  function addLayer(ws, name, after = null) {
    name = String(name || "").trim();
    if (!name || name.length > 24) throw new Error("A layer needs a name of up to 24 characters.");
    const layers = ws.layers;
    if (layers.length >= MAX_LAYERS) throw new Error(`Up to ${MAX_LAYERS} layers.`);
    if (layers.some((l) => l.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a layer called ${name}.`);
    let id = slug(name), k = 2;
    while (layers.some((l) => l.id === id)) id = slug(name).slice(0, 20) + "_" + k++;
    const at = after ? layers.findIndex((l) => l.id === after) + 1 : layers.length, order2 = layers.slice();
    order2.splice(at, 0, { id, name });
    const n = ws.size.w * ws.size.h, ids = order2.map((l) => l.id);
    const next = everyFrame(ws, (f) => ({ dur: f.dur, layers: Object.fromEntries(ids.map((l) => [l, l === id ? new Array(n).fill(null) : f.layers[l]])) }));
    next.layers = order2;
    return { ws: next, id };
  }
  function renameLayer(ws, id, name) {
    name = String(name || "").trim();
    if (!name || name.length > 24) throw new Error("A layer needs a name of up to 24 characters.");
    if (ws.layers.some((l) => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a layer called ${name}.`);
    const next = nextWorkshop(ws);
    next.layers = next.layers.map((l) => l.id === id ? { id, name } : l);
    return next;
  }
  function deleteLayer(ws, id) {
    if (ws.layers.length <= 1 || !ws.layers.some((l) => l.id === id)) return ws;
    const ids = ws.layers.map((l) => l.id).filter((l) => l !== id);
    const next = everyFrame(ws, (f) => ({ dur: f.dur, layers: Object.fromEntries(ids.map((l) => [l, f.layers[l]])) }));
    next.layers = next.layers.filter((l) => l.id !== id);
    next.view.hidden = next.view.hidden.filter((l) => l !== id);
    next.view.locked = next.view.locked.filter((l) => l !== id);
    return next;
  }
  function moveLayer2(ws, id, d) {
    const i = ws.layers.findIndex((l) => l.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= ws.layers.length) return ws;
    const order2 = ws.layers.slice();
    [order2[i], order2[j]] = [order2[j], order2[i]];
    const ids = order2.map((l) => l.id);
    const next = everyFrame(ws, (f) => ({ dur: f.dur, layers: Object.fromEntries(ids.map((l) => [l, f.layers[l]])) }));
    next.layers = order2;
    next.view.hidden = ids.filter((l) => next.view.hidden.includes(l));
    next.view.locked = ids.filter((l) => next.view.locked.includes(l));
    return next;
  }

