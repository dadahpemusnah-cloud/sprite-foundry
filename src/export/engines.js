  // src/export/engines.js
  var num = (v) => Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(4));
  function godotSpriteFrames({ base, rows, anims, placements, S, texturePath }) {
    const subs = placements.map((p, i) => ({ id: `AtlasTexture_${i}`, p }));
    const lines = [`[gd_resource type="SpriteFrames" load_steps=${subs.length + 2} format=3]`, "", `[ext_resource type="Texture2D" path="${texturePath || "res://" + base + ".png"}" id="1_sheet"]`, ""];
    for (const s of subs) lines.push(`[sub_resource type="AtlasTexture" id="${s.id}"]`, 'atlas = ExtResource("1_sheet")', `region = Rect2(${s.p.x}, ${s.p.y}, ${S}, ${S})`, "");
    const animations = rows.map((name) => {
      const a = anims[name], frameMs2 = 1e3 / a.fps;
      const mine = subs.filter((s) => s.p.anim === name).sort((u, v) => u.p.frame - v.p.frame);
      const seq = playSequence(mine.length, { mode: a.mode || "forward", loop: a.loop, repeat: a.repeat || 1 });
      const frames = seq.map((i) => mine[i]).map((s) => `{
"duration": ${num(a.durationsMs[s.p.frame] / frameMs2)},
"texture": SubResource("${s.id}")
}`);
      return `{
"frames": [${frames.join(", ")}],
"loop": ${a.loop ? "true" : "false"},
"name": &"${name}",
"speed": ${num(a.fps)}
}`;
    });
    lines.push("[resource]", `animations = [${animations.join(", ")}]`, "");
    return lines.join("\n");
  }
  function hexId(text) {
    let out = "";
    for (let k = 0; k < 4; k++) {
      let h = 2166136261 ^ k * 2654435761;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      out += (h >>> 0).toString(16).padStart(8, "0");
    }
    return out;
  }
  function unityTextureMeta({ base, placements, S, F, sheetW, sheetH, pivot, pivots = {}, pixelsPerUnit }) {
    const size = Math.max(2048, 2 ** Math.ceil(Math.log2(Math.max(sheetW, sheetH))));
    const sprites = placements.map((p, i) => {
      const pv = pivots[`${p.anim}:${p.frame}`] || pivot, name = `${base}_${p.anim}_${p.frame}`;
      return { name, id: 213e5 + 2 * i, rect: { x: p.x, y: sheetH - p.y - S, w: S, h: S }, pivot: { x: +(pv.x / F).toFixed(6), y: +(1 - pv.y / F).toFixed(6) }, spriteID: hexId(base + "/" + name) };
    });
    const lines = [
      "fileFormatVersion: 2",
      `guid: ${hexId("sprite-foundry/" + base + ".png")}`,
      "TextureImporter:",
      "  internalIDToNameTable: []",
      "  externalObjects: {}",
      "  serializedVersion: 12",
      "  mipmaps:",
      "    mipMapMode: 0",
      "    enableMipMap: 0",
      "  isReadable: 0",
      "  textureType: 8",
      "  textureShape: 1",
      "  spriteMode: 2",
      "  spriteExtrude: 1",
      "  spriteMeshType: 0",
      "  alignment: 9",
      "  spritePivot: {x: 0.5, y: 0.5}",
      `  spritePixelsToUnits: ${pixelsPerUnit}`,
      "  alphaUsage: 1",
      "  alphaIsTransparency: 1",
      "  wrapU: 1",
      "  wrapV: 1",
      "  filterMode: 0",
      "  aniso: 1",
      "  platformSettings:",
      "  - serializedVersion: 3",
      "    buildTarget: DefaultTexturePlatform",
      `    maxTextureSize: ${size}`,
      "    textureFormat: -1",
      "    textureCompression: 0",
      "    compressionQuality: 50",
      "  spriteSheet:",
      "    serializedVersion: 2",
      "    sprites:"
    ];
    for (const s of sprites) lines.push(
      "    - serializedVersion: 2",
      `      name: ${s.name}`,
      "      rect:",
      "        serializedVersion: 2",
      `        x: ${s.rect.x}`,
      `        y: ${s.rect.y}`,
      `        width: ${s.rect.w}`,
      `        height: ${s.rect.h}`,
      "      alignment: 9",
      `      pivot: {x: ${s.pivot.x}, y: ${s.pivot.y}}`,
      "      border: {x: 0, y: 0, z: 0, w: 0}",
      "      outline: []",
      "      physicsShape: []",
      "      tessellationDetail: 0",
      "      bones: []",
      `      spriteID: ${s.spriteID}`,
      `      internalID: ${s.id}`,
      "      vertices: []",
      "      indices: ",
      "      edges: []",
      "      weights: []"
    );
    lines.push("    nameFileIdTable:");
    for (const s of sprites) lines.push(`      ${s.name}: ${s.id}`);
    lines.push("  spritePackingTag: ", "  userData: ", "  assetBundleName: ", "  assetBundleVariant: ", "");
    return { text: lines.join("\n"), sprites };
  }
  function packFrames(frames, F, pad = 1, border = 1) {
    const cells = frames.map(({ name, px }) => {
      let x0 = F, y0 = F, x1 = -1, y1 = -1;
      for (let i = 0; i < px.length; i++) if (px[i]) {
        const x2 = i % F, y2 = i / F | 0;
        if (x2 < x0) x0 = x2;
        if (x2 > x1) x1 = x2;
        if (y2 < y0) y0 = y2;
        if (y2 > y1) y1 = y2;
      }
      if (x1 < 0) return { name, w: 1, h: 1, trim: { x: 0, y: 0 }, empty: true };
      x0 = Math.max(0, x0 - border);
      y0 = Math.max(0, y0 - border);
      x1 = Math.min(F - 1, x1 + border);
      y1 = Math.min(F - 1, y1 + border);
      return { name, w: x1 - x0 + 1, h: y1 - y0 + 1, trim: { x: x0, y: y0 } };
    });
    const area = cells.reduce((a, c) => a + (c.w + pad) * (c.h + pad), 0), limit = Math.max(F, Math.ceil(Math.sqrt(area) * 1.2));
    const order2 = cells.map((c, i) => i).sort((a, b) => cells[b].h - cells[a].h || a - b);
    let x = 0, y = 0, shelf = 0, width = 0;
    for (const i of order2) {
      const c = cells[i];
      if (x > 0 && x + c.w > limit) {
        x = 0;
        y += shelf + pad;
        shelf = 0;
      }
      c.x = x;
      c.y = y;
      x += c.w + pad;
      shelf = Math.max(shelf, c.h);
      width = Math.max(width, c.x + c.w);
    }
    return { width: Math.max(1, width), height: Math.max(1, y + shelf), cells };
  }
  function packedAtlasJson({ image, layout: layout2, F, scale, pivot, pivots = {} }) {
    const frames = {};
    for (const c of layout2.cells) {
      const pv = pivots[c.name] || pivot, S = F * scale;
      frames[c.name] = {
        frame: { x: c.x * scale, y: c.y * scale, w: c.w * scale, h: c.h * scale },
        rotated: false,
        trimmed: !c.empty && (c.w < F || c.h < F),
        spriteSourceSize: { x: c.trim.x * scale, y: c.trim.y * scale, w: c.w * scale, h: c.h * scale },
        sourceSize: { w: S, h: S },
        pivot: { x: +(pv.x / F).toFixed(6), y: +(pv.y / F).toFixed(6) }
      };
    }
    return { frames, meta: { app: "Sprite Foundry", version: "1.0", image, format: "RGBA8888", size: { w: layout2.width * scale, h: layout2.height * scale }, scale: String(scale) } };
  }

