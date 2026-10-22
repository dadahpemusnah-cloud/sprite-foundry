  // src/export/aseprite.js
  var MAGIC = 42464;
  var FRAME_MAGIC = 61946;
  var CH = {
    OLD_PALETTE: 4,
    OLD_PALETTE2: 17,
    LAYER: 8196,
    CEL: 8197,
    CEL_EXTRA: 8198,
    PROFILE: 8199,
    EXTERNAL: 8200,
    MASK: 8214,
    PATH: 8215,
    TAGS: 8216,
    PALETTE: 8217,
    USER: 8224,
    SLICE: 8226,
    TILESET: 8227
  };
  var DIRS = ["forward", "reverse", "pingpong", "pingpongReverse"];
  var LAYER_TYPES = ["image", "group", "tilemap"];
  var hex22 = (v) => v.toString(16).padStart(2, "0");
  var Out = class {
    constructor() {
      this.parts = [];
      this.n = 0;
    }
    bytes(a) {
      this.parts.push(a instanceof Uint8Array ? a : Uint8Array.from(a));
      this.n += a.length;
    }
    u8(v) {
      this.bytes([v & 255]);
    }
    u16(v) {
      this.bytes([v & 255, v >> 8 & 255]);
    }
    i16(v) {
      this.u16(v < 0 ? v + 65536 : v);
    }
    u32(v) {
      this.bytes([v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255]);
    }
    zeros(k) {
      this.bytes(new Uint8Array(k));
    }
    str(s) {
      const b = new TextEncoder().encode(s);
      this.u16(b.length);
      this.bytes(b);
    }
    done() {
      const out = new Uint8Array(this.n);
      let o = 0;
      for (const p of this.parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    }
  };
  var chunk = (type, fill) => {
    const o = new Out();
    fill(o);
    const body = o.done(), c = new Out();
    c.u32(body.length + 6);
    c.u16(type);
    c.bytes(body);
    return c.done();
  };
  var userDataChunk = (ud) => chunk(CH.USER, (o) => {
    o.u32(1);
    o.str(ud.text);
  });
  function crop(px, w2, h) {
    let x0 = w2, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) if (px[y * w2 + x]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    const cw = x1 - x0 + 1, chh = y1 - y0 + 1, rgba = new Uint8Array(cw * chh * 4);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      const c = px[(y + y0) * w2 + x + x0];
      if (!c) continue;
      const n = parseInt(c.slice(1), 16), i = (y * cw + x) * 4;
      rgba[i] = n >> 16 & 255;
      rgba[i + 1] = n >> 8 & 255;
      rgba[i + 2] = n & 255;
      rgba[i + 3] = 255;
    }
    return { x: x0, y: y0, w: cw, h: chh, rgba };
  }
  async function writeAseprite(doc, deflate2) {
    const { w: w2, h } = doc, frames = [];
    for (const [fi, fr] of doc.frames.entries()) {
      const chunks = [];
      if (fi === 0) {
        chunks.push(chunk(CH.PROFILE, (o) => {
          o.u16(1);
          o.u16(0);
          o.u32(0);
          o.zeros(8);
        }));
        const pal = doc.palette.length ? doc.palette : ["#000000"];
        chunks.push(chunk(CH.PALETTE, (o) => {
          o.u32(pal.length);
          o.u32(0);
          o.u32(pal.length - 1);
          o.zeros(8);
          for (const c of pal) {
            const n = parseInt(c.slice(1), 16);
            o.u16(0);
            o.u8(n >> 16);
            o.u8(n >> 8);
            o.u8(n);
            o.u8(255);
          }
        }));
        for (const L of doc.layers) {
          chunks.push(chunk(CH.LAYER, (o) => {
            o.u16((L.visible === false ? 0 : 1) | (L.editable === false ? 0 : 2));
            o.u16(0);
            o.u16(L.level || 0);
            o.u16(0);
            o.u16(0);
            o.u16(0);
            o.u8(255);
            o.zeros(3);
            o.str(L.name);
          }));
          if (L.userData) chunks.push(userDataChunk(L.userData));
        }
        if (doc.tags.length) {
          chunks.push(chunk(CH.TAGS, (o) => {
            o.u16(doc.tags.length);
            o.zeros(8);
            for (const t of doc.tags) {
              o.u16(t.from);
              o.u16(t.to);
              o.u8(DIRS.indexOf(t.dir || "forward"));
              o.u16(t.repeat || 0);
              o.zeros(6);
              o.bytes([0, 0, 0]);
              o.u8(0);
              o.str(t.name);
            }
          }));
          for (const t of doc.tags) chunks.push(t.userData ? userDataChunk(t.userData) : chunk(CH.USER, (o) => o.u32(0)));
        }
      }
      for (const cel of fr.cels) {
        if (cel.link !== void 0) {
          chunks.push(chunk(CH.CEL, (o) => {
            o.u16(cel.layer);
            o.i16(0);
            o.i16(0);
            o.u8(255);
            o.u16(1);
            o.i16(0);
            o.zeros(5);
            o.u16(cel.link);
          }));
          continue;
        }
        const c = crop(cel.px, w2, h);
        if (!c) continue;
        const z = await deflate2(c.rgba);
        chunks.push(chunk(CH.CEL, (o) => {
          o.u16(cel.layer);
          o.i16(c.x);
          o.i16(c.y);
          o.u8(255);
          o.u16(2);
          o.i16(0);
          o.zeros(5);
          o.u16(c.w);
          o.u16(c.h);
          o.bytes(z);
        }));
        if (cel.userData) chunks.push(userDataChunk(cel.userData));
      }
      const size = 16 + chunks.reduce((n, c) => n + c.length, 0), head = new Out();
      head.u32(size);
      head.u16(FRAME_MAGIC);
      head.u16(Math.min(chunks.length, 65535));
      head.u16(fr.dur);
      head.zeros(2);
      head.u32(chunks.length);
      frames.push(head.done(), ...chunks);
    }
    const body = frames.reduce((n, f) => n + f.length, 0), hd = new Out();
    hd.u32(128 + body);
    hd.u16(MAGIC);
    hd.u16(doc.frames.length);
    hd.u16(w2);
    hd.u16(h);
    hd.u16(32);
    hd.u32(1);
    hd.u16(doc.frames[0] ? doc.frames[0].dur : 100);
    hd.u32(0);
    hd.u32(0);
    hd.u8(0);
    hd.zeros(3);
    hd.u16(doc.palette.length >= 256 ? 0 : Math.max(1, doc.palette.length));
    hd.u8(1);
    hd.u8(1);
    hd.i16(0);
    hd.i16(0);
    hd.u16(16);
    hd.u16(16);
    hd.zeros(84);
    const out = new Out();
    out.bytes(hd.done());
    for (const f of frames) out.bytes(f);
    return out.done();
  }
  async function readAseprite(bytes, inflate2) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const need = (at2, n) => {
      if (at2 + n > b.length) throw new Error("The Aseprite file is cut short or damaged.");
    };
    const u8 = (at2) => (need(at2, 1), b[at2]), u162 = (at2) => (need(at2, 2), dv.getUint16(at2, true)), i16 = (at2) => (need(at2, 2), dv.getInt16(at2, true)), u322 = (at2) => (need(at2, 4), dv.getUint32(at2, true));
    const str = (at2) => {
      const n = u162(at2);
      need(at2 + 2, n);
      return { s: new TextDecoder().decode(b.subarray(at2 + 2, at2 + 2 + n)), end: at2 + 2 + n };
    };
    if (b.length < 128 || u162(4) !== MAGIC) throw new Error("This is not an Aseprite file (.aseprite or .ase).");
    const nFrames = u162(6), w2 = u162(8), h = u162(10), depth = u162(12), flags = u322(14), transparent = u8(28);
    if (![32, 16, 8].includes(depth)) throw new Error(`Unknown colour depth ${depth} in the Aseprite file.`);
    const doc = { w: w2, h, depth, transparent, palette: [], layers: [], frames: [], tags: [], unsupported: {} };
    const skip = (kind) => {
      doc.unsupported[kind] = (doc.unsupported[kind] || 0) + 1;
    };
    let palette = new Array(256).fill(null), lastTarget = null, tagUser = 0;
    const colourOf = (raw, i) => {
      if (depth === 32) {
        const a = raw[i + 3];
        return { c: "#" + hex22(raw[i]) + hex22(raw[i + 1]) + hex22(raw[i + 2]), a };
      }
      if (depth === 16) {
        const v = raw[i], a = raw[i + 1];
        return { c: "#" + hex22(v) + hex22(v) + hex22(v), a };
      }
      const k = raw[i];
      if (k === transparent) return { c: null, a: 0 };
      return palette[k] ? { c: palette[k].c, a: palette[k].a } : { c: null, a: 0 };
    };
    const bpp = depth / 8;
    let at = 128;
    for (let f = 0; f < nFrames; f++) {
      const start = at, size = u322(at);
      if (u162(at + 4) !== FRAME_MAGIC) throw new Error(`Aseprite frame ${f + 1} is damaged.`);
      const old = u162(at + 6), dur = u162(at + 8), nNew = u322(at + 12), count = nNew || old;
      const frame = { dur, cels: [] };
      doc.frames.push(frame);
      at += 16;
      for (let k = 0; k < count; k++) {
        const csize = u322(at), type = u162(at + 4), d = at + 6;
        need(at, csize);
        if (type === CH.LAYER) {
          const lflags = u162(d), ltype = u162(d + 2), level = u162(d + 4), blend = u162(d + 10), opacity = u8(d + 12), name = str(d + 16).s;
          const L = { name, type: LAYER_TYPES[ltype] || "other", level, visible: !!(lflags & 1), editable: !!(lflags & 2), blend, opacity: flags & 1 ? opacity : 255, userData: null };
          doc.layers.push(L);
          lastTarget = L;
        } else if (type === CH.CEL) {
          const layer = u162(d), x = i16(d + 2), y = i16(d + 4), opacity = u8(d + 6), ctype = u162(d + 7);
          if (ctype === 1) {
            const cel = { layer, link: u162(d + 16), userData: null };
            frame.cels.push(cel);
            lastTarget = cel;
          } else if (ctype === 0 || ctype === 2) {
            const cw = u162(d + 16), chh = u162(d + 18), dataAt = d + 20, n = cw * chh * bpp;
            let raw = ctype === 0 ? (need(dataAt, n), b.subarray(dataAt, dataAt + n)) : await inflate2(b.subarray(dataAt, at + csize));
            if (raw.length < n) throw new Error(`An Aseprite cel in frame ${f + 1} is damaged.`);
            const px = new Array(w2 * h).fill(null);
            let semi = 0;
            for (let yy = 0; yy < chh; yy++) for (let xx = 0; xx < cw; xx++) {
              const X = x + xx, Y = y + yy;
              if (X < 0 || Y < 0 || X >= w2 || Y >= h) continue;
              const { c, a } = colourOf(raw, (yy * cw + xx) * bpp);
              if (!c || a === 0) continue;
              if (a < 255) semi++;
              if (a >= 128) px[Y * w2 + X] = c;
            }
            if (semi) doc.unsupported["semi-transparent pixels"] = (doc.unsupported["semi-transparent pixels"] || 0) + semi;
            if (opacity < 255) skip("cel opacity");
            const cel = { layer, x: 0, y: 0, opacity, w: w2, h, px, userData: null };
            frame.cels.push(cel);
            lastTarget = cel;
          } else {
            skip("tilemap cels");
            lastTarget = null;
          }
        } else if (type === CH.TAGS) {
          const n = u162(d);
          let p = d + 10;
          for (let t = 0; t < n; t++) {
            const from = u162(p), to = u162(p + 2), dir = DIRS[u8(p + 4)] || "forward", repeat = u162(p + 5), s = str(p + 17);
            doc.tags.push({ name: s.s, from, to, dir, repeat, userData: null });
            p = s.end;
          }
          lastTarget = "tags";
          tagUser = 0;
        } else if (type === CH.PALETTE) {
          const first = u322(d + 4), last = u322(d + 8);
          let p = d + 20;
          for (let i = first; i <= last; i++) {
            const fl2 = u162(p), c = "#" + hex22(u8(p + 2)) + hex22(u8(p + 3)) + hex22(u8(p + 4)), a = u8(p + 5);
            p += 6;
            if (fl2 & 1) p = str(p).end;
            palette[i] = { c, a };
          }
          lastTarget = null;
        } else if (type === CH.OLD_PALETTE || type === CH.OLD_PALETTE2) {
          if (palette.some(Boolean)) {
            at += csize;
            continue;
          }
          const packets = u162(d);
          let p = d + 2, i = 0;
          for (let q = 0; q < packets; q++) {
            i += u8(p);
            let n = u8(p + 1) || 256;
            p += 2;
            for (let k2 = 0; k2 < n; k2++, i++, p += 3) {
              const s = type === CH.OLD_PALETTE2 ? 4 : 1;
              palette[i] = { c: "#" + [u8(p), u8(p + 1), u8(p + 2)].map((v) => hex22(Math.min(255, v * s))).join(""), a: 255 };
            }
          }
        } else if (type === CH.USER) {
          const uf = u322(d), ud = uf & 1 ? { text: str(d + 4).s } : null;
          if (lastTarget === "tags") {
            if (doc.tags[tagUser]) doc.tags[tagUser].userData = ud;
            tagUser++;
          } else if (lastTarget && typeof lastTarget === "object") lastTarget.userData = ud;
          else if (ud || uf & 6) skip("user data");
          if (uf & 6) skip("user data colours and properties");
        } else if (type === CH.SLICE) skip("slices");
        else if (type === CH.TILESET) skip("tilesets");
        else if (type === CH.EXTERNAL) skip("external files");
        else if (type === CH.PROFILE) {
          if (u162(d) === 2) skip("ICC colour profile");
        } else if (type !== CH.CEL_EXTRA && type !== CH.MASK && type !== CH.PATH) skip("unknown chunks");
        at += csize;
      }
      at = start + size;
    }
    doc.palette = palette.filter(Boolean).filter((p) => p.a > 0).map((p) => p.c);
    for (const L of doc.layers) {
      if (L.type === "group") skip("layer groups (their layers are kept)");
      if (L.type === "tilemap") skip("tilemap layers");
      if (L.type === "image" && L.blend !== 0) skip("blend modes other than normal");
      if (L.type === "image" && L.opacity < 255) skip("layer opacity");
    }
    return doc;
  }
  function framesToAseprite({ F, rows, anims }) {
    const frames = [], tags = [], colours = /* @__PURE__ */ new Set();
    for (const name of rows) {
      const a = anims[name], from = frames.length, mode = a.mode || "forward";
      for (const fr of a.frames) {
        for (const c of fr.px) if (c) colours.add(c);
        frames.push({ dur: fr.dur, cels: [{ layer: 0, px: fr.px, ...fr.data ? { userData: { text: JSON.stringify({ "sprite-foundry": 1, frameData: fr.data }) } } : {} }] });
      }
      tags.push({ name, from, to: frames.length - 1, dir: mode, repeat: asepriteRepeat(mode, a.loop, a.repeat || 1) });
    }
    return { w: F, h: F, palette: [...colours].slice(0, 256), layers: [{ name: "Sprite" }], frames, tags };
  }
  var through = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then((a) => new Uint8Array(a));
  var deflate = (bytes) => through(bytes, new CompressionStream("deflate"));
  var inflate = (bytes) => through(bytes, new DecompressionStream("deflate"));

