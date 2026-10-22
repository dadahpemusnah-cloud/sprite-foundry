  // src/ui/workshop-panel.js
  var MODE_KEY = "sprite-foundry-mode";
  var TOOLS = { pencil: "Pencil", eraser: "Eraser", fill: "Fill", picker: "Eyedropper", highlight: "Highlight", shadow: "Shadow", line: "Line", rect: "Rectangle", dither: "Dither", select: "Select", brush: "Brush" };
  var KEYS = { b: "pencil", e: "eraser", g: "fill", i: "picker", h: "highlight", s: "shadow", l: "line", r: "rect", d: "dither", m: "select", k: "brush" };
  var clipboard = null;
  var brush = null;
  var SHADE = { highlight: 1, shadow: -1 };
  var LIGHT_LABEL = { "top-left": "top left", top: "above", "top-right": "top right" };
  function initWorkshopPanel({ onChange, saveFile: saveFile2, sendToRig = null }) {
    const $2 = (s) => document.querySelector(s);
    const st = { variant: "", workshop: null, mode: "foundry", history: createHistory(), frame: 0, tool: "pencil", selection: null, layer: "body", colour: DEFAULT_PALETTE[0], sel: 0, stroke: null, playing: false, timer: null, frames: { undo: [], redo: [] }, shown: [] };
    const foundry = [$2("main.layout"), $2("#importPanel"), $2('section[aria-label="Variations"]')];
    const canvas = $2("#wsCanvas");
    function setMode2(mode, remember = true) {
      st.mode = mode === "workshop" ? "workshop" : "foundry";
      for (const el2 of foundry) el2.hidden = st.mode === "workshop";
      $2("#workshop").hidden = st.mode !== "workshop";
      for (const b of document.querySelectorAll("#modeSwitch button")) b.setAttribute("aria-pressed", String(b.dataset.mode === st.mode));
      if (remember) try {
        localStorage.setItem(MODE_KEY, st.mode);
      } catch (e) {
      }
      stop();
      render();
    }
    for (const b of document.querySelectorAll("#modeSwitch button")) b.addEventListener("click", () => setMode2(b.dataset.mode));
    function change(next) {
      if (next === st.workshop) return false;
      if (st.workshop) {
        st.history.push(st.workshop);
        st.frames.undo.push(st.frame);
        if (st.frames.undo.length > 100) st.frames.undo.shift();
        st.frames.redo.length = 0;
      }
      st.workshop = next;
      render();
      onChange();
      return true;
    }
    function setView(patch) {
      const next = nextWorkshop(st.workshop);
      Object.assign(next.view, patch);
      st.workshop = next;
      render();
      onChange();
    }
    const keepSettings = (w2) => ({ ...w2, view: { ...st.workshop.view, hidden: w2.view.hidden, locked: w2.view.locked }, export: { ...st.workshop.export } });
    const undo2 = () => {
      stop();
      const w2 = st.history.undo(st.workshop);
      if (w2) {
        st.frames.redo.push(st.frame);
        st.frame = st.frames.undo.pop() ?? st.frame;
        st.workshop = keepSettings(w2);
        render();
        onChange();
      }
    };
    const redo2 = () => {
      stop();
      const w2 = st.history.redo(st.workshop);
      if (w2) {
        st.frames.undo.push(st.frame);
        st.frame = st.frames.redo.pop() ?? st.frame;
        st.workshop = keepSettings(w2);
        render();
        onChange();
      }
    };
    $2("#wsCreate").addEventListener("click", () => {
      const size = Number($2("#wsSize").value);
      change(newWorkshop({ size }));
      st.frame = 0;
      st.colour = st.workshop.palette[0];
      st.sel = 0;
      msg(`New ${size}\xD7${size} sprite with one empty frame and the shading-ramps palette.`);
    });
    async function openAseprite(file) {
      try {
        const { workshop, notes } = asepriteToWorkshop(await readAseprite(new Uint8Array(await file.arrayBuffer()), inflate), file.name);
        stop();
        change(workshop);
        st.frame = 0;
        st.sel = 0;
        st.colour = workshop.palette[0];
        st.variant = "";
        render();
        msg(`Opened ${file.name}: ${workshop.layers.length} layer${workshop.layers.length > 1 ? "s" : ""}, ${workshop.clips.length} animation${workshop.clips.length > 1 ? "s" : ""}.${notes.length ? " " + notes.join(" ") : ""}`);
      } catch (err) {
        msg(`${file.name}: ${err.message}`);
      }
    }
    for (const id of ["#wsAseOpen", "#wsAseOpen2"]) $2(id).addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) openAseprite(file);
    });
    $2("#wsUndo").addEventListener("click", undo2);
    $2("#wsRedo").addEventListener("click", redo2);
    function msg(t) {
      $2("#wsMsg").textContent = t || "";
    }
    $2("#wsTools").replaceChildren(...Object.entries(TOOLS).map(([id, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.tool = id;
      b.textContent = label;
      b.title = `${label} (${Object.keys(KEYS).find((k) => KEYS[k] === id).toUpperCase()})`;
      b.addEventListener("click", () => {
        st.tool = id;
        render();
      });
      return b;
    }));
    $2("#wsZoom").replaceChildren(...ZOOMS.map((z) => {
      const o = document.createElement("option");
      o.value = String(z);
      o.textContent = `${z}\xD7`;
      return o;
    }));
    $2("#wsZoom").addEventListener("change", (e) => setView({ zoom: Number(e.target.value) }));
    const stepZoom = (d) => {
      const i = ZOOMS.indexOf(st.workshop.view.zoom), j = Math.max(0, Math.min(ZOOMS.length - 1, i + d));
      if (j !== i) setView({ zoom: ZOOMS[j] });
    };
    $2("#wsZoomOut").addEventListener("click", () => stepZoom(-1));
    $2("#wsZoomIn").addEventListener("click", () => stepZoom(1));
    $2("#wsGrid").addEventListener("change", (e) => setView({ grid: e.target.checked }));
    $2("#wsIso").addEventListener("change", (e) => setView({ isoGuide: e.target.checked }));
    $2("#wsLight").replaceChildren(...LIGHTS.map((l) => {
      const o = document.createElement("option");
      o.value = l;
      o.textContent = LIGHT_LABEL[l];
      return o;
    }));
    $2("#wsLight").addEventListener("change", (e) => setView({ light: e.target.value }));
    const refPics = /* @__PURE__ */ new Map();
    function refPicture(url) {
      let im = refPics.get(url);
      if (!im) {
        im = new Image();
        im.onload = () => draw();
        im.src = url;
        refPics.set(url, im);
      }
      return im.complete && im.naturalWidth ? im : null;
    }
    async function loadReference(file) {
      try {
        const bmp = await createImageBitmap(file), k = Math.min(1, REF_MAX / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(bmp.width * k));
        c.height = Math.max(1, Math.round(bmp.height * k));
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        let image = c.toDataURL("image/png");
        if (image.length > REF_BYTES) image = c.toDataURL("image/jpeg", 0.9);
        change(setReference(st.workshop, { image, w: c.width, h: c.height }));
        msg(`Reference image: ${file.name}${k < 1 ? ` (scaled to ${c.width}\xD7${c.height})` : ""}. It shows under your drawing and is never exported.`);
      } catch (err) {
        msg(`${file.name} could not be used as a reference: ${err.message}`);
      }
    }
    $2("#wsRefFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file && st.workshop) loadReference(file);
    });
    $2("#wsRefShow").addEventListener("change", (e) => change(setReferenceView(st.workshop, { visible: e.target.checked })));
    for (const [id, key] of [["#wsRefOpacity", "opacity"], ["#wsRefX", "x"], ["#wsRefY", "y"], ["#wsRefScale", "scale"]])
      $2(id).addEventListener("change", (e) => {
        const v = Number(e.target.value);
        if (!change(setReferenceView(st.workshop, { [key]: v }))) render();
      });
    $2("#wsRefRemove").addEventListener("click", () => {
      change(setReference(st.workshop, null));
      msg("Reference image removed.");
    });
    function renderReference() {
      const r = st.workshop.reference;
      $2("#wsRefControls").hidden = !r;
      if (!r) return;
      $2("#wsRefShow").checked = r.visible;
      for (const [id, key] of [["#wsRefOpacity", "opacity"], ["#wsRefX", "x"], ["#wsRefY", "y"], ["#wsRefScale", "scale"]]) if (document.activeElement !== $2(id)) $2(id).value = String(r[key]);
      for (const id of ["#wsRefOpacity", "#wsRefX", "#wsRefY", "#wsRefScale"]) $2(id).disabled = !r.visible;
    }
    const at = (e) => {
      const r = canvas.getBoundingClientRect(), z = st.workshop.view.zoom * r.width / canvas.width;
      return [Math.floor((e.clientX - r.left) / z), Math.floor((e.clientY - r.top) / z)];
    };
    canvas.addEventListener("pointerdown", (e) => {
      const w2 = st.workshop;
      if (!w2 || e.button !== 0) return;
      e.preventDefault();
      stop();
      const [x, y] = at(e), { w: W, h: H } = w2.size;
      if (st.tool === "picker") {
        const c = pickColour(w2.frames[st.frame], W, x, y, hiddenMap(w2));
        if (c) {
          st.colour = c;
          st.sel = w2.palette.indexOf(c);
          st.tool = "pencil";
          msg(`Picked ${c}${w2.palette.includes(c) ? "" : " (not in the palette; Add puts it there)"}.`);
          render();
        }
        return;
      }
      const why = blockedReason(w2, st.layer);
      if (why) {
        msg(why);
        return;
      }
      if (st.tool === "brush" && !brush) {
        msg("No brush yet: select some pixels, then Brush from selection.");
        return;
      }
      const px = w2.frames[st.frame].layers[st.layer];
      if (st.tool === "fill") {
        const out = floodFill(px, W, H, x, y, st.colour);
        if (out.some((v, i) => v !== px[i])) change(withLayer(w2, st.frame, st.layer, out));
        return;
      }
      const colour = st.tool === "eraser" ? null : st.colour, dir = SHADE[st.tool] || 0;
      if (st.tool === "select") {
        const r = st.selection, inside = r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
        st.stroke = inside ? { kind: "move", before: px, px, start: [x, y], last: [x, y], rect: r } : { kind: "select", before: px, px, start: [x, y], last: [x, y] };
        if (!inside) st.selection = rectFrom(x, y, x, y, W, H);
      } else st.stroke = { kind: st.tool, before: px, px, start: [x, y], last: [x, y], path: [[x, y]], colour, dir };
      st.stroke.px = strokeAt(st.stroke);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      draw();
    });
    canvas.addEventListener("pointermove", (e) => {
      const s = st.stroke;
      if (!s) return;
      const [x, y] = at(e);
      if (x === s.last[0] && y === s.last[1]) return;
      if (s.path) s.path.push(...linePoints(s.last[0], s.last[1], x, y).slice(1));
      s.last = [x, y];
      if (s.kind === "select") st.selection = rectFrom(s.start[0], s.start[1], x, y, st.workshop.size.w, st.workshop.size.h);
      s.px = strokeAt(s);
      draw();
    });
    const endStroke = () => {
      const s = st.stroke;
      if (!s) return;
      st.stroke = null;
      if (s.kind === "select") {
        render();
        return;
      }
      if (s.kind === "move") {
        const r = s.rect, dx = s.last[0] - s.start[0], dy = s.last[1] - s.start[1];
        st.selection = rectFrom(r.x + dx, r.y + dy, r.x + dx + r.w - 1, r.y + dy + r.h - 1, st.workshop.size.w, st.workshop.size.h);
      }
      if (s.px.some((v, i) => v !== s.before[i])) change(withLayer(st.workshop, st.frame, st.layer, s.px));
      else {
        draw();
        if (s.dir) msg(s.touched ? `No ${s.dir > 0 ? "lighter" : "darker"} colour of the same hue in the palette for ${s.touched}: it is the end of its ramp. Add one to the palette to shade further.` : `Nothing to ${s.dir > 0 ? "highlight" : "shade"} here: the ${layerName(st.layer).toLowerCase()} layer is empty under the brush.`);
      }
    };
    function strokeAt(s) {
      const { w: W, h: H } = st.workshop.size, mirror = (pts2) => mirrorPoints(pts2, W, H, $2("#wsMirror").value);
      if (s.kind === "select") return s.before;
      if (s.kind === "move") return moveRect(s.before, W, H, s.rect, s.last[0] - s.start[0], s.last[1] - s.start[1]);
      if (s.kind === "line") {
        const [x1, y1] = $2("#wsSnap").checked ? snapEnd(s.start[0], s.start[1], s.last[0], s.last[1]) : s.last;
        return paintPoints(s.before, W, H, mirror(linePoints(s.start[0], s.start[1], x1, y1)), s.colour);
      }
      if (s.kind === "rect") return paintPoints(s.before, W, H, mirror(rectPoints(s.start[0], s.start[1], s.last[0], s.last[1], $2("#wsFilled").checked)), s.colour);
      if (s.kind === "brush") return stampPixels(s.before, W, H, s.path, brush, { axis: $2("#wsMirror").value, dither: $2("#wsBrushDither").checked ? DITHER_LEVELS[$2("#wsDither").value] : 0 });
      if (s.kind === "dither") return paintPoints(s.before, W, H, ditherPoints(mirror(s.path), DITHER_LEVELS[$2("#wsDither").value]), s.colour);
      const pts = mirror(!s.dir && $2("#wsPerfect").checked ? pixelPerfect(s.path) : s.path);
      if (!s.dir) return paintPoints(s.before, W, H, pts, s.colour);
      for (const [x, y] of pts) {
        const c = x >= 0 && y >= 0 && x < W && y < H ? s.before[y * W + x] : null;
        if (c && !s.touched) s.touched = c;
      }
      return shadePoints(s.before, s.before, W, H, pts, st.workshop.palette, s.dir, st.workshop.ramps || []);
    }
    const layerPx = () => st.workshop.frames[st.frame].layers[st.layer];
    const editLayer = (fn, done) => {
      const w2 = st.workshop, why = blockedReason(w2, st.layer);
      if (why) {
        msg(why);
        return;
      }
      const px = layerPx(), out = fn(px);
      if (out.some((v, i) => v !== px[i])) {
        change(withLayer(w2, st.frame, st.layer, out));
        msg(done);
      } else msg("Nothing changed.");
    };
    const needSel = () => {
      if (!st.selection) {
        msg("Select an area first (Select tool, M).");
        return false;
      }
      return true;
    };
    $2("#wsCopy").addEventListener("click", () => {
      if (!needSel()) return;
      clipboard = copyRect(layerPx(), st.workshop.size.w, st.selection);
      msg(`Copied ${clipboard.w}\xD7${clipboard.h} px of the ${layerName(st.layer).toLowerCase()} layer.`);
      render();
    });
    $2("#wsCut").addEventListener("click", () => {
      if (!needSel()) return;
      clipboard = copyRect(layerPx(), st.workshop.size.w, st.selection);
      editLayer((px) => clearRect(px, st.workshop.size.w, st.selection), `Cut ${clipboard.w}\xD7${clipboard.h} px.`);
    });
    $2("#wsPaste").addEventListener("click", () => {
      if (!clipboard) {
        msg("Copy something first.");
        return;
      }
      const { w: W, h: H } = st.workshop.size, x = st.selection ? st.selection.x : 0, y = st.selection ? st.selection.y : 0;
      editLayer((px) => pasteClip(px, W, H, clipboard, x, y), `Pasted ${clipboard.w}\xD7${clipboard.h} px on the ${layerName(st.layer).toLowerCase()} layer of frame ${st.frame + 1}; drag it with Select to move it.`);
      st.selection = rectFrom(x, y, x + clipboard.w - 1, y + clipboard.h - 1, W, H);
      draw();
    });
    for (const [id, dir, name] of [["#wsFlipH", "h", "left to right"], ["#wsFlipV", "v", "top to bottom"]]) $2(id).addEventListener("click", () => {
      if (needSel()) editLayer((px) => flipRect(px, st.workshop.size.w, st.workshop.size.h, st.selection, dir), `Flipped the selection ${name}.`);
    });
    $2("#wsDeselect").addEventListener("click", () => {
      st.selection = null;
      render();
    });
    $2("#wsBrushDither").addEventListener("change", () => render());
    $2("#wsMakeBrush").addEventListener("click", () => {
      if (!needSel()) return;
      const b = brushFrom(layerPx(), st.workshop.size.w, st.selection);
      if (!b) {
        msg("The selection has no pixels on the " + layerName(st.layer).toLowerCase() + " layer: nothing to make a brush from.");
        return;
      }
      brush = { ...b, layer: layerName(st.layer) };
      st.tool = "brush";
      msg(`Brush: ${b.w}\xD7${b.h} px from the ${brush.layer.toLowerCase()} layer. Draw with the Brush tool (K).`);
      render();
    });
    $2("#wsSelOut").addEventListener("click", () => {
      const w2 = st.workshop;
      editLayer((px) => selOut(px, w2.size.w, w2.size.h, st.colour, (c) => shadeColour(c, w2.palette, -1)), `Sel-out: outline pixels of ${st.colour} now take a darker shade of the colour inside them.`);
    });
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    const layerName = (id) => {
      const l = st.workshop.layers.find((x) => x.id === id);
      return l ? l.name : id;
    };
    const tryChange = (fn, done) => {
      try {
        const r = fn();
        if (change(r.ws || r)) msg(done);
        return r;
      } catch (e) {
        msg(e.message);
        return null;
      }
    };
    function renderLayers2() {
      const w2 = st.workshop, layers = w2.layers;
      if (!layers.some((l) => l.id === st.layer)) st.layer = layers[layers.length - 1].id;
      $2("#wsLayers").replaceChildren(...layers.slice().reverse().map((L, k) => {
        const l = L.id, at2 = layers.length - 1 - k;
        const row = document.createElement("div");
        row.className = "ws-layer";
        const pick = document.createElement("label");
        pick.className = "ws-check";
        const r = document.createElement("input");
        r.type = "radio";
        r.name = "wsLayer";
        r.value = l;
        r.checked = st.layer === l;
        r.setAttribute("aria-label", L.name);
        r.addEventListener("change", () => {
          st.layer = l;
          msg("");
          render();
        });
        pick.append(r, ` ${L.name}`);
        const flag = (name, text) => {
          const lab = document.createElement("label");
          lab.className = "ws-check";
          const c = document.createElement("input");
          c.type = "checkbox";
          c.checked = w2.view[name].includes(l);
          c.setAttribute("aria-label", `${text} ${L.name.toLowerCase()} layer`);
          c.addEventListener("change", () => change(setLayerFlag(st.workshop, l, name, c.checked)));
          lab.append(c, ` ${text}`);
          return lab;
        };
        const btn = (text, label, fn, off2 = false) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = text;
          b.setAttribute("aria-label", label);
          b.disabled = off2;
          b.addEventListener("click", fn);
          return b;
        };
        row.append(
          pick,
          flag("hidden", "Hide"),
          flag("locked", "Lock"),
          btn("\u25B2", `Move ${L.name} layer forward`, () => tryChange(() => moveLayer2(st.workshop, l, 1), `${L.name} moved forward.`), at2 === layers.length - 1),
          btn("\u25BC", `Move ${L.name} layer back`, () => tryChange(() => moveLayer2(st.workshop, l, -1), `${L.name} moved back.`), at2 === 0),
          btn("Rename", `Rename ${L.name} layer`, () => {
            const n = prompt("Layer name", L.name);
            if (n !== null) tryChange(() => renameLayer(st.workshop, l, n), `Renamed to ${n.trim()}.`);
          }),
          btn("\u2715", `Remove ${L.name} layer`, () => {
            const drawn = clipList(st.workshop).some((c) => c.frames.some((f) => f.layers[l].some(Boolean)));
            if (drawn && !confirm(`Remove the ${L.name} layer and everything drawn on it, in every frame of every animation?`)) return;
            tryChange(() => deleteLayer(st.workshop, l), `Removed the ${L.name} layer.`);
          }, layers.length <= 1)
        );
        return row;
      }));
      $2("#wsLayerAdd").disabled = layers.length >= MAX_LAYERS;
    }
    $2("#wsLayerAdd").addEventListener("click", () => {
      const name = $2("#wsLayerName").value.trim() || `Layer ${st.workshop.layers.length + 1}`;
      const r = tryChange(() => addLayer(st.workshop, name, st.layer), `Added the ${name} layer above ${layerName(st.layer)}.`);
      if (r) {
        st.layer = r.id;
        $2("#wsLayerName").value = "";
        render();
      }
    });
    function showClip(i) {
      const next = selectClip(st.workshop, i);
      if (next === st.workshop) return;
      stop();
      st.workshop = next;
      st.frame = Math.min(st.frame, next.frames.length - 1);
      st.selection = null;
      render();
      onChange();
    }
    const curClip = () => st.workshop.clips[st.workshop.active];
    function renderClips() {
      const w2 = st.workshop, c = curClip(), names = animationNames(w2);
      $2("#wsAnim").replaceChildren(...names.map((n) => new Option(n, n)));
      $2("#wsAnim").value = c.name;
      $2("#wsAnimDel").disabled = names.length <= 1;
      $2("#wsDirs").value = String(w2.directions.length);
      $2("#wsDirTabs").hidden = w2.directions.length < 2;
      $2("#wsViews").hidden = w2.directions.length < 2;
      const marks = w2.mirrored || {};
      $2("#wsDirTabs").replaceChildren(...w2.directions.map((d) => {
        const b = document.createElement("button");
        b.type = "button";
        const from = marks[mirrorKey(c.name, d)];
        b.textContent = d + (from ? " \u21CB" : "");
        if (from) b.title = `Mirrored by you from ${from}`;
        b.setAttribute("aria-pressed", String(d === c.dir));
        b.setAttribute("aria-label", "Direction " + d + (from ? `, mirrored by you from ${from}` : ""));
        b.addEventListener("click", () => showClip(clipIndex(st.workshop, c.name, d)));
        return b;
      }));
      const to = MIRROR_OF[c.dir], can = !!to && w2.directions.includes(to);
      $2("#wsMirrorDir").hidden = !can;
      if (can) $2("#wsMirrorDir").textContent = `Mirror to ${to}`;
      $2("#wsMirrorNote").textContent = marks[mirrorKey(c.name, c.dir)] ? `${c.dir}: mirrored by you from ${marks[mirrorKey(c.name, c.dir)]}.` : "";
      const all = clipList(w2);
      $2("#wsViews").replaceChildren(...w2.directions.map((d) => {
        const clip2 = all[clipIndex(w2, c.name, d)], f = clip2.frames[Math.min(st.frame, clip2.frames.length - 1)], b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `View ${d}`);
        b.setAttribute("aria-pressed", String(d === c.dir));
        const cv = document.createElement("canvas");
        cv.width = w2.size.w;
        cv.height = w2.size.h;
        cv.getContext("2d").drawImage(toCanvas(composite(f, hiddenMap(w2)), w2.size.w), 0, 0);
        const cap = document.createElement("span");
        cap.textContent = d;
        b.append(cv, cap);
        b.addEventListener("click", () => showClip(clipIndex(st.workshop, c.name, d)));
        return b;
      }));
    }
    $2("#wsAnim").addEventListener("change", (e) => {
      const c = curClip();
      let i = clipIndex(st.workshop, e.target.value, c.dir);
      if (i < 0) i = st.workshop.clips.findIndex((x) => x.name === e.target.value);
      showClip(i);
    });
    $2("#wsAnimNew").addEventListener("click", () => {
      const n = prompt("New animation name (lower case, e.g. walk)", "");
      if (n === null) return;
      const r = tryChange(() => addAnimation(st.workshop, n), `New animation ${String(n).trim().toLowerCase()}: one empty frame in every direction.`);
      if (r) {
        st.frame = 0;
        render();
      }
    });
    $2("#wsAnimRename").addEventListener("click", () => {
      const c = curClip(), n = prompt("Rename the animation", c.name);
      if (n !== null) tryChange(() => renameAnimation(st.workshop, c.name, n), `Renamed to ${String(n).trim().toLowerCase()}.`);
    });
    $2("#wsAnimDel").addEventListener("click", () => {
      const c = curClip();
      if (!confirm(`Remove the animation ${c.name} in every direction?`)) return;
      tryChange(() => deleteAnimation(st.workshop, c.name), `Removed ${c.name}.`);
      st.frame = 0;
      render();
    });
    $2("#wsDirs").addEventListener("change", (e) => {
      const n = Number(e.target.value), lost = drawnClipsLost(st.workshop, n);
      if (lost.length && !confirm(`Going to ${n} direction${n > 1 ? "s" : ""} removes drawn animations: ${lost.join(", ")}. Continue?`)) {
        render();
        return;
      }
      tryChange(() => setDirections(st.workshop, n), n > 1 ? `${n} directions: each animation has a row per direction; new ones start empty.` : "One direction.");
      render();
    });
    function renderPalette() {
      const w2 = st.workshop;
      $2("#wsSwatches").replaceChildren(...w2.palette.map((c, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.style.background = c;
        b.setAttribute("aria-label", `Colour ${i + 1} ${c}`);
        b.setAttribute("aria-pressed", String(i === st.sel && c === st.colour));
        b.addEventListener("click", () => {
          st.colour = c;
          st.sel = i;
          if (st.tool === "eraser" || st.tool === "picker") st.tool = "pencil";
          render();
        });
        return b;
      }));
      $2("#wsCurrent").style.background = st.colour;
      $2("#wsCurrentLabel").textContent = st.colour + (w2.palette.includes(st.colour) ? "" : " (not in the palette)");
      $2("#wsColour").value = st.colour;
    }
    $2("#wsColourAdd").addEventListener("click", () => {
      const c = $2("#wsColour").value.toLowerCase();
      if (st.workshop.palette.includes(c)) {
        msg(`${c} is already in the palette.`);
        return;
      }
      if (change(addColour(st.workshop, c))) {
        st.colour = c;
        st.sel = st.workshop.palette.length - 1;
        msg(`Added ${c}.`);
        render();
      } else msg("The palette is full (64 colours).");
    });
    $2("#wsColourSet").addEventListener("click", () => {
      const c = $2("#wsColour").value.toLowerCase(), i = st.sel, old = st.workshop.palette[i];
      if (old === void 0) {
        msg("Pick a palette colour first.");
        return;
      }
      if (change(setColour(st.workshop, i, c))) {
        st.colour = c;
        msg(`Colour ${i + 1} is now ${c}. Pixels already drawn in ${old} keep it.`);
        render();
      } else msg(c === old ? "" : `${c} is already in the palette.`);
    });
    $2("#wsColourDel").addEventListener("click", () => {
      const i = st.sel, c = st.workshop.palette[i];
      if (c === void 0) {
        msg("Pick a palette colour first.");
        return;
      }
      if (change(removeColour(st.workshop, i))) {
        st.sel = Math.min(i, st.workshop.palette.length - 1);
        st.colour = st.workshop.palette[st.sel];
        msg(`Removed ${c} from the palette. Pixels drawn in it keep it.`);
        render();
      } else msg("The palette needs at least one colour.");
    });
    const PRESETS4 = [["ramps", "Shading ramps", DEFAULT_PALETTE], ...Object.entries(PALETTES).filter(([k]) => k !== "custom").map(([k, p]) => [k, k, p.colors])];
    $2("#wsPalPreset").replaceChildren(...PRESETS4.map(([k, label]) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = label;
      return o;
    }));
    $2("#wsPalLoad").addEventListener("click", () => {
      const p = PRESETS4.find(([k]) => k === $2("#wsPalPreset").value);
      if (change(replacePalette(st.workshop, p[2]))) {
        st.sel = 0;
        st.colour = st.workshop.palette[0];
        msg(`The palette is now ${p[1]} (${st.workshop.palette.length} colours). Pixels already drawn keep their colours.`);
        render();
      }
    });
    const wsRamp = () => buildRamp($2("#wsRampBase").value, Number($2("#wsRampSteps").value), { hueShift: Number($2("#wsRampShift").value) });
    function wsRampPreview() {
      $2("#wsRampPreview").replaceChildren(...wsRamp().map((c) => {
        const e = document.createElement("span");
        e.style.background = c;
        e.title = c;
        return e;
      }));
    }
    for (const id of ["#wsRampBase", "#wsRampSteps", "#wsRampShift"]) $2(id).addEventListener("input", wsRampPreview);
    wsRampPreview();
    $2("#wsRampAdd").addEventListener("click", () => {
      if (!st.workshop) return;
      try {
        const r = addRamp(st.workshop, wsRamp());
        if (r.ws === st.workshop) {
          msg("That ramp is already in the palette.");
          return;
        }
        change(r.ws);
        msg(`Added a ramp of ${wsRamp().length} (${r.added} new colours). Highlight and Shadow step along it.`);
        render();
      } catch (err) {
        msg(err.message);
      }
    });
    $2("#wsMirrorDir").addEventListener("click", () => {
      const w2 = st.workshop;
      if (!w2) return;
      const c = clipList(w2)[w2.active || 0];
      try {
        const r = mirrorDirection(w2, c.name, c.dir);
        change(r.ws);
        const asym = r.asymmetric === null ? " There is no front view (S) to check which layers are one-sided: look over the copy." : r.asymmetric.length ? ` Not the same both ways in the front view, so they now show on the other side: ${r.asymmetric.join(", ")}.` : " Every layer is the same both ways in the front view.";
        msg(`${c.name} ${r.to} is now your ${c.dir} drawing mirrored (marked "mirrored by you").${asym}`);
        render();
      } catch (err) {
        msg(err.message);
      }
    });
    $2("#wsReplace").addEventListener("click", () => {
      const w2 = st.workshop;
      if (!w2) return;
      const from = st.colour, to = $2("#wsReplaceTo").value.toLowerCase(), scope = $2("#wsReplaceScope").value;
      if (from === to) {
        msg("Choose a different colour to replace it with.");
        return;
      }
      const r = replaceColour(w2, from, to, scope, st.frame);
      const where = { frame: "this frame", anim: "this animation", all: "every animation" }[scope];
      const left = r.skipped ? ` ${r.skipped} on hidden or locked layers were left alone.` : "";
      if (!r.count) {
        msg(`No ${from} pixels to replace in ${where}.${left}`);
        return;
      }
      change(r.ws);
      st.colour = to;
      msg(`Replaced ${r.count} pixel${r.count > 1 ? "s" : ""} of ${from} with ${to} in ${where}.${left}${w2.palette.includes(to) ? "" : " (" + to + " is not in the palette.)"}`);
      render();
    });
    $2("#wsPalFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file || !st.workshop) return;
      try {
        const r = paletteColours(readPaletteFile(file.name, await file.text()), 64);
        if (!r.colours.length) {
          msg("That palette file has no colours.");
          return;
        }
        change(replacePalette(st.workshop, r.colours));
        st.sel = 0;
        st.colour = st.workshop.palette[0];
        msg(`${file.name}: ${r.colours.length} colours${r.duplicates ? `, ${r.duplicates} repeated left out` : ""}${r.dropped ? `, ${r.dropped} over the 64-colour limit left out` : ""}. Pixels already drawn keep their colours.`);
        render();
      } catch (err) {
        msg(err.message);
      }
    });
    $2("#wsPalSave").addEventListener("click", () => {
      if (!st.workshop) return;
      const fmt2 = $2("#wsPalFormat").value;
      saveFile2("workshop-palette." + fmt2, new Blob([writePaletteFile(fmt2, asPalette(st.workshop.palette, "Sprite Foundry Workshop"))], { type: "text/plain" }));
    });
    document.addEventListener("keydown", (e) => {
      if (st.mode !== "workshop" || !st.workshop) return;
      if (e.target.closest && e.target.closest("#helpPanel")) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && (k === "y" || k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo2();
        return;
      }
      if (mod && k === "z") {
        e.preventDefault();
        undo2();
        return;
      }
      if (!mod && !e.altKey && KEYS[k]) {
        st.tool = KEYS[k];
        render();
        return;
      }
      if (tag === "button") return;
      if (e.key === " ") {
        e.preventDefault();
        st.playing ? stop() : play2();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const n = st.workshop.frames.length;
        selectFrame2((st.frame + (e.key === "ArrowRight" ? 1 : -1) + n) % n);
      }
    });
    function draw() {
      const w2 = st.workshop;
      if (!w2) return;
      const { w: W, h: H } = w2.size, z = w2.view.zoom, ctx = canvas.getContext("2d");
      canvas.width = W * z;
      canvas.height = H * z;
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        ctx.fillStyle = (x + y) / 2 % 2 ? "#d7dbe5" : "#eef0f5";
        ctx.fillRect(x * z, y * z, 2 * z, 2 * z);
      }
      const ref = w2.reference && w2.reference.visible ? refPicture(w2.reference.image) : null;
      if (ref) {
        const rr = referenceRect(w2);
        ctx.globalAlpha = w2.reference.opacity;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(ref, rr.x * z, rr.y * z, rr.w * z, rr.h * z);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
      }
      if (w2.view.onion && !st.playing) {
        const v = w2.view, op = v.onionOpacity ?? 0.35;
        for (const o of onionFrames(w2.frames.length, st.frame, { back: v.onionBack ?? 1, ahead: v.onionNext ? v.onionAhead ?? 1 : 0, loop: w2.loop, opacity: op, aheadRatio: 0.2 / 0.35 })) {
          const cv = toCanvas(composite(w2.frames[o.frame], hiddenMap(w2)), W);
          ctx.globalAlpha = o.alpha;
          ctx.drawImage(v.onionTint === "redblue" ? tinted(cv, TINT[o.side]) : cv, 0, 0, W * z, H * z);
          ctx.globalAlpha = 1;
        }
      }
      let frame = w2.frames[st.frame];
      if (st.stroke) frame = { ...frame, layers: { ...frame.layers, [st.layer]: st.stroke.px } };
      ctx.drawImage(toCanvas(composite(frame, hiddenMap(w2)), W), 0, 0, W * z, H * z);
      if (w2.view.grid && z >= 6) {
        ctx.strokeStyle = "rgba(40,50,70,.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < W; x++) {
          ctx.moveTo(x * z + 0.5, 0);
          ctx.lineTo(x * z + 0.5, H * z);
        }
        for (let y = 1; y < H; y++) {
          ctx.moveTo(0, y * z + 0.5);
          ctx.lineTo(W * z, y * z + 0.5);
        }
        ctx.stroke();
      }
      const r = Math.max(4, z * 0.7), sx = { "top-left": r + 4, top: W * z / 2, "top-right": W * z - r - 4 }[w2.view.light], sy = r + 4;
      ctx.fillStyle = "rgba(255,200,40,.9)";
      ctx.strokeStyle = "rgba(150,100,0,.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const cx = W * z / 2, cy = H * z / 2, len = Math.hypot(cx - sx, cy - sy), ux = (cx - sx) / len, uy = (cy - sy) / len;
      ctx.beginPath();
      ctx.moveTo(sx + ux * (r + 3), sy + uy * (r + 3));
      ctx.lineTo(sx + ux * (r + 3 + 3 * r), sy + uy * (r + 3 + 3 * r));
      ctx.stroke();
      if (w2.view.isoGuide) {
        ctx.strokeStyle = "rgba(70,110,200,.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const s of isoGuideSegments(W, H)) {
          ctx.moveTo(s.x0 * z, s.y0 * z);
          ctx.lineTo(s.x1 * z, s.y1 * z);
        }
        ctx.stroke();
      }
      for (const s of slicesOf(w2)) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(200,0,200,.85)";
        ctx.setLineDash([]);
        ctx.strokeRect(s.x * z + 0.5, s.y * z + 0.5, s.w * z - 1, s.h * z - 1);
        if (s.center) {
          const c = s.center;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          for (const X of [s.x + c.x, s.x + c.x + c.w]) {
            ctx.moveTo(X * z + 0.5, s.y * z);
            ctx.lineTo(X * z + 0.5, (s.y + s.h) * z);
          }
          for (const Y of [s.y + c.y, s.y + c.y + c.h]) {
            ctx.moveTo(s.x * z, Y * z + 0.5);
            ctx.lineTo((s.x + s.w) * z, Y * z + 0.5);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      const sel = st.stroke && st.stroke.kind === "move" ? { ...st.stroke.rect, x: st.stroke.rect.x + st.stroke.last[0] - st.stroke.start[0], y: st.stroke.rect.y + st.stroke.last[1] - st.stroke.start[1] } : st.selection;
      if (sel) {
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        for (const [c, o] of [["#fff", 0], ["#111", 3.5]]) {
          ctx.strokeStyle = c;
          ctx.lineDashOffset = o;
          ctx.strokeRect(sel.x * z + 0.5, sel.y * z + 0.5, sel.w * z - 1, sel.h * z - 1);
        }
        ctx.setLineDash([]);
      }
    }
    function selectFrame2(i) {
      stop();
      st.frame = i;
      msg("");
      render();
    }
    const frameOp = (next, frame) => {
      stop();
      if (change(next)) {
        st.frame = frame;
        render();
      }
    };
    $2("#wsFrameAdd").addEventListener("click", () => frameOp(addFrame(st.workshop, st.frame), st.frame + 1));
    $2("#wsFrameDup").addEventListener("click", () => frameOp(duplicateFrame2(st.workshop, st.frame), st.frame + 1));
    $2("#wsFrameLink").addEventListener("click", () => frameOp(linkFrame(st.workshop, st.frame), st.frame + 1));
    $2("#wsFrameUnlink").addEventListener("click", () => frameOp(unlinkFrame(st.workshop, st.frame), st.frame));
    $2("#wsFrameDel").addEventListener("click", () => frameOp(deleteFrame2(st.workshop, st.frame), Math.max(0, st.frame - 1)));
    $2("#wsFrameLeft").addEventListener("click", () => frameOp(moveFrame2(st.workshop, st.frame, -1), st.frame - 1));
    $2("#wsFrameRight").addEventListener("click", () => frameOp(moveFrame2(st.workshop, st.frame, 1), st.frame + 1));
    $2("#wsDur").addEventListener("change", (e) => {
      const v = e.target.value.trim(), want = v === "" ? null : Math.round(Number(v));
      const next = setFrameDuration2(st.workshop, st.frame, want);
      if (next === st.workshop && want !== st.workshop.frames[st.frame].dur) msg("A frame time is 10 to 10000 ms, or empty to follow the FPS.");
      if (!change(next)) render();
      e.target.value = st.workshop.frames[st.frame].dur === null ? "" : String(st.workshop.frames[st.frame].dur);
    });
    $2("#wsFps").addEventListener("change", (e) => {
      const want = Math.round(Number(e.target.value)), next = setFps(st.workshop, want);
      if (next === st.workshop && want !== st.workshop.fps) msg("FPS is 1 to 60.");
      if (!change(next)) render();
      e.target.value = String(st.workshop.fps);
    });
    $2("#wsLoop").addEventListener("change", (e) => change(setLoop(st.workshop, e.target.checked)));
    $2("#wsMode").addEventListener("change", (e) => change(setMode(st.workshop, e.target.value)));
    $2("#wsRepeat").addEventListener("change", (e) => {
      const v = Number(e.target.value);
      if (!(Number.isInteger(v) && v >= 1 && v <= 99)) {
        msg("Repeat must be 1 to 99 times.");
        render();
        return;
      }
      change(setRepeat(st.workshop, v));
    });
    $2("#wsOnion").addEventListener("change", (e) => setView({ onion: e.target.checked }));
    $2("#wsOnionNext").addEventListener("change", (e) => setView({ onionNext: e.target.checked }));
    for (const [id, key, num3] of [["#wsOnionBack", "onionBack", true], ["#wsOnionAhead", "onionAhead", true], ["#wsOnionTint", "onionTint", false], ["#wsOnionOpacity", "onionOpacity", true]])
      $2(id).addEventListener("change", (e) => setView({ [key]: num3 ? Number(e.target.value) : e.target.value }));
    $2("#wsPlay").addEventListener("click", () => st.playing ? stop() : play2());
    function play2() {
      const w2 = st.workshop;
      if (!w2) return;
      const o = playOpts(w2), seq = playSequence(w2.frames.length, o);
      if (!w2.loop && seq[seq.length - 1] === st.frame) {
        st.pos = 0;
        st.frame = seq[0];
      } else st.pos = posOf(st.frame, w2.frames.length, o);
      st.playing = true;
      st.shown = [st.frame];
      render();
      const tick2 = () => {
        if (!st.playing) return;
        const ws = st.workshop, r = step(st.pos, ws.frames.length, playOpts(ws));
        if (r.done) {
          stop();
          return;
        }
        st.pos = r.pos;
        st.frame = r.frame;
        st.shown.push(r.frame);
        render();
        st.timer = setTimeout(tick2, frameDuration(st.workshop, st.frame));
      };
      st.timer = setTimeout(tick2, frameDuration(w2, st.frame));
    }
    function stop() {
      if (st.timer) clearTimeout(st.timer);
      st.timer = null;
      if (st.playing) {
        st.playing = false;
        render();
      }
    }
    const thumbs2 = /* @__PURE__ */ new WeakMap();
    function thumbOf(w2, f) {
      const key = w2.view.hidden.join(), had = thumbs2.get(f);
      if (had && had.key === key) return had.canvas;
      const c = document.createElement("canvas");
      c.width = w2.size.w;
      c.height = w2.size.h;
      c.getContext("2d").drawImage(toCanvas(composite(f, hiddenMap(w2)), w2.size.w), 0, 0);
      thumbs2.set(f, { key, canvas: c });
      return c;
    }
    function renderFrames() {
      const w2 = st.workshop;
      $2("#wsStrip").replaceChildren(...w2.frames.map((f2, i) => {
        const b = document.createElement("button");
        b.type = "button";
        const links = linkedWith(w2, i);
        b.setAttribute("aria-label", "Frame " + (i + 1) + " (" + frameDuration(w2, i) + " ms)" + (links.length ? ", linked with frame " + links.map((j) => j + 1).join(", ") : ""));
        b.setAttribute("aria-pressed", String(i === st.frame));
        let c = thumbOf(w2, f2);
        if (w2.frames.indexOf(f2) !== i) {
          const d = document.createElement("canvas");
          d.width = c.width;
          d.height = c.height;
          d.getContext("2d").drawImage(c, 0, 0);
          c = d;
        }
        const t = document.createElement("span");
        t.textContent = String(i + 1) + (links.length ? " \u26D3" : "");
        if (links.length) {
          t.className = "ws-linked";
          t.title = "Linked with frame " + links.map((j) => j + 1).join(", ") + ": drawing on one changes all";
        }
        b.append(c, t);
        b.addEventListener("click", () => selectFrame2(i));
        return b;
      }));
      const f = w2.frames[st.frame];
      if (document.activeElement !== $2("#wsDur")) $2("#wsDur").value = f.dur === null ? "" : String(f.dur);
      $2("#wsDurInfo").textContent = f.dur === null ? "auto: " + frameDuration(w2, st.frame) + " ms (" + w2.fps + " fps)" : "own time";
      if (document.activeElement !== $2("#wsFps")) $2("#wsFps").value = String(w2.fps);
      $2("#wsMode").value = w2.mode || "forward";
      if (document.activeElement !== $2("#wsRepeat")) $2("#wsRepeat").value = String(w2.repeat || 1);
      $2("#wsRepeat").disabled = w2.loop;
      $2("#wsLoop").checked = w2.loop;
      $2("#wsOnion").checked = w2.view.onion;
      $2("#wsOnionNext").checked = w2.view.onionNext;
      $2("#wsOnionNext").disabled = !w2.view.onion;
      $2("#wsOnionBack").value = String(w2.view.onionBack ?? 1);
      $2("#wsOnionAhead").value = String(w2.view.onionAhead ?? 1);
      $2("#wsOnionTint").value = w2.view.onionTint ?? "none";
      $2("#wsOnionOpacity").value = String(w2.view.onionOpacity ?? 0.35);
      for (const id of ["#wsOnionBack", "#wsOnionTint", "#wsOnionOpacity"]) $2(id).disabled = !w2.view.onion;
      $2("#wsOnionAhead").disabled = !w2.view.onion || !w2.view.onionNext;
      $2("#wsPlay").textContent = st.playing ? "Stop" : "Play";
      $2("#wsFrameDel").disabled = w2.frames.length < 2;
      $2("#wsFrameUnlink").disabled = !linkedWith(w2, st.frame).length;
      $2("#wsFrameLeft").disabled = st.frame === 0;
      $2("#wsFrameRight").disabled = st.frame === w2.frames.length - 1;
    }
    $2("#wsExScale").replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = n + "\xD7";
      return o;
    }));
    const EX = { wsExCellW: "cellW", wsExCellH: "cellH", wsExCols: "columns", wsExSpacing: "spacing", wsExMargin: "margin", wsExScale: "scale" };
    const LIMIT = { cellW: () => [st.workshop.size.w, 512], cellH: () => [st.workshop.size.h, 512], columns: () => [0, 64], spacing: () => [0, 64], margin: () => [0, 64], scale: () => [1, 8] };
    const NAMES2 = { cellW: "The cell width", cellH: "The cell height", columns: "Columns", spacing: "Spacing", margin: "The margin", scale: "The scale" };
    for (const [id, key] of Object.entries(EX)) $2("#" + id).addEventListener("change", (e) => {
      const v = Number(e.target.value), [lo, hi] = LIMIT[key]();
      if (!Number.isInteger(v) || v < lo || v > hi) {
        msg(NAMES2[key] + " is " + lo + " to " + hi + (key.startsWith("cell") ? " (the cell holds the whole sprite)" : "") + ".");
        renderExport(true);
        return;
      }
      setExport({ [key]: v });
    });
    $2("#wsExName").addEventListener("change", (e) => {
      const v = e.target.value.trim();
      if (!EXPORT_NAME.test(v)) {
        msg("A name is 1 to 32 letters, digits, - or _, starting with a letter or digit.");
        renderExport(true);
        return;
      }
      setExport({ name: v });
    });
    function setExport(patch) {
      const next = nextWorkshop(st.workshop);
      Object.assign(next.export, patch);
      if (JSON.stringify(next.export) === JSON.stringify(st.workshop.export)) return;
      st.workshop = next;
      msg("");
      render();
      onChange();
    }
    function logicalCanvas(w2, plan, variant = null) {
      const c = document.createElement("canvas");
      c.width = plan.logical.w;
      c.height = plan.logical.h;
      const id = c.getContext("2d").createImageData(plan.logical.w, plan.logical.h);
      const px = sheetPixels(w2, plan);
      (variant ? mapPixels(px, variant.map) : px).forEach((col, i) => {
        if (!col) return;
        const n = parseInt(col.slice(1), 16);
        id.data.set([n >> 16 & 255, n >> 8 & 255, n & 255, 255], i * 4);
      });
      c.getContext("2d").putImageData(id, 0, 0);
      return c;
    }
    function sheetCanvas(variant = null) {
      const w2 = st.workshop, plan = sheetPlan2(w2), logical = logicalCanvas(w2, plan, variant);
      if (plan.scale === 1) return { canvas: logical, plan };
      const big = document.createElement("canvas");
      big.width = plan.width;
      big.height = plan.height;
      const ctx = big.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(logical, 0, 0, plan.width, plan.height);
      return { canvas: big, plan };
    }
    const pngBlob = (c) => new Promise((r) => c.toBlob(r, "image/png"));
    $2("#wsToRig").addEventListener("click", async () => {
      const w2 = st.workshop;
      if (!w2 || !sendToRig) return;
      const px = composite(w2.frames[st.frame]);
      if (!px.some(Boolean)) {
        msg("This frame is empty: draw something first.");
        return;
      }
      const c = document.createElement("canvas");
      c.width = w2.size.w;
      c.height = w2.size.h;
      c.getContext("2d").drawImage(toCanvas(px, w2.size.w), 0, 0);
      const clip2 = w2.clips[w2.active], name = `${w2.export.name}-${clip2.name}-${clip2.dir.toLowerCase()}-${st.frame + 1}`;
      const colours = [.../* @__PURE__ */ new Set([...w2.palette, ...px.filter(Boolean)])];
      const blob = await pngBlob(c), file = new File([blob], name + ".png", { type: "image/png" });
      setMode2("foundry");
      await sendToRig({ file, size: w2.size.w, colours, name, dir: clip2.dir });
    });
    async function exportFiles() {
      const w2 = st.workshop, { canvas: c, plan } = sheetCanvas();
      const variants2 = [];
      for (const v of w2.variants || []) variants2.push({ name: v.name, file: `${w2.export.name}_${v.name}.png`, png: await pngBlob(sheetCanvas(v).canvas) });
      const styleBoxes = slicesOf(w2).map((s) => ({ file: styleBoxFile(w2, s), text: godotStyleBox(w2, plan, s) }));
      return { name: w2.export.name, plan, png: await pngBlob(c), json: JSON.stringify(atlasJson(w2, plan), null, 1), readme: readme(w2, plan), variants: variants2, styleBoxes };
    }
    const shownVariant2 = () => st.workshop ? variantByName(st.workshop.variants, st.variant) : null;
    $2("#wsSavePng").addEventListener("click", async () => {
      const w2 = st.workshop, v = shownVariant2();
      if (!v) {
        const x = await exportFiles();
        await saveFile2(x.name + ".png", x.png);
        return;
      }
      await saveFile2(`${w2.export.name}_${v.name}.png`, await pngBlob(sheetCanvas(v).canvas));
    });
    $2("#wsSaveJson").addEventListener("click", async () => {
      const x = await exportFiles();
      await saveFile2(x.name + ".json", new Blob([x.json], { type: "application/json" }));
    });
    $2("#wsSaveAse").addEventListener("click", async () => {
      const w2 = st.workshop;
      if (!w2) return;
      await saveFile2(w2.export.name + ".aseprite", new Blob([await writeAseprite(workshopToAseprite(w2), deflate)], { type: "application/octet-stream" }));
    });
    $2("#wsSaveZip").addEventListener("click", async () => {
      if (!window.JSZip) {
        msg("The zip library did not load. Save the PNG and JSON separately.");
        return;
      }
      const x = await exportFiles(), zip = new window.JSZip();
      zip.file(x.name + ".png", x.png);
      zip.file(x.name + ".json", x.json);
      zip.file("README.txt", x.readme);
      for (const v of x.variants) zip.file(v.file, v.png);
      for (const b of x.styleBoxes) zip.file(b.file, b.text);
      await saveFile2(x.name + "_sheet.zip", await zip.generateAsync({ type: "blob" }));
    });
    $2("#wsSliceAdd").addEventListener("click", () => {
      const name = $2("#wsSliceName").value.trim();
      if (!needSel()) return;
      try {
        change(addSlice(st.workshop, name, st.selection));
        $2("#wsSliceName").value = "";
        msg(`Slice ${name}: ${st.selection.w}\xD7${st.selection.h} px at ${st.selection.x}, ${st.selection.y}.`);
      } catch (e) {
        msg(e.message);
      }
    });
    const SIDES = [["left", "L"], ["top", "T"], ["right", "R"], ["bottom", "B"]];
    let slicesShown = null, slicesBusy = false;
    function renderSlices() {
      const w2 = st.workshop;
      $2("#wsSliceAdd").disabled = !st.selection;
      const sig = JSON.stringify(w2.slices || []);
      if (slicesBusy) return;
      if (sig === slicesShown) {
        for (const s of slicesOf(w2)) {
          const ins = insetsOf(s);
          for (const [k] of SIDES) {
            const i = document.querySelector(`#wsSlices input[aria-label="${s.name} inset ${k}"]`);
            if (i && document.activeElement !== i) i.value = String(ins[k]);
          }
        }
        return;
      }
      slicesBusy = true;
      slicesShown = sig;
      try {
        renderSliceRows(w2);
      } finally {
        slicesBusy = false;
      }
    }
    function renderSliceRows(w2) {
      $2("#wsSlices").replaceChildren(...slicesOf(w2).map((s) => {
        const row = document.createElement("div");
        row.className = "ws-row";
        row.dataset.slice = s.name;
        const t = document.createElement("span");
        t.className = "mono";
        t.textContent = `${s.name} ${s.w}\xD7${s.h} at ${s.x},${s.y}${s.center ? " \xB7 9-slice" : ""}`;
        const ins = insetsOf(s), inputs = SIDES.map(([k, l]) => {
          const lab = document.createElement("label");
          lab.className = "field";
          lab.textContent = l + " ";
          const i = document.createElement("input");
          i.type = "number";
          i.min = "0";
          i.step = "1";
          i.style.width = "3.5em";
          i.value = String(ins[k]);
          i.setAttribute("aria-label", `${s.name} inset ${k}`);
          i.addEventListener("change", () => {
            const next = { ...insetsOf(slicesOf(st.workshop).find((x) => x.name === s.name)), [k]: Number(i.value) };
            const was = insetsOf(slicesOf(st.workshop).find((x) => x.name === s.name))[k];
            try {
              if (!change(setSliceInsets(st.workshop, s.name, next))) i.value = String(was);
            } catch (e) {
              msg(e.message);
              i.value = String(was);
            }
          });
          lab.append(i);
          return lab;
        });
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Remove";
        del.setAttribute("aria-label", "Remove slice " + s.name);
        del.addEventListener("click", () => {
          change(removeSlice(st.workshop, s.name));
          msg("Slice " + s.name + " removed.");
        });
        row.append(t, ...inputs, del);
        return row;
      }));
    }
    function renderExport(force = false) {
      const w2 = st.workshop, e = w2.export, plan = sheetPlan2(w2);
      for (const [id, key] of Object.entries(EX)) if (force || document.activeElement !== $2("#" + id)) $2("#" + id).value = String(e[key]);
      for (const id of ["wsExCellW", "wsExCellH"]) $2("#" + id).min = String(w2.size.w);
      if (force || document.activeElement !== $2("#wsExName")) $2("#wsExName").value = e.name;
      $2("#wsExInfo").textContent = plan.width + "\xD7" + plan.height + " px \xB7 " + plan.cols + " \xD7 " + plan.rows + " cells of " + plan.cellW * plan.scale + "\xD7" + plan.cellH * plan.scale + " px";
      const frames = clipList(w2).flatMap((cl) => cl.frames), sig = JSON.stringify([w2.export, w2.size, w2.clips.map((cl) => [cl.name, cl.dir]), w2.directions, shownVariant2()]);
      if (preview.sig === sig && preview.frames.length === frames.length && preview.frames.every((f, i) => f === frames[i])) return;
      preview.sig = sig;
      preview.frames = frames;
      const c = $2("#wsSheet"), k = Math.max(1, Math.min(4, Math.floor(560 / plan.logical.w)));
      c.width = plan.logical.w * k;
      c.height = plan.logical.h * k;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(logicalCanvas(w2, plan, shownVariant2()), 0, 0, c.width, c.height);
    }
    const preview = { sig: null, frames: [] };
    let strokeImg = { px: null, f: null, canvas: null };
    const live = createLivePreview({
      box: $2("#wsLive"),
      canvas: $2("#wsLiveCanvas"),
      playBtn: $2("#wsLivePlay"),
      scaleSel: $2("#wsLiveScale"),
      playing: !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
      source() {
        const w2 = st.workshop;
        if (!w2) return null;
        const v = shownVariant2();
        const image = (i) => {
          const f = w2.frames[i];
          if (v && !(st.stroke && i === st.frame)) return variantThumb(w2, f, v);
          if (!(st.stroke && i === st.frame)) return thumbOf(w2, f);
          if (strokeImg.px !== st.stroke.px || strokeImg.f !== f) strokeImg = { px: st.stroke.px, f, canvas: toCanvas(composite({ ...f, layers: { ...f.layers, [st.layer]: st.stroke.px } }, hiddenMap(w2)), w2.size.w) };
          return strokeImg.canvas;
        };
        return { n: w2.frames.length, opts: playOpts(w2), dur: (i) => frameDuration(w2, i), image, w: w2.size.w, h: w2.size.h, scale: w2.view.previewScale ?? 2 };
      },
      onScale: (v) => setView({ previewScale: v })
    });
    const vthumbs = /* @__PURE__ */ new WeakMap();
    function variantThumb(w2, f, v) {
      const had = vthumbs.get(f), key = w2.view.hidden.join();
      if (had && had.v === v && had.key === key) return had.canvas;
      const canvas2 = toCanvas(mapPixels(composite(f, hiddenMap(w2)), v.map), w2.size.w);
      vthumbs.set(f, { v, key, canvas: canvas2 });
      return canvas2;
    }
    const variantEditor2 = createVariantEditor({
      $: $2,
      prefix: "wsVar",
      get: () => st.workshop ? st.workshop.variants || [] : [],
      shown: () => st.variant,
      say: msg,
      colours() {
        const w2 = st.workshop;
        if (!w2) return [];
        const set = new Set(w2.palette);
        for (const c of composite(w2.frames[st.frame], hiddenMap(w2))) if (c) set.add(c);
        return [...set];
      },
      set(list) {
        const w2 = st.workshop;
        if (!w2 || list === (w2.variants || [])) return;
        const next = nextWorkshop(w2);
        next.variants = list;
        if (!variantByName(list, st.variant)) st.variant = "";
        change(next);
        render();
      },
      onShow(name) {
        st.variant = name;
        render();
      }
    });
    const drawnFrame = /* @__PURE__ */ new WeakMap(), hasArt = (f) => {
      let v = drawnFrame.get(f);
      if (v === void 0) {
        v = Object.values(f.layers).some((px) => px.some(Boolean));
        drawnFrame.set(f, v);
      }
      return v;
    };
    const rot = createRotationPreview({
      box: $2("#wsRotPreview"),
      canvas: $2("#wsRotCanvas"),
      layoutSel: $2("#wsRotLayout"),
      playBtn: $2("#wsRotPlay"),
      playing: !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),
      source() {
        const w2 = st.workshop;
        if (!w2 || (w2.directions || ["S"]).length < 2) return null;
        const all = clipList(w2), c = all[w2.active || 0], views = all.filter((x) => x.name === c.name && x.frames.some(hasArt));
        if (views.length < 2) return null;
        return {
          n: c.frames.length,
          opts: playOpts(c),
          dur: (i) => c.frames[i].dur ?? Math.round(1e3 / c.fps),
          w: w2.size.w,
          h: w2.size.h,
          scale: w2.size.w <= 48 ? 2 : 1,
          views: views.map((v) => ({ dir: v.dir, frames: v.frames.length, image: (i) => thumbOf(w2, v.frames[i]) }))
        };
      }
    });
    function render() {
      const w2 = st.workshop;
      if (w2 && st.variant && !variantByName(w2.variants, st.variant)) st.variant = "";
      $2("#wsStart").hidden = !!w2;
      $2("#wsWork").hidden = !w2;
      $2("#wsUndo").disabled = !st.history.canUndo;
      $2("#wsRedo").disabled = !st.history.canRedo;
      if (!w2) return;
      st.frame = Math.min(st.frame, w2.frames.length - 1);
      $2("#wsInfo").textContent = `${w2.size.w}\xD7${w2.size.h} px \xB7 ${w2.frames.length} frame${w2.frames.length > 1 ? "s" : ""} \xB7 ${w2.palette.length} colours \xB7 ${w2.fps} fps`;
      for (const b of document.querySelectorAll("#wsTools button")) b.setAttribute("aria-pressed", String(b.dataset.tool === st.tool));
      for (const id of ["#wsCopy", "#wsCut", "#wsFlipH", "#wsFlipV", "#wsDeselect", "#wsMakeBrush"]) $2(id).disabled = !st.selection;
      $2("#wsBrushInfo").textContent = brush ? `Brush: ${brush.w}\xD7${brush.h} px from the ${brush.layer.toLowerCase()} layer, held at its centre; the mirror applies${$2("#wsBrushDither").checked ? ", and the dither pattern" : ""}.` : "Brush: none yet. Select pixels, then Brush from selection; the Brush tool (K) stamps them, held at their centre, with the mirror and, if ticked, the dither.";
      $2("#wsPaste").disabled = !clipboard;
      $2("#wsZoom").value = String(w2.view.zoom);
      $2("#wsGrid").checked = w2.view.grid;
      $2("#wsIso").checked = w2.view.isoGuide;
      $2("#wsLight").value = w2.view.light;
      $2("#wsZoomOut").disabled = w2.view.zoom === ZOOMS[0];
      $2("#wsZoomIn").disabled = w2.view.zoom === ZOOMS[ZOOMS.length - 1];
      $2("#wsLayerInfo").textContent = blockedReason(w2, st.layer) || `Drawing on the ${layerName(st.layer).toLowerCase()} layer.`;
      renderLayers2();
      renderClips();
      renderPalette();
      renderFrames();
      renderReference();
      renderSlices();
      renderExport();
      variantEditor2.render();
      draw();
    }
    $2("#wsSize").replaceChildren(...SIZES2.map((n) => {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = `${n}\xD7${n}`;
      if (n === 48) o.selected = true;
      return o;
    }));
    let saved = "foundry";
    try {
      saved = localStorage.getItem(MODE_KEY) || "foundry";
    } catch (e) {
    }
    setMode2(saved, false);
    return {
      get: () => st.workshop,
      // a project was opened (or a fresh one started): its workshop replaces this one, no undo
      load(w2) {
        stop();
        st.workshop = w2 ? cloneWorkshop(w2) : null;
        st.history.clear();
        st.variant = "";
        st.frames = { undo: [], redo: [] };
        st.frame = 0;
        st.stroke = null;
        if (w2) {
          st.sel = 0;
          st.colour = w2.palette[0];
        }
        msg("");
        render();
      },
      setMode: setMode2,
      exportFiles: () => st.workshop ? exportFiles() : null,
      asepriteBytes: () => st.workshop ? writeAseprite(workshopToAseprite(st.workshop), deflate) : null,
      openAseprite,
      info() {
        const w2 = st.workshop;
        return {
          mode: st.mode,
          exists: !!w2,
          size: w2 ? { ...w2.size } : null,
          frames: w2 ? w2.frames.length : 0,
          palette: w2 ? w2.palette.slice() : null,
          fps: w2 ? w2.fps : null,
          canUndo: st.history.canUndo,
          canRedo: st.history.canRedo,
          playing: st.playing,
          shown: st.shown.slice(),
          loop: w2 ? w2.loop : null,
          durations: w2 ? w2.frames.map((f, i) => frameDuration(w2, i)) : null,
          tool: st.tool,
          layer: st.layer,
          colour: st.colour,
          frame: st.frame,
          selection: st.selection ? { ...st.selection } : null,
          clipboard: clipboard ? { w: clipboard.w, h: clipboard.h } : null,
          view: w2 ? JSON.parse(JSON.stringify(w2.view)) : null,
          livePreview: live.info(),
          variant: st.variant,
          rotationPreview: rot.info()
        };
      },
      // the pixels of one layer (or the composite) of the current frame, for tests
      pixels(layer = null) {
        const w2 = st.workshop;
        if (!w2) return null;
        const f = w2.frames[st.frame];
        return layer ? f.layers[layer].slice() : composite(f, hiddenMap(w2));
      }
    };
  }

