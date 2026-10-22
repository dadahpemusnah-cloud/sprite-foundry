  // src/rig/art.js
  var emptyArt = () => ({ swaps: {}, holes: {} });
  var tagsOf = (rest) => spriteTags(rest.seg, rest.px, rest.N);
  function drawingFromPart(rest, id) {
    const tags = tagsOf(rest);
    return rest.px.map((c, i) => tags[i] === id ? c : null);
  }
  function hiddenAllowed(rest, id) {
    const N = rest.N, tags = tagsOf(rest), mine = [];
    tags.forEach((t, i) => {
      if (t === id) mine.push(i);
    });
    const allowed = new Uint8Array(N * N);
    if (!mine.length) return allowed;
    const xs = mine.map((i) => i % N), ys = mine.map((i) => i / N | 0);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * N + x;
      if (rest.px[i] && tags[i] !== id) allowed[i] = 1;
    }
    return allowed;
  }
  function fillNearest(rest, id) {
    const N = rest.N, tags = tagsOf(rest), allowed = hiddenAllowed(rest, id), out = new Array(N * N).fill(null);
    const from = new Int32Array(N * N).fill(-1), q = [];
    tags.forEach((t, i) => {
      if (t === id) {
        from[i] = i;
        q.push(i);
      }
    });
    for (let h = 0; h < q.length; h++) {
      const t = q[h], x = t % N;
      for (const u of [x > 0 ? t - 1 : -1, x < N - 1 ? t + 1 : -1, t - N, t + N]) if (u >= 0 && u < N * N && allowed[u] && from[u] < 0) {
        from[u] = from[t];
        q.push(u);
      }
    }
    for (let i = 0; i < N * N; i++) if (allowed[i] && from[i] >= 0) out[i] = rest.px[from[i]];
    return out;
  }
  function toPaletteHex(rgba, allowed, palette) {
    const labs = palette.map((h) => oklab(...rgbOf(h)));
    return Array.from(allowed, (a, i) => {
      if (!a) return null;
      const L = oklab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      let best = 0, bd = Infinity;
      labs.forEach((p, k) => {
        const d = (p[0] - L[0]) ** 2 + (p[1] - L[1]) ** 2 + (p[2] - L[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      return palette[best];
    });
  }
  function inpaintInput(rest, id) {
    const N = rest.N, allowed = hiddenAllowed(rest, id), tags = tagsOf(rest), data = new Uint8ClampedArray(N * N * 4), mask = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      if (tags[i] === id) {
        const [r, g, b] = rgbOf(rest.px[i]);
        data.set([r, g, b, 255], i * 4);
      } else if (allowed[i]) mask[i] = 1;
    }
    return { img: { width: N, height: N, data }, mask, allowed };
  }
  function addDrawing(art, id, name, px) {
    const list = art.swaps[id] || [];
    if (list.some((a) => a.name === name)) throw new Error(`${id} already has a drawing called ${name}.`);
    if (list.length >= 8) throw new Error("Up to 8 drawings per part.");
    return { ...art, swaps: { ...art.swaps, [id]: [...list, { name, px }] } };
  }
  function setDrawing(art, id, name, px) {
    return { ...art, swaps: { ...art.swaps, [id]: (art.swaps[id] || []).map((a) => a.name === name ? { name, px } : a) } };
  }
  function renameDrawing(art, id, from, to) {
    if ((art.swaps[id] || []).some((a) => a.name === to)) throw new Error(`${id} already has a drawing called ${to}.`);
    return { ...art, swaps: { ...art.swaps, [id]: art.swaps[id].map((a) => a.name === from ? { ...a, name: to } : a) } };
  }
  function deleteDrawing(art, id, name) {
    const list = (art.swaps[id] || []).filter((a) => a.name !== name), swaps = { ...art.swaps };
    if (list.length) swaps[id] = list;
    else delete swaps[id];
    return { ...art, swaps };
  }
  function setHidden(art, id, px) {
    const holes2 = { ...art.holes };
    if (px && px.some(Boolean)) holes2[id] = px;
    else delete holes2[id];
    return { ...art, holes: holes2 };
  }
  function pruneArt(art, rest) {
    if (!art) return art;
    const ids = new Set(rest.seg.parts.map((p) => p.id)), out = emptyArt();
    for (const [id, list] of Object.entries(art.swaps)) if (ids.has(id)) out.swaps[id] = list;
    for (const [id, px] of Object.entries(art.holes)) if (ids.has(id)) {
      const ok = hiddenAllowed(rest, id), p = px.map((c, i) => ok[i] ? c : null);
      if (p.some(Boolean)) out.holes[id] = p;
    }
    return out;
  }
  function pruneSwaps(anims, art) {
    if (!anims) return anims;
    const has2 = (id, name) => !!(art && (art.swaps[id] || []).some((a) => a.name === name));
    return Object.fromEntries(Object.entries(anims).map(([n, a]) => [n, { ...a, keys: a.keys.map((k) => {
      if (!k.pose.swap) return k;
      const swap = Object.fromEntries(Object.entries(k.pose.swap).filter(([id, v]) => has2(id, v)));
      const pose2 = { ...k.pose };
      if (Object.keys(swap).length) pose2.swap = swap;
      else delete pose2.swap;
      return { ...k, pose: pose2 };
    }) }]));
  }

