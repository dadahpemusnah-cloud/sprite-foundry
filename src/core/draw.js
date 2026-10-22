  // src/core/draw.js
  function linePoints(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, adx = Math.abs(dx), ady = Math.abs(dy), n = Math.max(adx, ady), pts = [];
    if (!n) return [[x0, y0]];
    const minor = (i, d, ad) => Math.sign(d) * Math.floor((2 * i * ad + n - 1) / (2 * n));
    for (let i = 0; i <= n; i++) {
      if (adx >= ady) pts.push([x0 + Math.sign(dx) * i, y0 + minor(i, dy, ady)]);
      else pts.push([x0 + minor(i, dx, adx), y0 + Math.sign(dy) * i]);
    }
    return pts;
  }
  var SNAP_DIRECTIONS = [[1, 0], [2, 1], [1, 1], [1, 2], [0, 1]].flatMap(([a, b]) => [[a, b], [-a, b], [a, -b], [-a, -b]]).filter(([a, b], i, all) => all.findIndex(([c, d]) => c === a && d === b) === i);
  function snapEnd(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    if (!dx && !dy) return [x1, y1];
    let best = null, bd = Infinity;
    for (const [a2, b2] of SNAP_DIRECTIONS) {
      const d = Math.abs(Math.atan2(dy, dx) - Math.atan2(b2, a2)), gap = Math.min(d, 2 * Math.PI - d);
      if (gap < bd - 1e-9) {
        bd = gap;
        best = [a2, b2];
      }
    }
    const [a, b] = best, k = Math.max(1, Math.round((dx * a + dy * b) / (a * a + b * b)));
    return [x0 + k * a, y0 + k * b];
  }
  function rectPoints(x0, y0, x1, y1, filled = false) {
    const [l, r] = x0 <= x1 ? [x0, x1] : [x1, x0], [t, b] = y0 <= y1 ? [y0, y1] : [y1, y0], pts = [];
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (filled || y === t || y === b || x === l || x === r) pts.push([x, y]);
    return pts;
  }
  function pixelPerfect(path) {
    const out = [];
    for (const p of path) {
      const last = out[out.length - 1];
      if (last && last[0] === p[0] && last[1] === p[1]) continue;
      out.push(p);
      if (out.length >= 3) {
        const [a, b, c] = out.slice(-3), side = (u, v) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) === 1;
        if (side(a, b) && side(b, c) && Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1) out.splice(out.length - 2, 1);
      }
    }
    return out;
  }
  function mirrorPoints(pts, w2, h, axis2) {
    if (!axis2 || axis2 === "off") return pts;
    const out = [], seen = /* @__PURE__ */ new Set(), add = (x, y) => {
      const k = y * w2 + x;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([x, y]);
      }
    };
    for (const [x, y] of pts) {
      add(x, y);
      if (axis2 === "vertical" || axis2 === "both") add(w2 - 1 - x, y);
      if (axis2 === "horizontal" || axis2 === "both") add(x, h - 1 - y);
      if (axis2 === "both") add(w2 - 1 - x, h - 1 - y);
    }
    return out;
  }
  var BAYER2 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var DITHER_LEVELS = { 25: 4, 50: 8, 75: 12 };
  var ditherOn = (x, y, level) => BAYER2[(y & 3) * 4 + (x & 3)] < level;
  var ditherPoints = (pts, level) => pts.filter(([x, y]) => ditherOn(x, y, level));
  function stampPixels(px, w2, h, path, brush2, { axis: axis2 = "off", dither = 0 } = {}) {
    const out = px.slice(), ax = Math.floor(brush2.w / 2), ay = Math.floor(brush2.h / 2);
    const set = (x, y, c) => {
      if (x >= 0 && y >= 0 && x < w2 && y < h && (!dither || ditherOn(x, y, dither))) out[y * w2 + x] = c;
    };
    for (const [x, y] of path) for (let by = 0; by < brush2.h; by++) for (let bx = 0; bx < brush2.w; bx++) {
      const c = brush2.px[by * brush2.w + bx];
      if (!c) continue;
      const X = x - ax + bx, Y = y - ay + by;
      set(X, Y, c);
      if (axis2 === "vertical" || axis2 === "both") set(w2 - 1 - X, Y, c);
      if (axis2 === "horizontal" || axis2 === "both") set(X, h - 1 - Y, c);
      if (axis2 === "both") set(w2 - 1 - X, h - 1 - Y, c);
    }
    return out;
  }
  var brushFrom = (px, W, rect) => {
    const b = copyRect(px, W, rect);
    return b.px.some(Boolean) ? b : null;
  };
  function paintPoints(px, w2, h, pts, value) {
    const out = px.slice();
    for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < w2 && y < h) out[y * w2 + x] = value;
    return out;
  }
  function selOut(px, w2, h, line, darker) {
    const out = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) {
      const i = y * w2 + x;
      if (px[i] !== line) continue;
      const count = /* @__PURE__ */ new Map();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w2 || Y >= h) continue;
        const c = px[Y * w2 + X];
        if (c && c !== line) count.set(c, (count.get(c) || 0) + 1);
      }
      if (!count.size) continue;
      const inside = [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0], d = darker(inside);
      if (d && d !== inside) out[i] = d;
    }
    return out;
  }
  function rectFrom(x0, y0, x1, y1, W, H) {
    const l = Math.max(0, Math.min(x0, x1)), r = Math.min(W - 1, Math.max(x0, x1)), t = Math.max(0, Math.min(y0, y1)), b = Math.min(H - 1, Math.max(y0, y1));
    return l > r || t > b ? null : { x: l, y: t, w: r - l + 1, h: b - t + 1 };
  }
  function copyRect(px, W, rect) {
    const out = [];
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) out.push(px[(rect.y + y) * W + rect.x + x]);
    return { w: rect.w, h: rect.h, px: out };
  }
  function clearRect(px, W, rect, empty = null) {
    const out = px.slice();
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) out[(rect.y + y) * W + rect.x + x] = empty;
    return out;
  }
  function pasteClip(px, W, H, clip2, x, y) {
    const out = px.slice();
    for (let j = 0; j < clip2.h; j++) for (let i = 0; i < clip2.w; i++) {
      const v = clip2.px[j * clip2.w + i], X = x + i, Y = y + j;
      if (v != null && X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = v;
    }
    return out;
  }
  function flipClip(clip2, dir) {
    const out = [];
    for (let y = 0; y < clip2.h; y++) for (let x = 0; x < clip2.w; x++) {
      const sx = dir === "h" ? clip2.w - 1 - x : x, sy = dir === "v" ? clip2.h - 1 - y : y;
      out.push(clip2.px[sy * clip2.w + sx]);
    }
    return { w: clip2.w, h: clip2.h, px: out };
  }
  function moveRect(px, W, H, rect, dx, dy) {
    return pasteClip(clearRect(px, W, rect), W, H, copyRect(px, W, rect), rect.x + dx, rect.y + dy);
  }
  function flipRect(px, W, H, rect, dir) {
    const f = flipClip(copyRect(px, W, rect), dir), out = px.slice();
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) out[(rect.y + y) * W + rect.x + x] = f.px[y * rect.w + x];
    return out;
  }

