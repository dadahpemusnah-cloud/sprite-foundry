  // src/export/gif.js
  function encodeGIF(frames, W, H, delayCs, { loop = true } = {}) {
    const pal = ["#000000"], index = /* @__PURE__ */ new Map();
    for (const f of frames) for (const c of f) if (c && !index.has(c) && pal.length < 256) {
      index.set(c, pal.length);
      pal.push(c);
    }
    let bits = 1;
    while (1 << bits < pal.length) bits++;
    const bytes = [], w16 = (v) => bytes.push(v & 255, v >> 8 & 255);
    for (const ch of "GIF89a") bytes.push(ch.charCodeAt(0));
    w16(W);
    w16(H);
    bytes.push(128 | bits - 1 << 4 | bits - 1, 0, 0);
    for (let i = 0; i < 1 << bits; i++) {
      const [r, g, b] = hexToRgb(pal[i] || "#000000");
      bytes.push(r, g, b);
    }
    if (loop) {
      bytes.push(33, 255, 11);
      for (const ch of "NETSCAPE2.0") bytes.push(ch.charCodeAt(0));
      bytes.push(3, 1, 0, 0, 0);
    }
    const minCode = Math.max(2, bits);
    frames.forEach((f, fi) => {
      bytes.push(33, 249, 4, 9);
      w16(Array.isArray(delayCs) ? delayCs[fi] : delayCs);
      bytes.push(0, 0);
      bytes.push(44);
      w16(0);
      w16(0);
      w16(W);
      w16(H);
      bytes.push(0);
      const idx = f.map((c) => c ? index.get(c) || 0 : 0);
      const data = lzw(idx, minCode);
      bytes.push(minCode);
      for (let i = 0; i < data.length; i += 255) {
        const chunk2 = data.slice(i, i + 255);
        bytes.push(chunk2.length, ...chunk2);
      }
      bytes.push(0);
    });
    bytes.push(59);
    return new Uint8Array(bytes);
  }
  function lzw(indices, minCode) {
    const clear = 1 << minCode, eoi = clear + 1, out = [];
    let size = minCode + 1, next = eoi + 1, dict = /* @__PURE__ */ new Map(), cur2 = 0, curBits = 0;
    const emit = (c) => {
      cur2 |= c << curBits;
      curBits += size;
      while (curBits >= 8) {
        out.push(cur2 & 255);
        cur2 >>>= 8;
        curBits -= 8;
      }
    };
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i], key = prefix * 256 + k;
      const hit = dict.get(key);
      if (hit !== void 0) {
        prefix = hit;
        continue;
      }
      emit(prefix);
      if (next === 4096) {
        emit(clear);
        dict = /* @__PURE__ */ new Map();
        size = minCode + 1;
        next = eoi + 1;
      } else {
        if (next >= 1 << size) size++;
        dict.set(key, next++);
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (curBits > 0) out.push(cur2 & 255);
    return out;
  }

