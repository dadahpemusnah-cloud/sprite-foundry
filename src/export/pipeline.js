  // src/export/pipeline.js
  var PRESETS2 = {
    phaser: { label: "Phaser: sheet + atlas JSON", sheet: true, json: true, frames: false, gifs: false, readme: true },
    full: { label: "Full pack: sheet, JSON, GIFs, frames", sheet: true, json: true, frames: true, gifs: true, readme: true },
    frames: { label: "Individual PNG frames", sheet: false, json: false, frames: true, gifs: false, readme: false },
    gifs: { label: "Animated GIF previews", sheet: false, json: false, frames: false, gifs: true, readme: false },
    // U6: game engines (src/export/engines.js)
    godot: { label: "Godot 4: sheet + SpriteFrames (.tres)", sheet: true, json: false, frames: false, gifs: false, readme: true, godot: true },
    unity: { label: "Unity: sheet + sprite slicing (.png.meta)", sheet: true, json: false, frames: false, gifs: false, readme: true, unity: true },
    packed: { label: "Trimmed, packed atlas (TexturePacker JSON)", sheet: false, json: false, frames: false, gifs: false, readme: true, packed: true }
  };
  var EXPORT_FORMAT = "1.1";
  var EXPORT_FORMAT_V12 = "1.2";
  function planExport({ preset, base, rows, anims, F, scale, sheet, pivot, generator, source = null, frameData = null, packed = null, variants: variants2 = [], cutout = [] }) {
    const P = PRESETS2[preset];
    if (!P) throw new Error(`Unknown export preset "${preset}"`);
    const S = F * scale, files = [];
    const sheetFile = P.sheet ? base + ".png" : null, atlasFile = P.json ? base + ".json" : null;
    if (P.sheet) files.push({ path: sheetFile, kind: "sheet", w: sheet.width, h: sheet.height });
    if (P.json) files.push({ path: atlasFile, kind: "atlas" });
    const engines = {};
    if (P.godot) {
      engines.godot = base + ".tres";
      files.push({ path: engines.godot, kind: "godot" });
    }
    if (P.unity) {
      engines.unity = base + ".png.meta";
      files.push({ path: engines.unity, kind: "unity" });
    }
    const unityAnims = (sheetBase) => {
      const clips = rows.map((name) => ({ anim: name, clip: `${sheetBase}_${name}.anim` }));
      for (const c of clips) files.push({ path: c.clip, kind: "unityClip", anim: c.anim, sheetBase }, { path: c.clip + ".meta", kind: "unityClipMeta", anim: c.anim, sheetBase });
      const controller = sheetBase + ".controller";
      files.push({ path: controller, kind: "unityController", sheetBase }, { path: controller + ".meta", kind: "unityControllerMeta", sheetBase });
      return { clips: clips.map((c) => c.clip), controller };
    };
    if (P.unity) engines.unityClips = unityAnims(base);
    if (P.godot && cutout.length) {
      engines.godotCutout = cutout.map((c) => ({ direction: c.direction, scene: c.scene, parts: c.parts.map((n) => `${c.dir}/${n}`) }));
      for (const c of cutout) {
        files.push({ path: c.scene, kind: "cutoutScene", direction: c.direction });
        for (const n of c.parts) files.push({ path: `${c.dir}/${n}`, kind: "cutoutPart", direction: c.direction, part: n });
      }
    }
    if (P.packed) {
      engines.packed = { image: base + "_packed.png", atlas: base + "_packed.json" };
      files.push({ path: engines.packed.image, kind: "packedSheet", w: packed.w, h: packed.h }, { path: engines.packed.atlas, kind: "packedAtlas" });
    }
    const vfiles = [];
    for (const v of variants2) {
      const e = { name: v };
      if (P.sheet) {
        e.sheet = `${base}_${v}.png`;
        files.push({ path: e.sheet, kind: "variantSheet", variant: v, w: sheet.width, h: sheet.height });
      }
      if (P.godot) {
        e.godot = `${base}_${v}.tres`;
        files.push({ path: e.godot, kind: "godotVariant", variant: v });
      }
      if (P.unity) {
        e.unity = `${base}_${v}.png.meta`;
        files.push({ path: e.unity, kind: "unityVariant", variant: v });
        e.unityClips = unityAnims(`${base}_${v}`);
      }
      if (P.packed) {
        e.packed = `${base}_${v}_packed.png`;
        files.push({ path: e.packed, kind: "variantPacked", variant: v, w: packed.w, h: packed.h });
      }
      if (Object.keys(e).length > 1) vfiles.push(e);
    }
    const animations = rows.map((name, row) => {
      const a = anims[name];
      const entry = { name, row, frames: a.frames, fps: a.fps, loop: a.loop, durationsMs: a.durationsMs.slice() };
      if (a.mode && a.mode !== "forward") entry.mode = a.mode;
      if (!a.loop && a.repeat > 1) entry.repeat = a.repeat;
      if (frameData && frameData[name]) entry.frameData = frameData[name];
      if (P.gifs) {
        entry.gif = `gif/${name}.gif`;
        files.push({ path: entry.gif, kind: "gif", w: S, h: S, anim: name });
      }
      if (P.frames) {
        entry.frameFiles = Array.from({ length: a.frames }, (_, i) => `frames/${name}_${i}.png`);
        entry.frameFiles.forEach((path, i) => files.push({ path, kind: "frame", w: S, h: S, anim: name, frame: i }));
      }
      return entry;
    });
    if (P.readme) files.push({ path: "README.txt", kind: "readme" });
    const manifest = {
      app: "Sprite Foundry",
      exportFormat: frameData || Object.keys(engines).length || vfiles.length ? EXPORT_FORMAT_V12 : EXPORT_FORMAT,
      preset,
      scale,
      logicalFrame: { w: F, h: F },
      outputFrame: { w: S, h: S },
      sheet: P.sheet ? { file: sheetFile, w: sheet.width, h: sheet.height, rows: sheet.rows, cols: sheet.cols } : null,
      atlas: atlasFile,
      animations,
      pivot,
      generator,
      ...source ? { source } : {},
      ...Object.keys(engines).length ? { engines } : {},
      ...vfiles.length ? { variants: vfiles } : {},
      files: files.map((f) => ({ path: f.path, kind: f.kind, ...f.w ? { w: f.w, h: f.h } : {} }))
    };
    files.push({ path: "manifest.json", kind: "manifest" });
    return { files, manifest, zipName: preset === "full" ? base + ".zip" : `${base}_${preset}.zip` };
  }

