  // src/generators/item.js
  function genItem(N, rs, rc) {
    const s = makeSprite("item", N), cx = N / 2;
    const kind = rs.pick(["potion", "sword", "gem", "coin", "key"]);
    const put = (x, y, c) => setPx(s, x, y, c, "body");
    if (kind === "potion") {
      const neckW = Math.max(2, even(N * 0.25)), corkH = Math.max(1, Math.round(N * 0.12)), neckH = Math.max(1, Math.round(N * 0.12));
      const nx0 = cx - neckW / 2, nx1 = cx + neckW / 2 - 1, yb0 = corkH + neckH;
      const glass = hsl(195, 35, 86), glassSh = hsl(210, 28, 68), cork = ramp(28, 45, 40);
      const liq = ramp(rc() * 360, rc.range(65, 90), rc.range(48, 58));
      const shape2 = rs.pick(["round", "flask", "tall"]);
      const inBody = (x, y) => {
        if (y < yb0 || y >= N || x < 0 || x >= N) return false;
        const px = x + 0.5, py = y + 0.5;
        if (shape2 === "round") {
          const r = Math.min(N * 0.46, (N - yb0) / 2), cy = N - r;
          return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
        }
        if (shape2 === "flask") {
          const t = (y - yb0) / Math.max(1, N - 1 - yb0);
          return Math.abs(px - cx) <= (neckW + t * (N * 0.86 - neckW)) / 2;
        }
        const w2 = even(N * 0.6);
        if (Math.abs(px - cx) > w2 / 2) return false;
        return !((y === yb0 || y === N - 1) && Math.abs(px - cx) > w2 / 2 - 1);
      };
      const lt = yb0 + Math.floor((N - yb0) * rc.range(0.3, 0.5));
      for (let y = 0; y < corkH; y++) for (let x = nx0; x <= nx1; x++) put(x, y, x === nx1 ? cork.sh : y === 0 ? cork.hi : cork.base);
      for (let y = corkH; y < yb0; y++) for (let x = nx0; x <= nx1; x++) put(x, y, x === nx1 ? glassSh : glass);
      for (let y = yb0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!inBody(x, y)) continue;
        const edgeR = !inBody(x + 1, y), edgeB = !inBody(x, y + 1);
        if (y >= lt) put(x, y, y === lt ? liq.hi : edgeR || edgeB ? liq.sh : liq.base);
        else put(x, y, edgeR ? glassSh : glass);
      }
      let lx = 0;
      while (lx < N && !inBody(lx, yb0 + 1)) lx++;
      for (let y = yb0 + 1; y < yb0 + 1 + Math.max(1, Math.round(N * 0.2)); y++) if (inBody(lx + 1, y)) put(lx + 1, y, "#ffffff");
      for (let k = 0; k < 2; k++) {
        const x = rs.int(1, N - 2), y = rs.int(lt + 1, N - 2);
        if (inBody(x, y) && inBody(x + 1, y) && inBody(x, y + 1)) put(x, y, liq.hi2);
      }
      s.meta.outline = hsl(toward(230, 245, 10), 35, 12);
    } else if (kind === "sword") {
      const blade = ramp(215, 12, 66), guard = rc.chance(0.6) ? ramp(44, 70, 52) : ramp(rc() * 360, 50, 45), gem = ramp(rc() * 360, 85, 58);
      const bl = Math.round(N * 0.62), gx = N - 1 - bl, gy = bl, gw = Math.max(1, Math.round(N / 8)), gl = Math.max(2, Math.round(N * 0.15));
      const t = N >= 24 ? 2 : 1;
      for (let i = 0; i < bl; i++) for (let j = 0; j <= (i === 0 ? 0 : t); j++) put(N - 1 - i - j, i, j === 0 ? i === 0 ? blade.hi2 : blade.base : j === t ? blade.hi : blade.base);
      for (let k = -gw; k <= gw; k++) put(gx + k, gy + k, Math.abs(k) === gw ? guard.sh : guard.base);
      const grip = hsl(25, 40, 26);
      for (let k = 1; k <= gl; k++) put(gx - k, gy + k, k % 2 ? grip : mix(grip, "#ffffff", 0.15));
      const px = gx - gl - 1, py = gy + gl + 1;
      put(px, py, gem.base);
      if (N >= 24) {
        put(px - 1, py, gem.hi);
        put(px, py + 1, gem.sh);
        put(px - 1, py + 1, gem.base);
      }
      s.meta.outline = hsl(235, 30, 11);
    } else if (kind === "gem") {
      const R = ramp(rc() * 360, rc.range(60, 90), rc.range(48, 60));
      const top = Math.max(2, Math.round(N * 0.3)), w0 = even(N * 0.5), w1 = even(N - 2);
      for (let y = 0; y <= N - 2; y++) {
        let w2 = y < top ? w0 + (w1 - w0) * (y / Math.max(1, top - 1)) : w1 - (w1 - 2) * ((y - top + 1) / Math.max(1, N - 2 - top + 1));
        w2 = Math.max(2, even(w2));
        for (let x = cx - w2 / 2; x < cx + w2 / 2; x++) {
          let c;
          if (y < top) c = y === 0 ? R.hi2 : x === cx - w2 / 2 ? R.hi2 : R.hi;
          else c = x < cx ? x === cx - w2 / 2 ? R.hi : R.base : x === cx + w2 / 2 - 1 ? R.sh2 : R.sh;
          put(x, y, c);
        }
      }
      put(cx - w0 / 2 + 1, 1, "#ffffff");
      s.meta.outline = hsl(toward(0, 245, 0), 35, 11);
    } else if (kind === "coin") {
      const R = rc.chance(0.7) ? ramp(44, rc.range(70, 90), 55) : ramp(210, 10, 66);
      const r = N * 0.45, cy = N / 2;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > r) continue;
        let c = R.base;
        if (d > r - 1.3) c = dx + dy < 0 ? R.hi : R.sh;
        else if (dx + dy < -r * 0.5) c = R.hi;
        if (Math.abs(dy) <= r * 0.45 && (x === cx - 1 || x === cx)) c = x === cx - 1 ? R.hi2 : R.sh2;
        put(x, y, c);
      }
      s.meta.outline = hsl(30, 40, 12);
    } else {
      const R = rc.chance(0.6) ? ramp(44, 75, 54) : ramp(210, 12, 64);
      const rr = N * 0.24, th = Math.max(1.2, N / 10), sw = Math.max(2, even(N / 8));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - rr - 0.5);
        if (d <= rr && d > rr - th - 0.4) put(x, y, x + 0.5 - cx + (y + 0.5 - rr) < 0 ? R.hi : R.base);
      }
      for (let y = Math.floor(2 * rr); y < N; y++) for (let x = cx - sw / 2; x < cx + sw / 2; x++) put(x, y, x === cx + sw / 2 - 1 ? R.sh : R.base);
      const tw = Math.max(2, Math.round(N / 8)), toothH = Math.max(1, Math.round(N / 10));
      for (const base of [N - 1, N - 1 - 2 * toothH - 1]) for (let k = 0; k < toothH; k++) for (let x = cx + sw / 2; x < cx + sw / 2 + tw; x++) put(x, base - k, k === toothH - 1 ? R.base : R.sh);
      s.meta.outline = hsl(30, 40, 12);
    }
    s.meta.desc = kind;
    const spin = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ spin: Math.cos(i / 8 * Math.PI * 2) }));
    const ib = bbox(Uint8Array.from(s.px, (c) => c ? 1 : 0), N), bob = ib.minY >= 1 ? -1 : N - 1 - ib.maxY >= 1 ? 1 : 0;
    s.anims = {
      float: bob ? [{}, { g: [0, bob] }, { g: [0, bob] }, {}] : [{}, { shine: 0.35 }, { shine: 0.65 }, {}],
      shine: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ shine: i / 7 })),
      spin
    };
    return s;
  }

