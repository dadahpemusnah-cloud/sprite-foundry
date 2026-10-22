  // src/rig/rotsprite.js
  function scale2x(px, w2, h) {
    const out = new Array(4 * w2 * h), W = 2 * w2;
    const at = (x, y, P) => x < 0 || y < 0 || x >= w2 || y >= h ? P : px[y * w2 + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) {
      const P = px[y * w2 + x], A = at(x, y - 1, P), B = at(x + 1, y, P), C2 = at(x - 1, y, P), D2 = at(x, y + 1, P);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C2 === A && C2 !== D2 && A !== B) e0 = A;
      if (A === B && A !== C2 && B !== D2) e1 = B;
      if (D2 === C2 && D2 !== B && C2 !== A) e2 = C2;
      if (B === D2 && B !== A && D2 !== C2) e3 = D2;
      const o = 2 * y * W + 2 * x;
      out[o] = e0;
      out[o + 1] = e1;
      out[o + W] = e2;
      out[o + W + 1] = e3;
    }
    return out;
  }
  var UP = 8;
  function upscale8(px, w2, h) {
    let p = px;
    for (let k = 1; k < UP; k *= 2) p = scale2x(p, w2 * k, h * k);
    return p;
  }
  function rotsprite(px, w2, h, M, width, height, up = upscale8(px, w2, h)) {
    const det = M[0] * M[3] - M[1] * M[2];
    const inv = [M[3] / det, -M[1] / det, -M[2] / det, M[0] / det, (M[2] * M[5] - M[3] * M[4]) / det, (M[1] * M[4] - M[0] * M[5]) / det];
    const corners = [[0, 0], [w2, 0], [0, h], [w2, h]].map(([x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]);
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])))), x1 = Math.min(width, Math.ceil(Math.max(...corners.map((c) => c[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), y1 = Math.min(height, Math.ceil(Math.max(...corners.map((c) => c[1]))));
    const out = new Array(width * height).fill(null), W = w2 * UP, H = h * UP;
    const sample = (X, Y) => {
      const sx = inv[0] * X + inv[2] * Y + inv[4], sy = inv[1] * X + inv[3] * Y + inv[5];
      const ux = Math.floor(sx * UP), uy = Math.floor(sy * UP);
      return ux < 0 || uy < 0 || ux >= W || uy >= H ? null : up[uy * W + ux];
    };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      out[y * width + x] = sample(x + 0.5, y + 0.5);
    }
    return out;
  }

