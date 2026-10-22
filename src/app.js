  // src/app.js
  var $ = (s) => document.querySelector(s);
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var state = { ...DEFAULTS };
  try {
    state = sanitizeSettings(JSON.parse(localStorage.getItem("sprite-foundry") || "null"), TYPES);
  } catch (e) {
  }
  var saveState = () => {
    try {
      localStorage.setItem("sprite-foundry", JSON.stringify(state));
    } catch (e) {
    }
    autosaveDue = true;
  };
  var autosaveDue = false;
  var lastAutosave = 0;
  var projectDirty = false;
  var projectName = null;
  var autosaveFailed = false;
  var AUTOSAVE_KEY = "sprite-foundry-project";
  var templatePanel = null;
  var autoAnimate = null;
  var preflightPanel = null;
  function refreshAnimStep(rest) {
    animPanel.refresh(rest);
    if (templatePanel) templatePanel.refresh(rest);
    if (autoAnimate) autoAnimate.refresh();
  }
  var sprite2;
  var anim;
  var frameIdx = 0;
  var playing = !reduced;
  var editMode = false;
  var tool = "pencil";
  var paintColor = null;
  var undo = [];
  var redo = [];
  var edited = false;
  var cache = /* @__PURE__ */ new Map();
  var sheetAnims = /* @__PURE__ */ new Set();
  var thumbs = [];
  var stageDirty = true;
  var sheetDirty = true;
  var painting = false;
  var strokeStart = null;
  var timeline = null;
  var activeLayer = null;
  var hiddenLayers = /* @__PURE__ */ new Set();
  var layerOnly = false;
  var shape = null;
  var selection = null;
  var clipboard2 = null;
  var editTarget = "base";
  var workingPx = null;
  var importedAsset = null;
  var hasImported = () => !!(importedAsset && importedAsset.rest);
  var activeDir = null;
  var mainDir = () => importedAsset && importedAsset.direction || "E";
  var viewOf = (d) => importedAsset && importedAsset.views ? importedAsset.views[d] || null : null;
  var viewDirs = () => importedAsset && importedAsset.views ? DIRECTIONS.filter((d) => importedAsset.views[d]) : [];
  var curView = () => activeDir && viewOf(activeDir) ? activeDir : null;
  var cur = () => curView() ? viewOf(curView()) : importedAsset;
  var curRest = () => {
    const c = cur();
    return c && c.rest ? c.rest : null;
  };
  var opts = () => ({ outline: state.outline, pal: state.palette });
  var genOpts = () => state.type === "hero" ? { cls: state.heroClass, locks: state.heroLocks, colourCls: state.lockColours ? state.heroColourClass : null } : state.type === "imported" ? { asset: importedAsset, rigLayers: layersFor(null) } : {};
  var thumbColour = (seed) => state.type === "hero" && state.lockColours ? state.color : seed;
  var frameSize = () => sprite2.N + 2 * PAD;
  var randSeed = () => Math.random().toString(36).slice(2, 7);
  function framesFor(name) {
    let f = cache.get(name);
    if (!f) {
      const F = frameSize();
      f = timeline.anims[name].frames.map((fr) => {
        const out = framePixels(sprite2, fr, opts());
        return { out, cv: toCanvas(out, F) };
      });
      cache.set(name, f);
    }
    return f;
  }
  function refreshFrame(name, i) {
    const f = cache.get(name);
    if (!f) return;
    const out = framePixels(sprite2, timeline.anims[name].frames[i], opts());
    f[i] = { out, cv: toCanvas(out, frameSize()) };
  }
  var variants = [];
  var shownVariant = "";
  var curVariant = () => variantByName(variants, shownVariant);
  var vframes = /* @__PURE__ */ new WeakMap();
  function frameIn(name, i, variant) {
    const f = framesFor(name)[i];
    if (!variant) return f;
    let m = vframes.get(f);
    if (!m || m.v !== variant) {
      const out = mapPixels(f.out, variant.map);
      m = { v: variant, out, cv: out === f.out ? f.cv : toCanvas(out, frameSize()) };
      vframes.set(f, m);
    }
    return m;
  }
  function invalidate() {
    cache.clear();
    stageDirty = true;
    sheetDirty = true;
    renderStrip();
    renderSwatches();
  }
  function regenerate(keepAnim) {
    if (TYPES[state.type].sizeFromAsset && !hasImported()) state.type = DEFAULTS.type;
    sprite2 = generate(state.type, state.size, state.shape, state.color, genOpts());
    undo = [];
    redo = [];
    edited = false;
    strokeStart = null;
    activeLayer = null;
    hiddenLayers = /* @__PURE__ */ new Set();
    timeline = createTimeline(sprite2);
    if (sprite2.type === "imported") addViewRows();
    const names = timeline.order;
    if (!keepAnim || !names.includes(anim)) anim = names[0];
    frameIdx = 0;
    sheetAnims = new Set(names);
    paintColor = null;
    cache.clear();
    stageDirty = sheetDirty = true;
    syncControls();
    renderAnimSeg();
    renderAnimList();
    renderStrip();
    renderSwatches();
    markThumbs();
    renderHeroPanel();
    saveState();
  }
  function seg(el2, items, current, onPick) {
    el2.replaceChildren(...items.map(([val, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.dataset.val = val;
      b.setAttribute("aria-pressed", String(String(val) === String(current)));
      b.addEventListener("click", () => onPick(val));
      return b;
    }));
  }
  function syncControls() {
    seg($("#typeSeg"), Object.entries(TYPES).map(([k, v]) => [k, v.label]), state.type, (v) => guardDiscard("Changing the sprite type", () => {
      state.type = v;
      regenerate();
      buildThumbs();
    }));
    seg($("#sizeSeg"), [12, 16, 24, 32].map((n) => [n, n + " px"]), TYPES[state.type].sizeFromAsset ? null : state.size, (v) => guardDiscard("Changing the size", () => {
      state.size = +v;
      regenerate(true);
      buildThumbs();
    }));
    const impBtn = [...$("#typeSeg").children].find((b) => b.dataset.val === "imported");
    if (impBtn && !hasImported()) {
      impBtn.disabled = true;
      impBtn.title = "Convert an image first: Image to pixel art, step 3, Use as sprite.";
    }
    const fromAsset = TYPES[state.type].sizeFromAsset, fixed = TYPES[state.type].fixedSize || (fromAsset && sprite2 ? sprite2.N : 0);
    for (const b of $("#sizeSeg").children) b.disabled = !!fixed;
    for (const id of ["#shapeSeed", "#colorSeed", "#reshapeBtn", "#recolorBtn", "#batchBtn"]) $(id).disabled = !!fromAsset;
    $("#sizeHint").textContent = fromAsset ? `Imported characters use the size chosen in Image to pixel art (step 3): a ${fixed} px sprite in a ${fixed + 2 * PAD}\xD7${fixed + 2 * PAD} frame, pivot at the bottom centre.` : fixed ? `${TYPES[state.type].label} always uses a ${fixed} px sprite in a ${fixed + 2 * PAD}\xD7${fixed + 2 * PAD} frame, pivot at the bottom centre.` : "Each frame gets 2 px of headroom on every side for outlines and motion.";
    seg($("#outlineSeg"), [["tinted", "Tinted"], ["black", "Black"], ["none", "None"]], state.outline, (v) => {
      state.outline = v;
      saveState();
      syncControls();
      invalidate();
      refreshThumbs();
    });
    seg($("#scaleSeg"), [1, 2, 4, 8].map((n) => [n, n + "\xD7"]), state.scale, (v) => {
      state.scale = +v;
      saveState();
      syncControls();
      sheetDirty = true;
    });
    seg($("#bgSeg"), [["checker", "Clear"], ["grass", "Grass"], ["night", "Night"], ["sand", "Sand"]], state.bg, (v) => {
      state.bg = v;
      saveState();
      syncControls();
    });
    seg($("#toolSeg"), [["pencil", "Pencil"], ["eraser", "Eraser"], ["fill", "Fill"], ["picker", "Pick"], ["line", "Line"], ["rect", "Rectangle"], ["dither", "Dither"], ["select", "Select"], ["pan", "Pan"]], tool, (v) => {
      tool = v;
      syncControls();
    });
    $("#mirrorAxis").disabled = !mirrorOn();
    const hasSel = !!(sprite2 && selection && selection.target === editTarget);
    for (const id of ["#selCopy", "#selCut", "#selFlipH", "#selFlipV", "#selNone"]) $(id).disabled = !hasSel;
    $("#selPaste").disabled = !clipboard2;
    stageEl.classList.toggle("pan-tool", editMode && tool === "pan" || !editMode && zoom > 1);
    seg($("#targetSeg"), [["base", "Base pose"], ["frame", "This frame"]], editTarget, (v) => {
      commitStroke();
      editTarget = v;
      stageDirty = true;
      syncControls();
      renderSwatches();
    });
    if (timeline) {
      const fr = timeline.anims[anim].frames[frameIdx];
      $("#editBadge").textContent = editTarget === "frame" ? `Editing ${anim} frame ${frameIdx + 1}` : "Editing base pose";
      $("#revertFrame").disabled = !(editTarget === "frame" && fr && fr.px && fr.spec);
      $("#targetHint").textContent = editTarget === "frame" ? "Edits change only this frame. An edited frame keeps its own pixels: later base-pose, palette and outline changes do not reach it." : "Edits go into the base pose and carry through every generated frame. Generating a new shape discards them.";
    }
    $("#stage").className = "stage bg-" + state.bg + (editMode ? " editing" : "");
    $("#palette").value = state.palette;
    $("#shapeSeed").value = state.shape;
    $("#colorSeed").value = state.color;
    $("#fps").value = state.fps;
    $("#fpsLabel").textContent = state.fps + " fps";
    $("#playBtn").textContent = playing ? "Pause" : "Play";
    $("#editBtn").setAttribute("aria-pressed", String(editMode));
    $("#tools").hidden = !editMode;
    $("#editBadge").hidden = !editMode;
    syncOnion();
    renderLayers();
  }
  function renderAnimSeg() {
    seg($("#animSeg"), timeline.order.map((n) => [n, n]), anim, (v) => {
      anim = v;
      frameIdx = 0;
      stageDirty = true;
      renderAnimSeg();
      renderStrip();
    });
  }
  function renderAnimList() {
    const el2 = $("#animList");
    el2.replaceChildren(...timeline.order.map((n) => {
      const l = document.createElement("label"), c = document.createElement("input");
      c.type = "checkbox";
      c.id = "row-" + n;
      c.checked = sheetAnims.has(n);
      c.addEventListener("change", () => {
        c.checked ? sheetAnims.add(n) : sheetAnims.delete(n);
        sheetDirty = true;
        markProjectDirty();
      });
      const t = document.createElement("span");
      t.textContent = n;
      const m = document.createElement("span");
      m.className = "mono";
      m.textContent = frameCount(timeline, n) + " frames";
      l.append(c, t, m);
      return l;
    }));
  }
  function renderStrip() {
    if (!sprite2) return;
    const F = frameSize(), sc = Math.max(1, Math.floor(48 / F)), frames = framesFor(anim);
    $("#strip").replaceChildren(...frames.map((f, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `${anim} frame ${i + 1}`);
      b.setAttribute("aria-pressed", String(i === frameIdx));
      const c = document.createElement("canvas");
      c.width = F * sc;
      c.height = F * sc;
      blit(c.getContext("2d"), f.cv, 0, 0, sc);
      const fr = timeline.anims[anim].frames[i];
      if (fr.px) {
        b.classList.add("baked");
        b.title = "Edited frame (stored pixels)";
      }
      b.append(c);
      if (fr.dur != null) {
        const ms = document.createElement("span");
        ms.className = "ms";
        ms.textContent = Math.round(fr.dur) + "ms";
        b.append(ms);
      }
      b.addEventListener("click", () => selectFrame(i));
      return b;
    }));
    $("#frameInfo").textContent = infoText();
    renderTimelineBar();
    if (sprite2.type === "imported" && hasImported()) refreshAnimStep(curRest());
  }
  var clip = null;
  function selectFrame(i) {
    commitStroke();
    playing = false;
    frameIdx = Math.max(0, Math.min(i, frameCount(timeline, anim) - 1));
    stageDirty = true;
    syncControls();
    renderStrip();
    if (editTarget === "frame") renderSwatches();
  }
  $("#revertFrame").addEventListener("click", () => {
    applyTimeline(revertFrame(timeline, anim, frameIdx));
    syncControls();
  });
  $("#onion").addEventListener("change", () => {
    stageDirty = true;
    syncOnion();
  });
  function syncOnion() {
    $("#onionBack").value = String(state.onionBack);
    $("#onionAhead").value = String(state.onionAhead);
    $("#onionTint").value = state.onionTint;
    $("#onionOpacity").value = String(state.onionOpacity);
    for (const id of ["#onionBack", "#onionAhead", "#onionTint", "#onionOpacity"]) $(id).disabled = !onionOn();
  }
  for (const [id, key, num3] of [["#onionBack", "onionBack", true], ["#onionAhead", "onionAhead", true], ["#onionTint", "onionTint", false], ["#onionOpacity", "onionOpacity", true]]) $(id).addEventListener("change", (e) => {
    state[key] = num3 ? Number(e.target.value) : e.target.value;
    saveState();
    stageDirty = true;
  });
  function applyTimeline(next, selectIdx) {
    if (next === timeline) return false;
    commitStroke();
    pushHistory(snapshot());
    timeline = next;
    edited = true;
    markProjectDirty();
    frameIdx = Math.max(0, Math.min(selectIdx ?? frameIdx, frameCount(timeline, anim) - 1));
    cache.clear();
    stageDirty = true;
    sheetDirty = true;
    renderStrip();
    renderAnimList();
    return true;
  }
  function renderTimelineBar() {
    if (!timeline) return;
    const a = timeline.anims[anim], n = a.frames.length, f = a.frames[frameIdx];
    $("#moveLeft").disabled = frameIdx <= 0;
    $("#moveRight").disabled = frameIdx >= n - 1;
    $("#delFrame").disabled = n <= 1;
    $("#delFrame").title = n <= 1 ? "An animation needs at least one frame" : "";
    $("#pasteFrame").disabled = !clip;
    const dur = $("#frameDur"), fps = $("#animFps");
    if (document.activeElement !== dur) {
      dur.value = f && f.dur != null ? Math.round(f.dur) : "";
      dur.placeholder = String(Math.round(1e3 / (a.fps || state.fps)));
    }
    if (document.activeElement !== fps) {
      fps.value = a.fps != null ? a.fps : "";
      fps.placeholder = String(state.fps);
    }
    $("#animLoop").checked = a.loop;
    $("#animMode").value = modeOf(a);
    if (document.activeElement !== $("#animRepeat")) $("#animRepeat").value = String(repeatOf(a));
    $("#animRepeat").disabled = a.loop;
    renderFrameData();
  }
  var spritePivot = () => sprite2.meta.pivot || { x: frameSize() / 2, y: frameSize() - PAD };
  function renderFrameData() {
    const f = timeline.anims[anim].frames[frameIdx], d = f && f.data || {}, p = d.pivot || [spritePivot().x, spritePivot().y];
    if (document.activeElement !== $("#fdPivotX")) $("#fdPivotX").value = String(p[0]);
    if (document.activeElement !== $("#fdPivotY")) $("#fdPivotY").value = String(p[1]);
    $("#fdPivotReset").disabled = !d.pivot;
    if (document.activeElement !== $("#fdEvents")) $("#fdEvents").value = (d.events || []).join(", ");
    $("#fdBoxes").replaceChildren(...(d.boxes || []).map((b, i) => {
      const li = document.createElement("li"), x = document.createElement("button");
      li.textContent = `${b.kind === "hit" ? "Hitbox" : "Hurtbox"} at ${b.x}, ${b.y}, ${b.w}\xD7${b.h} `;
      x.type = "button";
      x.textContent = "Remove";
      x.setAttribute("aria-label", `Remove ${b.kind}box ${i + 1}`);
      x.addEventListener("click", () => editData({ removeBox: i }, `Removed the ${b.kind}box.`));
      li.append(x);
      return li;
    }));
    const n = timeline.anims[anim].frames.filter((x) => x.data).length;
    $("#fdSummary").textContent = `\xB7 ${anim} frame ${frameIdx + 1}${f && f.data ? ": has data" : ""}${n ? ` \xB7 ${n} frame${n > 1 ? "s" : ""} of ${anim} with data` : ""}`;
    $("#fdFromSel").disabled = !(selection && selection.target === "frame");
  }
  function editData(change, note) {
    const f = timeline.anims[anim].frames[frameIdx];
    let data;
    try {
      data = editFrameData(f.data || null, frameSize(), change);
    } catch (e) {
      toast(e.message);
      renderFrameData();
      return;
    }
    if (applyTimeline(setFrameData(timeline, anim, frameIdx, data))) toast(note);
    renderTimelineBar();
  }
  var num2 = (id) => Number($(id).value);
  for (const id of ["#fdPivotX", "#fdPivotY"]) $(id).addEventListener("change", () => editData({ pivot: [num2("#fdPivotX"), num2("#fdPivotY")] }, `Pivot of ${anim} frame ${frameIdx + 1}: ${num2("#fdPivotX")}, ${num2("#fdPivotY")}.`));
  $("#fdPivotReset").addEventListener("click", () => editData({ pivot: null }, "This frame uses the sprite\u2019s pivot again."));
  $("#fdAdd").addEventListener("click", () => editData({ addBox: { kind: $("#fdKind").value, x: num2("#fdX"), y: num2("#fdY"), w: num2("#fdW"), h: num2("#fdH") } }, `Added a ${$("#fdKind").value}box to ${anim} frame ${frameIdx + 1}.`));
  $("#fdFromSel").addEventListener("click", () => {
    if (!(selection && selection.target === "frame")) return;
    const { x, y, w: w2, h } = selection;
    editData({ addBox: { kind: $("#fdKind").value, x, y, w: w2, h } }, `Added a ${$("#fdKind").value}box from the selection.`);
  });
  $("#fdEvents").addEventListener("change", (e) => editData({ events: parseEvents(e.target.value) }, `Events of ${anim} frame ${frameIdx + 1}: ${parseEvents(e.target.value).join(", ") || "none"}.`));
  $("#showBoxes").addEventListener("change", () => {
    stageDirty = true;
  });
  function drawFrameData(ctx, sc) {
    if (!$("#frameData").open || !$("#showBoxes").checked || !timeline) return;
    const f = timeline.anims[anim].frames[frameIdx % timeline.anims[anim].frames.length], d = f && f.data || {};
    ctx.lineWidth = 2;
    for (const b of d.boxes || []) {
      ctx.strokeStyle = b.kind === "hit" ? "rgba(230,40,40,.9)" : "rgba(30,170,60,.9)";
      ctx.fillStyle = b.kind === "hit" ? "rgba(230,40,40,.15)" : "rgba(30,170,60,.15)";
      ctx.fillRect(b.x * sc, b.y * sc, b.w * sc, b.h * sc);
      ctx.strokeRect(b.x * sc + 1, b.y * sc + 1, b.w * sc - 2, b.h * sc - 2);
    }
    const p = d.pivot || [spritePivot().x, spritePivot().y], r = Math.max(4, sc);
    ctx.strokeStyle = "#1060ff";
    ctx.beginPath();
    ctx.moveTo(p[0] * sc - r, p[1] * sc);
    ctx.lineTo(p[0] * sc + r, p[1] * sc);
    ctx.moveTo(p[0] * sc, p[1] * sc - r);
    ctx.lineTo(p[0] * sc, p[1] * sc + r);
    ctx.stroke();
  }
  $("#frameData").addEventListener("toggle", () => {
    stageDirty = true;
  });
  function copyFrame2() {
    const f = timeline.anims[anim].frames[frameIdx];
    clip = { spec: f.spec, px: f.px, dur: f.dur, data: f.data || null, out: framesFor(anim)[frameIdx].out.slice(), sprite: sprite2 };
    renderTimelineBar();
    toast(`Copied ${anim} frame ${frameIdx + 1}`);
  }
  function pasteFrame() {
    if (!clip) return;
    let frame;
    if (clip.sprite === sprite2) frame = { spec: clip.spec, px: clip.px, dur: clip.dur, data: clip.data };
    else if (clip.out.length === frameSize() ** 2) frame = { spec: null, px: clip.out.slice(), dur: clip.dur, data: clip.data };
    else {
      toast("That frame is a different size and cannot be pasted here.");
      return;
    }
    applyTimeline(insertFrames(timeline, anim, frameIdx + 1, [frame]), frameIdx + 1);
  }
  $("#prevFrame").addEventListener("click", () => selectFrame((frameIdx - 1 + frameCount(timeline, anim)) % frameCount(timeline, anim)));
  $("#nextFrame").addEventListener("click", () => selectFrame((frameIdx + 1) % frameCount(timeline, anim)));
  $("#moveLeft").addEventListener("click", () => applyTimeline(moveFrame(timeline, anim, frameIdx, frameIdx - 1), frameIdx - 1));
  $("#moveRight").addEventListener("click", () => applyTimeline(moveFrame(timeline, anim, frameIdx, frameIdx + 1), frameIdx + 1));
  $("#dupFrame").addEventListener("click", () => applyTimeline(duplicateFrame(timeline, anim, frameIdx), frameIdx + 1));
  $("#delFrame").addEventListener("click", () => applyTimeline(deleteFrame(timeline, anim, frameIdx), frameIdx));
  $("#copyFrame").addEventListener("click", copyFrame2);
  $("#tlUndo").addEventListener("click", doUndo);
  $("#tlRedo").addEventListener("click", doRedo);
  $("#pasteFrame").addEventListener("click", pasteFrame);
  $("#frameDur").addEventListener("change", (e) => {
    const v = e.target.value.trim();
    if (v !== "" && !(Number(v) >= 10 && Number(v) <= 1e4)) {
      toast("Frame time must be between 10 and 10000 ms.");
      renderTimelineBar();
      return;
    }
    applyTimeline(setFrameDuration(timeline, anim, frameIdx, v === "" ? null : Number(v)));
    renderTimelineBar();
  });
  $("#animFps").addEventListener("change", (e) => {
    const v = e.target.value.trim();
    if (v !== "" && !(Number(v) >= 1 && Number(v) <= 60)) {
      toast("Animation FPS must be between 1 and 60.");
      renderTimelineBar();
      return;
    }
    applyTimeline(setAnimFps(timeline, anim, v === "" ? null : Number(v)));
    renderTimelineBar();
  });
  $("#animLoop").addEventListener("change", (e) => {
    applyTimeline(setAnimLoop(timeline, anim, e.target.checked));
    $("#frameInfo").textContent = infoText();
    renderTimelineBar();
  });
  $("#animMode").addEventListener("change", (e) => {
    applyTimeline(setAnimMode(timeline, anim, e.target.value));
    $("#frameInfo").textContent = infoText();
    renderTimelineBar();
  });
  $("#animRepeat").addEventListener("change", (e) => {
    const v = Number(e.target.value);
    if (!(Number.isInteger(v) && v >= 1 && v <= 99)) {
      toast("Repeat must be 1 to 99 times.");
      renderTimelineBar();
      return;
    }
    applyTimeline(setAnimRepeat(timeline, anim, v));
    $("#frameInfo").textContent = infoText();
    renderTimelineBar();
  });
  function swatchColors() {
    if (state.palette !== "free" && PALETTES[state.palette]) return PALETTES[state.palette].colors.slice();
    const set = new Set(sprite2.px.filter(Boolean));
    if (editTarget === "frame" && timeline) {
      for (const c of framesFor(anim)[frameIdx].out) if (c) set.add(c);
    }
    set.add(sprite2.meta.outline);
    set.add("#ffffff");
    set.add("#000000");
    return [...set].sort((a, b) => lum(a) - lum(b)).slice(0, 40);
  }
  function renderSwatches() {
    if (!sprite2 || !editMode) return;
    const cols = swatchColors();
    if (!paintColor || state.palette !== "free" && !cols.includes(paintColor)) paintColor = cols[Math.floor(cols.length / 2)];
    $("#swatches").replaceChildren(...cols.map((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.background = c;
      b.setAttribute("aria-label", "Colour " + c);
      b.setAttribute("aria-pressed", String(c === paintColor));
      b.addEventListener("click", () => {
        paintColor = c;
        if (tool === "eraser" || tool === "picker") tool = "pencil";
        syncControls();
        renderSwatches();
      });
      return b;
    }));
    $("#customColor").value = paintColor;
  }
  var stageCanvas = $("#stageCanvas");
  var stageEl = $("#stage");
  var ZOOMS2 = [1, 2, 3, 4, 6, 8];
  var zoom = 1;
  var panning = null;
  function drawStage() {
    const F = frameSize();
    const box = Math.min(stageEl.offsetWidth - 2, stageEl.offsetHeight - 2 || stageEl.offsetWidth - 2) - 16;
    const fit = Math.max(1, Math.floor(box / F)), sc = Math.min(fit * zoom, Math.floor(8192 / F));
    stageEl.classList.toggle("zoomed", zoom > 1);
    if (stageCanvas.width !== F * sc) {
      stageCanvas.width = F * sc;
      stageCanvas.height = F * sc;
      stageCanvas.style.width = F * sc + "px";
      stageCanvas.style.height = F * sc + "px";
    }
    const ctx = stageCanvas.getContext("2d");
    ctx.clearRect(0, 0, stageCanvas.width, stageCanvas.height);
    const grid = (from, to) => {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim() || "rgba(0,0,0,.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i2 = from; i2 <= to; i2++) {
        ctx.moveTo(i2 * sc + 0.5, from * sc);
        ctx.lineTo(i2 * sc + 0.5, to * sc);
        ctx.moveTo(from * sc, i2 * sc + 0.5);
        ctx.lineTo(to * sc, i2 * sc + 0.5);
      }
      ctx.stroke();
    };
    if (editMode && editTarget === "base") {
      const out = renderFrame(sprite2, {}, { ...opts(), hidden: hiddenLayers });
      blit(ctx, toCanvas(out, F), 0, 0, sc);
      if (gridOn()) grid(PAD, F - PAD);
      drawSelection(ctx, sc, PAD);
      return;
    }
    const frames = framesFor(anim), n = frames.length, i = frameIdx % n;
    const v = editMode ? null : curVariant(), shown = (j) => v ? frameIn(anim, j, v) : frames[j];
    if (onionOn() && n > 1 && (editMode || !playing)) {
      for (const o of onionFrames(n, i, { back: state.onionBack, ahead: state.onionAhead, loop: timeline.anims[anim].loop, opacity: state.onionOpacity })) {
        ctx.globalAlpha = o.alpha;
        blit(ctx, state.onionTint === "redblue" ? tinted(shown(o.frame).cv, TINT[o.side]) : shown(o.frame).cv, 0, 0, sc);
      }
      ctx.globalAlpha = 1;
    }
    blit(ctx, shown(i).cv, 0, 0, sc);
    if (editMode && gridOn()) grid(0, F);
    if (editMode && editTarget === "frame") drawSelection(ctx, sc, 0);
    drawFrameData(ctx, sc);
  }
  function drawSelection(ctx, sc, off2) {
    let r = selection && selection.target === editTarget ? selection : null;
    if (shape && shape.kind === "move") r = { ...shape.rect, x: shape.rect.x + shape.last[0] - shape.start[0], y: shape.rect.y + shape.last[1] - shape.start[1] };
    if (!r) return;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const [c, o] of [["#fff", 0], ["#111", 3.5]]) {
      ctx.strokeStyle = c;
      ctx.lineDashOffset = o;
      ctx.strokeRect((r.x + off2) * sc + 0.5, (r.y + off2) * sc + 0.5, r.w * sc - 1, r.h * sc - 1);
    }
    ctx.setLineDash([]);
  }
  var gridOn = () => $("#gridToggle").checked;
  function setZoom(next) {
    next = Math.max(ZOOMS2[0], Math.min(ZOOMS2[ZOOMS2.length - 1], next));
    if (next === zoom) return;
    const cw = stageCanvas.offsetWidth || 1, ch = stageCanvas.offsetHeight || 1;
    const fx = (stageEl.scrollLeft + stageEl.clientWidth / 2) / cw, fy = (stageEl.scrollTop + stageEl.clientHeight / 2) / ch;
    zoom = next;
    drawStage();
    stageEl.scrollLeft = fx * stageCanvas.offsetWidth - stageEl.clientWidth / 2;
    stageEl.scrollTop = fy * stageCanvas.offsetHeight - stageEl.clientHeight / 2;
    $("#zoomLabel").textContent = zoom === 1 ? "Fit" : "\xD7" + zoom;
    stageEl.classList.toggle("pan-tool", editMode && tool === "pan" || !editMode && zoom > 1);
  }
  var zoomStep = (dir) => {
    const i = ZOOMS2.indexOf(zoom);
    setZoom(ZOOMS2[Math.max(0, Math.min(ZOOMS2.length - 1, i + dir))]);
  };
  $("#zoomIn").addEventListener("click", () => zoomStep(1));
  $("#zoomOut").addEventListener("click", () => zoomStep(-1));
  $("#zoomFit").addEventListener("click", () => setZoom(1));
  stageEl.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomStep(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  $("#gridToggle").addEventListener("change", () => {
    stageDirty = true;
  });
  var onionOn = () => $("#onion").checked;
  new ResizeObserver(() => {
    stageDirty = true;
  }).observe(stageEl);
  function nearestTag(x, y) {
    const N = sprite2.N;
    for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      const t = sprite2.tag[Y * N + X];
      if (t) return t;
    }
    return sprite2.order.includes("body") ? "body" : sprite2.order[0];
  }
  function canEdit(i) {
    const t = sprite2.tag[i];
    if (t && hiddenLayers.has(t)) return false;
    if (layerOnly && activeLayer && t && t !== activeLayer) return false;
    return true;
  }
  function applyPx(x, y) {
    const N = sprite2.N, i = y * N + x;
    if (!canEdit(i)) return;
    if (tool === "eraser") {
      sprite2.px[i] = null;
      sprite2.tag[i] = null;
    } else {
      if (!sprite2.tag[i]) sprite2.tag[i] = activeLayer || nearestTag(x, y);
      sprite2.px[i] = paintColor;
    }
  }
  function flood(x, y) {
    const N = sprite2.N, target = sprite2.px[y * N + x];
    if (target === paintColor) return;
    const st = [[x, y]], seen = /* @__PURE__ */ new Set();
    while (st.length) {
      const [cx, cy] = st.pop(), i = cy * N + cx;
      if (cx < 0 || cy < 0 || cx >= N || cy >= N || seen.has(i) || sprite2.px[i] !== target) continue;
      seen.add(i);
      applyPx(cx, cy);
      for (const [dx, dy] of D4) st.push([cx + dx, cy + dy]);
    }
  }
  function setFramePixel(i, c) {
    const cur2 = workingPx || framesFor(anim)[frameIdx].out;
    if (cur2[i] === c) return false;
    if (!workingPx) {
      workingPx = cur2.slice();
      timeline = bakeFrame(timeline, anim, frameIdx, workingPx);
    }
    workingPx[i] = c;
    return true;
  }
  function paintFrameAt(x, y) {
    const F = frameSize();
    if (x < 0 || y < 0 || x >= F || y >= F) return;
    const cur2 = () => workingPx || framesFor(anim)[frameIdx].out;
    if (tool === "picker") {
      const c = cur2()[y * F + x];
      if (c) {
        paintColor = c;
        tool = "pencil";
        syncControls();
        renderSwatches();
      }
      return;
    }
    const value = tool === "eraser" ? null : paintColor;
    let changed = false;
    const fill = (sx, sy) => {
      const target = cur2()[sy * F + sx];
      if (target === value) return;
      const st = [[sx, sy]], seen = /* @__PURE__ */ new Set();
      while (st.length) {
        const [cx, cy] = st.pop(), i = cy * F + cx;
        if (cx < 0 || cy < 0 || cx >= F || cy >= F || seen.has(i) || cur2()[i] !== target) continue;
        seen.add(i);
        changed = setFramePixel(i, value) || changed;
        for (const [dx, dy] of D4) st.push([cx + dx, cy + dy]);
      }
    };
    for (const [px, py] of mirrorPoints([[x, y]], F, F, mirrorAxis())) {
      if (tool === "fill") fill(px, py);
      else changed = setFramePixel(py * F + px, value) || changed;
    }
    if (changed) {
      edited = true;
      refreshFrame(anim, frameIdx);
      stageDirty = true;
      sheetDirty = true;
    }
  }
  function paintAt(e) {
    const r = stageCanvas.getBoundingClientRect(), F = frameSize(), N = sprite2.N;
    if (editTarget === "frame") return paintFrameAt(Math.floor((e.clientX - r.left) / r.width * F), Math.floor((e.clientY - r.top) / r.height * F));
    const x = Math.floor((e.clientX - r.left) / r.width * F) - PAD, y = Math.floor((e.clientY - r.top) / r.height * F) - PAD;
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    if (tool === "picker") {
      const c = sprite2.px[y * N + x];
      if (c) {
        paintColor = state.palette === "free" ? c : quantize(c, state.palette);
        tool = "pencil";
        syncControls();
        renderSwatches();
      }
      return;
    }
    for (const [mx, my] of mirrorPoints([[x, y]], N, N, mirrorAxis())) {
      if (tool === "fill") flood(mx, my);
      else applyPx(mx, my);
    }
    edited = true;
    cache.clear();
    stageDirty = true;
    sheetDirty = true;
  }
  var mirrorOn = () => $("#mirror").checked;
  var mirrorAxis = () => mirrorOn() ? $("#mirrorAxis").value : "off";
  var SHAPES = /* @__PURE__ */ new Set(["line", "rect", "dither", "select"]);
  function surface() {
    if (editTarget === "frame") {
      const F = frameSize();
      return { W: F, H: F, off: 0, px: (workingPx || framesFor(anim)[frameIdx].out).slice(), tag: null };
    }
    const N = sprite2.N;
    return { W: N, H: N, off: PAD, px: sprite2.px.slice(), tag: sprite2.tag.slice() };
  }
  function writeSurface(next, nextTag = null) {
    if (editTarget === "frame") {
      let changed = false;
      next.forEach((c, i) => {
        changed = setFramePixel(i, c) || changed;
      });
      if (changed) {
        edited = true;
        refreshFrame(anim, frameIdx);
      }
    } else {
      const N = sprite2.N;
      for (let i = 0; i < next.length; i++) {
        const t = nextTag ? nextTag[i] : sprite2.tag[i];
        if (next[i] === sprite2.px[i] && t === sprite2.tag[i]) continue;
        if (!canEdit(i)) continue;
        sprite2.px[i] = next[i];
        sprite2.tag[i] = next[i] == null ? null : t || sprite2.tag[i] || activeLayer || nearestTag(i % N, i / N | 0);
      }
      edited = true;
      cache.clear();
    }
    stageDirty = true;
    sheetDirty = true;
  }
  function surfaceAt(e) {
    const r = stageCanvas.getBoundingClientRect(), F = frameSize(), off2 = editTarget === "frame" ? 0 : PAD;
    return [Math.floor((e.clientX - r.left) / r.width * F) - off2, Math.floor((e.clientY - r.top) / r.height * F) - off2];
  }
  function shapeResult(s) {
    const { W, H } = s.before, b = s.before, axis2 = mirrorAxis(), m = (pts2) => mirrorPoints(pts2, W, H, axis2), value = tool === "eraser" ? null : paintColor;
    if (s.kind === "select") return null;
    if (s.kind === "move") {
      const dx = s.last[0] - s.start[0], dy = s.last[1] - s.start[1];
      return { px: moveRect(b.px, W, H, s.rect, dx, dy), tag: b.tag && moveRect(b.tag, W, H, s.rect, dx, dy) };
    }
    let pts;
    if (s.kind === "line") {
      const [x1, y1] = $("#snapLines").checked ? snapEnd(s.start[0], s.start[1], s.last[0], s.last[1]) : s.last;
      pts = m(linePoints(s.start[0], s.start[1], x1, y1));
    } else if (s.kind === "rect") pts = m(rectPoints(s.start[0], s.start[1], s.last[0], s.last[1], $("#rectFilled").checked));
    else if (s.kind === "dither") pts = ditherPoints(m(s.path), DITHER_LEVELS[$("#ditherLevel").value]);
    else pts = m(pixelPerfect(s.path));
    return { px: paintPoints(b.px, W, H, pts, value), tag: null };
  }
  function shapeDown(e) {
    const [x, y] = surfaceAt(e), before = surface();
    if (tool === "select") {
      const r = selection && selection.target === editTarget ? selection : null, inside = r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      shape = inside ? { kind: "move", before, start: [x, y], last: [x, y], rect: r } : { kind: "select", before, start: [x, y], last: [x, y] };
      if (!inside) {
        const s = rectFrom(x, y, x, y, before.W, before.H);
        selection = s && { ...s, target: editTarget };
      }
    } else shape = { kind: SHAPES.has(tool) ? tool : "perfect", before, start: [x, y], last: [x, y], path: [[x, y]] };
    shapeMove(e, true);
  }
  function shapeMove(e, first = false) {
    const s = shape;
    if (!s) return;
    const [x, y] = surfaceAt(e);
    if (!first && x === s.last[0] && y === s.last[1]) return;
    if (!first) {
      if (s.path) s.path.push(...linePoints(s.last[0], s.last[1], x, y).slice(1));
      s.last = [x, y];
    }
    if (s.kind === "select") {
      const r = rectFrom(s.start[0], s.start[1], x, y, s.before.W, s.before.H);
      selection = r && { ...r, target: editTarget };
      stageDirty = true;
      return;
    }
    const out = shapeResult(s);
    writeSurface(out.px, out.tag);
  }
  function shapeUp() {
    const s = shape;
    shape = null;
    if (!s) return;
    if (s.kind === "move") {
      const dx = s.last[0] - s.start[0], dy = s.last[1] - s.start[1], r = rectFrom(s.rect.x + dx, s.rect.y + dy, s.rect.x + dx + s.rect.w - 1, s.rect.y + dy + s.rect.h - 1, s.before.W, s.before.H);
      selection = r && { ...r, target: editTarget };
    }
  }
  function surfaceOp(fn, note) {
    if (!editMode) return;
    commitStroke();
    strokeStart = snapshot();
    const s = surface(), out = fn(s);
    if (out) writeSurface(out.px, out.tag || null);
    const before = strokeStart.tl !== timeline || strokeStart.px.some((c, i) => c !== sprite2.px[i]);
    commitStroke();
    workingPx = null;
    renderStrip();
    renderSwatches();
    syncControls();
    toast(before ? note : "Nothing changed.");
  }
  var selNow = () => {
    if (!selection || selection.target !== editTarget || !sprite2) return null;
    const s = surface();
    return selection.x + selection.w <= s.W && selection.y + selection.h <= s.H ? selection : null;
  };
  $("#selCopy").addEventListener("click", () => {
    const r = selNow();
    if (!r) return;
    const s = surface();
    clipboard2 = { ...copyRect(s.px, s.W, r), tag: s.tag && copyRect(s.tag, s.W, r).px, from: editTarget };
    toast(`Copied ${r.w}\xD7${r.h} px.`);
    syncControls();
  });
  $("#selCut").addEventListener("click", () => {
    const r = selNow();
    if (!r) return;
    const s0 = surface();
    clipboard2 = { ...copyRect(s0.px, s0.W, r), tag: s0.tag && copyRect(s0.tag, s0.W, r).px, from: editTarget };
    surfaceOp((s) => ({ px: clearRect(s.px, s.W, r), tag: s.tag && clearRect(s.tag, s.W, r) }), `Cut ${r.w}\xD7${r.h} px.`);
  });
  $("#selPaste").addEventListener("click", () => {
    if (!clipboard2) return;
    const r = selNow(), x = r ? r.x : 0, y = r ? r.y : 0, c = clipboard2;
    surfaceOp((s) => ({ px: pasteClip(s.px, s.W, s.H, c, x, y), tag: s.tag && c.tag ? pasteClip(s.tag, s.W, s.H, { w: c.w, h: c.h, px: c.px.map((v, i) => v == null ? null : c.tag[i]) }, x, y) : null }), `Pasted ${c.w}\xD7${c.h} px; drag it with Select to move it.`);
    const sz = surface(), nr = rectFrom(x, y, x + c.w - 1, y + c.h - 1, sz.W, sz.H);
    selection = nr && { ...nr, target: editTarget };
    stageDirty = true;
    syncControls();
  });
  for (const [id, dir, name] of [["#selFlipH", "h", "left to right"], ["#selFlipV", "v", "top to bottom"]]) $(id).addEventListener("click", () => {
    const r = selNow();
    if (r) surfaceOp((s) => ({ px: flipRect(s.px, s.W, s.H, r, dir), tag: s.tag && flipRect(s.tag, s.W, s.H, r, dir) }), `Flipped the selection ${name}.`);
  });
  $("#selNone").addEventListener("click", () => {
    selection = null;
    stageDirty = true;
    syncControls();
  });
  $("#selOut").addEventListener("click", () => {
    if (!paintColor) return;
    surfaceOp(
      (s) => {
        const pal = [.../* @__PURE__ */ new Set([...swatchColors(), ...s.px.filter(Boolean)])];
        return { px: selOut(s.px, s.W, s.H, paintColor, (c) => shadeColour(c, pal, -1)) };
      },
      `Sel-out: outline pixels of ${paintColor} now take a darker shade of the colour inside them.`
    );
  });
  $("#mirror").addEventListener("change", () => syncControls());
  function commitStroke() {
    if (!strokeStart) return;
    const s0 = strokeStart;
    strokeStart = null;
    workingPx = null;
    const changed = s0.tl !== timeline || s0.px.some((c, i) => c !== sprite2.px[i]) || s0.tag.some((t, i) => t !== sprite2.tag[i]);
    if (changed) {
      pushHistory(s0);
      markProjectDirty();
    }
  }
  stageCanvas.addEventListener("pointerdown", (e) => {
    if (e.button === 1 || editMode && tool === "pan" || !editMode && zoom > 1) {
      e.preventDefault();
      panning = { x: e.clientX, y: e.clientY, sl: stageEl.scrollLeft, st: stageEl.scrollTop };
      try {
        stageCanvas.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      return;
    }
    if (!editMode) return;
    e.preventDefault();
    commitStroke();
    workingPx = null;
    if (tool !== "picker") strokeStart = snapshot();
    try {
      stageCanvas.setPointerCapture(e.pointerId);
    } catch (err) {
    }
    if (SHAPES.has(tool) || (tool === "pencil" || tool === "eraser") && $("#pixelPerfect").checked) {
      shapeDown(e);
      return;
    }
    painting = tool === "pencil" || tool === "eraser";
    paintAt(e);
  });
  stageCanvas.addEventListener("pointermove", (e) => {
    if (panning) {
      stageEl.scrollLeft = panning.sl - (e.clientX - panning.x);
      stageEl.scrollTop = panning.st - (e.clientY - panning.y);
      return;
    }
    if (shape) {
      shapeMove(e);
      return;
    }
    if (painting) paintAt(e);
  });
  var endPaint = () => {
    if (panning) {
      panning = null;
      return;
    }
    const wasShape = !!shape;
    shapeUp();
    commitStroke();
    if (wasShape) {
      renderStrip();
      renderSwatches();
      syncControls();
    }
    if (painting || edited) {
      renderStrip();
      renderSwatches();
      syncControls();
    }
    painting = false;
  };
  stageCanvas.addEventListener("pointerup", endPaint);
  stageCanvas.addEventListener("pointercancel", endPaint);
  var snapshot = () => ({ px: sprite2.px.slice(), tag: sprite2.tag.slice(), order: sprite2.order.slice(), tl: timeline });
  function pushHistory(snap) {
    undo.push(snap);
    if (undo.length > 60) undo.shift();
    redo = [];
  }
  function restoreSnapshot(u) {
    sprite2.px = u.px;
    sprite2.tag = u.tag;
    if (u.order) sprite2.order = u.order;
    if (u.tl) timeline = u.tl;
    markProjectDirty();
    frameIdx = Math.min(frameIdx, Math.max(0, frameCount(timeline, anim) - 1));
    invalidate();
    renderAnimList();
    syncControls();
  }
  function replaceColour2(from, to, scope) {
    from = from.toLowerCase();
    to = to.toLowerCase();
    if (from === to) {
      toast("Choose a different colour to replace it with.");
      return null;
    }
    commitStroke();
    const before = snapshot(), o = opts();
    let tl = timeline, count = 0, base = 0;
    const bake = (name, i) => {
      const out = framePixels(sprite2, tl.anims[name].frames[i], o), k = countColour(out, from);
      if (k) {
        tl = bakeFrame(tl, name, i, replacePixels(out, from, to));
        count += k;
      }
    };
    if (scope === "frame") bake(anim, frameIdx);
    else if (scope === "anim") tl.anims[anim].frames.forEach((_, i) => bake(anim, i));
    else {
      const px = sprite2.px.slice();
      for (let i = 0; i < px.length; i++) if (px[i] === from && canEdit(i)) {
        px[i] = to;
        base++;
      }
      for (const name of tl.order) tl.anims[name].frames.forEach((fr, i) => {
        if (fr.px && fr.px.includes(from)) {
          count += countColour(fr.px, from);
          tl = bakeFrame(tl, name, i, replacePixels(fr.px, from, to));
        }
      });
      if (base) sprite2.px = px;
    }
    const where = { frame: "this frame", anim: "this animation", all: "everywhere" }[scope];
    if (!count && !base) {
      const shown = scope === "all" ? timeline.order.reduce((n, name) => n + framesFor(name).reduce((m, fr) => m + countColour(fr.out, from), 0), 0) : 0;
      toast(shown ? `${from} is drawn by the outline or the palette lock, not stored in the sprite: change the outline or palette, or replace it in this frame or this animation.` : `No ${from} pixels to replace ${scope === "all" ? "" : "in "}${where}.`);
      return { count: 0, base: 0, left: shown };
    }
    pushHistory(before);
    timeline = tl;
    edited = true;
    markProjectDirty();
    invalidate();
    syncControls();
    let left = 0;
    if (scope === "all") for (const name of timeline.order) for (const fr of framesFor(name)) left += countColour(fr.out, from);
    const lock = state.palette !== "free" && PALETTES[state.palette] && quantize(to, state.palette) !== to;
    toast(`Replaced ${from} with ${to} ${scope === "all" ? "" : "in "}${where}${base ? ` (base pose: ${base} px)` : ""}.${left ? ` ${left} px of ${from} still show: they come from the outline or the palette lock.` : ""}${lock ? ` The palette lock draws ${to} as ${quantize(to, state.palette)}.` : ""}`);
    return { count, base, left };
  }
  $("#rcFromCurrent").addEventListener("click", () => {
    if (paintColor) $("#rcFrom").value = paintColor;
  });
  $("#rcGo").addEventListener("click", () => replaceColour2($("#rcFrom").value, $("#rcTo").value, $("#rcScope").value));
  function doUndo() {
    commitStroke();
    const u = undo.pop();
    if (!u) {
      toast("Nothing to undo");
      return;
    }
    redo.push(snapshot());
    restoreSnapshot(u);
  }
  function doRedo() {
    commitStroke();
    const r = redo.pop();
    if (!r) {
      toast("Nothing to redo");
      return;
    }
    undo.push(snapshot());
    if (undo.length > 60) undo.shift();
    restoreSnapshot(r);
  }
  var layerList = () => {
    const present = new Set(sprite2.tag.filter(Boolean));
    return [...[...present].filter((t) => !sprite2.order.includes(t)), ...sprite2.order];
  };
  function renderLayers() {
    const panel = $("#layersPanel");
    panel.hidden = !(editMode && editTarget === "base" && sprite2);
    if (panel.hidden) return;
    const counts2 = {};
    for (const t of sprite2.tag) if (t) counts2[t] = (counts2[t] || 0) + 1;
    const draw = layerList(), rows = [];
    const auto2 = document.createElement("button");
    auto2.type = "button";
    auto2.className = "layer-pick";
    auto2.textContent = "Auto (nearest part)";
    auto2.setAttribute("aria-pressed", String(!activeLayer));
    auto2.addEventListener("click", () => {
      activeLayer = null;
      renderLayers();
    });
    rows.push(auto2, document.createElement("span"), document.createElement("span"), document.createElement("span"));
    [...draw].reverse().forEach((t) => {
      const pos = sprite2.order.indexOf(t);
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "layer-pick";
      pick.textContent = `${t} \xB7 ${counts2[t] || 0} px`;
      pick.setAttribute("aria-pressed", String(activeLayer === t));
      pick.setAttribute("aria-label", "Select layer " + t);
      pick.addEventListener("click", () => {
        activeLayer = t;
        renderLayers();
      });
      const show = document.createElement("label");
      show.className = "lock";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !hiddenLayers.has(t);
      cb.setAttribute("aria-label", "Show layer " + t);
      cb.addEventListener("change", () => {
        cb.checked ? hiddenLayers.delete(t) : hiddenLayers.add(t);
        stageDirty = true;
      });
      show.append(cb, document.createTextNode("Show"));
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "\u25B2";
      up.setAttribute("aria-label", "Move layer " + t + " up");
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "\u25BC";
      down.setAttribute("aria-label", "Move layer " + t + " down");
      up.disabled = pos < 0 || pos === sprite2.order.length - 1;
      down.disabled = pos <= 0;
      up.addEventListener("click", () => moveLayer3(t, 1));
      down.addEventListener("click", () => moveLayer3(t, -1));
      rows.push(pick, show, up, down);
    });
    $("#layerList").replaceChildren(...rows);
    $("#layerOnly").checked = layerOnly;
  }
  function moveLayer3(t, dir) {
    const i = sprite2.order.indexOf(t), j = i + dir;
    if (i < 0 || j < 0 || j >= sprite2.order.length) return;
    commitStroke();
    pushHistory(snapshot());
    const order2 = sprite2.order.slice();
    [order2[i], order2[j]] = [order2[j], order2[i]];
    sprite2.order = order2;
    edited = true;
    markProjectDirty();
    invalidate();
    renderLayers();
  }
  $("#layerOnly").addEventListener("change", (e) => {
    layerOnly = e.target.checked;
  });
  function buildThumbs() {
    const el2 = $("#thumbs");
    if (TYPES[state.type].sizeFromAsset) {
      thumbs = [];
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Imported characters come from your image, so there are no seed variations.";
      el2.replaceChildren(p);
      return;
    }
    thumbs = Array.from({ length: 12 }, (_, i) => {
      const seed = state.batch + "-" + (i + 1);
      const s = generate(state.type, state.size, seed, thumbColour(seed), genOpts());
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb";
      const c = document.createElement("canvas");
      const F = s.N + 2 * PAD;
      c.width = F;
      c.height = F;
      const label = document.createElement("span");
      label.textContent = seed;
      b.append(c, label);
      b.setAttribute("aria-label", `Load variation ${seed}`);
      b.addEventListener("click", () => guardDiscard("Loading a variation", () => {
        state.shape = seed;
        state.color = thumbColour(seed);
        regenerate(true);
      }));
      return { seed, s, b, c, frames: null };
    });
    el2.replaceChildren(...thumbs.map((t) => t.b));
    refreshThumbs();
    markThumbs();
  }
  function refreshThumbs() {
    for (const t of thumbs) {
      const F = t.s.N + 2 * PAD, first = Object.keys(t.s.anims)[0];
      t.frames = t.s.anims[first].map((spec) => toCanvas(renderFrame(t.s, spec, opts()), F));
      const ctx = t.c.getContext("2d");
      ctx.clearRect(0, 0, F, F);
      ctx.drawImage(t.frames[0], 0, 0);
    }
  }
  function markThumbs() {
    for (const t of thumbs) t.b.setAttribute("aria-pressed", String(state.shape === t.seed && state.color === thumbColour(t.seed)));
  }
  function renderHeroPanel() {
    const on = state.type === "hero" && sprite2 && sprite2.meta.hero;
    $("#heroGroup").hidden = !on;
    if (!on) return;
    const cfg = sprite2.meta.hero, sel = $("#heroClass");
    if (!sel.options.length) {
      sel.append(new Option("Random class", "random"), ...Object.entries(CLASSES).map(([k, c]) => new Option(c.label, k)));
    }
    sel.value = state.heroClass;
    $("#heroRolled").textContent = state.heroClass === "random" ? `Rolled class: ${CLASSES[cfg.cls].label}` : "";
    $("#lockColours").checked = !!state.lockColours;
    const rows = [];
    for (const slot of HUMANOID.slots) {
      if (slot.name === "body") continue;
      const id = "part-" + slot.name;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = slot.label;
      const select = document.createElement("select");
      select.id = id;
      for (const p of partsForSlot(slot.name)) select.append(new Option(p.label, p.id));
      if (slot.optional) select.append(new Option("None", "none"));
      select.value = cfg.parts[slot.name];
      select.addEventListener("change", () => guardDiscard("Changing a part", () => {
        state.heroLocks = { ...state.heroLocks, [slot.name]: select.value };
        regenerate(true);
        buildThumbs();
      }));
      const lockWrap = document.createElement("label");
      lockWrap.className = "lock";
      const lock = document.createElement("input");
      lock.type = "checkbox";
      lock.id = "lock-" + slot.name;
      lock.checked = Object.prototype.hasOwnProperty.call(state.heroLocks, slot.name);
      lock.setAttribute("aria-label", "Lock " + slot.label);
      lock.addEventListener("change", () => guardDiscard(lock.checked ? "Locking a part" : "Unlocking a part", () => {
        const next = { ...state.heroLocks };
        if (lock.checked) next[slot.name] = cfg.parts[slot.name];
        else delete next[slot.name];
        state.heroLocks = next;
        regenerate(true);
        buildThumbs();
      }));
      lockWrap.append(lock, document.createTextNode("Lock"));
      rows.push(label, select, lockWrap);
    }
    $("#partList").replaceChildren(...rows);
  }
  $("#heroClass").addEventListener("change", (e) => {
    const v = e.target.value;
    guardDiscard("Changing the class", () => {
      state.heroClass = v;
      regenerate(true);
      buildThumbs();
    });
  });
  $("#heroRoll").addEventListener("click", () => guardDiscard("Randomizing", () => {
    state.shape = randSeed();
    if (!state.lockColours) state.color = randSeed();
    regenerate(true);
  }));
  $("#lockColours").addEventListener("change", (e) => {
    state.lockColours = e.target.checked;
    state.heroColourClass = state.lockColours && sprite2.meta.hero ? sprite2.meta.hero.cls : null;
    saveState();
    buildThumbs();
  });
  function sheetRows() {
    return timeline.order.filter((n) => sheetAnims.has(n) && frameCount(timeline, n) > 0);
  }
  var packCtx = () => ({ sprite: sprite2, timeline, rows: [...sheetAnims], state: { scale: state.scale, fps: state.fps, palette: state.palette, outline: state.outline }, edited, variants });
  function buildSheet(scale, variant = null) {
    const plan = sheetPlan(packCtx(), scale, sheetRows());
    const cv = document.createElement("canvas");
    cv.width = plan.layout.width;
    cv.height = plan.layout.height;
    const ctx = cv.getContext("2d");
    for (const p of plan.layout.placements) blit(ctx, frameIn(p.anim, p.frame, variant).cv, p.x, p.y, scale);
    return { cv, ...plan };
  }
  var STEADY = /^(idle|walk)/;
  function bodyMeasure() {
    if (!(sprite2.type === "imported" && sprite2.rigFrame && sprite2.rigFrame.result)) return null;
    const refs = /* @__PURE__ */ new Map();
    const at = (r) => bodyPoint(r.px, r.stats.owner, Math.sqrt(r.px.length));
    return (name, i) => {
      const fr = timeline.anims[name] && timeline.anims[name].frames[i];
      if (!fr || fr.px) return null;
      const spec = fr.spec || {}, fn = spec.view ? sprite2.rigFrame.resultFor && sprite2.rigFrame.resultFor(spec.view) : sprite2.rigFrame.result;
      if (!fn) return null;
      const key = spec.view || "@main";
      if (!refs.has(key)) refs.set(key, at(fn({ rot: {}, off: {}, root: [0, 0] })));
      const ref = refs.get(key), cur2 = at(fn(spec.pose || { rot: {}, off: {}, root: [0, 0] }));
      if (cur2.mid === null || ref.mid === null) return null;
      return { mid: cur2.mid, y1: cur2.y1, refMid: ref.mid, refY1: ref.y1, steady: STEADY.test(name) };
    };
  }
  function iaOf() {
    if (!hasImported()) return null;
    const act = activeWork(), imageOf = (w2) => w2 && w2.source ? { name: w2.source.name, fingerprint: w2.source.hash } : null;
    return {
      main: mainDir(),
      rest: importedAsset.rest,
      image: imageOf(curView() ? importedAsset.work : act),
      views: viewDirs().map((d) => ({ dir: d, rest: viewOf(d).rest, image: imageOf(d === curView() ? act : viewOf(d).work) })),
      layers: (v) => layersFor(v)
    };
  }
  function rigFindings() {
    const ia = iaOf(), r = ia && importedFindings(packCtx(), ia, (n, i) => framesFor(n)[i].out);
    if (!r) return null;
    lastDirViews = r.dirs;
    return r.findings;
  }
  function sourceNotes(rows) {
    const ia = sprite2.type === "imported" ? iaOf() : null;
    return ia ? importedSource(packCtx(), ia, rows, (n, i) => framesFor(n)[i].out) : null;
  }
  var lastCheck = { findings: [], errors: 0, warnings: 0 };
  var lastDirViews = [];
  function runCheck(layout2) {
    lastCheck = validateFrames({ timeline, F: frameSize(), pixelsOf: (n, i) => framesFor(n)[i].out, rows: sheetRows(), layout: layout2, measure: bodyMeasure() });
    const extra = rigFindings();
    if (extra) {
      lastCheck = { ...lastCheck, findings: [...lastCheck.findings, ...extra], warnings: lastCheck.warnings + extra.filter((f) => f.level === "warning").length, notes: extra.filter((f) => f.level === "info").length };
    }
    const { errors, warnings, findings } = lastCheck;
    $("#checkSummary").textContent = `${errors} error${errors === 1 ? "" : "s"} \xB7 ${warnings} warning${warnings === 1 ? "" : "s"}${errors ? " \xB7 fix errors before exporting" : ""}`;
    const rank = { error: 0, warning: 1, info: 2 };
    const shown = findings.slice().sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 40);
    const items = shown.map((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "finding";
      const lvl = document.createElement("span");
      lvl.className = "lvl " + f.level;
      lvl.textContent = f.level;
      const msg = document.createElement("span");
      msg.textContent = f.message;
      b.append(lvl, msg);
      if (f.anim && timeline.anims[f.anim]) b.addEventListener("click", () => {
        anim = f.anim;
        renderAnimSeg();
        selectFrame(f.frame ?? 0);
      });
      return b;
    });
    if (findings.length > shown.length) {
      const more = document.createElement("p");
      more.className = "hint";
      more.textContent = `\u2026and ${findings.length - shown.length} more`;
      items.push(more);
    }
    if (!findings.length) {
      const ok = document.createElement("p");
      ok.className = "hint check-ok";
      ok.textContent = "No problems found in any frame.";
      items.push(ok);
    }
    $("#findings").replaceChildren(...items);
  }
  function drawSheetPreview() {
    const { cv, cols, rows, layout: layout2 } = buildSheet(state.scale, curVariant()), F = frameSize();
    runCheck(layout2);
    const p = $("#sheetCanvas");
    p.width = cv.width;
    p.height = cv.height;
    const ctx = p.getContext("2d");
    ctx.clearRect(0, 0, p.width, p.height);
    ctx.drawImage(cv, 0, 0);
    $("#sheetInfo").textContent = rows ? `${rows} row${rows > 1 ? "s" : ""} \xD7 ${cols} cols \xB7 ${F}\xD7${F} frames \xB7 ${cv.width}\xD7${cv.height} px` : "Tick at least one animation row.";
  }
  var baseName = () => `${sprite2.type}_${sprite2.N}px_${sprite2.seedShape}${sprite2.seedColor !== sprite2.seedShape ? "_" + sprite2.seedColor : ""}`.replace(/[^\w.-]+/g, "-");
  var canvasBlob = (cv) => new Promise((res) => cv.toBlob(res, "image/png"));
  function gifFor(name, scale, variant = null) {
    return new Blob([gifBytes(packCtx(), name, scale, (n, i) => frameIn(n, i, variant).out)], { type: "image/gif" });
  }
  var dlNS;
  async function getDownloads() {
    if (dlNS !== void 0) return dlNS;
    try {
      dlNS = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
    } catch (e) {
      dlNS = null;
    }
    return dlNS;
  }
  async function saveFile(name, blob) {
    if (window.claude && window.claude.use) {
      const d = await getDownloads();
      if (!d) {
        toast("Saving files is not available in this view.");
        return false;
      }
      try {
        await d.save({ filename: name, data: blob });
        toast("Saved " + name);
        return true;
      } catch (e) {
        toast(e && e.code === "declined" ? "Save cancelled" : "Could not save " + name + (e && e.message ? ": " + e.message : ""));
        return false;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5e3);
    toast("Saved " + name);
    return true;
  }
  var pendingWork = null;
  function activeWork() {
    const w2 = pendingWork, imp = w2 ? null : importPanel.state();
    return w2 ? { source: w2.source, crop: w2.crop, place: w2.place, background: w2.background, conversion: w2.conversion } : imp ? { source: imp.source, crop: imp.crop, place: imp.place, background: bgPanel.state(), conversion: convPanel.state() } : null;
  }
  function assetForSave(reduced2 = false) {
    const act = activeWork(), base = curView() ? importedAsset && importedAsset.work || null : act;
    if (!base) return null;
    const copy2 = reduced2 && !curView() && base.source.bytes ? pendingWork ? null : bgPanel.reducedCopy() : null;
    const source = copy2 ? { ...base.source, bytes: null, base64: null, reduced: copy2 } : base.source;
    const views = [];
    for (const d of viewDirs()) {
      const v = viewOf(d), work = d === curView() ? act : v.work;
      if (work) views.push({ direction: d, ...work, rest: v.rest, history: v.history || [] });
    }
    return { ...base, source, rest: importedAsset ? importedAsset.rest : null, history: importedAsset ? importedAsset.history : [], direction: mainDir(), views };
  }
  function currentProject(asset = assetForSave()) {
    return serializeProject({ state, sprite: sprite2, timeline, rows: timeline.order.filter((n) => sheetAnims.has(n)), edited, asset, workshop: workshopPanel.get(), variants });
  }
  function markProjectDirty() {
    projectDirty = true;
    autosaveDue = true;
    renderProjectStatus();
  }
  var autosaveReduced = false;
  function renderProjectStatus() {
    $("#projectStatus").textContent = (projectDirty ? "Unsaved changes" + (projectName ? ` (last saved or opened: ${projectName})` : "") : projectName ? `Up to date with ${projectName}` : "Not saved to a file yet") + (autosaveReduced && projectDirty ? ". The browser copy keeps only a reduced image; Save project keeps the original." : "");
  }
  function showProjectMessages(kind, lines) {
    const el2 = $("#projectMsg");
    el2.replaceChildren(...lines.map((t) => {
      const p = document.createElement("p");
      p.className = "msg " + kind;
      p.textContent = t;
      return p;
    }));
    el2.hidden = !lines.length;
  }
  async function saveProject() {
    const name = baseName() + ".sfproj.json";
    const ok = await saveFile(name, new Blob([JSON.stringify(currentProject())], { type: "application/json" }));
    if (ok) {
      projectDirty = false;
      projectName = name;
      showProjectMessages("info", []);
      renderProjectStatus();
    }
  }
  function applyProject(project) {
    const r = restoreProject(project);
    state = r.state;
    sprite2 = r.sprite;
    timeline = r.timeline;
    edited = r.edited;
    variants = r.variants || [];
    shownVariant = "";
    variantEditor.render();
    setCustomPalette(state.customPalette);
    sheetAnims = new Set(r.rows);
    undo = [];
    redo = [];
    strokeStart = null;
    workingPx = null;
    activeLayer = null;
    hiddenLayers = /* @__PURE__ */ new Set();
    anim = timeline.order[0];
    frameIdx = 0;
    paintColor = null;
    cache.clear();
    stageDirty = sheetDirty = true;
    importedAsset = r.asset ? {
      rest: r.asset.rest,
      history: r.asset.history.slice(),
      direction: r.asset.direction || "E",
      views: Object.fromEntries((r.asset.views || []).map((v) => [v.direction, { direction: v.direction, work: { source: v.source, crop: v.crop, place: v.place, background: v.background, conversion: v.conversion }, rest: v.rest, history: (v.history || []).slice() }]))
    } : null;
    activeDir = null;
    partsPanel.setRest(hasImported() ? importedAsset.rest : null);
    syncControls();
    renderAnimSeg();
    renderAnimList();
    renderStrip();
    renderSwatches();
    renderHeroPanel();
    buildThumbs();
    renderCustomPalette();
    saveState();
    workshopPanel.load(r.workshop);
    restoreWork(r.asset);
    renderDirBar();
  }
  var restoring = 0;
  var restoreToken = 0;
  async function restoreWork(a) {
    const token = ++restoreToken;
    restoring++;
    try {
      if (!a || !a.source) {
        pendingWork = null;
        importPanel.reset();
        return;
      }
      pendingWork = a;
      const r = await importPanel.restore(a);
      if (token !== restoreToken) return;
      if (!r.ok) {
        showProjectMessages("warning", [r.message, "The Imported sprite is kept; the image steps are empty until you upload the image again."]);
        return;
      }
      convPanel.restore(a.conversion);
      bgPanel.restore(a.background);
      convPanel.convertNow();
      pendingWork = null;
    } finally {
      restoring--;
      renderVersions();
    }
  }
  var workChanged = () => {
    if (!restoring) {
      pendingWork = null;
      markProjectDirty();
    }
  };
  function addViewRows() {
    for (const d of viewDirs()) {
      const anims = viewOf(d).rest && viewOf(d).rest.anims || {};
      for (const [n, a] of Object.entries(anims)) {
        const row = rowName(n, d, mainDir());
        sprite2.anims[row] = sampleAnim(a);
        sprite2.animMeta[row] = { fps: a.fps, loop: a.loop };
        timeline = applyToTimeline(timeline, row, a, d);
      }
    }
  }
  function switchDirection(d) {
    if (!hasImported()) return;
    const target = d === mainDir() ? null : d;
    if (target === curView()) return;
    const leaving = cur(), work = activeWork();
    if (leaving) leaving.work = work;
    activeDir = target;
    const c = cur();
    if (c.work) restoreWork(c.work);
    else {
      pendingWork = null;
      importPanel.reset();
      const main = importedAsset.rest;
      convPanel.restore({ ...main.settings || {}, height: main.N, locked: main.palette.slice() });
    }
    partsPanel.setRest(c.rest || null);
    renderVersions();
    renderDirBar();
    if (templatePanel) templatePanel.refresh(curRest());
  }
  function addDirection(d) {
    if (!hasImported() || viewOf(d) || d === mainDir()) return;
    importedAsset.views = { ...importedAsset.views || {}, [d]: { direction: d, work: null, rest: null, history: [] } };
    markProjectDirty();
    switchDirection(d);
    toast(`Direction ${d} added: upload its image in step 1. It must become ${importedAsset.rest.N} px in step 3.`);
  }
  function removeDirection(d) {
    const v = viewOf(d);
    if (!v) return;
    askGuard(`Removing direction ${d} deletes its image, parts, rig and animations (${Object.keys(v.rest && v.rest.anims || {}).length}).`, () => {
      if (curView() === d) switchDirection(mainDir());
      const names = Object.keys(v.rest && v.rest.anims || {});
      importedAsset.views = Object.fromEntries(Object.entries(importedAsset.views).filter(([k]) => k !== d));
      for (const n of names) {
        const row = rowName(n, d, mainDir());
        delete sprite2.anims[row];
        delete sprite2.animMeta[row];
        timeline = removeFromTimeline(timeline, row);
        sheetAnims.delete(row);
      }
      if (!timeline.anims[anim]) {
        anim = timeline.order[0];
        frameIdx = 0;
      }
      attachRig();
      renderAnimSeg();
      renderAnimList();
      renderStrip();
      markProjectDirty();
      renderDirBar();
      if (templatePanel) templatePanel.refresh(curRest());
    });
  }
  function setMainDirection(d) {
    if (!hasImported() || viewOf(d) || d === mainDir()) return;
    importedAsset.direction = d;
    markProjectDirty();
    renderDirBar();
    if (templatePanel) templatePanel.refresh(curRest());
  }
  function directions() {
    if (!hasImported()) return [];
    const out = [{ dir: mainDir(), main: true, rest: importedAsset.rest, layers: layersFor(null) }];
    for (const d of viewDirs()) {
      const v = viewOf(d);
      if (v.rest) out.push({ dir: d, main: false, rest: v.rest, layers: layersFor(d) });
    }
    return out;
  }
  // sets animation `name` of direction `dir` to `a`, or removes it when `a` is null
  function addAnimationTo(dir, name, a, note) {
    if (dir === (curView() || mainDir())) {
      animPanel.put(name, a, note);
      return;
    }
    const view = dir === mainDir() ? null : dir, rec = view ? viewOf(view) : importedAsset;
    rec.rest.anims = { ...rec.rest.anims || {}, [name]: a };
    if (!a) delete rec.rest.anims[name];
    const v = (rec.history || []).find((h) => h.work && rec.rest.work && h.work.dataUrl === rec.rest.work.dataUrl && h.px.join() === rec.rest.px.join());
    if (v) v.anims = rec.rest.anims;
    animsToTimeline([name], view);
    markProjectDirty();
  }
  function renderDirBar() {
    const on = hasImported();
    $("#dirBar").hidden = !on;
    if (!on) return;
    const main = mainDir(), shown = curView() || main;
    seg($("#dirSeg"), [main, ...DIRECTIONS.filter((d) => d !== main)].map((d) => [d, d === main ? `${d} \xB7 main image` : !viewOf(d) ? `${d} \xB7 needs its own image` : d + (viewOf(d).rest ? "" : " \xB7 no sprite yet")]), shown, (v) => viewOf(v) || v === main ? switchDirection(v) : addDirection(v));
    const free = DIRECTIONS.filter((d) => d !== main && !viewOf(d));
    $("#dirAdd").replaceChildren(...free.map((d) => new Option(`${d} \xB7 ${DIRECTION_LABEL[d]}`, d)));
    $("#dirAddBtn").disabled = !free.length || viewDirs().length >= MAX_VIEWS;
    $("#dirMain").replaceChildren(...DIRECTIONS.filter((d) => d === main || !viewOf(d)).map((d) => new Option(`${d} \xB7 ${DIRECTION_LABEL[d]}`, d)));
    $("#dirMain").value = main;
    $("#dirRemove").hidden = !curView();
    $("#dirInfo").textContent = curView() ? `Steps 1\u20137 below work on direction ${shown} (${DIRECTION_LABEL[shown]}). Its animations are the rows ending in _${shown.toLowerCase()}. The main editor keeps the main image.` : `Steps 1\u20137 below work on the main image (${DIRECTION_LABEL[main]}). Each other direction needs its own image: nothing is rotated, stretched or mirrored to make one.`;
  }
  $("#dirAddBtn").addEventListener("click", () => addDirection($("#dirAdd").value));
  $("#dirRemove").addEventListener("click", () => removeDirection(curView()));
  $("#dirMain").addEventListener("change", (e) => setMainDirection(e.target.value));
  function workImage(work) {
    const c = document.createElement("canvas");
    c.width = c.height = work.size;
    c.getContext("2d").putImageData(new ImageData(workToRGBA(work), work.size, work.size), 0, 0);
    return { dataUrl: c.toDataURL("image/png"), size: work.size };
  }
  var versionInUse = (rest) => (cur() && cur().history || []).find((h) => h.work && rest.work && h.work.dataUrl === rest.work.dataUrl && h.px.join() === rest.px.join());
  function partsChanged(seg2) {
    const rest = curRest();
    if (!rest) return;
    rest.seg = seg2;
    rest.rig = syncRig(seg2, rest.rig);
    if (rest.art) rest.art = pruneArt(rest.art, rest);
    const pruned = rest.anims ? pruneSwaps(pruneAnims(rest.anims, rest.rig), rest.art) : null;
    if (pruned) rest.anims = pruned;
    const v = versionInUse(rest);
    if (v) {
      v.seg = seg2;
      v.rig = rest.rig;
      v.art = rest.art;
      if (pruned) v.anims = pruned;
    }
    refreshRig();
    if (!curView()) retagImported();
    if (pruned) animsToTimeline(Object.keys(pruned), curView());
    markProjectDirty();
  }
  function rigChanged(rig) {
    const rest = curRest();
    if (!rest) return;
    rest.rig = rig;
    const v = versionInUse(rest);
    if (v) v.rig = rig;
    if (!curView()) retagImported();
    attachRig();
    refreshAnimStep(rest);
    markProjectDirty();
  }
  function refreshRig() {
    const d = partsPanel.data(), rest = curRest();
    if (rest && rest.seg && !rest.rig) rest.rig = syncRig(rest.seg);
    rigPanel.refresh(rest, d && d.rgba);
    refreshAnimStep(rest);
    artPanel.refresh(rest);
    attachRig();
  }
  function artChanged(art) {
    const rest = curRest();
    if (!rest) return;
    rest.art = art;
    const anims = rest.anims ? pruneSwaps(rest.anims, art) : null;
    if (anims) rest.anims = anims;
    const v = versionInUse(rest);
    if (v) {
      v.art = art;
      if (anims) v.anims = anims;
    }
    attachRig();
    refreshAnimStep(rest);
    if (anims) animsToTimeline(Object.keys(anims), curView());
    markProjectDirty();
  }
  var layerCache = /* @__PURE__ */ new Map();
  var workRGBA = /* @__PURE__ */ new Map();
  function layersFor(view) {
    const rest = view ? viewOf(view) && viewOf(view).rest : hasImported() ? importedAsset.rest : null;
    if (!rest || !rest.seg || !rest.rig) return null;
    const shown = (view || null) === curView(), d = shown ? partsPanel.data() : null;
    const rgba = shown ? d && d.rgba : rest.work ? workRGBA.get(rest.work.dataUrl) : null;
    if (!rgba) {
      if (!shown) decodeWork(rest.work);
      return null;
    }
    const key = view || "@main", hit = layerCache.get(key);
    if (hit && hit.seg === rest.seg && hit.rgba === rgba && hit.bleed === rest.rig.bleed && hit.art === rest.art) return hit.L;
    const L = prepareLayers(rest.seg, rgba, rest.rig, rest.art || null, rest.N);
    layerCache.set(key, { seg: rest.seg, rgba, bleed: rest.rig.bleed, art: rest.art, L });
    return L;
  }
  var rigLayers = () => layersFor(curView());
  var decoding = /* @__PURE__ */ new Set();
  function decodeWork(work) {
    if (!work || workRGBA.has(work.dataUrl) || decoding.has(work.dataUrl)) return;
    decoding.add(work.dataUrl);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = work.size;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      workRGBA.set(work.dataUrl, ctx.getImageData(0, 0, work.size, work.size).data);
      decoding.delete(work.dataUrl);
      attachRig();
    };
    img.onerror = () => decoding.delete(work.dataUrl);
    img.src = work.dataUrl;
  }
  function attachRig() {
    if (!sprite2 || sprite2.type !== "imported" || !hasImported()) return;
    sprite2.rigFrame = rigFrames(iaOf());
    cache.clear();
    stageDirty = sheetDirty = true;
    renderStrip();
    runPreflight();
  }
  var pfMotion = null;
  function runPreflight() {
    if (!preflightPanel) return;
    const rest = hasImported() ? curRest() : null, L = rest && rest.seg && rest.rig ? rigLayers() : null;
    if (!L) {
      preflightPanel.render(null);
      return;
    }
    const names = new Map([...rest.seg.parts.map((p) => [p.id, p.label]), ...rest.seg.extras.map((e) => [e.id, e.label || e.id])]);
    preflightPanel.render(preflight({ rest, layers: L, template: pfMotion ? templateById(pfMotion) : null, labelOf: (id) => names.get(id) || id }));
  }
  function preflightFix(fix) {
    if (fix.step === "parts") {
      partsPanel.focus({ part: fix.part || null, unassigned: fix.what === "unassigned" });
      $("#partsWork").scrollIntoView({ block: "start" });
    } else if (fix.step === "rig") {
      $("#rigWork").scrollIntoView({ block: "start" });
      rigPanel.focus({ joint: fix.joint || null, control: fix.control || null });
    } else if (fix.step === "motion") {
      $("#anTabs").querySelector('[data-tab="template"]').click();
      $("#anTemplate").scrollIntoView({ block: "start" });
    }
  }
  function animsChanged(anims, names) {
    const rest = curRest();
    if (!rest) return;
    rest.anims = anims;
    const v = versionInUse(rest);
    if (v) v.anims = anims;
    animsToTimeline(names, curView());
    markProjectDirty();
  }
  function animsToTimeline(names, view = null) {
    if (!sprite2 || sprite2.type !== "imported") return;
    const rest = view ? viewOf(view) && viewOf(view).rest : importedAsset.rest, anims = rest && rest.anims || {};
    sprite2.animMeta = sprite2.animMeta || {};
    for (const n of names) {
      const row = view ? rowName(n, view, mainDir()) : n;
      if (anims[n]) {
        sprite2.anims[row] = sampleAnim(anims[n]);
        sprite2.animMeta[row] = { fps: anims[n].fps, loop: anims[n].loop };
        if (!timeline.anims[row]) sheetAnims.add(row);
        timeline = applyToTimeline(timeline, row, anims[n], view);
      } else {
        delete sprite2.anims[row];
        delete sprite2.animMeta[row];
        timeline = removeFromTimeline(timeline, row);
        sheetAnims.delete(row);
      }
    }
    if (!timeline.anims[anim]) {
      anim = timeline.order[0];
      frameIdx = 0;
    }
    frameIdx = Math.min(frameIdx, frameCount(timeline, anim) - 1);
    cache.clear();
    stageDirty = sheetDirty = true;
    renderAnimSeg();
    renderAnimList();
    renderStrip();
  }
  function retagImported() {
    const rest = importedAsset.rest;
    if (sprite2 && sprite2.type === "imported") {
      const t = importedTags(rest, sprite2.px);
      sprite2.tag = t.tag;
      sprite2.order = t.order;
      if (activeLayer && !sprite2.order.includes(activeLayer)) activeLayer = null;
      hiddenLayers = new Set([...hiddenLayers].filter((l) => sprite2.order.includes(l)));
      invalidate();
      renderLayers();
    }
  }
  function renderVersions() {
    const c = cur(), h = c ? c.history || [] : [], curPx = c && c.rest ? c.rest.px.join() : null;
    $("#convVersionRow").hidden = !h.length;
    $("#convVersions").replaceChildren(...h.map((v, i) => new Option(v.label + (v.px.join() === curPx ? " (in use)" : ""), String(i))).reverse());
  }
  $("#convApply").addEventListener("click", () => {
    const r = convPanel.result();
    if (!r || !r.stats.opaque) return;
    const settings = convPanel.state(), rest = { N: r.N, palette: r.fullPalette.slice(), px: r.px.slice(), work: workImage(r.work), settings };
    if (curView()) {
      const d = curView(), v = viewOf(d);
      if (r.N !== importedAsset.rest.N) {
        toast(`Direction ${d} must be ${importedAsset.rest.N} px like the main image: set the size in step 3.`);
        return;
      }
      if (v.rest && v.rest.anims) {
        const old = Object.keys(v.rest.anims);
        v.rest = { ...v.rest, anims: {} };
        animsToTimeline(old, d);
      }
      const history = (v.history || []).slice(), last = history[history.length - 1], n = last ? Number((last.label.match(/^Version (\d+)/) || [0, history.length])[1]) + 1 : 1;
      history.push(versionOf(rest, settings, (/* @__PURE__ */ new Date()).toISOString(), n));
      while (history.length > HISTORY_MAX) history.shift();
      v.rest = rest;
      v.history = history;
      markProjectDirty();
      renderVersions();
      partsPanel.setRest(rest);
      renderDirBar();
      toast(`Version ${n} is now direction ${d}`);
      return;
    }
    if (importedAsset && viewDirs().length && r.N !== importedAsset.rest.N) {
      toast(`The other directions are ${importedAsset.rest.N} px: keep the main image at that size (step 3).`);
      return;
    }
    guardDiscard("Using the converted image", () => {
      const history = importedAsset ? importedAsset.history.slice() : [];
      const last = history[history.length - 1], n = last ? Number((last.label.match(/^Version (\d+)/) || [0, history.length])[1]) + 1 : 1;
      history.push(versionOf(rest, settings, (/* @__PURE__ */ new Date()).toISOString(), n));
      while (history.length > HISTORY_MAX) history.shift();
      importedAsset = { ...importedAsset || {}, rest, history };
      state.type = "imported";
      regenerate();
      buildThumbs();
      markProjectDirty();
      renderVersions();
      partsPanel.setRest(rest);
      renderDirBar();
      toast(`Version ${n} is now the Imported sprite`);
    });
  });
  $("#convRestore").addEventListener("click", () => {
    const c = cur(), v = c && c.history[Number($("#convVersions").value)];
    if (!v) return;
    const restOf = () => ({ N: v.N, palette: v.palette.slice(), px: v.px.slice(), settings: v.settings, ...v.work ? { work: v.work } : {}, ...v.seg ? { seg: v.seg } : {}, ...v.rig ? { rig: v.rig } : {}, ...v.anims ? { anims: v.anims } : {} });
    if (curView()) {
      const d = curView(), old = Object.keys(c.rest && c.rest.anims || {});
      c.rest = restOf();
      animsToTimeline([.../* @__PURE__ */ new Set([...old, ...Object.keys(c.rest.anims || {})])], d);
      markProjectDirty();
      renderVersions();
      partsPanel.setRest(c.rest);
      toast(`Direction ${d} returned to ${v.label.split(" \xB7 ")[0]}.`);
      return;
    }
    guardDiscard("Returning to an earlier version", () => {
      importedAsset = { ...importedAsset, rest: { N: v.N, palette: v.palette.slice(), px: v.px.slice(), settings: v.settings, ...v.work ? { work: v.work } : {}, ...v.seg ? { seg: v.seg } : {}, ...v.rig ? { rig: v.rig } : {}, ...v.anims ? { anims: v.anims } : {} }, history: importedAsset.history };
      state.type = "imported";
      regenerate();
      buildThumbs();
      markProjectDirty();
      renderVersions();
      partsPanel.setRest(importedAsset.rest);
      toast(`Returned to ${v.label.split(" \xB7 ")[0]}. The step 3 settings are unchanged.`);
    });
  });
  async function openProjectFile(file) {
    let raw;
    try {
      raw = JSON.parse(await file.text());
    } catch (e) {
      showProjectMessages("error", [`${file.name} is not valid JSON, so it was not opened. Your current work is unchanged.`]);
      return;
    }
    const v = validateProject(raw);
    if (v.errors.length) {
      showProjectMessages("error", [`${file.name} was not opened. Your current work is unchanged.`, ...v.errors]);
      return;
    }
    applyProject(v.project);
    projectName = file.name;
    projectDirty = false;
    renderProjectStatus();
    showProjectMessages(v.warnings.length ? "warning" : "info", v.warnings.length ? [`Opened ${file.name} with notes:`, ...v.warnings] : []);
    toast("Opened " + file.name);
  }
  $("#saveProject").addEventListener("click", saveProject);
  window.addEventListener("pagehide", () => {
    if (autosaveDue) autosave();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && autosaveDue) autosave();
  });
  $("#openProject").addEventListener("click", () => {
    if (!projectDirty) {
      $("#openFile").click();
      return;
    }
    askGuard("Opening a project replaces your current work, which has changes not saved to a project file.", () => $("#openFile").click());
  });
  var guardAction = null;
  function askGuard(text, action) {
    guardAction = action;
    $("#guardText").textContent = text;
    $("#guard").hidden = false;
    $("#guardCancel").focus();
  }
  function guardDiscard(label, action) {
    if (!edited) {
      action();
      return;
    }
    askGuard(`${label} will rebuild the sprite and lose your pixel and timeline edits.`, action);
  }
  function closeGuard() {
    guardAction = null;
    $("#guard").hidden = true;
    syncControls();
    renderHeroPanel();
  }
  $("#guardCancel").addEventListener("click", closeGuard);
  $("#guardGo").addEventListener("click", () => {
    const a = guardAction;
    closeGuard();
    if (a) a();
  });
  $("#guardSave").addEventListener("click", async () => {
    const a = guardAction;
    await saveProject();
    if (!projectDirty) {
      closeGuard();
      if (a) a();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#guard").hidden) closeGuard();
  });
  window.addEventListener("beforeunload", (e) => {
    if (projectDirty && (autosaveFailed || autosaveReduced)) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes.";
      return e.returnValue;
    }
  });
  $("#openFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) openProjectFile(f);
  });
  var AUTOSAVE_FULL_LIMIT = 35e5;
  function autosave() {
    autosaveDue = false;
    const full = assetForSave(), canReduce = !!(full && full.source.bytes && !pendingWork);
    let reduced2 = canReduce && full.source.size * 4 / 3 > AUTOSAVE_FULL_LIMIT;
    try {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(currentProject(reduced2 ? assetForSave(true) : full)));
      } catch (e) {
        if (reduced2 || !canReduce) throw e;
        reduced2 = true;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(currentProject(assetForSave(true))));
      }
    } catch (e) {
      autosaveFailed = true;
      $("#projectStatus").textContent = "Autosave unavailable in this browser view; use Save project.";
      return;
    }
    autosaveFailed = false;
    if (autosaveReduced !== reduced2) {
      autosaveReduced = reduced2;
      renderProjectStatus();
    }
  }
  function needRows() {
    if (!sheetRows().length) {
      toast("Tick at least one animation row first.");
      return false;
    }
    return noErrors();
  }
  function noErrors() {
    if (lastCheck.errors) {
      toast(`Export stopped: the frame check found ${lastCheck.errors} error${lastCheck.errors === 1 ? "" : "s"}.`);
      return false;
    }
    return true;
  }
  var shownName = () => curVariant() ? "_" + curVariant().name : "";
  $("#pngBtn").addEventListener("click", async () => {
    if (!needRows()) return;
    await saveFile(baseName() + shownName() + ".png", await canvasBlob(buildSheet(state.scale, curVariant()).cv));
  });
  $("#jsonBtn").addEventListener("click", () => {
    if (!needRows()) return;
    saveFile(baseName() + ".json", new Blob([JSON.stringify(buildSheet(state.scale).json, null, 2)], { type: "application/json" }));
  });
  async function asepriteFile() {
    const rows = sheetRows(), anims = {};
    for (const n of rows) {
      const a = timeline.anims[n];
      anims[n] = { mode: modeOf(a), loop: a.loop, repeat: repeatOf(a), frames: a.frames.map((fr, i) => ({ px: framesFor(n)[i].out, dur: frameDurationMs(timeline, n, i, state.fps), data: fr.data || null })) };
    }
    return writeAseprite(framesToAseprite({ F: frameSize(), rows, anims }), deflate);
  }
  $("#aseBtn").addEventListener("click", async () => {
    if (!needRows()) return;
    await saveFile(baseName() + ".aseprite", new Blob([await asepriteFile()], { type: "application/octet-stream" }));
  });
  $("#gifBtn").addEventListener("click", () => noErrors() && saveFile(`${baseName()}${shownName()}_${anim}.gif`, gifFor(anim, state.scale, curVariant())));
  function cutoutScenes(base, rows) {
    const ia = sprite2 && sprite2.type === "imported" ? iaOf() : null;
    return ia ? importedCutout(packCtx(), ia, rows, base) : [];
  }
  function rasterCanvas(r) {
    const c = document.createElement("canvas");
    c.width = r.w;
    c.height = r.h;
    if (r.w && r.h) c.getContext("2d").putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
    return c;
  }
  async function buildExport(preset) {
    const rows = sheetRows(), cut = PRESETS2[preset] && PRESETS2[preset].godot ? cutoutScenes(baseName(), rows) : [];
    const { plan, out } = buildPack(packCtx(), preset, { source: sourceNotes(rows), cutout: cut, pixel: (n, i) => framesFor(n)[i].out });
    const files = [];
    for (const [path, data] of out) files.push([path, data.raster ? await canvasBlob(rasterCanvas(data.raster)) : data instanceof Uint8Array ? new Blob([data], { type: "image/gif" }) : data]);
    return { plan, out: files };
  }
  async function exportPreset(preset) {
    if (!needRows()) return;
    if (!window.JSZip) {
      toast("The zip library did not load. Save the PNG and JSON separately.");
      return;
    }
    const { plan, out } = await buildExport(preset), zip = new JSZip();
    for (const [path, data] of out) zip.file(path, data);
    saveFile(plan.zipName, await zip.generateAsync({ type: "blob" }));
  }
  $("#zipBtn").addEventListener("click", () => exportPreset("full"));
  $("#exportPreset").replaceChildren(...Object.entries(PRESETS2).map(([k, p]) => new Option(p.label, k)));
  $("#presetBtn").addEventListener("click", () => exportPreset($("#exportPreset").value));
  if (!window.JSZip) for (const id of ["#zipBtn", "#presetBtn"]) {
    $(id).disabled = true;
    $(id).title = "Zip library unavailable";
  }
  $("#palette").addEventListener("change", (e) => {
    state.palette = e.target.value;
    saveState();
    paintColor = null;
    invalidate();
    refreshThumbs();
    renderCustomPalette();
  });
  function applyCustomPalette(colors, { save = true } = {}) {
    state.customPalette = colors.slice(0, CUSTOM_MAX);
    setCustomPalette(state.customPalette);
    if (save) saveState();
    if (state.palette === "custom") {
      paintColor = null;
      invalidate();
      refreshThumbs();
    }
    renderCustomPalette();
  }
  function renderCustomPalette() {
    const on = state.palette === "custom", cols = state.customPalette;
    $("#customPaletteGroup").hidden = !on;
    if (!on) return;
    $("#customSwatches").replaceChildren(...cols.map((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.background = c;
      b.className = "cp-swatch";
      b.setAttribute("aria-label", "Remove " + c);
      b.title = c + " (click to remove)";
      b.addEventListener("click", () => applyCustomPalette(state.customPalette.filter((x) => x !== c)));
      return b;
    }));
    if (document.activeElement !== $("#cpHex")) $("#cpHex").value = cols.join(" ");
    $("#cpHint").textContent = cols.length ? `${cols.length} of ${CUSTOM_MAX} colours. Every rendered pixel uses the nearest of these.` : "Empty: add colours to start locking the sprite to them. Until then colours stay free.";
  }
  function spriteColours() {
    const set = new Set(sprite2.px.filter(Boolean));
    for (const n of timeline.order) for (const f of timeline.anims[n].frames) if (f.px) {
      for (const c of f.px) if (c) set.add(c);
    }
    return [...set].sort((a, b) => lum(a) - lum(b)).slice(0, CUSTOM_MAX);
  }
  $("#cpAdd").addEventListener("click", () => {
    const c = $("#cpColor").value.toLowerCase();
    if (state.customPalette.includes(c)) {
      toast(c + " is already in the palette");
      return;
    }
    if (state.customPalette.length >= CUSTOM_MAX) {
      toast(`The custom palette holds up to ${CUSTOM_MAX} colours.`);
      return;
    }
    applyCustomPalette([...state.customPalette, c]);
  });
  $("#cpFromSprite").addEventListener("click", () => applyCustomPalette(spriteColours()));
  $("#cpClear").addEventListener("click", () => applyCustomPalette([]));
  $("#cpPreset").addEventListener("change", (e) => {
    const P = PALETTES[e.target.value];
    e.target.value = "";
    if (P) applyCustomPalette(P.colors.map((c) => c.toLowerCase()));
  });
  var cpRamp = () => buildRamp($("#cpRampBase").value, Number($("#cpRampSteps").value), { hueShift: Number($("#cpRampShift").value) });
  function cpRampPreview() {
    $("#cpRampPreview").replaceChildren(...cpRamp().map((c) => {
      const e = document.createElement("span");
      e.style.background = c;
      e.title = c;
      return e;
    }));
  }
  for (const id of ["#cpRampBase", "#cpRampSteps", "#cpRampShift"]) $(id).addEventListener("input", cpRampPreview);
  cpRampPreview();
  $("#cpRampAdd").addEventListener("click", () => {
    const fresh2 = cpRamp().filter((c) => !state.customPalette.includes(c));
    if (!fresh2.length) {
      toast("Those colours are already in the palette.");
      return;
    }
    if (state.customPalette.length + fresh2.length > CUSTOM_MAX) {
      toast(`The custom palette has room for ${CUSTOM_MAX - state.customPalette.length} more colours.`);
      return;
    }
    applyCustomPalette([...state.customPalette, ...fresh2]);
    toast(`Added ${fresh2.length} ramp colours.`);
  });
  $("#cpPalFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const r = paletteColours(readPaletteFile(file.name, await file.text()), CUSTOM_MAX);
      if (!r.colours.length) {
        toast("That palette file has no colours.");
        return;
      }
      applyCustomPalette(r.colours);
      toast(`${file.name}: ${r.colours.length} colours${r.duplicates ? `, ${r.duplicates} repeated left out` : ""}${r.dropped ? `, ${r.dropped} over the ${CUSTOM_MAX}-colour limit left out` : ""}.`);
    } catch (err) {
      toast(err.message);
    }
  });
  $("#cpPalSave").addEventListener("click", () => {
    if (!state.customPalette.length) {
      toast("The custom palette is empty.");
      return;
    }
    const fmt2 = $("#cpPalFormat").value;
    saveFile("sprite-foundry-palette." + fmt2, new Blob([writePaletteFile(fmt2, asPalette(state.customPalette))], { type: "text/plain" }));
  });
  $("#cpHex").addEventListener("change", (e) => {
    const cols = parseHexList(e.target.value);
    if (!cols.length && e.target.value.trim()) {
      toast("No #rrggbb colours found in that text.");
      return;
    }
    applyCustomPalette(cols);
  });
  $("#shapeSeed").addEventListener("change", (e) => {
    const v = e.target.value.trim() || randSeed();
    guardDiscard("Changing the shape seed", () => {
      state.shape = v;
      regenerate(true);
    });
  });
  $("#colorSeed").addEventListener("change", (e) => {
    const v = e.target.value.trim() || randSeed();
    guardDiscard("Changing the colour seed", () => {
      state.color = v;
      regenerate(true);
    });
  });
  $("#reshapeBtn").addEventListener("click", () => guardDiscard("A new shape", () => {
    state.shape = randSeed();
    regenerate(true);
  }));
  $("#recolorBtn").addEventListener("click", () => guardDiscard("New colours", () => {
    state.color = randSeed();
    regenerate(true);
  }));
  $("#batchBtn").addEventListener("click", () => {
    state.batch = randSeed();
    saveState();
    buildThumbs();
  });
  $("#fps").addEventListener("input", (e) => {
    state.fps = +e.target.value;
    $("#fpsLabel").textContent = state.fps + " fps";
    saveState();
  });
  $("#playBtn").addEventListener("click", togglePlay);
  $("#editBtn").addEventListener("click", () => {
    editMode = !editMode;
    stageDirty = true;
    syncControls();
    renderSwatches();
  });
  $("#undoBtn").addEventListener("click", doUndo);
  $("#redoBtn").addEventListener("click", doRedo);
  $("#resetBtn").addEventListener("click", () => {
    if (!edited) {
      toast("No edits to discard");
      return;
    }
    regenerate(true);
    toast("Edits discarded");
  });
  $("#customColor").addEventListener("input", (e) => {
    paintColor = e.target.value;
    if (tool !== "fill") tool = "pencil";
    syncControls();
    renderSwatches();
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#workshop").hidden) return;
    if (e.target.closest && e.target.closest("#helpPanel")) return;
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "select" || tag === "textarea";
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && (k === "y" || k === "z" && e.shiftKey) && (editMode || !typing)) {
      e.preventDefault();
      doRedo();
      return;
    }
    if (mod && k === "z" && (editMode || !typing)) {
      e.preventDefault();
      doUndo();
      return;
    }
    if (tag === "input" || tag === "select" || tag === "textarea" || tag === "button") return;
    if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const n = frameCount(timeline, anim);
      selectFrame((frameIdx + (e.key === "ArrowRight" ? 1 : n - 1)) % n);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      copyFrame2();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      pasteFrame();
    }
    if (e.key.toLowerCase() === "e") {
      editMode = !editMode;
      stageDirty = true;
      syncControls();
      renderSwatches();
    }
  });
  var toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2400);
  }
  var importPanel = initImportPanel({ $, toast });
  var bgPanel = initBackgroundPanel({ $, importPanel });
  var convPanel = initConvertPanel({ $, importPanel, bgPanel });
  importPanel.onChange(workChanged);
  bgPanel.onChange(workChanged);
  convPanel.onChange(workChanged);
  var partsPanel = initPartsPanel({ $, cv: bgPanel.cv, onChange: partsChanged, onReady: () => refreshRig() });
  async function workshopToRig({ file, size, colours, name, dir }) {
    await importPanel.load(file);
    convPanel.restore({ ...DEFAULTS2, ...convPanel.state(), height: size, headroom: 0, floor: 0, resample: "exact", cleanup: false, dither: false, contrast: 0, saturation: 0, locked: colours.slice(0, 64) });
    $("#bgMethod").value = "alpha";
    $("#bgMethod").dispatchEvent(new Event("change"));
    $("#bgRun").click();
    $("#importPanel").scrollIntoView({ block: "start" });
    toast(`${name}.png is in Image to pixel art, converted pixel for pixel. Check step 3 and press Use as sprite${dir && dir !== "E" ? `; it faces ${dir}: set that as the main direction in step 1` : ""}.`);
  }
  var workshopPanel = initWorkshopPanel({ onChange: markProjectDirty, saveFile, sendToRig: workshopToRig });
  var pageNow = () => ($('#modeSwitch [aria-pressed="true"]') || {}).dataset ? $('#modeSwitch [aria-pressed="true"]').dataset.mode : "foundry";
  var helpPanel = initHelpPanel({ $, mode: pageNow, setMode: (m) => $(`#modeSwitch [data-mode="${m}"]`).click() });
  var rigPanel = initRigPanel({ $, onChange: rigChanged });
  var animPanel = initAnimPanel({
    $,
    getLayers: () => rigLayers(),
    onChange: animsChanged,
    facing: () => FACING_OF[curView() || mainDir()],
    edited: (name) => timeline && timeline.anims[name] ? timeline.anims[name].frames.map((f, i) => f.px && f.spec && f.spec.pose ? i : -1).filter((i) => i >= 0) : [],
    rerender: (name, frames) => {
      let t = timeline;
      for (const i of frames) t = revertFrame(t, name, i);
      applyTimeline(t);
      syncControls();
    }
  });
  var artPanel = initArtPanel({ $, cv: bgPanel.cv, onChange: artChanged });
  templatePanel = initTemplatePanel({
    $,
    directions,
    shownDir: () => curView() || mainDir(),
    F: frameSize,
    // a preview frame exactly as the timeline will draw it (rig render, outline, palette; spec.view: another direction)
    frameOf: (spec) => framePixels(sprite2, { spec, px: null, dur: null }, opts()),
    addTo: addAnimationTo,
    showManual: (name) => animPanel.select(name),
    onSelect: (id) => {
      if (id !== pfMotion) {
        pfMotion = id;
        runPreflight();
      }
    }
  });
  autoAnimate = initAutoAnimate({
    $,
    directions,
    F: frameSize,
    frameOf: (spec) => framePixels(sprite2, { spec, px: null, dur: null }, opts()),
    setAnim: addAnimationTo,
    handEdited: (dir, name) => {
      const t = timeline.anims[rowName(name, dir, mainDir())];
      return !!(t && t.frames.some((f) => f.px));
    }
  });
  preflightPanel = initPreflightPanel({ $, onFix: preflightFix });
  runPreflight();
  var playPos = 0;
  function togglePlay() {
    playing = !playing;
    if (playing) {
      const a = timeline.anims[anim], o = playOpts(a), seq = playSequence(a.frames.length, o);
      if (!a.loop && playPos >= seq.length - 1 && seq[seq.length - 1] === frameIdx) {
        playPos = 0;
        frameIdx = seq[0];
        stageDirty = true;
      } else if (seq[playPos] !== frameIdx) playPos = posOf(frameIdx, a.frames.length, o);
      lastT = performance.now();
    }
    syncControls();
  }
  function advanceFrame() {
    const a = timeline.anims[anim], n = a.frames.length, o = playOpts(a), seq = playSequence(n, o);
    if (seq[playPos] !== frameIdx) playPos = posOf(frameIdx, n, o);
    const r = step(playPos, n, o);
    if (r.done) {
      playing = false;
      syncControls();
      return;
    }
    playPos = r.pos;
    frameIdx = r.frame;
  }
  function infoText() {
    const F = frameSize(), a = timeline.anims[anim];
    const m = modeOf(a), rp = repeatOf(a);
    return `${F}\xD7${F} px \xB7 frame ${frameIdx + 1}/${a.frames.length}${m !== "forward" ? " \xB7 " + MODE_LABEL[m] : ""}${a.loop ? "" : rp > 1 ? ` \xB7 plays ${rp} times` : " \xB7 plays once"} \xB7 ${sprite2.meta.desc || ""}${sprite2.meta.motion === "generated" ? " \xB7 generated motion" : ""}`;
  }
  var livePreview = createLivePreview({
    box: $("#livePreview"),
    canvas: $("#liveCanvas"),
    playBtn: $("#livePlay"),
    scaleSel: $("#liveScale"),
    playing: !reduced,
    source() {
      if (!editMode || !sprite2 || !timeline) return null;
      const a = timeline.anims[anim], F = frameSize();
      return { n: a.frames.length, opts: playOpts(a), dur: (i) => frameMs(timeline, anim, i, state.fps), image: (i) => framesFor(anim)[i].cv, w: F, h: F, scale: state.previewScale };
    },
    onScale: (v) => {
      state.previewScale = v;
      saveState();
    }
  });
  function spriteShownColours() {
    const set = /* @__PURE__ */ new Set();
    for (const n of timeline.order) for (const f of framesFor(n)) for (const c of f.out) if (c) set.add(c);
    return [...set].sort((a, b) => lum(a) - lum(b)).slice(0, 64);
  }
  var variantEditor = createVariantEditor({
    $,
    prefix: "var",
    get: () => variants,
    colours: spriteShownColours,
    shown: () => shownVariant,
    say: toast,
    set(list) {
      if (list === variants) return;
      variants = list;
      if (!curVariant()) shownVariant = "";
      markProjectDirty();
      stageDirty = sheetDirty = true;
      variantEditor.render();
    },
    onShow(name) {
      shownVariant = name;
      stageDirty = sheetDirty = true;
      variantEditor.render();
    }
  });
  variantEditor.render();
  var rotPreview = createRotationPreview({
    box: $("#rotPreview"),
    canvas: $("#rotCanvas"),
    layoutSel: $("#rotLayout"),
    playBtn: $("#rotPlay"),
    playing: !reduced,
    source() {
      if (!sprite2 || !timeline || !hasImported() || !viewDirs().length) return null;
      const main = mainDir();
      let base = anim;
      for (const d of viewDirs()) if (anim.endsWith("_" + d.toLowerCase())) {
        base = anim.slice(0, -(d.length + 1));
        break;
      }
      const views = [main, ...viewDirs()].map((d) => ({ dir: d, row: rowName(base, d, main) })).filter((v) => timeline.anims[v.row]);
      if (views.length < 2) return null;
      const lead = views[0].row, a = timeline.anims[lead], F = frameSize();
      return {
        n: a.frames.length,
        opts: playOpts(a),
        dur: (i) => frameMs(timeline, lead, i, state.fps),
        w: F,
        h: F,
        scale: F <= 52 ? 2 : 1,
        views: views.map((v) => ({ dir: v.dir, frames: timeline.anims[v.row].frames.length, image: (i) => framesFor(v.row)[i].cv }))
      };
    }
  });
  var lastT = 0;
  var thumbFrame = 0;
  var lastThumbT = 0;
  function tick(t) {
    requestAnimationFrame(tick);
    if (!sprite2) return;
    const step2 = 1e3 / state.fps;
    let dur = playing && !editMode ? frameMs(timeline, anim, frameIdx, state.fps) : 0;
    if (playing && !editMode && t - lastT >= dur) {
      if (t - lastT > dur * 4) {
        lastT = t;
        advanceFrame();
      } else {
        let guard = 0;
        while (playing && t - lastT >= dur && guard++ < 64) {
          lastT += dur;
          advanceFrame();
          dur = frameMs(timeline, anim, frameIdx, state.fps);
        }
      }
      stageDirty = true;
      const btns = $("#strip").children;
      for (let i = 0; i < btns.length; i++) btns[i].setAttribute("aria-pressed", String(i === frameIdx));
      $("#frameInfo").textContent = infoText();
      renderTimelineBar();
    }
    if (stageDirty) {
      stageDirty = false;
      drawStage();
    }
    if (sheetDirty) {
      sheetDirty = false;
      drawSheetPreview();
    }
    if (autosaveDue && t - lastAutosave > 400) {
      lastAutosave = t;
      autosave();
    }
    if (!reduced && t - lastThumbT >= step2 * 1.5) {
      lastThumbT = t;
      thumbFrame++;
      for (const tb of thumbs) {
        if (!tb.frames) continue;
        const ctx = tb.c.getContext("2d");
        ctx.clearRect(0, 0, tb.c.width, tb.c.height);
        ctx.drawImage(tb.frames[thumbFrame % tb.frames.length], 0, 0);
      }
    }
  }
  (() => {
    const s = generate("creature", 12, "foundry", "foundry");
    const out = renderFrame(s, {}, { outline: "tinted", pal: "free" });
    const c = $("#logo");
    c.getContext("2d").drawImage(toCanvas(out, 16), 0, 0);
  })();
  window.__sf = {
    generate,
    renderFrame,
    encodeGIF,
    sheetLayout,
    PAD,
    configure(cfg) {
      Object.assign(state, cfg);
      regenerate();
    },
    buildSheet,
    gifFor,
    framesFor,
    frameSize,
    restFrame: (view) => renderFrame(sprite2, { pose: {}, ...view ? { view } : {} }, opts()),
    get state() {
      return state;
    },
    get sprite() {
      return sprite2;
    },
    get anim() {
      return anim;
    },
    get frameIdx() {
      return frameIdx;
    },
    get playing() {
      return playing;
    },
    get editMode() {
      return editMode;
    },
    // U8: one stage redraw, timed (ms); fresh = after an edit (the frames are drawn again)
    tick() {
      advanceFrame();
      return { frame: frameIdx, playing };
    },
    // V1: one playback step
    replaceColour: replaceColour2,
    // V2
    workshopExportAll() {
      return workshopPanel.exportFiles();
    },
    asepriteFile,
    // V3: bytes, in the page                // V2: blobs, in the page
    get directionsChecked() {
      return lastDirViews.slice();
    },
    // V4
    get variants() {
      return JSON.parse(JSON.stringify(variants));
    },
    get shownVariant() {
      return shownVariant;
    },
    frameIn(name, i) {
      return frameIn(name, i, curVariant()).out;
    },
    get livePreview() {
      return livePreview.info();
    },
    get rotationPreview() {
      return rotPreview.info();
    },
    redrawMs(fresh2 = false) {
      if (fresh2) cache.clear();
      const t = performance.now();
      drawStage();
      return performance.now() - t;
    },
    get tool() {
      return tool;
    },
    get paintColor() {
      return paintColor;
    },
    get selection() {
      return selection ? { ...selection } : null;
    },
    get clipboard() {
      return clipboard2 ? { w: clipboard2.w, h: clipboard2.h, from: clipboard2.from } : null;
    },
    get undoDepth() {
      return undo.length;
    },
    get redoDepth() {
      return redo.length;
    },
    get edited() {
      return edited;
    },
    buildExport,
    get customPalette() {
      return state.customPalette;
    },
    get editTarget() {
      return editTarget;
    },
    get activeLayer() {
      return activeLayer;
    },
    get layerOrder() {
      return sprite2.order.slice();
    },
    get zoom() {
      return zoom;
    },
    get sheetRows() {
      return sheetRows();
    },
    get timeline() {
      return timeline;
    },
    get importInfo() {
      return importPanel.info();
    },
    get bgInfo() {
      return bgPanel.info();
    },
    bgMask() {
      return bgPanel.mask();
    },
    get convInfo() {
      return convPanel.info();
    },
    convPixels() {
      return convPanel.pixels();
    },
    get imported() {
      return importedAsset ? {
        N: hasImported() ? importedAsset.rest.N : null,
        palette: hasImported() ? importedAsset.rest.palette.slice() : null,
        versions: importedAsset.history.map((v) => v.label),
        direction: mainDir(),
        active: curView() || mainDir(),
        views: viewDirs().map((d) => ({ direction: d, hasSprite: !!viewOf(d).rest, anims: Object.keys(viewOf(d).rest && viewOf(d).rest.anims || {}), versions: (viewOf(d).history || []).map((v) => v.label) }))
      } : null;
    },
    switchDirection,
    directions,
    get autosaveReduced() {
      return autosaveReduced;
    },
    get partsInfo() {
      return partsPanel.info();
    },
    partOwner(x, y) {
      return partsPanel.ownerAt(x, y);
    },
    get rigInfo() {
      return rigPanel.info();
    },
    get animInfo() {
      return animPanel.info();
    },
    get autoAnimate() {
      return autoAnimate.info();
    },
    get templateInfo() {
      return templatePanel.info();
    },
    get help() {
      return helpPanel.info();
    },
    get preflight() {
      return preflightPanel ? preflightPanel.info() : null;
    },
    get artInfo() {
      return artPanel.info();
    },
    get workshopInfo() {
      return workshopPanel.info();
    },
    workshopPixels(l) {
      return workshopPanel.pixels(l);
    },
    async workshopExport() {
      const x = await workshopPanel.exportFiles();
      if (!x) return null;
      const png = await new Promise((r) => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(x.png);
      });
      return { name: x.name, plan: x.plan, png, json: x.json, readme: x.readme };
    },
    workshop() {
      return workshopPanel.get();
    },
    get restoring() {
      return restoring;
    },
    get projectDirty() {
      return projectDirty;
    },
    get guardOpen() {
      return !$("#guard").hidden;
    },
    currentProject,
    get check() {
      return lastCheck;
    },
    recheck() {
      sheetDirty = true;
    },
    get thumbs() {
      return thumbs.map((t) => ({ seed: t.seed, type: t.s.type, cls: t.s.meta.hero ? t.s.meta.hero.cls : null, parts: t.s.meta.hero ? t.s.meta.hero.parts : null }));
    }
  };
  (() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const v = validateProject(JSON.parse(raw));
        if (!v.errors.length) {
          applyProject(v.project);
          restored = true;
        } else showProjectMessages("warning", ["The last session could not be restored, so a fresh sprite was generated.", ...v.errors]);
      }
    } catch (e) {
    }
    if (!restored) {
      setCustomPalette(state.customPalette);
      regenerate(true);
      buildThumbs();
      renderCustomPalette();
    }
    renderProjectStatus();
  })();
  requestAnimationFrame(tick);
