  // src/import/input.js
  var MAX_BYTES = 20 * 1024 * 1024;
  var MAX_DIM = 4096;
  var MIN_CROP = 8;
  function sniffType(b) {
    if (b.length >= 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 && b[4] === 13 && b[5] === 10 && b[6] === 26 && b[7] === 10) return "png";
    if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "jpeg";
    return null;
  }
  var u32 = (b, i) => (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
  var u16 = (b, i) => b[i] << 8 | b[i + 1];
  function readPngSize(b) {
    if (b.length < 24 || u32(b, 8) !== 13 || String.fromCharCode(b[12], b[13], b[14], b[15]) !== "IHDR") return null;
    return { width: u32(b, 16), height: u32(b, 20) };
  }
  function readJpegSize(b) {
    let i = 2;
    while (i + 3 < b.length) {
      if (b[i] !== 255) return null;
      let m = b[i + 1];
      while (m === 255 && i + 2 < b.length) {
        i++;
        m = b[i + 1];
      }
      if (m === 216 || m === 1 || m >= 208 && m <= 215) {
        i += 2;
        continue;
      }
      if (m === 217 || m === 218) return null;
      if (i + 3 >= b.length) return null;
      const len = u16(b, i + 2);
      if (len < 2) return null;
      if (m >= 192 && m <= 207 && m !== 196 && m !== 200 && m !== 204) {
        if (i + 8 >= b.length) return null;
        return { width: u16(b, i + 7), height: u16(b, i + 5) };
      }
      i += 2 + len;
    }
    return null;
  }
  var mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";
  function checkImageFile({ name = "file", size, bytes }) {
    const errors = [], n = size ?? bytes.length;
    if (!n) return { ok: false, errors: [`${name} is empty.`] };
    if (n > MAX_BYTES) return { ok: false, errors: [`${name} is ${mb(n)}; the limit is ${mb(MAX_BYTES)}. Save a smaller copy and try again.`] };
    const type = sniffType(bytes);
    if (!type) return { ok: false, errors: [`${name} is not a PNG or JPEG image (checked by its contents, not its name).`] };
    const dims = type === "png" ? readPngSize(bytes) : readJpegSize(bytes);
    if (!dims) return { ok: false, type, errors: [`${name} looks like a ${type.toUpperCase()} but its header is damaged or incomplete.`] };
    if (!dims.width || !dims.height) errors.push(`${name} reports a size of ${dims.width}\xD7${dims.height} px, which is not a usable image.`);
    else if (dims.width > MAX_DIM || dims.height > MAX_DIM) errors.push(`${name} is ${dims.width}\xD7${dims.height} px; the limit is ${MAX_DIM}\xD7${MAX_DIM}. Scale it down and try again.`);
    return { ok: !errors.length, type, width: dims.width, height: dims.height, errors };
  }
  function clampCrop(c, w2, h) {
    const cw = Math.max(Math.min(MIN_CROP, w2), Math.min(w2, Math.round(c.w)));
    const ch = Math.max(Math.min(MIN_CROP, h), Math.min(h, Math.round(c.h)));
    return { x: Math.max(0, Math.min(w2 - cw, Math.round(c.x))), y: Math.max(0, Math.min(h - ch, Math.round(c.y))), w: cw, h: ch };
  }
  function bytesHash(b) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < b.length; i++) {
      h ^= b[i];
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

