  // src/export/pack.js
  var baseNameOf = (sprite3) => `${sprite3.type}_${sprite3.N}px_${sprite3.seedShape}${sprite3.seedColor !== sprite3.seedShape ? "_" + sprite3.seedColor : ""}`.replace(/[^\w.-]+/g, "-");
  var frameSizeOf = (sprite3) => sprite3.N + 2 * PAD;
  var pivotOf = (sprite3) => sprite3.meta.pivot || { x: frameSizeOf(sprite3) / 2, y: frameSizeOf(sprite3) - PAD };
  var sheetRowsOf = (timeline2, rows) => timeline2.order.filter((n) => rows.includes(n) && frameCount(timeline2, n) > 0);
  function frameSource(ctx) {
    const cache2 = /* @__PURE__ */ new Map(), opts2 = { outline: ctx.state.outline, pal: ctx.state.palette };
    return (name, i) => {
      let f = cache2.get(name);
      if (!f) {
        f = ctx.timeline.anims[name].frames.map((fr) => framePixels(ctx.sprite, fr, opts2));
        cache2.set(name, f);
      }
      return f[i];
    };
  }
  var hexRGB = /* @__PURE__ */ new Map();
  var rgbOf2 = (h) => {
    let v = hexRGB.get(h);
    if (v === void 0) {
      v = parseInt(h.slice(1), 16);
      hexRGB.set(h, v);
    }
    return v;
  };
  var blankRaster = (w2, h) => ({ w: w2, h, data: new Uint8ClampedArray(w2 * h * 4) });
  function drawFrame(r, px, F, x0, y0, scale) {
    for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
      const c = px[y * F + x];
      if (!c) continue;
      const v = rgbOf2(c), R = v >> 16 & 255, G = v >> 8 & 255, B = v & 255;
      for (let dy = 0; dy < scale; dy++) {
        let k = ((y0 + y * scale + dy) * r.w + x0 + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++, k += 4) {
          r.data[k] = R;
          r.data[k + 1] = G;
          r.data[k + 2] = B;
          r.data[k + 3] = 255;
        }
      }
    }
    return r;
  }
  function drawPart(r, px, F, sx, sy, w2, h, x0, y0, scale) {
    const sub = new Array(w2 * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) sub[y * w2 + x] = px[(sy + y) * F + sx + x];
    return drawRect(r, sub, w2, h, x0, y0, scale);
  }
  function drawRect(r, px, w2, h, x0, y0, scale) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) {
      const c = px[y * w2 + x];
      if (!c) continue;
      const v = rgbOf2(c);
      for (let dy = 0; dy < scale; dy++) {
        let k = ((y0 + y * scale + dy) * r.w + x0 + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++, k += 4) {
          r.data[k] = v >> 16 & 255;
          r.data[k + 1] = v >> 8 & 255;
          r.data[k + 2] = v & 255;
          r.data[k + 3] = 255;
        }
      }
    }
    return r;
  }
  function sheetPlan(ctx, scale, rows = sheetRowsOf(ctx.timeline, ctx.rows)) {
    const { sprite: sprite3, timeline: timeline2, state: state2 } = ctx, F = frameSizeOf(sprite3), base = baseNameOf(sprite3);
    const frameCounts = {}, durations = {};
    for (const n of rows) {
      frameCounts[n] = frameCount(timeline2, n);
      durations[n] = timeline2.anims[n].frames.map((_, i) => frameDurationMs(timeline2, n, i, state2.fps));
    }
    const layout2 = sheetLayout({
      rows,
      frameCounts,
      durations,
      F,
      scale,
      fps: state2.fps,
      image: base + ".png",
      v11: {
        animSettings: Object.fromEntries(rows.map((n) => [n, { fps: timeline2.anims[n].fps || state2.fps, loop: timeline2.anims[n].loop, mode: modeOf(timeline2.anims[n]), repeat: repeatOf(timeline2.anims[n]) }])),
        pivot: sprite3.meta.pivot || { x: F / 2, y: F - PAD },
        generator: { type: sprite3.type, version: GENERATOR_VERSIONS[sprite3.type] }
      },
      seeds: { type: sprite3.type, size: sprite3.N, shape: sprite3.seedShape, colour: sprite3.seedColor, palette: state2.palette, outline: state2.outline, edited: ctx.edited }
    });
    const variants2 = ctx.variants || [];
    if (variants2.length) {
      layout2.json.meta.version = "1.2";
      layout2.json.meta.variants = variants2.map((x) => ({ name: x.name, image: variantFile(base, x.name), map: { ...x.map } }));
    }
    const fd = exportFrameData(timeline2, rows, F, scale, layout2.json.meta.pivot || pivotOf(sprite3));
    if (fd) {
      layout2.json.meta.version = "1.2";
      layout2.json.meta.frameData = fd;
    }
    return { json: layout2.json, cols: layout2.cols, rows: layout2.rows, layout: layout2, frameData: fd };
  }
  function sheetRaster(plan, F, scale, pixel) {
    const r = blankRaster(plan.layout.width, plan.layout.height);
    for (const p of plan.layout.placements) drawFrame(r, pixel(p.anim, p.frame), F, p.x, p.y, scale);
    return r;
  }
  function gifBytes(ctx, name, scale, pixel) {
    const { timeline: timeline2, state: state2 } = ctx, F = frameSizeOf(ctx.sprite), S = F * scale, n = frameCount(timeline2, name);
    const seq = playSequence(n, playOpts(timeline2.anims[name]));
    const scaled = Array.from({ length: n }, (_, i) => {
      const f = pixel(name, i), o = new Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) o[y * S + x] = f[Math.floor(y / scale) * F + Math.floor(x / scale)];
      return o;
    });
    return encodeGIF(seq.map((i) => scaled[i]), S, S, seq.map((i) => frameDelayCs(timeline2, name, i, state2.fps)), { loop: timeline2.anims[name].loop });
  }
  function playbackReadme(ctx, rows, base) {
    const special = rows.filter((n) => modeOf(ctx.timeline.anims[n]) !== "forward" || !ctx.timeline.anims[n].loop && repeatOf(ctx.timeline.anims[n]) > 1);
    if (!special.length) return "";
    return `
Playback (${special.join(", ")}): the JSON tag gives the direction, and meta.animationSettings[name].order
the exact frame order (tag frame indices) for any engine. Phaser 3.90 builds "reverse" and
"pingpong" (as yoyo) itself; it plays "pingpong_reverse" forward and ignores the repeat count,
so for those use the order: this.anims.create({ key, frames: order.map(i => ({ key: '${base}', frame: String(tagFrom + i) })), frameRate: fps }).
`;
  }
  function engineReadme(ctx, preset, base, F, rows) {
    const sc = ctx.state.scale, S = F * sc, pv = pivotOf(ctx.sprite);
    const head = `Sprite Foundry pack for ${preset === "godot" ? "Godot 4" : preset === "unity" ? "Unity" : "a trimmed, packed atlas"}
Type: ${ctx.sprite.type}  Frame: ${F}x${F}px at ${sc}x (${S}x${S} px)  Rows: ${rows.join(", ")}
Pivot: ${pv.x}, ${pv.y} frame px from the top left (per-frame pivots, hitboxes and events: manifest.json "frameData").

`;
    if (preset === "godot") return head + `Copy ${base}.png and ${base}.tres into your project (the .tres expects res://${base}.png; change the path
in its first lines if you put it elsewhere). Add an AnimatedSprite2D, set Sprite Frames to ${base}.tres.
Texture filter: Nearest (Project Settings > Rendering > Textures > Default Texture Filter) for crisp pixels.
The pivot: keep "Centered" on and set Offset to (${S / 2 - pv.x * sc}, ${S / 2 - pv.y * sc}).
Animation speed = the fps; per-frame durations are relative to it, as Godot stores them.

Written to the Godot 4 text resource format; not opened in Godot here.
`;
    if (preset === "unity") return head + `Copy ${base}.png and ${base}.png.meta into Assets/ together (the .meta holds the slicing; Unity
reads it on import). Sprites are named ${base}_<animation>_<frame>, Sprite Mode Multiple, point filter, no
compression, pivot per sprite. Pixels Per Unit = ${S} (one frame is one unit).
Animation clips: ${base}_<animation>.anim (each with its .meta) key the sprites in play order at the fps,
with Loop Time from the loop setting; ${base}.controller has a state per clip. Copy them into Assets/ too,
add a SpriteRenderer and an Animator, and set the Animator's Controller to ${base}.controller.

Written to Unity's TextureImporter .meta and YAML asset formats; not opened in Unity here.
`;
    if (preset === "packed") return head + `${base}_packed.png holds every frame cut to its pixels; ${base}_packed.json is TexturePacker JSON (hash):
frames "<animation>_<frame>" with trimmed rectangles, the full frame size (sourceSize) and a pivot.
Phaser 3: this.load.atlas('${base}', '${base}_packed.png', '${base}_packed.json');
  this.anims.create({ key: 'walk', frames: this.anims.generateFrameNames('${base}', { prefix: 'walk_', start: 0, end: n - 1 }), frameRate: fps });
Trimmed frames keep their place in the full frame, so animations do not jitter.
`;
    return null;
  }
  function readmeText(ctx, base, F, preset, rows) {
    const ex = engineReadme(ctx, preset, base, F, rows);
    if (ex) return ex;
    const { sprite: sprite3, state: state2 } = ctx;
    return `Sprite Foundry pack
Type: ${sprite3.type}  Size: ${sprite3.N}px  Frame: ${F}x${F}px at ${state2.scale}x
Shape seed: ${sprite3.seedShape}  Colour seed: ${sprite3.seedColor}  Palette: ${state2.palette}  Outline: ${state2.outline}${ctx.edited ? "  (hand-edited)" : ""}
Rows: ${rows.join(", ")}  FPS: ${state2.fps}

Phaser 3 (tested with 3.90.0):
  this.load.aseprite('${base}', '${base}.png', '${base}.json');
  // in create():
  this.anims.createFromAseprite('${base}');
  const meta = this.cache.json.get('${base}').meta;
  const s = this.add.sprite(x, y, '${base}').setOrigin(meta.pivot.normalized.x, meta.pivot.normalized.y);
  const name = '${rows[0]}';
  s.play({ key: name, repeat: meta.animationSettings[name].loop ? -1 : 0 });

createFromAseprite uses each frame's duration but ignores loop settings, so pass
repeat yourself as above. Frame size ${F}x${F} logical px; pivot = bottom centre.
manifest.json lists every file with its size.
` + (sprite3.type === "imported" ? `
Source: an imported image, animated by moving its parts (a rig). It cannot show sides
or details the image does not have. manifest.json "source" lists frames that show
joint fill or art you drew, and frames you edited by hand.
` : "") + playbackReadme(ctx, rows, base);
  }
  function cutoutReadme(cut) {
    if (!cut.length) return "";
    const lines = cut.map((c) => {
      const why = [...Object.entries(c.notes).map(([n, w2]) => `${n}: ${w2.join(", ")}`), ...c.edited.length ? [`frames edited by hand are not in the scene (${c.edited.join(", ")})`] : []];
      return `  ${c.scene} (direction ${c.direction}) with its parts in ${c.dir}/${why.length ? "\n    " + why.join("\n    ") : ""}`;
    });
    return `
Cutout scene (the rig as nodes, editable in Godot): copy the .tscn and its folder next to the
.png. The root's origin is the pivot; each part is a Sprite2D under a Node2D at its joint, parented
like the rig; an AnimationPlayer holds every animation (and RESET, the rest pose).
${lines.join("\n")}
Godot turns the pictures itself (nearest filter), so turned frames are close to, not identical to, the
sheet; the rest pose is exact. Keys and easing are ours where Godot has the same transition; ease
in-out, curves, secondary motion and uneven frame times have a key on every frame. Colour variants,
flash frames and joint fill (the colour the sheet spreads into gaps at turned joints) are in the
sheets, not the cutout scene: where a part turns far, the scene can show a gap the sheet fills.
`;
  }
  function variantsReadme(manifest) {
    if (!manifest.variants) return "";
    return `
Colour variants (the same frames in other colours, laid out exactly like the main files):
` + manifest.variants.map((v) => `  ${v.name}: ${[v.sheet, v.packed, v.godot, v.unity].filter(Boolean).join(", ")}`).join("\n") + `
The atlas JSON is shared: its meta.variants lists each variant's image and colour map.
`;
  }
  function buildPack(ctx, preset, { source = null, cutout = [], pixel = frameSource(ctx) } = {}) {
    const { sprite: sprite3, timeline: timeline2, state: state2 } = ctx, variants2 = ctx.variants || [];
    const base = baseNameOf(sprite3), F = frameSizeOf(sprite3), scale = state2.scale, rows = sheetRowsOf(timeline2, ctx.rows);
    const vpixel = (v) => v ? (n, i) => mapPixels(pixel(n, i), v.map) : pixel;
    const sheet = sheetPlan(ctx, scale, rows);
    const anims = {};
    for (const n of rows) anims[n] = {
      frames: frameCount(timeline2, n),
      fps: timeline2.anims[n].fps || state2.fps,
      loop: timeline2.anims[n].loop,
      mode: modeOf(timeline2.anims[n]),
      repeat: repeatOf(timeline2.anims[n]),
      durationsMs: timeline2.anims[n].frames.map((_, i) => frameDurationMs(timeline2, n, i, state2.fps))
    };
    const pivots = {};
    for (const n of rows) timeline2.anims[n].frames.forEach((fr, i) => {
      if (fr.data && fr.data.pivot) pivots[`${n}_${i}`] = pivots[`${n}:${i}`] = { x: fr.data.pivot[0], y: fr.data.pivot[1] };
    });
    let pack = null;
    if (PRESETS2[preset] && PRESETS2[preset].packed) {
      const cells = rows.flatMap((n) => Array.from({ length: frameCount(timeline2, n) }, (_, i) => ({ name: `${n}_${i}`, px: pixel(n, i), n, i })));
      const layout2 = packFrames(cells, F, 1);
      pack = { layout: layout2, cells, json: packedAtlasJson({ image: base + "_packed.png", layout: layout2, F, scale, pivot: pivotOf(sprite3), pivots }) };
      if (variants2.length) pack.json.meta.variants = variants2.map((v) => ({ name: v.name, image: `${base}_${v.name}_packed.png` }));
    }
    const packedIn = (v) => {
      const r = blankRaster(pack.layout.width * scale, pack.layout.height * scale), px = vpixel(v);
      pack.layout.cells.forEach((c, k) => {
        if (!c.empty) drawPart(r, px(pack.cells[k].n, pack.cells[k].i), F, c.trim.x, c.trim.y, c.w, c.h, c.x * scale, c.y * scale, scale);
      });
      return r;
    };
    const plan = planExport({
      preset,
      base,
      rows,
      anims,
      F,
      scale,
      sheet: { width: sheet.layout.width, height: sheet.layout.height, rows: sheet.rows, cols: sheet.cols },
      pivot: sheet.json.meta.pivot,
      generator: sheet.json.meta.generator,
      source,
      frameData: sheet.frameData,
      packed: pack ? { w: pack.layout.width * scale, h: pack.layout.height * scale } : null,
      variants: variants2.map((v) => v.name),
      cutout
    });
    const placements = sheet.layout.placements, S = F * scale;
    const metaOf = (b) => unityTextureMeta({ base: b, placements, S, F, sheetW: sheet.layout.width, sheetH: sheet.layout.height, pivot: pivotOf(sprite3), pivots, pixelsPerUnit: S });
    const sliced = metaOf(base).sprites;
    const spritesOf = (row) => placements.map((p, i) => ({ p, s: sliced[i] })).filter((x) => x.p.anim === row).sort((a, b) => a.p.frame - b.p.frame).map((x) => ({ fileID: x.s.id }));
    const clipOf = (sheetBase, row) => unityClip({ name: `${sheetBase}_${row}`, sprites: spritesOf(row), texGuid: hexId("sprite-foundry/" + sheetBase + ".png"), play: { ...anims[row], fps: anims[row].fps } });
    const out = [];
    for (const f of plan.files) {
      const v = f.variant ? variantByName(variants2, f.variant) : null;
      if (f.kind === "sheet") out.push([f.path, { raster: sheetRaster(sheet, F, scale, pixel) }]);
      else if (f.kind === "atlas") out.push([f.path, JSON.stringify(sheet.json, null, 2)]);
      else if (f.kind === "gif") out.push([f.path, gifBytes(ctx, f.anim, scale, pixel)]);
      else if (f.kind === "frame") out.push([f.path, { raster: drawFrame(blankRaster(f.w, f.h), pixel(f.anim, f.frame), F, 0, 0, scale) }]);
      else if (f.kind === "variantSheet") out.push([f.path, { raster: sheetRaster(sheet, F, scale, vpixel(v)) }]);
      else if (f.kind === "variantPacked") out.push([f.path, { raster: packedIn(v) }]);
      else if (f.kind === "godotVariant") out.push([f.path, godotSpriteFrames({ base: `${base}_${f.variant}`, rows, anims, placements, S })]);
      else if (f.kind === "unityVariant") out.push([f.path, metaOf(`${base}_${f.variant}`).text]);
      else if (f.kind === "readme") out.push([f.path, readmeText(ctx, base, F, preset, rows) + cutoutReadme(cutout) + variantsReadme(plan.manifest)]);
      else if (f.kind === "godot") out.push([f.path, godotSpriteFrames({ base, rows, anims, placements, S })]);
      else if (f.kind === "unity") out.push([f.path, metaOf(base).text]);
      else if (f.kind === "unityClip") out.push([f.path, clipOf(f.sheetBase, f.anim)]);
      else if (f.kind === "unityClipMeta") out.push([f.path, unityNativeMeta(clipGuid(f.path.slice(0, -5)), CLIP_FILE_ID)]);
      else if (f.kind === "unityController") out.push([f.path, unityController({ name: f.sheetBase, clips: rows.map((r) => ({ name: r, guid: clipGuid(`${f.sheetBase}_${r}.anim`) })) })]);
      else if (f.kind === "unityControllerMeta") out.push([f.path, unityNativeMeta(clipGuid(f.path.slice(0, -5)), CONTROLLER_FILE_ID)]);
      else if (f.kind === "cutoutScene") out.push([f.path, cutout.find((c) => c.scene === f.path).text]);
      else if (f.kind === "cutoutPart") {
        const im = cutout.find((c) => c.direction === f.direction).images[f.part];
        out.push([f.path, { raster: drawRect(blankRaster(im.w, im.h), im.px, im.w, im.h, 0, 0, 1) }]);
      } else if (f.kind === "packedSheet") out.push([f.path, { raster: packedIn(null) }]);
      else if (f.kind === "packedAtlas") out.push([f.path, JSON.stringify(pack.json, null, 2)]);
      else if (f.kind === "manifest") out.push([f.path, JSON.stringify(plan.manifest, null, 2)]);
    }
    return { plan, out };
  }

