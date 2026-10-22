  // src/generators/chibi-asset.js
  // V7: a generated chibi as an imported character with 8 directions, each one exactly what the app
  // makes from a 32 px pixel-art PNG converted 1:1 (step 3, exact), with its parts (step 4), joints and
  // drawing order (step 5) and hidden areas (step 7) filled in from the drawing, and its animations.
  var CHIBI_MOTIONS = [
    { id: "idle", fps: 6 },
    { id: "walk", fps: 10 },
    { id: "run", fps: 12 },
    { id: "sneak", fps: 8 }
  ];
  var CHIBI_FRAMES = 8;
  var chibiSettings = (palette) => ({ ...DEFAULTS2, height: CHIBI_N, headroom: 0, floor: 0, resample: "exact", cleanup: false, dither: false, contrast: 0, saturation: 0, locked: palette.slice() });
  // png(rgba, w, h) -> { bytes, base64 } and workImage(work) -> { dataUrl, size } come from the page
  function chibiDirection(d, dir, { png, workImage: workImage2 }) {
    const N = CHIBI_N, v = chibiView(d, dir), { px, owner, hidden } = chibiCompose(v);
    // every colour drawn, also those only in hidden areas (a project stores those against the palette)
    const palette = [...new Set([...px, ...Object.values(hidden).flat()].filter(Boolean))];
    const img = { width: N, height: N, data: new Uint8ClampedArray(N * N * 4) };
    px.forEach((c, i) => {
      if (!c) return;
      const n = parseInt(c.slice(1), 16);
      img.data.set([n >> 16 & 255, n >> 8 & 255, n & 255, 255], i * 4);
    });
    const mask = alphaMask(img), settings = chibiSettings(palette);
    const r = convertToPixelArt(img, mask, { ...settings, paletteColours: palette, place: { anchor: "bottom", offsetX: 0, offsetY: 0 } });
    const S = r.work.size, B = S / N, rgba = workToRGBA(r.work);
    // parts: each work pixel belongs to the part drawn in front at its sprite pixel
    const parts = DEFAULT_PARTS.map((p) => ({ ...p, missing: !v.layers[p.id] }));
    const index = Object.fromEntries(parts.map((p, i) => [p.id, i + 1])), map = new Uint8Array(S * S);
    for (let t = 0; t < S * S; t++) {
      if (rgba[t * 4 + 3] < 128) continue;
      const id = owner[((t / S | 0) / B | 0) * N + (t % S / B | 0)];
      map[t] = id ? index[id] : UNASSIGNED;
    }
    const seg2 = { size: S, parts, map, extras: [] };
    const rig = syncRig(seg2);
    for (const [id, [x, y]] of Object.entries(v.joints)) if (rig.bones[id]) rig.bones[id] = { ...rig.bones[id], pivot: [x * B, y * B], auto: false };
    // the drawing order of the view; parts it does not draw (the weapon) stay listed, at the back
    rig.order = [...rig.order.filter((id) => !v.order.includes(id)), ...v.order.filter((id) => rig.bones[id])];
    const art = { swaps: {}, holes: hidden };
    const rest = { N, palette: r.fullPalette.slice(), px: r.px.slice(), work: workImage2(r.work), settings, seg: seg2, rig, art };
    const L = prepareLayers(seg2, rgba, rig, art, N), anims = {};
    for (const m of CHIBI_MOTIONS) {
      const a = JSON.parse(JSON.stringify(buildTemplate(templateById(m.id), rest, L, { facing: FACING_OF[dir], frames: CHIBI_FRAMES, fps: m.fps, loop: true })));
      // a chibi's big head stays nearly level when the body leans (it reads as falling otherwise)
      for (const k of a.keys) if (k.pose.rot.torso) k.pose.rot.head = Math.round(((k.pose.rot.head || 0) - k.pose.rot.torso * 0.75) * 10) / 10 || void 0;
      anims[m.id] = JSON.parse(JSON.stringify(a));
    }
    rest.anims = anims;
    const file = png(img.data, N, N), name = `chibi-${d.shape}-${dir.toLowerCase()}.png`;
    const source = { name, type: "png", size: file.bytes.length, width: N, height: N, hash: bytesHash(file.bytes), bytes: file.bytes, base64: file.base64, reduced: null };
    const work = {
      source,
      crop: { x: 0, y: 0, w: N, h: N },
      place: { anchor: "bottom", offsetX: 0, offsetY: 0 },
      background: { method: "alpha", tolerance: 40, iterations: 5, key: [106, 160, 216], clean: false, used: "alpha", w: N, h: N, raw: mask, hints: new Uint8Array(N * N) },
      conversion: { ...settings }
    };
    return { rest, work, rgba, layers: L, drawn: px };
  }
  // the whole character: S is the main image, the other 7 directions are views
  function chibiAsset(shapeSeed, colourSeed, page) {
    const d = chibiDesign(shapeSeed, colourSeed), out = {};
    for (const dir of DIRECTIONS) out[dir] = chibiDirection(d, dir, page);
    const views = {};
    for (const dir of DIRECTIONS) if (dir !== "S") views[dir] = { direction: dir, work: out[dir].work, rest: out[dir].rest, history: [] };
    return { design: d, directions: out, asset: { rest: out.S.rest, history: [], direction: "S", views, work: out.S.work } };
  }
