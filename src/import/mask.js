  // src/import/mask.js
  var HINT_KEEP = 1;
  var HINT_REMOVE = 2;
  var MASK_MAX_SIDE = 768;
  var dist2 = (d, i, c) => {
    const r = d[i] - c[0], g = d[i + 1] - c[1], b = d[i + 2] - c[2];
    return r * r + g * g + b * b;
  };
  function maskSize(cw, ch, max = MASK_MAX_SIDE) {
    const s = Math.min(1, max / Math.max(cw, ch));
    return { w: Math.max(1, Math.round(cw * s)), h: Math.max(1, Math.round(ch * s)), scale: s };
  }
  function hasTransparency(img) {
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 128) return true;
    return false;
  }
  function alphaMask(img, threshold = 128) {
    const n = img.width * img.height, m = new Uint8Array(n), d = img.data;
    for (let p = 0; p < n; p++) m[p] = d[p * 4 + 3] >= threshold ? 1 : 0;
    return m;
  }
  function borderColours(img, max = 4) {
    const { width: w2, height: h, data: d } = img, buckets = /* @__PURE__ */ new Map();
    let total = 0;
    const add = (p) => {
      const i = p * 4;
      if (d[i + 3] < 128) return;
      const key = d[i] >> 3 << 10 | d[i + 1] >> 3 << 5 | d[i + 2] >> 3;
      let b = buckets.get(key);
      if (!b) buckets.set(key, b = { n: 0, r: 0, g: 0, b: 0, key });
      b.n++;
      b.r += d[i];
      b.g += d[i + 1];
      b.b += d[i + 2];
      total++;
    };
    for (let x = 0; x < w2; x++) {
      add(x);
      if (h > 1) add((h - 1) * w2 + x);
    }
    for (let y = 1; y < h - 1; y++) {
      add(y * w2);
      if (w2 > 1) add(y * w2 + w2 - 1);
    }
    const list = [...buckets.values()].sort((a, b) => b.n - a.n || a.key - b.key);
    const keep = list.filter((b, i) => i === 0 || b.n >= total * 0.05).slice(0, max);
    return keep.map((b) => [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)]);
  }
  function floodFillMask(img, { tolerance = 40 } = {}) {
    const { width: w2, height: h, data: d } = img, n = w2 * h;
    const refs = borderColours(img), t2 = tolerance * tolerance;
    const isBg = (p) => {
      const i = p * 4;
      if (d[i + 3] < 128) return true;
      for (const c of refs) if (dist2(d, i, c) <= t2) return true;
      return false;
    };
    const bg = new Uint8Array(n), queue = new Int32Array(n);
    let qh = 0, qt = 0;
    const push = (p) => {
      if (!bg[p] && isBg(p)) {
        bg[p] = 1;
        queue[qt++] = p;
      }
    };
    for (let x = 0; x < w2; x++) {
      push(x);
      push((h - 1) * w2 + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w2);
      push(y * w2 + w2 - 1);
    }
    while (qh < qt) {
      const p = queue[qh++], x = p % w2;
      if (x > 0) push(p - 1);
      if (x < w2 - 1) push(p + 1);
      if (p >= w2) push(p - w2);
      if (p < n - w2) push(p + w2);
    }
    const m = new Uint8Array(n);
    for (let p = 0; p < n; p++) m[p] = bg[p] ? 0 : 1;
    return m;
  }
  function colourKeyMask(img, colour, { tolerance = 40 } = {}) {
    const n = img.width * img.height, m = new Uint8Array(n), d = img.data, t2 = tolerance * tolerance;
    for (let p = 0; p < n; p++) m[p] = d[p * 4 + 3] < 128 || dist2(d, p * 4, colour) <= t2 ? 0 : 1;
    return m;
  }
  function components(mask, w2, h, value) {
    const n = w2 * h, label = new Int32Array(n).fill(-1), sizes = [], touches = [], queue = new Int32Array(n);
    const eight = value === 1;
    for (let s = 0; s < n; s++) {
      if (mask[s] !== value || label[s] >= 0) continue;
      const id = sizes.length;
      let qh = 0, qt = 0, size = 0, edge = false;
      label[s] = id;
      queue[qt++] = s;
      while (qh < qt) {
        const p = queue[qh++], x = p % w2, y = (p - x) / w2;
        size++;
        if (x === 0 || y === 0 || x === w2 - 1 || y === h - 1) edge = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (!eight && dx && dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w2 || ny >= h) continue;
          const q = ny * w2 + nx;
          if (mask[q] === value && label[q] < 0) {
            label[q] = id;
            queue[qt++] = q;
          }
        }
      }
      sizes.push(size);
      touches.push(edge);
    }
    return { label, sizes, touches };
  }
  function cleanMask(mask, w2, h, { minSpeck = 0, maxHole = 0 } = {}) {
    const out = Uint8Array.from(mask);
    if (minSpeck > 0) {
      const { label, sizes } = components(out, w2, h, 1);
      const biggest = sizes.indexOf(Math.max(...sizes, 0));
      for (let p = 0; p < out.length; p++) if (label[p] >= 0 && label[p] !== biggest && sizes[label[p]] < minSpeck) out[p] = 0;
    }
    if (maxHole > 0) {
      const { label, sizes, touches } = components(out, w2, h, 0);
      for (let p = 0; p < out.length; p++) if (label[p] >= 0 && !touches[label[p]] && sizes[label[p]] < maxHole) out[p] = 1;
    }
    return out;
  }
  var defaultSpeck = (w2, h) => Math.max(4, Math.round(w2 * h * 1e-3));
  function paintHint(hints, w2, h, x0, y0, x1, y1, radius, value) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, radius / 2)));
    const r2 = radius * radius;
    for (let s = 0; s <= steps; s++) {
      const cx = x0 + (x1 - x0) * s / steps, cy = y0 + (y1 - y0) * s / steps;
      const xa = Math.max(0, Math.floor(cx - radius)), xb = Math.min(w2 - 1, Math.ceil(cx + radius));
      const ya = Math.max(0, Math.floor(cy - radius)), yb = Math.min(h - 1, Math.ceil(cy + radius));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) hints[y * w2 + x] = value;
      }
    }
    return hints;
  }
  function applyHints(mask, hints) {
    const out = Uint8Array.from(mask);
    for (let p = 0; p < out.length; p++) if (hints[p] === HINT_KEEP) out[p] = 1;
    else if (hints[p] === HINT_REMOVE) out[p] = 0;
    return out;
  }
  function countValues(arr, v = 1) {
    let n = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] === v) n++;
    return n;
  }
  function encodeRLE(arr, w2, h) {
    const runs = [];
    for (let p = 0; p < arr.length; ) {
      const v = arr[p];
      let q = p;
      while (q < arr.length && arr[q] === v) q++;
      runs.push(v, q - p);
      p = q;
    }
    return { w: w2, h, runs };
  }
  function decodeRLE(rle) {
    if (!rle || !Number.isInteger(rle.w) || !Number.isInteger(rle.h) || rle.w < 1 || rle.h < 1 || !Array.isArray(rle.runs) || rle.runs.length % 2) throw new Error("invalid mask data");
    const n = rle.w * rle.h, out = new Uint8Array(n);
    let p = 0;
    for (let i = 0; i < rle.runs.length; i += 2) {
      const v = rle.runs[i], c = rle.runs[i + 1];
      if (!Number.isInteger(v) || v < 0 || v > 255 || !Number.isInteger(c) || c < 1 || p + c > n) throw new Error("invalid mask data");
      out.fill(v, p, p + c);
      p += c;
    }
    if (p !== n) throw new Error("invalid mask data");
    return out;
  }

