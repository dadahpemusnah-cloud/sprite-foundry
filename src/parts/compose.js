  // src/parts/compose.js
  var HERO_GENERATOR_VERSION = 1;
  var ZOMBIE_SKIN = [["#b4c79a", "#8fa476", "#667a52"], ["#a9b5a4", "#83907e", "#5f6a5b"], ["#9fb08e", "#7a8b6a", "#57664b"]];
  var skinRamp = (t) => ({ hi: t[0], base: t[1], sh: t[2] });
  function weightedPick(r, options) {
    const total = options.reduce((a, [, wt]) => a + wt, 0);
    let x = r() * total;
    for (const [id, wt] of options) {
      if ((x -= wt) < 0) return id;
    }
    return options[options.length - 1][0];
  }
  function resolveClass(shapeSeed, cls) {
    if (cls && cls !== "random" && CLASSES[cls]) return cls;
    return seedRng(`${shapeSeed}:class`).pick(RANDOM_CLASSES);
  }
  function heroColours(colorSeed, clsName) {
    const C2 = CLASSES[clsName].colours || {}, r = (m) => seedRng(`${colorSeed}:${m}`);
    const rs = r("skin");
    const skin = skinRamp(C2.zombie ? rs.pick(ZOMBIE_SKIN) : C2.fantasy && r("fantasy").chance(C2.fantasy) ? rs.pick(FANTASY_SKIN) : rs.pick(SKIN));
    const rh = r("hair");
    const hair = ramp(rh.pick([28, 22, 40, 48, 8, 275, 200, 330]), rh.range(30, 70), rh.pick([16, 26, 38, 55, 70]));
    const rcl = r("cloth");
    const clothHue = C2.clothHue ? rcl.range(C2.clothHue[0], C2.clothHue[1]) : rcl() * 360;
    const clothSat = C2.zombie ? rcl.range(10, 25) : rcl.range(40, 75);
    const clothL = C2.dark ? rcl.range(24, 32) : C2.zombie ? rcl.range(32, 42) : rcl.range(38, 54);
    const cloth = ramp(clothHue, clothSat, clothL);
    const r2 = r("cloth2");
    const cloth2 = ramp(clothHue + r2.pick([150, 180, -150, 30]), C2.zombie ? 15 : r2.range(45, 75), C2.dark ? r2.range(26, 34) : r2.range(36, 50));
    const rl = r("leather"), rb = r("boots"), rm = r("metal"), rw = r("wood"), rg = r("gem");
    const leather = ramp(rl.range(20, 35), rl.range(30, 50), rl.range(30, 40));
    const boots = ramp(rb.range(15, 35), 30, rb.range(18, 26));
    const metal = C2.metalGold && rm.chance(C2.metalGold) ? ramp(44, 70, 55) : ramp(rm.range(205, 225), rm.range(8, 16), rm.range(58, 66));
    const gold = ramp(44, 70, 54);
    const wood = ramp(rw.range(22, 36), rw.range(35, 50), rw.range(30, 40));
    const gem = ramp(rg() * 360, 85, 58);
    return { skin, hair, cloth, cloth2, leather, boots, metal, gold, wood, gem, clothHue };
  }
  function rollHero({ shapeSeed, colorSeed, cls = "random", locks = {}, colourCls = null }) {
    const clsName = resolveClass(shapeSeed, cls);
    const C2 = CLASSES[clsName];
    const parts = { body: "body.base" };
    for (const slot of HUMANOID.slots) {
      if (slot.name === "body") continue;
      if (Object.prototype.hasOwnProperty.call(locks, slot.name)) {
        parts[slot.name] = locks[slot.name];
        continue;
      }
      parts[slot.name] = weightedPick(seedRng(`${shapeSeed}:${slot.name}`), C2.slots[slot.name]);
    }
    return { version: HERO_GENERATOR_VERSION, template: HUMANOID.id, cls: clsName, shapeSeed, colorSeed, parts, colours: heroColours(colorSeed, colourCls && CLASSES[colourCls] ? colourCls : clsName) };
  }
  var sameGroup = (a, b) => a === b || HUMANOID.rigidGroups.some((g) => g.includes(a) && g.includes(b));
  function composeHero(config, template = HUMANOID, library = PARTS_BY_ID) {
    const N = template.N, px = new Array(N * N).fill(null), tag = new Array(N * N).fill(null), owner = new Array(N * N).fill(null);
    const issues = { overlaps: [], outOfBounds: [], missingParts: [], unknownGlyphs: [], slotMismatch: [] };
    const order2 = template.slots.map((s, i) => ({ ...s, i })).sort((a, b) => a.layer - b.layer || a.i - b.i);
    for (const slot of order2) {
      const id = config.parts[slot.name];
      if (!id || id === "none") continue;
      const part = library[id];
      if (!part) {
        issues.missingParts.push({ slot: slot.name, id });
        continue;
      }
      if (part.slot !== slot.name) issues.slotMismatch.push({ slot: slot.name, id });
      for (const c of part.clear || []) {
        const [ax, ay] = template.anchors[c.at];
        for (let y = ay + c.off[1]; y < ay + c.off[1] + c.h; y++) for (let x = ax + c.off[0]; x < ax + c.off[0] + c.w; x++) {
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const i = y * N + x;
          px[i] = null;
          tag[i] = null;
          owner[i] = null;
        }
      }
      for (const pc of part.pieces) {
        const [ax, ay] = template.anchors[pc.at];
        pc.rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
          if (ch === ".") return;
          const x = ax + pc.off[0] + rx, y = ay + pc.off[1] + ry;
          if (x < 0 || y < 0 || x >= N || y >= N) {
            issues.outOfBounds.push({ id, x, y });
            return;
          }
          const col = glyphColour(ch, config.colours);
          if (col === void 0) {
            issues.unknownGlyphs.push({ id, ch });
            return;
          }
          const i = y * N + x;
          if (tag[i] && !sameGroup(tag[i], pc.tag)) issues.overlaps.push({ x, y, under: owner[i], over: id, tags: [tag[i], pc.tag] });
          px[i] = col;
          tag[i] = pc.tag;
          owner[i] = id;
        }));
      }
    }
    return { px, tag, owner, issues };
  }
  function weaponGrip(config, template = HUMANOID, library = PARTS_BY_ID) {
    const p = library[config.parts.weapon];
    if (!p || !p.grip) return null;
    const [ax, ay] = template.anchors[p.grip.at];
    return { x: ax + p.grip.off[0], y: ay + p.grip.off[1], kind: p.kind };
  }

