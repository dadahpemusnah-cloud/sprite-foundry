  // src/core/sprite.js
  function makeSprite(type, N) {
    return { type, N, px: new Array(N * N).fill(null), tag: new Array(N * N).fill(null), meta: {}, anims: {}, order: ["body"], post: null };
  }
  function setPx(s, x, y, c, t) {
    if (x < 0 || y < 0 || x >= s.N || y >= s.N) return;
    const i = y * s.N + x;
    s.px[i] = c;
    s.tag[i] = c ? t : null;
  }
  function off(tags, dx, dy) {
    const o = {};
    for (const t of tags) o[t] = [dx, dy];
    return o;
  }
  function merge(...os) {
    const r = {};
    for (const o of os) for (const k in o) {
      const a = r[k] || [0, 0];
      r[k] = [a[0] + o[k][0], a[1] + o[k][1]];
    }
    return r;
  }
  function largest(g, N) {
    const seen = new Uint8Array(N * N);
    let best = [];
    for (let i = 0; i < N * N; i++) {
      if (!g[i] || seen[i]) continue;
      const comp = [], st = [i];
      seen[i] = 1;
      while (st.length) {
        const j = st.pop();
        comp.push(j);
        const x = j % N, y = j / N | 0;
        for (const [dx, dy] of D4) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
          const k = Y * N + X;
          if (g[k] && !seen[k]) {
            seen[k] = 1;
            st.push(k);
          }
        }
      }
      if (comp.length > best.length) best = comp;
    }
    const out = new Uint8Array(N * N);
    for (const j of best) out[j] = g[j];
    return out;
  }
  function bbox(g, N) {
    let minX = N, maxX = -1, minY = N, maxY = -1, count = 0;
    for (let i = 0; i < N * N; i++) if (g[i]) {
      const x = i % N, y = i / N | 0;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1, count };
  }
  function smooth(g, N, birth, survive) {
    const n2 = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < N && Y < N && g[Y * N + X]) c++;
      }
      const i = y * N + x;
      n2[i] = g[i] ? c >= survive ? g[i] : 0 : c >= birth ? 1 : 0;
    }
    return n2;
  }
  function shadeBlob(s, g, rampOf, tagName) {
    const N = s.N, occ = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !!g[y * N + x];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!occ(x, y)) continue;
      const R = rampOf(y * N + x);
      const up = !occ(x, y - 1), dn = !occ(x, y + 1), lf = !occ(x - 1, y), rt = !occ(x + 1, y);
      let c = R.base;
      if (dn) c = rt ? R.sh2 : R.sh;
      else if (up) c = lf ? R.hi2 : R.hi;
      else if (rt && !occ(x + 1, y + 1)) c = R.sh;
      setPx(s, x, y, c, tagName);
    }
  }

