  // src/workshop/export.js
  var EXPORT_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
  function sheetPlan2(ws) {
    const e = ws.export, S = e.scale, clips = clipList(ws), single = clips.length === 1;
    const n = single ? ws.frames.length : Math.max(...clips.map((c) => c.frames.length));
    const cols = single && e.columns ? Math.min(e.columns, n) : n, rows = single ? Math.ceil(n / cols) : clips.length;
    const W = e.margin * 2 + cols * e.cellW + (cols - 1) * e.spacing, H = e.margin * 2 + rows * e.cellH + (rows - 1) * e.spacing;
    const dx = Math.floor((e.cellW - ws.size.w) / 2), dy = e.cellH - ws.size.h;
    const cells = [];
    clips.forEach((clip2, k) => clip2.frames.forEach((f, i) => {
      const c = single ? i % cols : i, r = single ? Math.floor(i / cols) : k;
      cells.push({ clip: k, frame: i, x: e.margin + c * (e.cellW + e.spacing), y: e.margin + r * (e.cellH + e.spacing) });
    }));
    return { cols, rows, cellW: e.cellW, cellH: e.cellH, scale: S, logical: { w: W, h: H }, width: W * S, height: H * S, offset: { x: dx, y: dy }, cells, clips: clips.map((c) => ({ name: single ? e.name : rowOf(ws, c), animation: c.name, dir: c.dir, fps: c.fps, loop: c.loop, mode: c.mode || "forward", repeat: c.repeat || 1, frames: c.frames.length })) };
  }
  var clipFrames = (ws, k) => clipList(ws)[k].frames;
  var durationOf = (c, f) => f.dur ?? Math.round(1e3 / c.fps);
  function cellPixels(ws, i, plan = sheetPlan2(ws)) {
    const cell = plan.cells[i], { cellW, cellH, offset } = plan, { w: w2, h } = ws.size, px = composite(clipFrames(ws, cell.clip)[cell.frame]), out = new Array(cellW * cellH).fill(null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w2; x++) out[(y + offset.y) * cellW + x + offset.x] = px[y * w2 + x];
    return out;
  }
  function sheetPixels(ws, plan = sheetPlan2(ws)) {
    const { w: W, h: H } = plan.logical, out = new Array(W * H).fill(null);
    for (const [k, c] of plan.cells.entries()) {
      const px = cellPixels(ws, k, plan);
      for (let y = 0; y < plan.cellH; y++) for (let x = 0; x < plan.cellW; x++) out[(c.y + y) * W + c.x + x] = px[y * plan.cellW + x];
    }
    return out;
  }
  function atlasJson(ws, plan = sheetPlan2(ws)) {
    const S = plan.scale, name = ws.export.name, frames = {}, clips = clipList(ws);
    plan.cells.forEach((c, k) => {
      const w2 = plan.cellW * S, h = plan.cellH * S;
      frames[String(k)] = { frame: { x: c.x * S, y: c.y * S, w: w2, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: w2, h }, sourceSize: { w: w2, h }, duration: durationOf(clips[c.clip], clips[c.clip].frames[c.frame]) };
    });
    const tags = [], animations = {}, animationSettings = {};
    let v12 = false;
    plan.clips.forEach((c, k) => {
      const idx = plan.cells.map((cell, j) => cell.clip === k ? j : -1).filter((j) => j >= 0);
      const tag = { name: c.name, from: idx[0], to: idx[idx.length - 1], direction: ASEPRITE_DIRECTION[c.mode] };
      if (!c.loop) tag.repeat = String(asepriteRepeat(c.mode, false, c.repeat));
      tags.push(tag);
      animations[c.name] = idx;
      animationSettings[c.name] = { fps: c.fps, loop: c.loop };
      if (c.mode !== "forward" || !c.loop && c.repeat > 1) {
        Object.assign(animationSettings[c.name], { mode: c.mode, ...c.loop ? {} : { repeat: c.repeat }, order: playSequence(c.frames, c) });
        v12 = true;
      }
    });
    const px = plan.cellW / 2, py = plan.cellH;
    return {
      frames,
      meta: {
        app: "Sprite Foundry",
        version: v12 || (ws.variants || []).length || (ws.slices || []).length ? "1.2" : "1.1",
        image: name + ".png",
        format: "RGBA8888",
        size: { w: plan.width, h: plan.height },
        scale: String(S),
        frameTags: tags,
        layers: [],
        slices: slicesJson(ws, plan),
        animations,
        fps: ws.fps,
        animationSettings,
        pivot: { x: px, y: py, scaled: { x: px * S, y: py * S }, normalized: { x: px / plan.cellW, y: py / plan.cellH } },
        generator: { type: "workshop", version: ws.version },
        // V2: colour variants: the same sheet in other colours, one PNG each (format 1.2)
        ...(ws.variants || []).length ? { variants: ws.variants.map((v) => ({ name: v.name, image: `${name}_${v.name}.png`, map: { ...v.map } })) } : {},
        workshop: {
          sprite: { ...ws.size },
          cell: { w: plan.cellW, h: plan.cellH },
          columns: plan.cols,
          rows: plan.rows,
          spacing: ws.export.spacing,
          margin: ws.export.margin,
          ...plan.clips.length > 1 ? { directions: (ws.directions || ["S"]).slice(), clips: plan.clips.map((c) => ({ name: c.name, animation: c.animation, direction: c.dir, ...(ws.mirrored || {})[c.animation + "|" + c.dir] ? { mirroredFrom: ws.mirrored[c.animation + "|" + c.dir] } : {} })) } : {}
        }
      }
    };
  }
  function readme(ws, plan = sheetPlan2(ws)) {
    const name = ws.export.name;
    return [
      `${name} \u2014 made in the Sprite Foundry 2.5D Workshop`,
      "",
      `${name}.png   sprite sheet, transparent background, ${plan.width}\xD7${plan.height} px`,
      `${name}.json  frame positions and times (Aseprite hash layout, Sprite Foundry format 1.1)`,
      "",
      `${ws.frames.length} frame${ws.frames.length > 1 ? "s" : ""} in ${plan.cols} column${plan.cols > 1 ? "s" : ""} and ${plan.rows} row${plan.rows > 1 ? "s" : ""}; each cell ${plan.cellW * plan.scale}\xD7${plan.cellH * plan.scale} px (${plan.cellW}\xD7${plan.cellH} at scale ${plan.scale}).`,
      `Spacing ${ws.export.spacing * plan.scale} px between cells, margin ${ws.export.margin * plan.scale} px around the sheet.`,
      `${ws.fps} fps, ${ws.loop ? "loops" : "plays once"}. Frame times are in the JSON (ms).`,
      "The pivot is the bottom centre of each cell (meta.pivot): set the sprite origin to (0.5, 1) to stand it on the ground.",
      "",
      ...(ws.variants || []).length ? ["Colour variants (the same sheet in other colours; this JSON fits them all):", ...ws.variants.map((v) => `  ${name}_${v.name}.png`), ""] : [],
      ...Object.keys(ws.mirrored || {}).length ? ["Mirrored by you (your own drawing of the opposite direction, flipped):", ...Object.entries(ws.mirrored).map(([k, from]) => `  ${k.replace("|", " ")} from ${from}`), ""] : [],
      ...slicesOf(ws).length ? [
        "UI slices (meta.slices: bounds and the 9-slice center in cell pixels at this scale, frame 0), and a Godot 4 StyleBoxTexture for each:",
        ...slicesOf(ws).map((s) => {
          const i = insetsOf(s);
          return `  ${styleBoxFile(ws, s)}  ${s.w * plan.scale}\xD7${s.h * plan.scale} px${s.center ? `, margins left ${i.left * plan.scale}, top ${i.top * plan.scale}, right ${i.right * plan.scale}, bottom ${i.bottom * plan.scale}` : ", no 9-slice margins"}`;
        }),
        "  In Godot: a Panel or Button theme override (StyleBox) set to the .tres; it expects res://" + name + ".png.",
        ""
      ] : [],
      "Phaser 3: this.load.aseprite(key, png, json); this.anims.createFromAseprite(key);",
      `Phaser ignores the tag's repeat: play it with repeat: ${ws.loop ? -1 : 0} (meta.animationSettings).`,
      ""
    ].join("\n");
  }

