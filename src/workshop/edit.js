  // src/workshop/edit.js
  var HEX6 = /^#[0-9a-f]{6}$/;
  function floodFill(px, w2, h, x, y, colour) {
    if (x < 0 || y < 0 || x >= w2 || y >= h) return px.slice();
    const from = px[y * w2 + x];
    if (from === colour) return px.slice();
    const out = px.slice(), stack = [y * w2 + x];
    out[y * w2 + x] = colour;
    while (stack.length) {
      const t = stack.pop(), tx = t % w2;
      for (const u of [tx > 0 ? t - 1 : -1, tx < w2 - 1 ? t + 1 : -1, t >= w2 ? t - w2 : -1, t + w2 < w2 * h ? t + w2 : -1]) {
        if (u >= 0 && out[u] === from) {
          out[u] = colour;
          stack.push(u);
        }
      }
    }
    return out;
  }
  function pickColour(frame, w2, x, y, hidden = {}) {
    if (x < 0 || y < 0 || x >= w2) return null;
    return composite(frame, hidden)[y * w2 + x] ?? null;
  }
  function withLayer(ws, frameIdx2, layer, px) {
    const next = nextWorkshop(ws), old = next.frames[frameIdx2].layers, layers = { ...old, [layer]: px.slice() };
    next.frames = next.frames.map((g) => g.layers === old ? { ...g, layers } : g);
    return next;
  }
  function addColour(ws, hex) {
    hex = String(hex).toLowerCase();
    if (!HEX6.test(hex) || ws.palette.includes(hex) || ws.palette.length >= MAX_COLOURS) return ws;
    const next = nextWorkshop(ws);
    next.palette.push(hex);
    return next;
  }
  function setColour(ws, i, hex) {
    hex = String(hex).toLowerCase();
    if (!HEX6.test(hex) || i < 0 || i >= ws.palette.length || ws.palette.includes(hex)) return ws;
    const next = nextWorkshop(ws);
    next.palette[i] = hex;
    return next;
  }
  function removeColour(ws, i) {
    if (i < 0 || i >= ws.palette.length || ws.palette.length <= 1) return ws;
    const next = nextWorkshop(ws);
    next.palette.splice(i, 1);
    return next;
  }
  function addRamp(ws, ramp2) {
    ramp2 = ramp2.map((c) => String(c).toLowerCase());
    if (ramp2.length < 2 || !ramp2.every((c) => HEX6.test(c))) throw new Error("A ramp needs at least two colours.");
    const fresh2 = ramp2.filter((c) => !ws.palette.includes(c));
    if (ws.palette.length + fresh2.length > MAX_COLOURS) throw new Error(`The palette has room for ${MAX_COLOURS - ws.palette.length} more colours; this ramp needs ${fresh2.length}.`);
    const ramps = ws.ramps || [], same2 = ramps.some((r) => r.join() === ramp2.join());
    if (!same2 && ramps.length >= MAX_RAMPS) throw new Error(`Up to ${MAX_RAMPS} ramps.`);
    if (same2 && !fresh2.length) return { ws, added: 0 };
    const next = nextWorkshop(ws);
    next.palette = [...ws.palette, ...fresh2];
    next.ramps = same2 ? ramps : [...ramps, ramp2];
    return { ws: next, added: fresh2.length };
  }
  function replacePalette(ws, colours) {
    const list = [...new Set(colours.map((c) => String(c).toLowerCase()).filter((c) => HEX6.test(c)))].slice(0, MAX_COLOURS);
    if (!list.length) return ws;
    const next = nextWorkshop(ws);
    next.palette = list;
    return next;
  }
  function replaceColour(ws, from, to, scope, frameIdx2 = 0) {
    from = String(from).toLowerCase();
    to = String(to).toLowerCase();
    if (!HEX6.test(from) || !HEX6.test(to) || from === to || !ws.frames[frameIdx2]) return { ws, count: 0, skipped: 0 };
    const blocked = /* @__PURE__ */ new Set([...ws.view.hidden, ...ws.view.locked]), memo = /* @__PURE__ */ new Map();
    let count = 0, skipped = 0;
    const fix = (fr) => {
      if (!memo.has(fr.layers)) {
        let layers2 = fr.layers;
        for (const id of Object.keys(fr.layers)) {
          const px = fr.layers[id];
          let k = 0;
          for (const c of px) if (c === from) k++;
          if (!k) continue;
          if (blocked.has(id)) {
            skipped += k;
            continue;
          }
          if (layers2 === fr.layers) layers2 = { ...fr.layers };
          layers2[id] = px.map((c) => c === from ? to : c);
          count += k;
        }
        memo.set(fr.layers, layers2);
      }
      const layers = memo.get(fr.layers);
      return layers === fr.layers ? fr : { ...fr, layers };
    };
    const only = ws.frames[frameIdx2].layers, next = nextWorkshop(ws);
    next.frames = next.frames.map((fr) => scope !== "frame" || fr.layers === only ? fix(fr) : fr);
    if (scope === "all") next.clips = next.clips.map((c) => c.frames ? { ...c, frames: c.frames.map(fix) } : c);
    return count ? { ws: next, count, skipped } : { ws, count, skipped };
  }
  function setLayerFlag(ws, layer, flag, on) {
    const ids = layerIds(ws);
    if (!ids.includes(layer) || !["hidden", "locked"].includes(flag)) return ws;
    const next = nextWorkshop(ws), set = new Set(next.view[flag]);
    if (on) set.add(layer);
    else set.delete(layer);
    next.view[flag] = ids.filter((l) => set.has(l));
    return next;
  }
  var hiddenMap = (ws) => Object.fromEntries(ws.view.hidden.map((l) => [l, true]));
  function blockedReason(ws, layer) {
    const l = (ws.layers || []).find((x) => x.id === layer), name = l ? l.name.toLowerCase() : layer;
    if (ws.view.hidden.includes(layer)) return `The ${name} layer is hidden. Show it to draw on it.`;
    if (ws.view.locked.includes(layer)) return `The ${name} layer is locked. Unlock it to draw on it.`;
    return null;
  }
  function isoGuideSegments(w2, h, step2 = 8) {
    const segs = [], clip2 = (x0, y0, dx, dy) => {
      const ys = (x) => y0 + (x - x0) * dy / dx, inside = [];
      for (const x of [0, w2]) {
        const y = ys(x);
        if (y >= 0 && y <= h) inside.push([x, y]);
      }
      for (const y of [0, h]) {
        const x = x0 + (y - y0) * dx / dy;
        if (x > 0 && x < w2) inside.push([x, y]);
      }
      if (inside.length >= 2) {
        inside.sort((a, b) => a[0] - b[0]);
        segs.push({ x0: inside[0][0], y0: inside[0][1], x1: inside[inside.length - 1][0], y1: inside[inside.length - 1][1] });
      }
    };
    for (let c = -2 * w2; c <= h + 2 * w2; c += step2) {
      clip2(0, c, 2, 1);
      clip2(0, c, 2, -1);
    }
    return segs;
  }
  var MIN_STEP = 0.02;
  var GREY = 0.035;
  var MAX_HUE = 30;
  var RAMPS = ["skin", "red", "blue", "metal", "wood"];
  var labOf = (hex) => oklab(...rgbOf(hex));
  var chroma = ([, a, b]) => Math.hypot(a, b);
  var hueGap = (p, q) => {
    const d = Math.abs(Math.atan2(p[2], p[1]) - Math.atan2(q[2], q[1])) * 180 / Math.PI;
    return Math.min(d, 360 - d);
  };
  function shadeColour(c, palette, dir, ramps = []) {
    if (!c) return c;
    for (const ramp2 of [...ramps, ...RAMPS.map((n) => SHADING_RAMPS[n])]) {
      const i = ramp2.indexOf(c);
      if (i < 0) continue;
      const next = ramp2[i - dir];
      if (!next) return c;
      if (palette.includes(next)) return next;
    }
    const lc = labOf(c), grey = chroma(lc) < GREY;
    let best = c, bs = Infinity;
    for (const p of palette) {
      const lp = labOf(p), dL = (lp[0] - lc[0]) * dir;
      if (dL < MIN_STEP) continue;
      const pg = chroma(lp) < GREY;
      if (grey !== pg) continue;
      const hg = grey ? 0 : hueGap(lc, lp);
      if (hg > MAX_HUE) continue;
      const score = dL + hg / 300;
      if (score < bs) {
        bs = score;
        best = p;
      }
    }
    return best;
  }
  function shadePoints(before, current, w2, h, pts, palette, dir, ramps = []) {
    const out = current.slice();
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= w2 || y >= h) continue;
      const i = y * w2 + x;
      if (before[i]) out[i] = shadeColour(before[i], palette, dir, ramps);
    }
    return out;
  }

