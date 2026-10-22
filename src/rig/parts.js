  // src/rig/parts.js
  var UNASSIGNED = 255;
  var MAX_PARTS = 40;
  var DEFAULT_PARTS = [
    ["thighL", "thigh L"],
    ["shinL", "shin L"],
    ["footL", "foot L"],
    ["thighR", "thigh R"],
    ["shinR", "shin R"],
    ["footR", "foot R"],
    ["pelvis", "pelvis"],
    ["torso", "torso"],
    ["head", "head"],
    ["upperArmL", "upper arm L"],
    ["forearmL", "forearm L"],
    ["handL", "hand L"],
    ["upperArmR", "upper arm R"],
    ["forearmR", "forearm R"],
    ["handR", "hand R"],
    ["weapon", "weapon"]
  ].map(([id, label]) => ({ id, label, missing: false, userMade: false }));
  var LIMBS = {
    armL: ["upperArmL", "forearmL", "handL"],
    armR: ["upperArmR", "forearmR", "handR"],
    legL: ["thighL", "shinL", "footL"],
    legR: ["thighR", "shinR", "footR"]
  };
  var ID = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
  function newSegmentation(alpha, size) {
    const map = new Uint8Array(size * size);
    for (let t = 0; t < map.length; t++) map[t] = alpha[t * 4 + 3] >= 128 ? UNASSIGNED : 0;
    return { size, parts: DEFAULT_PARTS.map((p) => ({ ...p })), map, extras: [] };
  }
  var partIndex = (seg2, id) => seg2.parts.findIndex((p) => p.id === id) + 1;
  function counts(seg2) {
    const c = new Array(seg2.parts.length + 1).fill(0);
    let unassigned = 0, character = 0;
    for (const v of seg2.map) {
      if (!v) continue;
      character++;
      if (v === UNASSIGNED) unassigned++;
      else c[v]++;
    }
    return { perPart: seg2.parts.map((p, i) => c[i + 1]), unassigned, character };
  }
  function paint(map, size, x0, y0, x1, y1, radius, value) {
    const out = Uint8Array.from(map), r2 = radius * radius;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, radius / 2)));
    for (let s = 0; s <= steps; s++) {
      const cx = x0 + (x1 - x0) * s / steps, cy = y0 + (y1 - y0) * s / steps;
      for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(size - 1, Math.ceil(cy + radius)); y++)
        for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(size - 1, Math.ceil(cx + radius)); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, t = y * size + x;
          if (dx * dx + dy * dy <= r2 && out[t]) out[t] = value;
        }
    }
    return out;
  }
  function lasso(map, size, points, value) {
    const out = Uint8Array.from(map);
    if (points.length < 3) return out;
    const ys = points.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(size - 1, Math.ceil(Math.max(...ys))); y++) {
      const cy = y + 0.5, xs = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
        if (ay <= cy && by > cy || by <= cy && ay > cy) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(size - 1, Math.floor(xs[k + 1] - 0.5)); x++) {
          const t = y * size + x;
          if (out[t]) out[t] = value;
        }
    }
    return out;
  }
  function connectedFill(map, size, rgba, x, y, value, tolerance = 40) {
    const out = Uint8Array.from(map), s = y * size + x;
    if (x < 0 || y < 0 || x >= size || y >= size || !map[s]) return out;
    const owner = map[s], c = [rgba[s * 4], rgba[s * 4 + 1], rgba[s * 4 + 2]], t2 = tolerance * tolerance;
    const seen = new Uint8Array(map.length), queue = new Int32Array(map.length);
    let qh = 0, qt = 0;
    const ok = (t) => map[t] === owner && (rgba[t * 4] - c[0]) ** 2 + (rgba[t * 4 + 1] - c[1]) ** 2 + (rgba[t * 4 + 2] - c[2]) ** 2 <= t2;
    seen[s] = 1;
    queue[qt++] = s;
    while (qh < qt) {
      const t = queue[qh++], tx = t % size;
      out[t] = value;
      for (const n of [tx > 0 ? t - 1 : -1, tx < size - 1 ? t + 1 : -1, t - size, t + size])
        if (n >= 0 && n < map.length && !seen[n] && ok(n)) {
          seen[n] = 1;
          queue[qt++] = n;
        }
    }
    return out;
  }
  function growRegions(map, size, rgba) {
    const out = Uint8Array.from(map), n = map.length, dist = new Float64Array(n).fill(Infinity);
    const heap = [];
    const push = (d, t) => {
      heap.push([d, t]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (heap[p][0] < heap[i][0] || heap[p][0] === heap[i][0] && heap[p][1] <= heap[i][1]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (; ; ) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          const lt = (a, b) => heap[a][0] < heap[b][0] || heap[a][0] === heap[b][0] && heap[a][1] < heap[b][1];
          if (l < heap.length && lt(l, m)) m = l;
          if (r < heap.length && lt(r, m)) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    for (let t = 0; t < n; t++) if (map[t] && map[t] !== UNASSIGNED) {
      dist[t] = 0;
      push(0, t);
    }
    while (heap.length) {
      const [d, t] = pop();
      if (d > dist[t]) continue;
      const tx = t % size;
      for (const q of [tx > 0 ? t - 1 : -1, tx < size - 1 ? t + 1 : -1, t - size, t + size]) {
        if (q < 0 || q >= n || !map[q] || map[q] !== UNASSIGNED) continue;
        const diff = Math.abs(rgba[t * 4] - rgba[q * 4]) + Math.abs(rgba[t * 4 + 1] - rgba[q * 4 + 1]) + Math.abs(rgba[t * 4 + 2] - rgba[q * 4 + 2]);
        const nd = d + 1 + diff / 8;
        if (nd < dist[q]) {
          dist[q] = nd;
          out[q] = out[t];
          push(nd, q);
        }
      }
    }
    return out;
  }
  function looseParts(seg2, id, { bridge, minPx }) {
    const k = partIndex(seg2, id), size = seg2.size, map = seg2.map, n = map.length;
    if (!k) return [];
    const label = new Int32Array(n).fill(-1), sizes = [];
    for (let t = 0; t < n; t++) {
      if (map[t] !== k || label[t] >= 0) continue;
      const q = [t], c = sizes.length;
      label[t] = c;
      let m = 0;
      while (q.length) {
        const u = q.pop(), x = u % size;
        m++;
        for (const v of [x > 0 ? u - 1 : -1, x < size - 1 ? u + 1 : -1, u - size, u + size]) if (v >= 0 && v < n && map[v] === k && label[v] < 0) {
          label[v] = c;
          q.push(v);
        }
      }
      sizes.push(m);
    }
    if (sizes.length < 2) return [];
    const main = sizes.indexOf(Math.max(...sizes));
    const cost = new Int32Array(n).fill(-1), dq = new Int32Array(n * 2);
    let head = n, tail = n;
    for (let t = 0; t < n; t++) if (label[t] === main) {
      cost[t] = 0;
      dq[tail++] = t;
    }
    const reached = /* @__PURE__ */ new Set([main]);
    while (head < tail) {
      const u = dq[head++], x = u % size, cu = cost[u];
      for (const v of [x > 0 ? u - 1 : -1, x < size - 1 ? u + 1 : -1, u - size, u + size]) {
        if (v < 0 || v >= n || !map[v]) continue;
        const own = map[v] === k, cv = own ? cu : cu + 1;
        if (cv > bridge || cost[v] >= 0 && cost[v] <= cv) continue;
        cost[v] = cv;
        if (own) {
          reached.add(label[v]);
          dq[--head] = v;
        } else dq[tail++] = v;
      }
    }
    return sizes.filter((m, c) => !reached.has(c) && m >= minPx).sort((a, b) => b - a);
  }
  var thinPieces = (map, size, top, bottom) => {
    const H = bottom - top + 1, wide = Math.max(2, Math.round(H * 0.045)), runs = [], parent = [];
    const find = (i) => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    let prev = [];
    for (let y = top; y <= bottom; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        if (!map[y * size + x]) continue;
        let b = x;
        while (b + 1 < size && map[y * size + b + 1]) b++;
        const r = { y, a: x, b, thin: b - x + 1 <= wide, i: runs.length };
        runs.push(r);
        parent.push(r.i);
        row.push(r);
        if (r.thin) {
          for (const q of prev) if (q.thin && q.a <= b + 1 && r.a <= q.b + 1) parent[find(r.i)] = find(q.i);
        }
        x = b;
      }
      prev = row;
    }
    const chains = /* @__PURE__ */ new Map();
    for (const r of runs) if (r.thin) {
      const k = find(r.i), c = chains.get(k) || { top: r.y, bottom: r.y, runs: [] };
      c.top = Math.min(c.top, r.y);
      c.bottom = Math.max(c.bottom, r.y);
      c.runs.push(r);
      chains.set(k, c);
    }
    const solid = runs.reduce((m, r) => r.thin ? m : Math.max(m, r.y), -1), list = [...chains.values()];
    return list.filter((c) => c.bottom - c.top + 1 >= H * 0.1 && c.bottom > Math.max(solid, ...list.filter((o) => o !== c).map((o) => o.bottom)) + WORK);
  };
  var WEAPON_TOL = 36;
  function findWeapon(map, size, rgba, { H, bodyL, bodyR }) {
    const n = map.length, seen = new Uint8Array(n), diff = (a, b) => Math.abs(rgba[a * 4] - rgba[b * 4]) + Math.abs(rgba[a * 4 + 1] - rgba[b * 4 + 1]) + Math.abs(rgba[a * 4 + 2] - rgba[b * 4 + 2]);
    let best = null;
    for (let s0 = 0; s0 < n; s0++) {
      if (!map[s0] || seen[s0]) continue;
      const list = [s0], q = [s0];
      seen[s0] = 1;
      while (q.length) {
        const t = q.pop(), x = t % size;
        for (const u of [x > 0 ? t - 1 : -1, x < size - 1 ? t + 1 : -1, t - size, t + size]) if (u >= 0 && u < n && map[u] && !seen[u] && diff(t, u) <= WEAPON_TOL) {
          seen[u] = 1;
          q.push(u);
          list.push(u);
        }
      }
      if (list.length < H * 0.25 * 2) continue;
      let mx = 0, my = 0;
      for (const t of list) {
        mx += t % size;
        my += t / size | 0;
      }
      mx /= list.length;
      my /= list.length;
      let sxx = 0, syy = 0, sxy = 0;
      for (const t of list) {
        const dx = t % size - mx, dy = (t / size | 0) - my;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
      const ang = Math.atan2(2 * sxy, sxx - syy) / 2, ux = Math.cos(ang), uy = Math.sin(ang);
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, beside = 0;
      for (const t of list) {
        const x = t % size, y = t / size | 0, a = (x - mx) * ux + (y - my) * uy, b = -(x - mx) * uy + (y - my) * ux;
        a0 = Math.min(a0, a);
        a1 = Math.max(a1, a);
        b0 = Math.min(b0, b);
        b1 = Math.max(b1, b);
        if (x < bodyL || x > bodyR) beside++;
      }
      const length = a1 - a0 + 1, thick = b1 - b0 + 1;
      if (length < H * 0.25 || thick > Math.max(3, length / 6) || beside < list.length * 0.5) continue;
      const mine = new Set(list), cols = /* @__PURE__ */ new Map(), rows = /* @__PURE__ */ new Map(), w2 = Math.ceil(thick) + 2;
      for (const t of list) {
        const x = t % size, y = t / size | 0;
        const c = cols.get(x) || [Infinity, -1];
        c[0] = Math.min(c[0], y);
        c[1] = Math.max(c[1], y);
        cols.set(x, c);
        const r = rows.get(y) || [Infinity, -1];
        r[0] = Math.min(r[0], x);
        r[1] = Math.max(r[1], x);
        rows.set(y, r);
      }
      let stick = 0;
      for (const [x, [y0, y1]] of cols) {
        let o0 = Infinity, o1 = -1;
        for (let X = Math.max(0, x - w2); X <= Math.min(size - 1, x + w2); X++) for (let y = 0; y < size; y++) {
          const t = y * size + X;
          if (map[t] && !mine.has(t)) {
            o0 = Math.min(o0, y);
            o1 = Math.max(o1, y);
          }
        }
        stick = Math.max(stick, o1 < 0 ? y1 - y0 + 1 : Math.max(o0 - y0, y1 - o1));
      }
      for (const [y, [x0, x1]] of rows) {
        let o0 = Infinity, o1 = -1;
        for (let Y = Math.max(0, y - w2); Y <= Math.min(size - 1, y + w2); Y++) for (let x = 0; x < size; x++) {
          const t = Y * size + x;
          if (map[t] && !mine.has(t)) {
            o0 = Math.min(o0, x);
            o1 = Math.max(o1, x);
          }
        }
        stick = Math.max(stick, o1 < 0 ? x1 - x0 + 1 : Math.max(o0 - x0, x1 - o1));
      }
      if (stick < H * 0.03) continue;
      if (!best || length > best.length) best = { list, length, thick, stick };
    }
    return best;
  }
  function crossWeapon(map, size, rgba, { H }) {
    const n = map.length, seen = new Uint8Array(n), col = (t) => [rgba[t * 4], rgba[t * 4 + 1], rgba[t * 4 + 2]];
    const diff = (a2, b) => Math.abs(a2[0] - b[0]) + Math.abs(a2[1] - b[1]) + Math.abs(a2[2] - b[2]);
    const blades = [];
    for (let s0 = 0; s0 < n; s0++) {
      if (!map[s0] || seen[s0]) continue;
      const list = [s0], q2 = [s0];
      seen[s0] = 1;
      while (q2.length) {
        const t = q2.pop(), x = t % size;
        for (const u of [x > 0 ? t - 1 : -1, x < size - 1 ? t + 1 : -1, t - size, t + size]) if (u >= 0 && u < n && map[u] && !seen[u] && diff(col(t), col(u)) <= WEAPON_TOL) {
          seen[u] = 1;
          q2.push(u);
          list.push(u);
        }
      }
      if (list.length < H * 0.12 * 2) continue;
      const c = col(list[list.length >> 1]);
      if (Math.max(...c) - Math.min(...c) > 40) continue;
      const a2 = axis(list, size);
      if (a2.length >= H * 0.12 && a2.thick <= Math.max(3, a2.length / 6)) blades.push({ list, ...a2 });
    }
    let best = null;
    for (const b of blades) {
      const group = blades.filter((o) => Math.abs(((o.ang - b.ang) * 180 / Math.PI + 90) % 180 - 90) <= 6 && Math.abs(-(o.mx - b.mx) * b.uy + (o.my - b.my) * b.ux) <= Math.max(b.thick, o.thick) + 2);
      const all2 = group.flatMap((o) => o.list);
      if (!best || all2.length > best.all.length) best = { all: all2, ...axis(all2, size) };
    }
    if (!best) return null;
    const { thick } = best, hw = thick / 2 + 1, out = new Set(best.all);
    const at = (x, y) => {
      const X = Math.round(x), Y = Math.round(y);
      return X < 0 || Y < 0 || X >= size || Y >= size ? -1 : Y * size + X;
    };
    const mean = (ts) => {
      const s = [0, 0, 0];
      for (const t of ts) {
        const c = col(t);
        s[0] += c[0];
        s[1] += c[1];
        s[2] += c[2];
      }
      return s.map((v) => v / ts.length);
    };
    const strip = (ax2, along) => {
      const cx = ax2.mx + ax2.ux * along, cy = ax2.my + ax2.uy * along, band = [], sideA = [], sideB = [];
      let tot = 0;
      for (let j = -hw; j <= hw; j += 0.5) {
        const t = at(cx - ax2.uy * j, cy + ax2.ux * j);
        tot++;
        if (t >= 0 && map[t]) band.push(t);
      }
      let bgSide = false;
      for (const [side, s] of [[sideA, -1], [sideB, 1]]) for (let j = hw + 2; j <= hw + 3; j++) {
        const t = at(cx - ax2.uy * j * s, cy + ax2.ux * j * s);
        if (t < 0 || !map[t]) bgSide = true;
        else side.push(t);
      }
      const inside = band.length >= tot * 0.6, m = inside ? mean(band) : null;
      return { band, inside, bgSide, ok: inside && (bgSide || sideA.length && sideB.length && diff(m, mean(sideA)) > 70 && diff(m, mean(sideB)) > 70) };
    };
    const walk = (ax2) => {
      for (const dir of [-1, 1]) {
        const start = dir < 0 ? ax2.a0 : ax2.a1, gapMax = Math.round(H * 0.08);
        for (let k = 1, gap = 0, outside = 0; k < size && gap <= gapMax && outside < 2; k++) {
          const s = strip(ax2, start + dir * k);
          if (!s.inside) {
            outside++;
            gap++;
            continue;
          }
          outside = 0;
          if (s.ok) {
            for (const t of s.band) out.add(t);
            gap = 0;
          } else gap++;
        }
      }
    };
    walk(best);
    const ax = axis([...out], size);
    walk(ax);
    const { mx, my, ux, uy } = ax;
    const line = [...out].map((t) => (t % size - mx) * ux + ((t / size | 0) - my) * uy), lo = Math.min(...line), hi = Math.max(...line);
    const q = [...out];
    while (q.length) {
      const t = q.pop(), x = t % size;
      for (const u of [x > 0 ? t - 1 : -1, x < size - 1 ? t + 1 : -1, t - size, t + size]) {
        if (u < 0 || u >= n || !map[u] || out.has(u) || diff(col(t), col(u)) > WEAPON_TOL) continue;
        const dx = u % size - mx, dy = (u / size | 0) - my, along = dx * ux + dy * uy;
        if (Math.abs(-dx * uy + dy * ux) > hw * 2.5 || along < lo || along > hi) continue;
        out.add(u);
        q.push(u);
      }
    }
    const all = [...out], a = axis(all, size), sticks = [a.a0, a.a1].some((e, i) => [1, 2, 3, 4].some((k) => {
      const st = strip(a, e + (i ? -k : k));
      return st.inside && st.bgSide;
    }));
    return sticks && a.length >= H * 0.35 ? all : null;
  }
  function axis(list, size) {
    let mx = 0, my = 0;
    for (const t of list) {
      mx += t % size;
      my += t / size | 0;
    }
    mx /= list.length;
    my /= list.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const t of list) {
      const dx = t % size - mx, dy = (t / size | 0) - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const ang = Math.atan2(2 * sxy, sxx - syy) / 2, ux = Math.cos(ang), uy = Math.sin(ang);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const t of list) {
      const x = t % size, y = t / size | 0, a = (x - mx) * ux + (y - my) * uy, b = -(x - mx) * uy + (y - my) * ux;
      a0 = Math.min(a0, a);
      a1 = Math.max(a1, a);
      b0 = Math.min(b0, b);
      b1 = Math.max(b1, b);
    }
    return { mx, my, ux, uy, ang, a0, a1, length: a1 - a0 + 1, thick: b1 - b0 + 1 };
  }
  function staffFromThin(map, size, rgba, pieces, H) {
    if (!pieces.length) return null;
    const piece = pieces.reduce((a, b) => b.bottom - b.top > a.bottom - a.top ? b : a), px = [];
    for (const r of piece.runs) for (let x = r.a; x <= r.b; x++) px.push(r.y * size + x);
    let mx = 0, my = 0;
    for (const t of px) {
      mx += t % size;
      my += t / size | 0;
    }
    mx /= px.length;
    my /= px.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const t of px) {
      const dx = t % size - mx, dy = (t / size | 0) - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const ang = Math.atan2(2 * sxy, sxx - syy) / 2;
    let ux = Math.cos(ang), uy = Math.sin(ang);
    if (uy > 0) {
      ux = -ux;
      uy = -uy;
    }
    const width = Math.max(...piece.runs.map((r) => r.b - r.a + 1)), half2 = width / 2 + 1;
    const col = (k) => [0, 1, 2].map((c) => {
      const v = px.map((t) => rgba[t * 4 + c]).sort((a, b) => a - b);
      return v[v.length >> 1];
    })[k];
    const ref = [col(0), col(1), col(2)], near = (t) => Math.abs(rgba[t * 4] - ref[0]) + Math.abs(rgba[t * 4 + 1] - ref[1]) + Math.abs(rgba[t * 4 + 2] - ref[2]) <= 60;
    let sx = mx, sy = my, best = -Infinity;
    for (const t of px) {
      const d = (t % size - mx) * ux + ((t / size | 0) - my) * uy;
      if (d > best) {
        best = d;
        sx = t % size;
        sy = t / size | 0;
      }
    }
    const out = new Set(px), gapMax = Math.max(4, Math.round(H * 0.03));
    for (let k = 1, miss = 0; k < H * 1.2 && miss < gapMax; k++) {
      const cx = sx + ux * k, cy = sy + uy * k;
      let hit = false;
      for (let j = -half2; j <= half2; j += 0.5) {
        const x = Math.round(cx - uy * j), y = Math.round(cy + ux * j);
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const t = y * size + x;
        if (map[t] && near(t)) {
          out.add(t);
          hit = true;
        }
      }
      miss = hit ? 0 : miss + 1;
    }
    return out.size >= H * 0.25 * width ? [...out] : null;
  }
  function torsoEdges(map, size, cx, y0, y1, skip) {
    const L = [], R = [], xc = Math.round(cx);
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      const on = (x) => x >= 0 && x < size && map[y * size + x] && !skip[y * size + x];
      if (!on(xc)) continue;
      let a = xc, b = xc;
      while (on(a - 1)) a--;
      while (on(b + 1)) b++;
      let left = false, right = false;
      for (let x = 0; x < a - 1; x++) if (on(x)) {
        left = true;
        break;
      }
      for (let x = size - 1; x > b + 1; x--) if (on(x)) {
        right = true;
        break;
      }
      if (left) L.push(a);
      if (right) R.push(b);
    }
    const med = (v) => v.length >= 3 ? v.slice().sort((p, q) => p - q)[v.length >> 1] : null;
    return { L: med(L), R: med(R) };
  }
  function traceArm(map, size, side, { edge, y0, armTop, bottom, skip, hips, bodyL, bodyR }) {
    const ok = (x, y) => x >= 0 && x < size && y >= 0 && y < size && map[y * size + x] && !skip[y * size + x] && (side < 0 ? x < edge : x > edge);
    const runsOn = (y) => {
      const out = [];
      for (let x = 0; x < size; x++) {
        if (!ok(x, y)) continue;
        let b = x;
        while (ok(b + 1, y)) b++;
        out.push([x, b]);
        x = b;
      }
      return out;
    };
    let seedY = -1;
    for (let y = Math.round(y0); y <= bottom; y++) if (runsOn(y).length) {
      seedY = y;
      break;
    }
    if (seedY < 0) return null;
    const set = /* @__PURE__ */ new Set(), add = (r) => {
      for (const [a, b] of r.runs) for (let x = a; x <= b; x++) set.add(r.y * size + x);
    };
    const touching = (r, prev) => r.filter(([a, b]) => prev.some(([p, q]) => a <= q + 1 && p <= b + 1));
    const seed = { y: seedY, runs: runsOn(seedY) };
    add(seed);
    for (let y = seedY - 1, prev = seed.runs; y >= Math.round(armTop); y--) {
      const r = touching(runsOn(y), prev);
      if (!r.length) break;
      add({ y, runs: r });
      prev = r;
    }
    for (let y = seedY + 1, prev = seed.runs; y <= bottom; y++) {
      const r = touching(runsOn(y), prev);
      if (!r.length) break;
      if (y > hips && r.some(([a, b]) => a <= bodyR && b >= bodyL || (side < 0 ? b >= edge - 1 : a <= edge + 1))) break;
      add({ y, runs: r });
      prev = r;
    }
    return set;
  }
  function findNeck(map, size, cx, top, H, skip) {
    const xc = Math.round(cx), at = (y, x) => map[y * size + x] && !skip[y * size + x];
    const width = (y) => {
      if (!at(y, xc)) return 0;
      let a = xc, b = xc;
      while (a > 0 && at(y, a - 1)) a--;
      while (b < size - 1 && at(y, b + 1)) b++;
      return b - a + 1;
    };
    const runs = (y) => {
      const rs = [];
      for (let x = 0; x < size; x++) if (at(y, x)) {
        const r = rs[rs.length - 1];
        if (r && x - r[1] <= 3) r[1] = x;
        else rs.push([x, x]);
      }
      return rs.filter((r) => r[1] - r[0] >= 2).length;
    };
    const w2 = [];
    for (let y = top; y < top + H; y++) w2.push(width(y));
    let widest = 0;
    for (let i = 0; i < Math.round(H * 0.6); i++) {
      const y = top + i;
      if (i >= Math.round(H * 0.1) && w2[i] && w2[i] <= widest * 0.8) {
        let below = 0;
        for (let j = i + 1; j <= i + Math.round(H * 0.1) && j < w2.length; j++) below = Math.max(below, w2[j]);
        if (w2[i] <= below * 0.9) {
          let k = i;
          while (k + 1 < w2.length && w2[k + 1] && w2[k + 1] < w2[k]) k++;
          return top + k;
        }
      }
      if (i >= Math.round(H * 0.1) && runs(y) > 1) return null;
      widest = Math.max(widest, w2[i]);
    }
    return null;
  }
  function roughGuess(seg2, report = {}, { rgba = null } = {}) {
    const { size, map } = seg2;
    report.thin = 0;
    report.cloak = 0;
    report.bigHead = false;
    let top = size, bottom = -1;
    for (let t = 0; t < map.length; t++) if (map[t]) {
      const y = t / size | 0;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
    if (bottom < 0) return { ...seg2, map: Uint8Array.from(map) };
    const loose = new Uint8Array(map.length);
    const thin = thinPieces(map, size, top, bottom);
    for (const c of thin) for (const r of c.runs) for (let x = r.a; x <= r.b; x++) loose[r.y * size + x] = 1;
    bottom = -1;
    for (let t = 0; t < map.length; t++) if (map[t] && !loose[t]) bottom = Math.max(bottom, t / size | 0);
    const H = bottom - top + 1;
    let sx = 0, n = 0;
    for (let t = 0; t < map.length; t++) if (map[t]) {
      sx += t % size;
      n++;
    }
    const cx = sx / n;
    const neck = findNeck(map, size, cx, top, H, loose), big = neck !== null && (neck - top) / H > 0.25;
    report.bigHead = big;
    const band = (f) => !big ? top + f * H : f <= 0.15 ? top + f / 0.15 * (neck - top) : neck + (f - 0.15) / 0.85 * (bottom - neck);
    const fracOf = (y) => !big ? (y - top) / H : y <= neck ? (y - top) / (neck - top) * 0.15 : 0.15 + (y - neck) / (bottom - neck) * 0.85;
    const runs = [];
    for (let y = Math.round(band(0.2)); y <= Math.round(band(0.42)); y++) {
      let a = Math.round(cx), b = a;
      if (!map[y * size + a]) continue;
      while (a > 0 && map[y * size + a - 1]) a--;
      while (b < size - 1 && map[y * size + b + 1]) b++;
      runs.push([a, b]);
    }
    const widths = runs.map(([a, b]) => b - a).sort((p, q) => p - q);
    const half2 = runs.length ? widths[Math.floor(widths.length * 0.25)] / 2 * 0.62 : H * 0.12;
    const colL = cx - half2, colR = cx + half2;
    const xc = Math.round(cx), runAt = (y) => {
      let a = xc, b = xc;
      if (!map[y * size + xc] || loose[y * size + xc]) return null;
      while (a > 0 && map[y * size + a - 1] && !loose[y * size + a - 1]) a--;
      while (b < size - 1 && map[y * size + b + 1] && !loose[y * size + b + 1]) b++;
      return [a, b];
    };
    const hips = Math.ceil(band(0.55)), cloth = /* @__PURE__ */ new Map();
    const w0 = runAt(hips) ? runAt(hips)[1] - runAt(hips)[0] + 1 : 0;
    for (let y = hips, r; y <= bottom && (r = runAt(y)) && r[1] - r[0] + 1 >= w0 * 0.6; y++) cloth.set(y, r);
    const hem = cloth.size ? hips + cloth.size - 1 : -1, cloak = hem >= band(0.8) && hem < bottom;
    let next = seg2;
    if (cloak && !partIndex(seg2, "cloak") && seg2.parts.length < MAX_PARTS) {
      const at = partIndex(seg2, "pelvis") || seg2.parts.length, parts = seg2.parts.slice();
      parts.splice(at, 0, { id: "cloak", label: "cloak", missing: false, userMade: false });
      next = { ...seg2, parts, map: Uint8Array.from(map, (v) => v && v !== UNASSIGNED && v > at ? v + 1 : v) };
    }
    const out = Uint8Array.from(next.map), legTop = cloak ? hem + 1 : 0, legH = bottom - hem;
    const id = (k) => partIndex(next, k);
    const armTop = band(0.17), armBottom = band(0.58);
    const edges0 = torsoEdges(map, size, cx, band(0.22), band(0.5), loose);
    const staff = rgba && id("weapon") ? staffFromThin(map, size, rgba, thin, H) : null;
    const found = !staff && rgba && id("weapon") ? findWeapon(map, size, rgba, { H, bodyL: edges0.L ?? colL, bodyR: edges0.R ?? colR }) : null;
    const across = !staff && !found && rgba && id("weapon") ? crossWeapon(map, size, rgba, { H }) : null;
    const weapon = staff || (found ? found.list : null) || across, wmask = new Uint8Array(map.length);
    if (weapon) for (const t of weapon) wmask[t] = 1;
    report.weapon = weapon ? weapon.length : 0;
    report.staff = !!staff;
    report.across = !!across;
    const skip = Uint8Array.from(map, (v, t) => loose[t] || wmask[t]);
    const edges = torsoEdges(map, size, cx, band(0.22), band(0.5), skip), bodyL = edges.L ?? colL, bodyR = edges.R ?? colR;
    const tr = { y0: band(0.22), armTop, bottom, skip, hips: band(0.5), bodyL, bodyR };
    const arms = { L: edges.L !== null ? traceArm(map, size, -1, { ...tr, edge: edges.L }) : null, R: edges.R !== null ? traceArm(map, size, 1, { ...tr, edge: edges.R }) : null };
    const extent = (set) => {
      let a = Infinity, b = -1;
      for (const t of set) {
        const y = t / size | 0;
        a = Math.min(a, y);
        b = Math.max(b, y);
      }
      return [a, b];
    };
    const armSpan = { L: arms.L && extent(arms.L), R: arms.R && extent(arms.R) };
    for (let t = 0; t < map.length; t++) {
      if (!map[t]) continue;
      if (wmask[t]) {
        out[t] = id("weapon");
        continue;
      }
      if (loose[t]) {
        out[t] = UNASSIGNED;
        report.thin++;
        continue;
      }
      const x = t % size, y = t / size | 0, f = fracOf(y), left = x < cx, run = cloak && cloth.get(y);
      const traced = arms.L && arms.L.has(t) ? "L" : arms.R && arms.R.has(t) ? "R" : null;
      let p;
      if (f < 0.15) p = "head";
      else if (traced) {
        const [a, b] = armSpan[traced], g = b > a ? (y - a) / (b - a) : 0;
        p = (g < 0.45 ? "upperArm" : g < 0.8 ? "forearm" : "hand") + traced;
      } else if (!arms[left ? "L" : "R"] && (x < colL || x > colR) && y >= armTop && y <= armBottom) {
        const g = (y - armTop) / (armBottom - armTop);
        p = (g < 0.45 ? "upperArm" : g < 0.8 ? "forearm" : "hand") + (left ? "L" : "R");
      } else if (f < 0.47) p = "torso";
      else if (f < 0.55) p = "pelvis";
      else if (run && x >= run[0] && x <= run[1]) p = "cloak";
      else if (cloak && y >= legTop) p = ((y - legTop) / legH < 0.5 ? "shin" : "foot") + (left ? "L" : "R");
      else p = (f < 0.74 ? "thigh" : f < 0.92 ? "shin" : "foot") + (left ? "L" : "R");
      const k = id(p);
      if (k) {
        out[t] = k;
        if (p === "cloak") report.cloak++;
      }
    }
    return { ...next, map: out };
  }
  function spriteTags(seg2, px, N) {
    const B = seg2.size / N, tags = new Array(N * N).fill(null);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!px[y * N + x]) continue;
      const c = /* @__PURE__ */ new Map();
      for (let yy = 0; yy < B; yy++) for (let xx = 0; xx < B; xx++) {
        const v = seg2.map[(y * B + yy) * seg2.size + x * B + xx];
        if (v && v !== UNASSIGNED) c.set(v, (c.get(v) || 0) + 1);
      }
      let best = 0, bn = 0;
      for (const [v, k] of [...c].sort((a, b) => a[0] - b[0])) if (k > bn) {
        best = v;
        bn = k;
      }
      if (best) tags[y * N + x] = seg2.parts[best - 1].id;
    }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N * N; i++) {
      if (!px[i] || tags[i]) continue;
      const x = i % N, y = i / N | 0, c = /* @__PURE__ */ new Map();
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N && tags[Y * N + X]) c.set(tags[Y * N + X], (c.get(tags[Y * N + X]) || 0) + 1);
      }
      let best = null, bn = 0;
      for (const [t, k] of [...c].sort((a, b) => a[0] < b[0] ? -1 : 1)) if (k > bn) {
        best = t;
        bn = k;
      }
      tags[i] = best;
    }
    return tags;
  }
  var partOrder = (seg2) => seg2.parts.filter((p) => !p.missing).map((p) => p.id);
  function addPart(seg2, id, label) {
    if (!ID.test(id)) throw new Error("A part name must start with a letter and use letters, digits or _ (up to 32).");
    if (seg2.parts.some((p) => p.id === id) || seg2.extras.some((e) => e.id === id)) throw new Error(`There is already a part called ${id}.`);
    if (seg2.parts.length >= MAX_PARTS) throw new Error(`Up to ${MAX_PARTS} parts.`);
    return { ...seg2, parts: [...seg2.parts, { id, label: label || id, missing: false, userMade: false }] };
  }
  function deletePart(seg2, id) {
    const k = partIndex(seg2, id);
    if (!k) return seg2;
    const map = Uint8Array.from(seg2.map, (v) => v === k ? UNASSIGNED : v > k && v !== UNASSIGNED ? v - 1 : v);
    return { ...seg2, map, parts: seg2.parts.filter((p) => p.id !== id), extras: seg2.extras.filter((e) => e.from !== id) };
  }
  var setPart = (seg2, id, patch) => ({ ...seg2, parts: seg2.parts.map((p) => p.id === id ? { ...p, ...patch } : p) });
  function duplicateBackLimb(seg2, limb, darken = 0.3) {
    const chain = LIMBS[limb];
    if (!chain) throw new Error("Unknown limb " + limb);
    const extras = seg2.extras.filter((e) => !chain.includes(e.from));
    for (const from of chain) {
      const k = partIndex(seg2, from);
      if (!k) continue;
      const mask = Uint8Array.from(seg2.map, (v) => v === k ? 1 : 0);
      if (!mask.some(Boolean)) continue;
      extras.push({ id: from + "Back", label: seg2.parts[k - 1].label + " \u2014 back copy", from, darken, userMade: true, mask });
    }
    return { ...seg2, extras };
  }

