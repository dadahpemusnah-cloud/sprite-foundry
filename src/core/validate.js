  // src/core/validate.js
  var HEX2 = /^#[0-9a-f]{6}$/i;
  function bboxOf(px, F) {
    let x0 = F, x1 = -1, y0 = F, y1 = -1, n = 0;
    const cols = new Array(F).fill(0);
    for (let i = 0; i < px.length; i++) if (px[i]) {
      const x = i % F, y = i / F | 0;
      n++;
      cols[x]++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (!n) return null;
    let acc = 0, mid = x0;
    for (let x = x0; x <= x1; x++) {
      acc += cols[x];
      if (acc * 2 >= n) {
        mid = x;
        break;
      }
    }
    return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, mid, count: n };
  }
  function validateFrames({ timeline: timeline2, F, pixelsOf: pixelsOf2, rows = null, layout: layout2 = null, drift = 4, measure = null }) {
    const findings = [], frames = [];
    const add = (level, code, anim2, frame, message) => findings.push({ level, code, anim: anim2, frame, message });
    const label = (a, i) => `${a} frame ${i + 1}`;
    let ref = null;
    for (const name of timeline2.order) {
      const a = timeline2.anims[name];
      if (!a) {
        add("error", "missing-animation", name, null, `"${name}" is listed in the animation order but has no data.`);
        continue;
      }
      if (a.fps != null && !(Number.isFinite(a.fps) && a.fps > 0)) add("error", "bad-fps", name, null, `${name}: animation FPS ${a.fps} is not a positive number.`);
      if (!a.frames.length) {
        add("error", "empty-animation", name, null, `${name} has no frames; it would export as an empty row.`);
        continue;
      }
      let prevKey = null;
      const keys = [];
      a.frames.forEach((fr, i) => {
        const px = pixelsOf2(name, i);
        if (!Array.isArray(px) || px.length !== F * F) {
          add("error", "frame-size", name, i, `${label(name, i)} has ${Array.isArray(px) ? px.length : "no"} pixels; expected ${F}\xD7${F} = ${F * F}.`);
          keys.push(null);
          prevKey = null;
          return;
        }
        const bad = px.find((c) => c != null && !(typeof c === "string" && HEX2.test(c)));
        if (bad !== void 0) add("error", "bad-pixel", name, i, `${label(name, i)} contains an invalid colour value (${JSON.stringify(bad)}).`);
        if (fr.dur != null && !(Number.isFinite(fr.dur) && fr.dur > 0)) add("error", "bad-duration", name, i, `${label(name, i)} has an invalid duration (${fr.dur}).`);
        const bb = bboxOf(px, F);
        frames.push({ anim: name, frame: i, bbox: bb });
        if (!bb) add("warning", "empty-frame", name, i, `${label(name, i)} is completely transparent.`);
        else {
          const sides = [bb.y0 === 0 && "top", bb.y1 === F - 1 && "bottom", bb.x0 === 0 && "left", bb.x1 === F - 1 && "right"].filter(Boolean);
          if (sides.length) add("warning", "edge", name, i, `${label(name, i)} touches the frame edge (${sides.join(", ")}); part of the sprite may be cut off.`);
          const m = measure ? measure(name, i) : null;
          if (m) {
            if (m.y1 > m.refY1) add("warning", "below-ground", name, i, `${label(name, i)}: the feet reach ${m.y1 - m.refY1} px below the ground line of the rest pose.`);
            if (m.steady && Math.abs(m.mid - m.refMid) > drift) add("warning", "drift", name, i, `${label(name, i)}: the body is off-centre by ${m.mid - m.refMid} px compared with the rest pose (measured at the torso and head, so a weapon, a staff or a raised arm does not count).`);
            if (!ref) ref = bb;
          } else if (!ref) ref = bb;
          else {
            if (bb.y1 > ref.y1) add("warning", "below-ground", name, i, `${label(name, i)} reaches ${bb.y1 - ref.y1} px below the ground line of ${timeline2.order[0]} frame 1.`);
            if (Math.abs(bb.mid - ref.mid) > drift) add("warning", "drift", name, i, `${label(name, i)}: the body is off-centre by ${bb.mid - ref.mid} px compared with ${timeline2.order[0]} frame 1 (measured at the middle of its pixels, so a weapon held out or a raised arm does not count).`);
          }
        }
        const key = px.join(",");
        if (prevKey !== null && key === prevKey) add("warning", "duplicate", name, i, `${label(name, i)} is identical to frame ${i}. Fine for a held pose; otherwise the motion stalls here.`);
        prevKey = key;
        keys.push(key);
      });
      if (a.frames.length > 1 && keys.every((k) => k !== null && k === keys[0])) add("warning", "static-animation", name, null, `Every frame of ${name} is identical, so it shows no movement.`);
    }
    if (rows) {
      for (const r of rows) if (!timeline2.anims[r]) add("error", "missing-animation", r, null, `The sheet includes "${r}", which does not exist.`);
    }
    if (layout2) {
      const expected = (rows || timeline2.order).filter((n) => timeline2.anims[n] && timeline2.anims[n].frames.length);
      const total = expected.reduce((s, n) => s + timeline2.anims[n].frames.length, 0);
      const keys = Object.keys(layout2.json.frames);
      if (keys.length !== total) add("error", "meta-frame-count", null, null, `The atlas lists ${keys.length} frames but the animations have ${total}.`);
      for (const k of keys) {
        const f = layout2.json.frames[k].frame;
        if (f.x < 0 || f.y < 0 || f.x + f.w > layout2.width || f.y + f.h > layout2.height) add("error", "meta-bounds", null, null, `Atlas frame ${k} lies outside the ${layout2.width}\xD7${layout2.height} sheet.`);
        if (f.w !== f.h || f.w % F !== 0) add("error", "meta-size", null, null, `Atlas frame ${k} is ${f.w}\xD7${f.h}, not a whole multiple of the ${F}\xD7${F} frame.`);
      }
      let idx = 0;
      for (const n of expected) {
        const tag = layout2.json.meta.frameTags.find((t) => t.name === n), len = timeline2.anims[n].frames.length;
        if (!tag) add("error", "meta-tag", n, null, `The atlas has no frame tag for ${n}.`);
        else if (tag.from !== idx || tag.to !== idx + len - 1) add("error", "meta-tag", n, null, `The atlas tag for ${n} covers frames ${tag.from}\u2013${tag.to}; expected ${idx}\u2013${idx + len - 1}.`);
        idx += len;
      }
    }
    return { findings, frames, errors: findings.filter((f) => f.level === "error").length, warnings: findings.filter((f) => f.level === "warning").length };
  }

