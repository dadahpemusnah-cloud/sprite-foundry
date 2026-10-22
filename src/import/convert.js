  // src/import/convert.js
  var WORK = 4;
  var HEIGHTS = [32, 48, 64, 96];
  var DEFAULTS2 = { height: 96, headroom: 12, floor: 1, colours: 16, palette: "auto", resample: "average", contrast: 0, saturation: 0, dither: false, cleanup: true, seed: "sprite-foundry" };
  var LIN = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  var toSrgb8 = (v) => {
    v = Math.min(1, Math.max(0, v));
    const c = v <= 31308e-7 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(c * 255);
  };
  var hexOf = (r, g, b) => "#" + [r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0")).join("");
  var rgbOf = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  function oklab(r, g, b) {
    const R = LIN[r], G = LIN[g], B = LIN[b];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function bounds(mask, w2, h) {
    let x0 = w2, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) if (mask[y * w2 + x]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function layout(box, N, { headroom = DEFAULTS2.headroom, floor = 0, anchor = "bottom", offsetX = 0, offsetY = 0 } = {}) {
    const room = Math.max(4, N - headroom - floor), scale = Math.min(room / box.h, N / box.w);
    const w2 = box.w * scale, h = box.h * scale;
    const x = (N - w2) / 2 + offsetX, y = (anchor === "centre" ? (N - h) / 2 : N - floor - h) + offsetY;
    return { x, y, w: w2, h, scale };
  }
  function workingImage(img, mask, N, place) {
    const { width: sw, height: sh, data } = img, box = bounds(mask, sw, sh);
    const size = N * WORK, rgb = new Float32Array(size * size * 3), cov = new Float32Array(size * size);
    if (!box) return { size, rgb, cov, box: null, layout: null };
    if (place && place.exact) {
      const x0 = Math.floor((N - sw) / 2) + (place.offsetX || 0);
      const y0 = (place.anchor === "centre" ? Math.floor((N - sh) / 2) : N - (place.floor || 0) - sh) + (place.offsetY || 0);
      for (let ty = 0; ty < size; ty++) for (let tx = 0; tx < size; tx++) {
        const x = Math.floor(tx / WORK) - x0, y = Math.floor(ty / WORK) - y0;
        if (x < 0 || y < 0 || x >= sw || y >= sh) continue;
        const p = y * sw + x;
        if (!mask[p]) continue;
        const t = ty * size + tx;
        rgb[t * 3] = LIN[data[p * 4]];
        rgb[t * 3 + 1] = LIN[data[p * 4 + 1]];
        rgb[t * 3 + 2] = LIN[data[p * 4 + 2]];
        cov[t] = 1;
      }
      return { size, rgb, cov, box, layout: { x: x0 + box.x, y: y0 + box.y, w: box.w, h: box.h, scale: 1 } };
    }
    const L = layout(box, N, place), k = L.scale * WORK;
    const ox = L.x * WORK - box.x * k, oy = L.y * WORK - box.y * k;
    for (let ty = 0; ty < size; ty++) {
      const sy0 = (ty - oy) / k, sy1 = (ty + 1 - oy) / k;
      if (sy1 <= box.y || sy0 >= box.y + box.h) continue;
      for (let tx = 0; tx < size; tx++) {
        const sx0 = (tx - ox) / k, sx1 = (tx + 1 - ox) / k;
        if (sx1 <= box.x || sx0 >= box.x + box.w) continue;
        let wsum = 0, fsum = 0, r = 0, g = 0, b = 0;
        for (let y = Math.max(0, Math.floor(sy0)); y < Math.min(sh, Math.ceil(sy1)); y++) {
          const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
          if (wy <= 0) continue;
          for (let x = Math.max(0, Math.floor(sx0)); x < Math.min(sw, Math.ceil(sx1)); x++) {
            const wx = Math.min(x + 1, sx1) - Math.max(x, sx0);
            if (wx <= 0) continue;
            const wgt = wx * wy, p = y * sw + x;
            wsum += wgt;
            if (!mask[p]) continue;
            fsum += wgt;
            r += LIN[data[p * 4]] * wgt;
            g += LIN[data[p * 4 + 1]] * wgt;
            b += LIN[data[p * 4 + 2]] * wgt;
          }
        }
        const t = ty * size + tx;
        if (fsum > 0) {
          rgb[t * 3] = LIN[toSrgb8(r / fsum)];
          rgb[t * 3 + 1] = LIN[toSrgb8(g / fsum)];
          rgb[t * 3 + 2] = LIN[toSrgb8(b / fsum)];
        }
        cov[t] = wsum > 0 ? fsum / ((sx1 - sx0) * (sy1 - sy0)) : 0;
      }
    }
    return { size, rgb, cov, box, layout: L };
  }
  function workToRGBA(work) {
    const { size, rgb, cov } = work, out = new Uint8ClampedArray(size * size * 4);
    for (let t = 0; t < size * size; t++) {
      if (cov[t] < 0.5) continue;
      out[t * 4] = toSrgb8(rgb[t * 3]);
      out[t * 4 + 1] = toSrgb8(rgb[t * 3 + 1]);
      out[t * 4 + 2] = toSrgb8(rgb[t * 3 + 2]);
      out[t * 4 + 3] = 255;
    }
    return out;
  }
  function workFromRGBA(data, size) {
    const rgb = new Float32Array(size * size * 3), cov = new Float32Array(size * size);
    for (let t = 0; t < size * size; t++) {
      if (data[t * 4 + 3] < 128) continue;
      cov[t] = 1;
      rgb[t * 3] = LIN[data[t * 4]];
      rgb[t * 3 + 1] = LIN[data[t * 4 + 1]];
      rgb[t * 3 + 2] = LIN[data[t * 4 + 2]];
    }
    return { size, rgb, cov };
  }
  function downsample(work, N, mode = "average") {
    const { size, rgb, cov } = work, out = new Array(N * N).fill(null), B = WORK, half2 = B * B / 2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c = 0, r = 0, g = 0, b = 0;
      const votes = mode === "majority" ? /* @__PURE__ */ new Map() : null;
      for (let yy = 0; yy < B; yy++) for (let xx = 0; xx < B; xx++) {
        const t = (y * B + yy) * size + x * B + xx;
        if (cov[t] < 0.5) continue;
        c++;
        r += rgb[t * 3];
        g += rgb[t * 3 + 1];
        b += rgb[t * 3 + 2];
        if (votes) {
          const key = [toSrgb8(rgb[t * 3]) >> 3, toSrgb8(rgb[t * 3 + 1]) >> 3, toSrgb8(rgb[t * 3 + 2]) >> 3].join(",");
          const v = votes.get(key) || { n: 0, r: 0, g: 0, b: 0 };
          v.n++;
          v.r += rgb[t * 3];
          v.g += rgb[t * 3 + 1];
          v.b += rgb[t * 3 + 2];
          votes.set(key, v);
        }
      }
      if (c < half2) continue;
      if (votes) {
        let best = null;
        for (const v of votes.values()) if (!best || v.n > best.n) best = v;
        r = best.r / best.n;
        g = best.g / best.n;
        b = best.b / best.n;
      } else {
        r /= c;
        g /= c;
        b /= c;
      }
      out[y * N + x] = [toSrgb8(r), toSrgb8(g), toSrgb8(b)];
    }
    return out;
  }
  function lift(cols, contrast = 0, saturation = 0) {
    if (!contrast && !saturation) return cols;
    return cols.map((c) => {
      if (!c) return c;
      let [r, g, b] = c;
      if (contrast) {
        const k = 1 + contrast;
        r = (r - 128) * k + 128;
        g = (g - 128) * k + 128;
        b = (b - 128) * k + 128;
      }
      if (saturation) {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b, k = 1 + saturation;
        r = l + (r - l) * k;
        g = l + (g - l) * k;
        b = l + (b - l) * k;
      }
      return [r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))));
    });
  }
  function kmeansPalette(cols, k, seed = DEFAULTS2.seed) {
    const pts = [], counts2 = /* @__PURE__ */ new Map();
    for (const c of cols) if (c) {
      const h = hexOf(...c);
      counts2.set(h, (counts2.get(h) || 0) + 1);
    }
    const uniq = [...counts2.keys()].sort();
    if (uniq.length <= k) return sortPalette(uniq);
    for (const h of uniq) pts.push({ lab: oklab(...rgbOf(h)), n: counts2.get(h) });
    const rnd = seedRng(seed + ":" + k), d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    let total = 0;
    for (const p of pts) total += p.n;
    let t = rnd() * total, first = pts[0];
    for (const p of pts) {
      t -= p.n;
      if (t <= 0) {
        first = p;
        break;
      }
    }
    const cent = [first.lab.slice()], dist = pts.map((p) => d2(p.lab, first.lab));
    while (cent.length < k) {
      let sum = 0;
      for (let i = 0; i < pts.length; i++) sum += dist[i] * pts[i].n;
      if (sum === 0) break;
      let r = rnd() * sum, pick = pts.length - 1;
      for (let i = 0; i < pts.length; i++) {
        r -= dist[i] * pts[i].n;
        if (r <= 0) {
          pick = i;
          break;
        }
      }
      cent.push(pts[pick].lab.slice());
      for (let i = 0; i < pts.length; i++) dist[i] = Math.min(dist[i], d2(pts[i].lab, pts[pick].lab));
    }
    const assign = new Int32Array(pts.length);
    for (let it = 0; it < 16; it++) {
      let moved = false;
      for (let i = 0; i < pts.length; i++) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < cent.length; j++) {
          const d = d2(pts[i].lab, cent[j]);
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
        if (assign[i] !== best) moved = true;
        assign[i] = best;
      }
      const acc = cent.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < pts.length; i++) {
        const a = acc[assign[i]], p = pts[i];
        a[0] += p.lab[0] * p.n;
        a[1] += p.lab[1] * p.n;
        a[2] += p.lab[2] * p.n;
        a[3] += p.n;
      }
      for (let j = 0; j < cent.length; j++) if (acc[j][3]) cent[j] = [acc[j][0] / acc[j][3], acc[j][1] / acc[j][3], acc[j][2] / acc[j][3]];
      if (!moved && it > 0) break;
    }
    const sums = cent.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      const [r, g, b] = rgbOf(uniq[i]), s = sums[assign[i]], n = pts[i].n;
      s[0] += LIN[r] * n;
      s[1] += LIN[g] * n;
      s[2] += LIN[b] * n;
      s[3] += n;
    }
    const out = [];
    for (const s of sums) if (s[3]) {
      const h = hexOf(toSrgb8(s[0] / s[3]), toSrgb8(s[1] / s[3]), toSrgb8(s[2] / s[3]));
      if (!out.includes(h)) out.push(h);
    }
    return sortPalette(out);
  }
  function sortPalette(list) {
    return list.slice().sort((a, b) => oklab(...rgbOf(a))[0] - oklab(...rgbOf(b))[0] || (a < b ? -1 : 1));
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  function mapToPalette(cols, N, palette, dither = false) {
    const labs = palette.map((h) => oklab(...rgbOf(h))), cache2 = /* @__PURE__ */ new Map();
    const nearest2 = (c) => {
      const key = c.join(",");
      let hit = cache2.get(key);
      if (hit) return hit;
      const L = oklab(...c);
      let a = 0, ad = Infinity, b = 0, bd = Infinity;
      labs.forEach((p, i) => {
        const d = (p[0] - L[0]) ** 2 + (p[1] - L[1]) ** 2 + (p[2] - L[2]) ** 2;
        if (d < ad) {
          b = a;
          bd = ad;
          a = i;
          ad = d;
        } else if (d < bd) {
          b = i;
          bd = d;
        }
      });
      hit = { a, b, ad: Math.sqrt(ad), bd: Math.sqrt(bd) };
      cache2.set(key, hit);
      return hit;
    };
    return cols.map((c, p) => {
      if (!c) return null;
      const n = nearest2(c);
      if (!dither || labs.length < 2 || !Number.isFinite(n.bd)) return palette[n.a];
      const t = n.ad / (n.ad + n.bd);
      return t > 0.25 && t > BAYER[(p % N & 3) + ((Math.floor(p / N) & 3) << 2)] ? palette[n.b] : palette[n.a];
    });
  }
  function cleanup(px, N) {
    const out = px.slice(), stats = { orphans: 0, holes: 0, noise: 0 };
    const at = (x, y) => x < 0 || y < 0 || x >= N || y >= N ? null : out[y * N + x];
    const n8 = (x, y) => [at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1), at(x - 1, y), at(x + 1, y), at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (out[y * N + x] && n8(x, y).every((c) => !c)) {
      out[y * N + x] = null;
      stats.orphans++;
    }
    const mode = (list) => {
      const m = /* @__PURE__ */ new Map();
      for (const c of list) if (c) m.set(c, (m.get(c) || 0) + 1);
      let best = null, bn = 0;
      for (const [c, n] of [...m].sort((a, b) => a[0] < b[0] ? -1 : 1)) if (n > bn) {
        best = c;
        bn = n;
      }
      return [best, bn];
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (out[y * N + x]) continue;
      const four = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      if (four.every(Boolean)) {
        out[y * N + x] = mode(four)[0];
        stats.holes++;
      }
    }
    const src = out.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = src[y * N + x];
      if (!c) continue;
      const nb = [x - 1, x, x + 1].flatMap((xx) => [y - 1, y, y + 1].map((yy) => xx === x && yy === y || xx < 0 || yy < 0 || xx >= N || yy >= N ? null : src[yy * N + xx]));
      if (nb.includes(c)) continue;
      const [m, n] = mode(nb);
      if (n >= 6) {
        out[y * N + x] = m;
        stats.noise++;
      }
    }
    return { px: out, stats };
  }
  function finishPixels(raw, N, palette, o) {
    let px = mapToPalette(raw, N, palette, o.dither), stats = { orphans: 0, holes: 0, noise: 0 };
    if (o.cleanup) ({ px, stats } = cleanup(px, N));
    return { px, stats };
  }
  function pixelsFromWork(work, N, palette, o) {
    const raw = lift(downsample(work, N, o.resample), o.contrast, o.saturation);
    return finishPixels(raw, N, palette, o);
  }
  function convertToPixelArt(img, mask, options = {}) {
    const o = { ...DEFAULTS2, ...options }, N = o.height;
    if (!HEIGHTS.includes(N)) throw new Error("unsupported height " + N);
    const work = workingImage(img, mask, N, { headroom: o.headroom, floor: o.floor, ...o.place || {}, exact: o.resample === "exact" });
    const raw = lift(downsample(work, N, o.resample), o.contrast, o.saturation);
    const palette = o.paletteColours && o.paletteColours.length ? o.paletteColours.map((c) => c.toLowerCase()) : kmeansPalette(raw, Math.max(2, Math.min(32, o.colours)), o.seed);
    const { px, stats } = finishPixels(raw, N, palette, o);
    const used = [...new Set(px.filter(Boolean))];
    return {
      N,
      px,
      palette: palette.filter((c) => used.includes(c)),
      fullPalette: palette,
      work,
      stats: { ...stats, opaque: px.filter(Boolean).length, colours: used.length, layout: work.layout }
    };
  }

