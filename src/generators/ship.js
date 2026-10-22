  // src/generators/ship.js
  var SHIP_MASKS = [
    [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 1, 1], [0, 0, 0, 0, 1, -1], [0, 0, 0, 1, 1, -1], [0, 0, 0, 1, 1, -1], [0, 0, 1, 1, 1, -1], [0, 1, 1, 1, 2, 2], [0, 1, 1, 1, 2, 2], [0, 1, 1, 1, 2, 2], [0, 1, 1, 1, 1, -1], [0, 0, 0, 1, 1, 1], [0, 0, 0, 0, 0, 0]],
    [[0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 1, 1], [0, 0, 0, 0, 1, -1], [0, 0, 0, 1, 1, -1], [1, 0, 0, 1, 1, -1], [1, 1, 0, 1, 2, -1], [1, 1, 1, 1, 2, 2], [1, 2, 1, 1, 2, 2], [0, 1, 1, 1, 1, -1], [0, 0, 1, 1, 1, -1], [0, 0, 0, 1, 0, 1], [0, 0, 0, 0, 0, 0]],
    [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, -1], [0, 0, 0, 0, 1, -1], [0, 0, 0, 0, 1, -1], [0, 0, 0, 1, 1, -1], [0, 0, 1, 1, 2, -1], [0, 1, 1, 1, 2, 2], [1, 1, 2, 1, 1, 2], [1, 1, 1, 1, 1, -1], [1, 0, 0, 1, 1, -1], [0, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0]]
  ];
  function genShip(N, rs, rc) {
    const hw = N / 2, M = rs.pick(SHIP_MASKS);
    let g, bb;
    for (let tries = 0; tries < 24; tries++) {
      const cell = M.map((row) => row.map((v) => v === -1 ? 1 : v === 1 ? rs() < 0.5 ? 1 : 0 : v === 2 ? rs() < 0.5 ? 2 : 1 : 0));
      g = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < hw; x++) {
        const v = cell[Math.min(11, Math.floor(y * 12 / N))][Math.min(5, Math.floor(x * 6 / hw))];
        g[y * N + x] = v;
        g[y * N + N - 1 - x] = v;
      }
      if (N >= 24) g = smooth(g, N, 5, 3);
      g = largest(g, N);
      bb = bbox(g, N);
      if (bb.count > N * N * 0.18) break;
    }
    const s = makeSprite("ship", N);
    const hue = rc() * 360;
    const R = ramp(hue, rc.range(20, 65), rc.range(50, 64)), A = ramp(hue + rc.pick([180, 150, -150, 30]), rc.range(55, 85), rc.range(45, 58));
    shadeBlob(s, g, (i) => g[i] === 2 ? A : R, "body");
    const ct = bb.minY + Math.max(1, Math.round(bb.h * 0.22)), ch = Math.max(2, Math.round(N / 8));
    for (let y = ct; y < ct + ch; y++) for (const x of [hw - 1, hw]) if (g[y * N + x]) setPx(s, x, y, y === ct ? "#d9fbff" : y === ct + ch - 1 ? "#3f86b8" : "#7fd4f0", "body");
    let eng = [];
    for (let x = 0; x < N; x++) if (g[bb.maxY * N + x]) eng.push(x);
    if (eng.length > 4) {
      const outer = [eng[0], eng[eng.length - 1]];
      eng = eng.includes(hw - 1) ? [...outer, hw - 1, hw] : outer;
    }
    s.meta.engines = eng.map((x) => ({ x, y: bb.maxY + 1 }));
    s.meta.outline = hsl(toward(hue, 245, 40), 40, 10);
    s.meta.desc = `${eng.length} engine${eng.length === 1 ? "" : "s"} \xB7 ${bb.w}\xD7${bb.h} px hull`;
    const FL = ["#fffbe0", "#ffd84a", "#ff9a2e", "#f0522f", "#b8322a"];
    const lastRow = N + 2 * PAD - 2;
    s.post = (spec, put) => {
      if (!spec.fl) return;
      const gy = (spec.g || [0, 0])[1];
      s.meta.engines.forEach((e, n) => {
        const room = lastRow - PAD - gy - e.y + 1;
        const len = Math.max(1, Math.min(spec.fl, room) - (n + (spec.fi || 0)) % 2);
        if (room <= 0) return;
        for (let k = 0; k < len; k++) put(e.x, e.y + k, len === 1 ? FL[1] : FL[Math.round(k / (len - 1) * 4)]);
      });
    };
    const up = bb.minY >= 1 ? -1 : 0;
    const side = bb.minX >= 1 ? 1 : 0, down = N - 1 - bb.maxY >= 1 ? 1 : 0;
    const shake = side ? [[-1, 0], [1, 0]] : down ? [[0, 1], [0, 0]] : [[0, 0], [0, 0]];
    s.anims = {
      fly: [{ fl: 2, fi: 0 }, { fl: 2, fi: 1, g: [0, up] }, { fl: 3, fi: 0, g: [0, up] }, { fl: 2, fi: 1 }],
      boost: [{ fl: 3, fi: 0 }, { fl: 4, fi: 1 }, { fl: 3, fi: 1 }, { fl: 4, fi: 0 }],
      bank: [{ fl: 2, spin: 0.75 }, { fl: 2, spin: 0.55 }, { fl: 2, spin: 0.75 }, { fl: 2 }],
      hurt: [{ flash: true, g: shake[0], fl: 1 }, { g: shake[1], fl: 1 }, { flash: true, fl: 1 }, { fl: 2 }]
    };
    return s;
  }

