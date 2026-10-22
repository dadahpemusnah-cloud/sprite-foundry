  // src/workshop/slices.js
  var SLICE_NAME = /^[a-z][a-z0-9_-]{0,23}$/;
  var MAX_SLICES = 16;
  var copy = (s) => ({ ...s, center: s.center ? { ...s.center } : null });
  var slicesOf = (ws) => (ws.slices || []).map(copy);
  var insetsOf = (s) => s.center ? { left: s.center.x, top: s.center.y, right: s.w - s.center.x - s.center.w, bottom: s.h - s.center.y - s.center.h } : { left: 0, top: 0, right: 0, bottom: 0 };
  function addSlice(ws, name, rect) {
    const list = slicesOf(ws);
    if (!SLICE_NAME.test(name)) throw new Error("A slice name starts with a letter: lower-case letters, digits, - and _ (up to 24).");
    if (list.some((s) => s.name === name)) throw new Error(`There is already a slice called ${name}.`);
    if (list.length >= MAX_SLICES) throw new Error(`At most ${MAX_SLICES} slices.`);
    const { w: W, h: H } = ws.size;
    if (!rect || rect.w < 1 || rect.h < 1 || rect.x < 0 || rect.y < 0 || rect.x + rect.w > W || rect.y + rect.h > H) throw new Error("Select the slice's rectangle inside the sprite first.");
    const next = nextWorkshop(ws);
    next.slices = [...list, { name, x: rect.x, y: rect.y, w: rect.w, h: rect.h, center: null }];
    return next;
  }
  function removeSlice(ws, name) {
    if (!(ws.slices || []).some((s) => s.name === name)) return ws;
    const next = nextWorkshop(ws);
    next.slices = slicesOf(ws).filter((s) => s.name !== name);
    if (!next.slices.length) delete next.slices;
    return next;
  }
  function setSliceInsets(ws, name, ins) {
    const list = slicesOf(ws), s = list.find((x) => x.name === name);
    if (!s) return ws;
    const v = ["left", "top", "right", "bottom"].map((k) => ins[k]);
    if (!v.every((n) => Number.isInteger(n) && n >= 0)) throw new Error("Insets are whole pixels, 0 or more.");
    const [l, t, r, b] = v;
    if (l + r >= s.w || t + b >= s.h) throw new Error(`The insets leave no middle: the slice is ${s.w}\xD7${s.h} px.`);
    const center = l || t || r || b ? { x: l, y: t, w: s.w - l - r, h: s.h - t - b } : null;
    if (JSON.stringify(center) === JSON.stringify(s.center)) return ws;
    s.center = center;
    const next = nextWorkshop(ws);
    next.slices = list;
    return next;
  }
  function readSlices(raw, size) {
    if (raw === void 0 || raw === null) return { slices: [] };
    const int3 = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
    if (!Array.isArray(raw) || raw.length > MAX_SLICES) return { error: "slices" };
    const out = [];
    for (const s of raw) {
      if (!s || typeof s !== "object" || typeof s.name !== "string" || !SLICE_NAME.test(s.name) || out.some((o) => o.name === s.name) || !int3(s.x, 0, size.w - 1) || !int3(s.y, 0, size.h - 1) || !int3(s.w, 1, size.w - s.x) || !int3(s.h, 1, size.h - s.y)) return { error: "slices" };
      const c = s.center;
      if (c !== null && c !== void 0 && !(c && int3(c.x, 0, s.w - 1) && int3(c.y, 0, s.h - 1) && int3(c.w, 1, s.w - c.x) && int3(c.h, 1, s.h - c.y))) return { error: `slice ${s.name}, 9-slice center` };
      out.push({ name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, center: c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null });
    }
    return { slices: out };
  }
  function slicesJson(ws, plan) {
    const S = plan.scale, o = plan.offset, sc = (r) => ({ x: r.x * S, y: r.y * S, w: r.w * S, h: r.h * S });
    return slicesOf(ws).map((s) => ({ name: s.name, color: "#0000ffff", keys: [{ frame: 0, bounds: sc({ x: s.x + o.x, y: s.y + o.y, w: s.w, h: s.h }), ...s.center ? { center: sc(s.center) } : {} }] }));
  }
  function godotStyleBox(ws, plan, s, texturePath = `res://${ws.export.name}.png`) {
    const S = plan.scale, cell = plan.cells[0], o = plan.offset, ins = insetsOf(s), f = (v) => (v * S).toFixed(1);
    const x = (cell.x + o.x + s.x) * S, y = (cell.y + o.y + s.y) * S;
    return [
      `[gd_resource type="StyleBoxTexture" load_steps=2 format=3]`,
      "",
      `[ext_resource type="Texture2D" path="${texturePath}" id="1_sheet"]`,
      "",
      "[resource]",
      'texture = ExtResource("1_sheet")',
      `texture_margin_left = ${f(ins.left)}`,
      `texture_margin_top = ${f(ins.top)}`,
      `texture_margin_right = ${f(ins.right)}`,
      `texture_margin_bottom = ${f(ins.bottom)}`,
      `region_rect = Rect2(${x}, ${y}, ${s.w * S}, ${s.h * S})`,
      ""
    ].join("\n");
  }
  var styleBoxFile = (ws, s) => `${ws.export.name}_${s.name}.tres`;

