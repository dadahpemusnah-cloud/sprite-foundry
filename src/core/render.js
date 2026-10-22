  // src/core/render.js
  function renderFrame(s, spec, o) {
    const N = s.N, F = N + 2 * PAD, out = new Array(F * F).fill(null);
    const g = spec.g || [0, 0], d = spec.d || {};
    const put = (x, y, c) => {
      const X = x + PAD + g[0], Y = y + PAD + g[1];
      if (c && X >= 0 && Y >= 0 && X < F && Y < F) out[Y * F + X] = c;
    };
    const rigPx = s.rigFrame && spec.pose ? s.rigFrame(spec.pose, spec.view) : null;
    if (rigPx) for (let i = 0; i < N * N; i++) {
      if (rigPx[i]) put(i % N, i / N | 0, rigPx[i]);
    }
    const present = new Set(rigPx ? [] : s.tag.filter(Boolean));
    const layers = rigPx ? [] : [...[...present].filter((t) => !s.order.includes(t)), ...s.order];
    for (const L of layers) {
      if (o.hidden && o.hidden.has(L)) continue;
      const of = d[L] || [0, 0];
      for (let i = 0; i < N * N; i++) {
        if (s.tag[i] !== L || !s.px[i]) continue;
        put(i % N + of[0], (i / N | 0) + of[1], spec.blink && L === "eye" ? s.meta.lid : s.px[i]);
      }
      if (L === "armR" && s.meta.weapon) drawWeapon(s, spec.w || "up", (x, y, c) => put(x + of[0], y + of[1], c));
    }
    let fr = out;
    if (spec.lie) fr = lieDown(out, F);
    if (spec.spin != null) {
      const k = Math.abs(spec.spin) < 0.12 ? 0.12 * (spec.spin < 0 ? -1 : 1) : spec.spin, cx = F / 2;
      fr = new Array(F * F).fill(null);
      for (let x = 0; x < F; x++) {
        const rel = (x + 0.5 - cx) / k, sx = Math.floor(cx + rel);
        if (sx < 0 || sx >= F) continue;
        for (let y = 0; y < F; y++) {
          const c = out[y * F + sx];
          if (c) fr[y * F + x] = k < 0 ? mix(c, "#000000", 0.28) : c;
        }
      }
    }
    const outlineIdx = /* @__PURE__ */ new Set();
    if (o.outline !== "none") {
      const oc = o.outline === "black" ? "#000000" : s.meta.outline;
      const add = [];
      for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
        if (fr[y * F + x]) continue;
        if (D4.some(([dx, dy]) => {
          const X = x + dx, Y = y + dy;
          return X >= 0 && Y >= 0 && X < F && Y < F && fr[Y * F + X];
        })) add.push(y * F + x);
      }
      for (const i of add) {
        fr[i] = oc;
        outlineIdx.add(i);
      }
    }
    if (s.post) s.post(spec, (x, y, c) => {
      const X = x + PAD + g[0], Y = y + PAD + g[1];
      if (X >= 0 && Y >= 0 && X < F && Y < F) {
        fr[Y * F + X] = c;
        outlineIdx.delete(Y * F + X);
      }
    });
    if (spec.flash) {
      for (let i = 0; i < fr.length; i++) if (fr[i] && !outlineIdx.has(i)) fr[i] = "#ffffff";
    }
    if (spec.shine != null) {
      const c = -3 + spec.shine * (2 * F + 3);
      for (let i = 0; i < fr.length; i++) {
        if (!fr[i] || outlineIdx.has(i)) continue;
        const t = i % F + (i / F | 0);
        if (t >= c && t <= c + 1.5) fr[i] = mix(fr[i], "#ffffff", 0.7);
      }
    }
    if (o.pal !== "free") {
      for (let i = 0; i < fr.length; i++) if (fr[i]) fr[i] = quantize(fr[i], o.pal);
    }
    return fr;
  }
  function lieDown(out, F) {
    let minX = F, maxX = -1, minY = F, maxY = -1;
    for (let i = 0; i < out.length; i++) if (out[i]) {
      const x = i % F, y = i / F | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0) return out;
    const w2 = maxX - minX + 1, h = maxY - minY + 1, res = new Array(F * F).fill(null);
    const x0 = Math.round(F / 2 - h / 2), y0 = maxY - w2 + 1;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const c = out[y * F + x];
      if (!c) continue;
      const nx = x0 + (y - minY), ny = y0 + (maxX - x);
      if (nx >= 0 && ny >= 0 && nx < F && ny < F) res[ny * F + nx] = c;
    }
    return res;
  }

