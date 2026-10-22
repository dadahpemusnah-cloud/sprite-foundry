  // src/core/framedata.js
  var BOX_KINDS = ["hit", "hurt"];
  var MAX_BOXES = 8;
  var MAX_EVENTS = 4;
  var EVENT_NAME = /^[a-z][a-z0-9_-]{0,23}$/;
  var int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  var half = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi && Math.round(v * 2) === v * 2;
  function readFrameData(raw, F) {
    if (raw == null) return { data: null, error: null };
    const bad = (error) => ({ data: null, error });
    if (typeof raw !== "object" || Array.isArray(raw)) return bad("the frame data is invalid");
    const out = {};
    if (raw.pivot != null) {
      if (!Array.isArray(raw.pivot) || raw.pivot.length !== 2 || !raw.pivot.every((v) => half(v, 0, F))) return bad(`the pivot must be two numbers from 0 to ${F} (half pixels allowed)`);
      out.pivot = raw.pivot.slice();
    }
    if (raw.boxes != null) {
      if (!Array.isArray(raw.boxes) || raw.boxes.length > MAX_BOXES) return bad(`up to ${MAX_BOXES} boxes`);
      const boxes = [];
      for (const b of raw.boxes) {
        if (!b || typeof b !== "object" || !BOX_KINDS.includes(b.kind) || !int(b.x, 0, F - 1) || !int(b.y, 0, F - 1) || !int(b.w, 1, F) || !int(b.h, 1, F) || b.x + b.w > F || b.y + b.h > F)
          return bad(`a box must be hit or hurt, with whole-pixel x, y, w, h inside the ${F}\xD7${F} frame`);
        boxes.push({ kind: b.kind, x: b.x, y: b.y, w: b.w, h: b.h });
      }
      if (boxes.length) out.boxes = boxes;
    }
    if (raw.events != null) {
      if (!Array.isArray(raw.events) || raw.events.length > MAX_EVENTS || !raw.events.every((e) => typeof e === "string" && EVENT_NAME.test(e)) || new Set(raw.events).size !== raw.events.length)
        return bad(`up to ${MAX_EVENTS} different events, each a lower-case name (letters, digits, - or _)`);
      if (raw.events.length) out.events = raw.events.slice();
    }
    return { data: Object.keys(out).length ? out : null, error: null };
  }
  function parseEvents(text) {
    const names = String(text || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
    return [...new Set(names)];
  }
  function editFrameData(data, F, change) {
    const next = { ...data || {} };
    if ("pivot" in change) {
      if (change.pivot == null) delete next.pivot;
      else next.pivot = change.pivot.slice();
    }
    if (change.addBox) next.boxes = [...next.boxes || [], { ...change.addBox }];
    if (change.removeBox != null) next.boxes = (next.boxes || []).filter((_, i) => i !== change.removeBox);
    if (change.events) next.events = change.events.slice();
    const r = readFrameData(next, F);
    if (r.error) throw new Error(r.error[0].toUpperCase() + r.error.slice(1) + ".");
    return r.data;
  }
  function exportFrameData(timeline2, rows, F, scale, pivot) {
    let any = false;
    const out = {};
    for (const name of rows) {
      const list = [];
      timeline2.anims[name].frames.forEach((f, i) => {
        if (!f.data) return;
        any = true;
        const p = f.data.pivot || [pivot.x, pivot.y];
        list.push({
          frame: i,
          pivot: { x: p[0], y: p[1], scaled: { x: p[0] * scale, y: p[1] * scale }, normalized: { x: p[0] / F, y: p[1] / F } },
          boxes: (f.data.boxes || []).map((b) => ({ ...b, scaled: { x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale } })),
          events: (f.data.events || []).slice()
        });
      });
      if (list.length) out[name] = list;
    }
    return any ? out : null;
  }

