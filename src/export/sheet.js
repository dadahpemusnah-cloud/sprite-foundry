  // src/export/sheet.js
  function sheetLayout({ rows, frameCounts, F, scale, fps, image, seeds, durations, v11 }) {
    const cols = Math.max(1, ...rows.map((n) => frameCounts[n]));
    const width = Math.max(1, cols * F * scale), height = Math.max(1, rows.length * F * scale);
    const json = { frames: {}, meta: { app: "Sprite Foundry", version: "1.0", image, format: "RGBA8888", size: { w: width, h: height }, scale: String(scale), frameTags: [], layers: [], slices: [], animations: {}, seeds } };
    const placements = [];
    let idx = 0, v12 = false;
    const dur = Math.round(1e3 / fps);
    rows.forEach((n, r) => {
      const from = idx;
      json.meta.animations[n] = [];
      for (let c = 0; c < frameCounts[n]; c++) {
        const w2 = F * scale;
        placements.push({ anim: n, frame: c, x: c * w2, y: r * w2 });
        json.frames[String(idx)] = { frame: { x: c * w2, y: r * w2, w: w2, h: w2 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: w2, h: w2 }, sourceSize: { w: w2, h: w2 }, duration: durations && durations[n] ? durations[n][c] : dur };
        json.meta.animations[n].push(idx);
        idx++;
      }
      const st = v11 && v11.animSettings[n], mode = st && st.mode || "forward", fancy = mode !== "forward" || st && !st.loop && st.repeat > 1;
      const tag = { name: n, from, to: idx - 1, direction: ASEPRITE_DIRECTION[mode] };
      if (st && !st.loop) tag.repeat = String(asepriteRepeat(mode, false, st.repeat || 1));
      if (fancy) v12 = true;
      json.meta.frameTags.push(tag);
    });
    if (v11) {
      json.meta.version = "1.1";
      json.meta.fps = fps;
      json.meta.animationSettings = {};
      for (const n of rows) {
        const st = v11.animSettings[n], mode = st.mode || "forward", repeat = st.repeat || 1;
        json.meta.animationSettings[n] = { fps: st.fps, loop: st.loop };
        if (mode !== "forward" || !st.loop && repeat > 1) Object.assign(json.meta.animationSettings[n], { mode, ...st.loop ? {} : { repeat }, order: playSequence(frameCounts[n], { mode, loop: st.loop, repeat }) });
      }
      if (v12) json.meta.version = "1.2";
      const p = v11.pivot;
      json.meta.pivot = { x: p.x, y: p.y, scaled: { x: p.x * scale, y: p.y * scale }, normalized: { x: p.x / F, y: p.y / F } };
      json.meta.generator = { ...v11.generator };
    }
    return { json, cols, rows: rows.length, width, height, placements };
  }

